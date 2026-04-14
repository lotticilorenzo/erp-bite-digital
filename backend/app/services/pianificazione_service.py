import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.models import (
    Pianificazione, PianificazioneLavorazione, Cliente, Commessa, 
    CommessaProgetto, User, PianificazioneStatus, ClientStartDayType
)
from app.schemas.schemas import PianificazioneCreate, PianificazioneUpdate
from app.services.services import write_audit, get_commessa

async def calcola_metriche_pianificazione(pianificazione: Pianificazione) -> dict:
    costo_totale = Decimal("0")
    for lav in pianificazione.lavorazioni:
        costo_totale += (lav.ore_previste or Decimal("0")) * (lav.costo_orario_snapshot or Decimal("0"))
    
    budget = pianificazione.budget or Decimal("0")
    margine_euro = budget - costo_totale
    margine_percentuale = 0
    if budget > 0:
        margine_percentuale = round(float((margine_euro / budget) * 100), 2)
    
    return {
        "costo_totale": costo_totale,
        "margine_euro": margine_euro,
        "margine_percentuale": margine_percentuale
    }

async def list_pianificazioni(db: AsyncSession, cliente_id: Optional[uuid.UUID] = None, stato: Optional[PianificazioneStatus] = None) -> List[Pianificazione]:
    q = select(Pianificazione).options(
        selectinload(Pianificazione.cliente),
        selectinload(Pianificazione.lavorazioni).selectinload(PianificazioneLavorazione.user)
    )
    if cliente_id:
        q = q.where(Pianificazione.cliente_id == cliente_id)
    if stato:
        q = q.where(Pianificazione.stato == stato)
    
    result = await db.execute(q.order_by(Pianificazione.created_at.desc()))
    return result.unique().scalars().all()

async def get_pianificazione(db: AsyncSession, pianificazione_id: uuid.UUID) -> Optional[Pianificazione]:
    q = select(Pianificazione).options(
        selectinload(Pianificazione.cliente),
        selectinload(Pianificazione.lavorazioni).selectinload(PianificazioneLavorazione.user)
    ).where(Pianificazione.id == pianificazione_id)
    
    result = await db.execute(q)
    return result.unique().scalar_one_or_none()

async def create_pianificazione(db: AsyncSession, data: PianificazioneCreate, by_user_id: uuid.UUID) -> Pianificazione:
    # Get current hourly costs for collaborators
    user_ids = [lav.user_id for lav in data.lavorazioni]
    users_q = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u.costo_orario or Decimal("0") for u in users_q.scalars().all()}

    p = Pianificazione(
        cliente_id=data.cliente_id,
        budget=data.budget,
        note=data.note,
        stato=data.stato
    )
    db.add(p)
    await db.flush()

    for lav_data in data.lavorazioni:
        lav = PianificazioneLavorazione(
            pianificazione_id=p.id,
            tipo_lavorazione=lav_data.tipo_lavorazione,
            user_id=lav_data.user_id,
            ore_previste=lav_data.ore_previste,
            costo_orario_snapshot=users_map.get(lav_data.user_id, Decimal("0"))
        )
        db.add(lav)

    await write_audit(db, by_user_id, "pianificazioni", p.id, "CREATE", dopo=data.model_dump())
    await db.flush()
    return await get_pianificazione(db, p.id)

async def update_pianificazione(db: AsyncSession, pianificazione_id: uuid.UUID, data: PianificazioneUpdate, by_user_id: uuid.UUID) -> Optional[Pianificazione]:
    p = await get_pianificazione(db, pianificazione_id)
    if not p:
        return None
    
    prima = {"budget": str(p.budget), "stato": p.stato}
    
    update_data = data.model_dump(exclude_none=True)
    lavorazioni_data = update_data.pop("lavorazioni", None)

    for field, val in update_data.items():
        setattr(p, field, val)
    
    if lavorazioni_data is not None:
        # Simple implementation: delete and recreate lavorazioni
        await db.execute(text("DELETE FROM pianificazione_lavorazioni WHERE pianificazione_id = :pid"), {"pid": p.id})
        
        user_ids = [lav["user_id"] for lav in lavorazioni_data]
        users_q = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u.costo_orario or Decimal("0") for u in users_q.scalars().all()}

        for lav_item in lavorazioni_data:
            lav = PianificazioneLavorazione(
                pianificazione_id=p.id,
                tipo_lavorazione=lav_item["tipo_lavorazione"],
                user_id=lav_item["user_id"],
                ore_previste=lav_item["ore_previste"],
                costo_orario_snapshot=users_map.get(lav_item["user_id"], Decimal("0"))
            )
            db.add(lav)

    await write_audit(db, by_user_id, "pianificazioni", p.id, "UPDATE", prima=prima, dopo=update_data)
    await db.flush()
    return await get_pianificazione(db, p.id)

async def delete_pianificazione(db: AsyncSession, pianificazione_id: uuid.UUID, by_user_id: uuid.UUID) -> bool:
    p = await get_pianificazione(db, pianificazione_id)
    if not p:
        return False
    
    if p.stato == PianificazioneStatus.CONVERTED:
        raise HTTPException(status_code=400, detail="Impossibile eliminare una pianificazione già convertita in commessa.")
    
    await write_audit(db, by_user_id, "pianificazioni", p.id, "DELETE", prima={"budget": str(p.budget)})
    await db.delete(p)
    await db.flush()
    return True

async def convert_pianificazione_to_commessa(db: AsyncSession, pianificazione_id: uuid.UUID, mese_competenza: date, by_user: User) -> Commessa:
    p = await get_pianificazione(db, pianificazione_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pianificazione non trovata")
    
    if p.stato == PianificazioneStatus.CONVERTED:
        raise HTTPException(status_code=400, detail="Pianificazione già convertita")

    cliente = p.cliente
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")

    # Date calculation
    mese_norm = mese_competenza.replace(day=1)
    if cliente.start_day_type == ClientStartDayType.STANDARD_1:
        data_inizio = mese_norm
        next_month = (mese_norm + timedelta(days=32)).replace(day=1)
        data_fine = next_month - timedelta(days=1)
    else: # CROSS_15
        data_inizio = mese_norm.replace(day=15)
        next_month_15 = (data_inizio + timedelta(days=32)).replace(day=15)
        data_fine = next_month_15 - timedelta(days=1)

    # Check for existing commessa for this client and mese
    existing = await db.execute(
        select(Commessa).where(
            and_(
                Commessa.cliente_id == p.cliente_id,
                Commessa.mese_competenza == mese_norm
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Esiste già una commessa per questo cliente in questo mese")

    # Create Commessa
    commessa = Commessa(
        cliente_id=p.cliente_id,
        mese_competenza=mese_norm,
        data_inizio=data_inizio,
        data_fine=data_fine,
        valore_fatturabile_override=p.budget,
        pianificazione_id=p.id,
        note=f"Convertita da Pianificazione del {p.created_at.strftime('%d/%m/%Y')}. {p.note or ''}"
    )
    db.add(commessa)
    await db.flush()

    # Update Planning status
    p.stato = PianificazioneStatus.CONVERTED
    
    await write_audit(db, by_user.id, "pianificazioni", p.id, "CONVERT", dopo={"commessa_id": str(commessa.id)})
    await db.flush()
    
    return await get_commessa(db, commessa.id)

from sqlalchemy import text
