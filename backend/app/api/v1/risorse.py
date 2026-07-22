from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List
import uuid

from datetime import date

from app.db.session import get_db
from app.core.security import get_current_user, require_roles, require_finance_access, has_finance_access
from app.models.models import User, UserRole, Risorsa, RipartizioneSocio, RisorsaProgettoPeriodo
from app.schemas.schemas import (
    RisorsaCreate, RisorsaUpdate, RisorsaOut, RisorsaPublicOut,
    RipartizioneSocioUpsert, RipartizioneSocioOut,
    RisorsaProgettoPeriodoUpsert, RisorsaProgettoPeriodoOut,
)
from app.services.services import calcola_quota_socio

router = APIRouter(prefix="/risorse", tags=["Collaboratori"])

@router.get("", response_model=None)
async def get_risorse(
    includi_inattivi: bool = Query(False, description="Se true include anche le risorse disattivate (soft-deleted)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ritorna la lista dei membri del team (risorse) con la loro capacità e servizi.
    Di default esclude le risorse disattivate (soft-delete, attivo=False).
    A-01: solo i ruoli finance/admin vedono i dati sensibili (IBAN/CF/P.IVA/costi);
    gli altri ricevono una vista ridotta (RisorsaPublicOut).
    """
    q = select(Risorsa).options(selectinload(Risorsa.servizi)).order_by(Risorsa.nome)
    if not includi_inattivi:
        q = q.where(Risorsa.attivo == True)
    result = await db.execute(q)
    rows = result.scalars().all()
    if has_finance_access(current_user.ruolo):
        return [RisorsaOut.model_validate(r) for r in rows]
    return [RisorsaPublicOut.model_validate(r) for r in rows]

@router.get("/{risorsa_id}", response_model=None)
async def get_risorsa(
    risorsa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Risorsa)
        .where(Risorsa.id == risorsa_id)
        .options(selectinload(Risorsa.servizi))
    )
    risorsa = result.scalar_one_or_none()
    if not risorsa:
        raise HTTPException(status_code=404, detail="Risorsa non trovata")
    # A-01: dati sensibili solo a finance/admin; gli altri vista ridotta.
    if has_finance_access(current_user.ruolo):
        return RisorsaOut.model_validate(risorsa)
    return RisorsaPublicOut.model_validate(risorsa)

@router.post("", response_model=RisorsaOut, status_code=status.HTTP_201_CREATED)
async def create_risorsa(
    data: RisorsaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    # Check if a risorsa with same email exists (if email provided)
    if data.email:
        existing = await db.execute(select(Risorsa).where(Risorsa.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Una risorsa con questa email esiste già")

    risorsa = Risorsa(**data.model_dump())
    db.add(risorsa)
    await db.commit()
    await db.refresh(risorsa)
    
    # Re-fetch with services
    result = await db.execute(
        select(Risorsa)
        .where(Risorsa.id == risorsa.id)
        .options(selectinload(Risorsa.servizi))
    )
    return result.scalar_one()

@router.patch("/{risorsa_id}", response_model=RisorsaOut)
async def update_risorsa(
    risorsa_id: uuid.UUID,
    data: RisorsaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    res = await db.execute(
        select(Risorsa)
        .where(Risorsa.id == risorsa_id)
        .options(selectinload(Risorsa.servizi))
    )
    risorsa = res.scalar_one_or_none()
    if not risorsa:
        raise HTTPException(status_code=404, detail="Risorsa non trovata")
    
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(risorsa, field, value)
    
    await db.commit()
    await db.refresh(risorsa)
    return risorsa

@router.delete("/{risorsa_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_risorsa(
    risorsa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    # SOFT-DELETE canonico (attivo=False): preserva lo storico finanziario e i riferimenti
    # FK (risorse_servizi, piano_commessa_righe). Per riattivare: PATCH /risorse/{id} {attivo:true}.
    res = await db.execute(select(Risorsa).where(Risorsa.id == risorsa_id))
    risorsa = res.scalar_one_or_none()
    if not risorsa:
        raise HTTPException(status_code=404, detail="Risorsa non trovata")
    
    risorsa.attivo = False
    await db.commit()
    return None


# ── RIPARTIZIONE SOCIO (spec v2 §4.6, invariante 16) ──
@router.put("/{risorsa_id}/ripartizione-socio", response_model=RipartizioneSocioOut)
async def upsert_ripartizione_socio(
    risorsa_id: uuid.UUID,
    data: RipartizioneSocioUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    risorsa = (await db.execute(select(Risorsa).where(Risorsa.id == risorsa_id))).scalar_one_or_none()
    if not risorsa:
        raise HTTPException(status_code=404, detail="Risorsa non trovata")
    if risorsa.tipologia != "socio":
        raise HTTPException(status_code=400, detail="La ripartizione si applica solo a risorse tipologia=socio")
    rip = (await db.execute(select(RipartizioneSocio).where(RipartizioneSocio.risorsa_id == risorsa_id))).scalar_one_or_none()
    if rip:
        rip.amministrativa_pct = data.amministrativa_pct
        rip.commerciale_pct = data.commerciale_pct
        rip.progettuale_pct = data.progettuale_pct
    else:
        rip = RipartizioneSocio(risorsa_id=risorsa_id, **data.model_dump())
        db.add(rip)
    await db.commit()
    await db.refresh(rip)
    return rip


@router.post("/{risorsa_id}/progetti-periodo", response_model=RisorsaProgettoPeriodoOut, status_code=status.HTTP_201_CREATED)
async def upsert_progetto_periodo(
    risorsa_id: uuid.UUID,
    data: RisorsaProgettoPeriodoUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    periodo = data.periodo.replace(day=1)
    row = (await db.execute(select(RisorsaProgettoPeriodo).where(
        RisorsaProgettoPeriodo.risorsa_id == risorsa_id, RisorsaProgettoPeriodo.progetto_id == data.progetto_id,
        RisorsaProgettoPeriodo.periodo == periodo,
    ))).scalar_one_or_none()
    if row:
        row.attivo = data.attivo
        row.override_pct = data.override_pct
    else:
        row = RisorsaProgettoPeriodo(risorsa_id=risorsa_id, progetto_id=data.progetto_id, periodo=periodo,
                                     attivo=data.attivo, override_pct=data.override_pct)
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.get("/{risorsa_id}/quota-socio", tags=["Collaboratori"])
async def get_quota_socio(
    risorsa_id: uuid.UUID,
    periodo: date = Query(..., description="YYYY-MM-DD (mese)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    """Quota progettuale del socio per progetto nel periodo (spec v2 §4.6)."""
    quote = await calcola_quota_socio(db, risorsa_id, periodo)
    return {"risorsa_id": str(risorsa_id), "periodo": str(periodo.replace(day=1)),
            "quote": {str(k): float(v) for k, v in quote.items()}, "totale": float(sum(quote.values()))}
