from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List
import uuid

from app.db.session import get_db
from app.core.security import get_current_user, require_roles, has_finance_access
from app.models.models import User, UserRole, Risorsa
from app.schemas.schemas import RisorsaCreate, RisorsaUpdate, RisorsaOut, RisorsaPublicOut

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
