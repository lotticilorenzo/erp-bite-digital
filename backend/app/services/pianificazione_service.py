import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, List, Optional

from fastapi import HTTPException
from sqlalchemy import and_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import (
    ClientStartDayType,
    Commessa,
    Notification,
    Pianificazione,
    PianificazioneLavorazione,
    PianificazioneStatus,
    Timesheet,
    User,
    UserRole,
)
from app.schemas.schemas import PianificazioneCreate, PianificazioneUpdate
from app.services.services import get_commessa, write_audit


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
        "margine_percentuale": margine_percentuale,
    }


async def list_pianificazioni(
    db: AsyncSession,
    cliente_id: Optional[uuid.UUID] = None,
    stato: Optional[PianificazioneStatus] = None,
) -> List[Pianificazione]:
    q = select(Pianificazione).options(
        selectinload(Pianificazione.cliente),
        selectinload(Pianificazione.commessa),
        selectinload(Pianificazione.lavorazioni).selectinload(PianificazioneLavorazione.user),
    )
    if cliente_id:
        q = q.where(Pianificazione.cliente_id == cliente_id)
    if stato:
        q = q.where(Pianificazione.stato == stato)

    result = await db.execute(q.order_by(Pianificazione.created_at.desc()))
    return result.unique().scalars().all()


async def get_pianificazione(db: AsyncSession, pianificazione_id: uuid.UUID) -> Optional[Pianificazione]:
    q = (
        select(Pianificazione)
        .options(
            selectinload(Pianificazione.cliente),
            selectinload(Pianificazione.commessa),
            selectinload(Pianificazione.lavorazioni).selectinload(PianificazioneLavorazione.user),
        )
        .where(Pianificazione.id == pianificazione_id)
    )

    result = await db.execute(q)
    return result.unique().scalar_one_or_none()


async def create_pianificazione(db: AsyncSession, data: PianificazioneCreate, by_user_id: uuid.UUID) -> Pianificazione:
    user_ids = [lav.user_id for lav in data.lavorazioni if lav.user_id]
    users_map: dict[uuid.UUID, Decimal] = {}
    if user_ids:
        users_q = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u.costo_orario or Decimal("0") for u in users_q.scalars().all()}

    p = Pianificazione(
        cliente_id=data.cliente_id,
        budget=data.budget,
        note=data.note,
        stato=PianificazioneStatus.PENDING,
    )
    db.add(p)
    await db.flush()

    for lav_data in data.lavorazioni:
        db.add(
            PianificazioneLavorazione(
                pianificazione_id=p.id,
                tipo_lavorazione=lav_data.tipo_lavorazione,
                user_id=lav_data.user_id,
                ore_previste=lav_data.ore_previste,
                costo_orario_snapshot=users_map.get(lav_data.user_id, Decimal("0")),
            )
        )

    await write_audit(
        db,
        by_user_id,
        "pianificazioni",
        p.id,
        "CREATE",
        dopo={**data.model_dump(), "stato": "PENDING"},
    )
    await db.flush()
    return await get_pianificazione(db, p.id)


async def update_pianificazione(
    db: AsyncSession,
    pianificazione_id: uuid.UUID,
    data: PianificazioneUpdate,
    by_user_id: uuid.UUID,
) -> Optional[Pianificazione]:
    p = await get_pianificazione(db, pianificazione_id)
    if not p:
        return None

    if p.stato == PianificazioneStatus.CONVERTED:
        raise HTTPException(status_code=400, detail="Impossibile modificare una pianificazione già convertita.")

    prima = {
        "budget": str(p.budget),
        "stato": p.stato.value if hasattr(p.stato, "value") else str(p.stato),
    }

    update_data = data.model_dump(exclude_none=True)
    lavorazioni_data = update_data.pop("lavorazioni", None)
    next_status = update_data.get("stato")
    current_status = p.stato.value if hasattr(p.stato, "value") else str(p.stato)
    if next_status is not None and str(next_status) != current_status:
        raise HTTPException(status_code=400, detail="Usa le azioni dedicate per approvare o convertire la pianificazione.")

    for field, val in update_data.items():
        setattr(p, field, val)

    if lavorazioni_data is not None:
        await db.execute(
            text("DELETE FROM pianificazione_lavorazioni WHERE pianificazione_id = :pid"),
            {"pid": p.id},
        )

        user_ids = [lav["user_id"] for lav in lavorazioni_data if lav.get("user_id")]
        users_map: dict[uuid.UUID, Decimal] = {}
        if user_ids:
            users_q = await db.execute(select(User).where(User.id.in_(user_ids)))
            users_map = {u.id: u.costo_orario or Decimal("0") for u in users_q.scalars().all()}

        for lav_item in lavorazioni_data:
            db.add(
                PianificazioneLavorazione(
                    pianificazione_id=p.id,
                    tipo_lavorazione=lav_item["tipo_lavorazione"],
                    user_id=lav_item["user_id"],
                    ore_previste=lav_item["ore_previste"],
                    costo_orario_snapshot=users_map.get(lav_item["user_id"], Decimal("0")),
                )
            )

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


