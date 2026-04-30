import logging
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.models import TimesheetStatus, User, UserRole
from app.schemas.schemas import TimesheetApprova, TimesheetCreate, TimesheetOut
from app.services.services import (
    approva_timesheet,
    create_timesheet,
    list_timesheet,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/timesheet", tags=["Timesheet"])


async def _check_margin_and_notify(db: AsyncSession, commessa_id: Optional[uuid.UUID]) -> None:
    """Dopo l'inserimento di un timesheet, controlla il margine e crea notifiche se sotto soglia."""
    if not commessa_id:
        return
    try:
        from sqlalchemy.orm import selectinload as sil

        from app.models.models import Commessa, Notification
        from app.services.notification_service import create_notification

        result = await db.execute(
            select(Commessa)
            .options(
                sil(Commessa.righe_progetto),
                sil(Commessa.timesheet),
                sil(Commessa.cliente),
            )
            .where(Commessa.id == commessa_id)
        )
        c = result.unique().scalar_one_or_none()
        if not c:
            return

        costo_manodopera = float(sum(t.costo_lavoro or Decimal("0") for t in c.timesheet))
        try:
            valore_fatturabile = float(sum(r.valore_fatturabile_calc for r in c.righe_progetto))
            for ag in c.aggiustamenti or []:
                valore_fatturabile += float(ag.get("importo", 0))
        except Exception:
            valore_fatturabile = 0.0

        if valore_fatturabile <= 0:
            return

        costi_diretti = float(c.costi_diretti or 0)
        margine_euro = valore_fatturabile - costo_manodopera - costi_diretti
        margine_pct = round(margine_euro / valore_fatturabile * 100, 1)
        cliente_nome = c.cliente.ragione_sociale if c.cliente else "?"
        mese_str = c.mese_competenza.strftime("%B %Y") if c.mese_competenza else "?"

        if margine_pct < 15:
            alert_type = "CRITICAL"
            title = f"Margine critico - {cliente_nome}"
            message = f"Commessa {mese_str}: margine sceso al {margine_pct}% (soglia critica: 15%)"
        elif margine_pct < 30:
            alert_type = "WARNING"
            title = f"Attenzione margine - {cliente_nome}"
            message = f"Commessa {mese_str}: margine al {margine_pct}% (soglia warning: 30%)"
        else:
            return  # Tutto OK, nessuna notifica

        link = f"/commesse/{commessa_id}"
        month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Notifica tutti gli ADMIN e PM
        admins_result = await db.execute(select(User).where(User.ruolo.in_([UserRole.ADMIN, UserRole.PM])))
        for admin in admins_result.scalars().all():
            existing = await db.execute(
                select(Notification).where(
                    Notification.user_id == admin.id,
                    Notification.type == alert_type,
                    Notification.link == link,
                    Notification.created_at >= month_start,
                )
            )
            if existing.scalar_one_or_none():
                continue
            await create_notification(db, admin.id, title, message, alert_type, link)

    except Exception as e:
        logger.warning(f"Errore controllo margine commessa {commessa_id}: {e}")


@router.get("", response_model=List[TimesheetOut])
async def get_timesheet(
    mese: Optional[date] = Query(None),
    stato: Optional[TimesheetStatus] = Query(None),
    commessa_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # DIPENDENTE e FREELANCER vedono solo le proprie ore
    user_filter = None
    if current_user.ruolo in (UserRole.DIPENDENTE, UserRole.FREELANCER, UserRole.COLLABORATORE):
        user_filter = current_user.id
    return await list_timesheet(db, user_filter, mese, stato, commessa_id)


@router.post("", response_model=TimesheetOut, status_code=201)
async def add_timesheet(
    data: TimesheetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ts = await create_timesheet(db, data, current_user.id)
    await _check_margin_and_notify(db, ts.commessa_id)
    return ts


@router.post("/approva", response_model=List[TimesheetOut])
async def bulk_approva(
    data: TimesheetApprova,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    return await approva_timesheet(db, data, current_user)