async def _queue_pianificazione_notifications(
    db: AsyncSession,
    *,
    title: str,
    message: str,
    link: Optional[str],
    exclude_user_id: Optional[uuid.UUID] = None,
):
    recipients_result = await db.execute(
        select(User).where(
            User.ruolo.in_([UserRole.ADMIN, UserRole.PM]),
            User.attivo == True,
        )
    )
    for recipient in recipients_result.scalars().all():
        if exclude_user_id and recipient.id == exclude_user_id:
            continue
        db.add(
            Notification(
                user_id=recipient.id,
                title=title,
                message=message,
                type="INFO",
                link=link,
            )
        )


async def approve_pianificazione(db: AsyncSession, pianificazione_id: uuid.UUID, by_user: User) -> Pianificazione:
    p = await get_pianificazione(db, pianificazione_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pianificazione non trovata")

    if p.stato != PianificazioneStatus.PENDING:
        raise HTTPException(status_code=400, detail="Si possono approvare solo pianificazioni in stato PENDING")

    p.stato = PianificazioneStatus.ACCEPTED
    await write_audit(
        db,
        by_user.id,
        "pianificazioni",
        p.id,
        "APPROVE",
        prima={"stato": "PENDING"},
        dopo={"stato": "ACCEPTED"},
    )
    await _queue_pianificazione_notifications(
        db,
        title="Pianificazione approvata",
        message=f"Pianificazione {p.cliente.ragione_sociale if p.cliente else p.id} approvata e pronta per la conversione in commessa.",
        link=f"/pianificazioni/{p.id}",
        exclude_user_id=by_user.id,
    )
    await db.flush()
    return await get_pianificazione(db, p.id)


async def convert_pianificazione_to_commessa(
    db: AsyncSession,
    pianificazione_id: uuid.UUID,
    mese_competenza: date,
    by_user: User,
) -> Commessa:
    p = await get_pianificazione(db, pianificazione_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pianificazione non trovata")

    if p.stato == PianificazioneStatus.CONVERTED:
        raise HTTPException(status_code=400, detail="Pianificazione già convertita")
    if p.stato != PianificazioneStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="La pianificazione deve essere prima approvata")

    cliente = p.cliente
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")

    mese_norm = mese_competenza.replace(day=1)
    if cliente.start_day_type == ClientStartDayType.STANDARD_1:
        data_inizio = mese_norm
        next_month = (mese_norm + timedelta(days=32)).replace(day=1)
        data_fine = next_month - timedelta(days=1)
    else:
        data_inizio = mese_norm.replace(day=15)
        next_month_15 = (data_inizio + timedelta(days=32)).replace(day=15)
        data_fine = next_month_15 - timedelta(days=1)

    existing = await db.execute(
        select(Commessa).where(
            and_(
                Commessa.cliente_id == p.cliente_id,
                Commessa.mese_competenza == mese_norm,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Esiste già una commessa per questo cliente in questo mese")

    commessa = Commessa(
        cliente_id=p.cliente_id,
        mese_competenza=mese_norm,
        data_inizio=data_inizio,
        data_fine=data_fine,
        valore_fatturabile_override=p.budget,
        pianificazione_id=p.id,
        note=f"Convertita da Pianificazione del {p.created_at.strftime('%d/%m/%Y')}. {p.note or ''}",
    )
    db.add(commessa)
    await db.flush()

    p.stato = PianificazioneStatus.CONVERTED

    await write_audit(
        db,
        by_user.id,
        "pianificazioni",
        p.id,
        "CONVERT",
        prima={"stato": "ACCEPTED"},
        dopo={"stato": "CONVERTED", "commessa_id": str(commessa.id)},
    )
    await _queue_pianificazione_notifications(
        db,
        title="Pianificazione convertita",
        message=f"Pianificazione {cliente.ragione_sociale} convertita in commessa operativa.",
        link=f"/commesse/{commessa.id}",
        exclude_user_id=by_user.id,
    )
    await db.flush()

    return await get_commessa(db, commessa.id)


async def get_pianificazione_delta(db: AsyncSession, pianificazione_id: uuid.UUID) -> dict[str, Any]:
    p = await get_pianificazione(db, pianificazione_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pianificazione non trovata")

    planned_rows: dict[str, dict[str, Any]] = {}
    planned_hours_total = Decimal("0")
    planned_cost_total = Decimal("0")

    for lav in p.lavorazioni:
        key = str(lav.user_id)
        label = f"{lav.user.nome} {lav.user.cognome}" if lav.user else lav.tipo_lavorazione
        row = planned_rows.setdefault(
            key,
            {
                "key": key,
                "label": label,
                "planned_hours": Decimal("0"),
                "planned_cost": Decimal("0"),
                "actual_hours": Decimal("0"),
                "actual_cost": Decimal("0"),
            },
        )
        planned_hours = Decimal(str(lav.ore_previste or 0))
        planned_cost = planned_hours * Decimal(str(lav.costo_orario_snapshot or 0))
        row["planned_hours"] += planned_hours
        row["planned_cost"] += planned_cost
        planned_hours_total += planned_hours
        planned_cost_total += planned_cost

    commessa_id = p.commessa.id if p.commessa else None
    actual_hours_total = Decimal("0")
    actual_cost_total = Decimal("0")

    if commessa_id:
        timesheets_result = await db.execute(
            select(Timesheet)
            .options(selectinload(Timesheet.user))
            .where(Timesheet.commessa_id == commessa_id)
        )
        for ts in timesheets_result.scalars().all():
            key = str(ts.user_id)
            label = f"{ts.user.nome} {ts.user.cognome}" if ts.user else f"Utente {str(ts.user_id)[:8]}"
            row = planned_rows.setdefault(
                key,
                {
                    "key": key,
                    "label": label,
                    "planned_hours": Decimal("0"),
                    "planned_cost": Decimal("0"),
                    "actual_hours": Decimal("0"),
                    "actual_cost": Decimal("0"),
                },
            )
            actual_hours = Decimal(str(ts.durata_minuti or 0)) / Decimal("60")
            if ts.costo_lavoro is not None:
                actual_cost = Decimal(str(ts.costo_lavoro))
            else:
                hourly_rate = Decimal(
                    str(
                        ts.costo_orario_snapshot
                        or (ts.user.costo_orario if ts.user and ts.user.costo_orario is not None else 0)
                    )
                )
                actual_cost = actual_hours * hourly_rate
            row["actual_hours"] += actual_hours
            row["actual_cost"] += actual_cost
            actual_hours_total += actual_hours
            actual_cost_total += actual_cost

    rows = []
    for row in planned_rows.values():
        planned_hours = row["planned_hours"]
        planned_cost = row["planned_cost"]
        actual_hours = row["actual_hours"]
        actual_cost = row["actual_cost"]
        delta_hours = actual_hours - planned_hours
        delta_cost = actual_cost - planned_cost
        rows.append(
            {
                "key": row["key"],
                "label": row["label"],
                "planned_hours": round(float(planned_hours), 2),
                "planned_cost": round(float(planned_cost), 2),
                "actual_hours": round(float(actual_hours), 2),
                "actual_cost": round(float(actual_cost), 2),
                "delta_hours": round(float(delta_hours), 2),
                "delta_cost": round(float(delta_cost), 2),
                "delta_hours_pct": round(float((delta_hours / planned_hours) * 100), 2) if planned_hours > 0 else None,
                "delta_cost_pct": round(float((delta_cost / planned_cost) * 100), 2) if planned_cost > 0 else None,
            }
        )

    rows.sort(key=lambda item: item["label"])
    delta_hours_total = actual_hours_total - planned_hours_total
    delta_cost_total = actual_cost_total - planned_cost_total

    return {
        "pianificazione_id": str(p.id),
        "commessa_id": str(commessa_id) if commessa_id else None,
        "has_commessa": bool(commessa_id),
        "summary": {
            "planned_hours": round(float(planned_hours_total), 2),
            "planned_cost": round(float(planned_cost_total), 2),
            "actual_hours": round(float(actual_hours_total), 2),
            "actual_cost": round(float(actual_cost_total), 2),
            "delta_hours": round(float(delta_hours_total), 2),
            "delta_cost": round(float(delta_cost_total), 2),
            "delta_hours_pct": round(float((delta_hours_total / planned_hours_total) * 100), 2) if planned_hours_total > 0 else None,
            "delta_cost_pct": round(float((delta_cost_total / planned_cost_total) * 100), 2) if planned_cost_total > 0 else None,
        },
        "rows": rows,
    }
