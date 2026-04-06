import uuid
import logging
from datetime import datetime, date, timedelta
from typing import Optional, List
from sqlalchemy import select, and_, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Notification, User, UserRole, Task, TaskStatus,
    FatturaAttiva, Timesheet, TimesheetStatus, TimerSession,
    Commessa, Cliente
)

logger = logging.getLogger(__name__)

async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    message: str,
    type: str = "INFO",
    link: Optional[str] = None
) -> Optional[Notification]:
    """
    Crea una notifica evitando duplicati non letti nelle ultime 24 ore.
    """
    yesterday = datetime.now() - timedelta(days=1)
    
    # Controllo duplicati: stessa notifica non letta per lo stesso utente nelle ultime 24h
    stmt = select(Notification).where(
        Notification.user_id == user_id,
        Notification.type == type,
        Notification.message == message,
        Notification.is_read == False,
        Notification.created_at >= yesterday
    )
    result = await db.execute(stmt)
    if result.scalars().first():
        return None

    new_notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        link=link
    )
    db.add(new_notif)
    await db.commit()
    return new_notif

async def notify_tasks_due_today(db: AsyncSession):
    """Notifica i task in scadenza oggi agli assegnatari."""
    today = date.today()
    stmt = select(Task).where(
        Task.data_scadenza == today,
        Task.assegnatario_id.is_not(None),
        ~Task.stato.in_([TaskStatus.PRONTO, TaskStatus.PROGRAMMATO, TaskStatus.PUBBLICATO])
    )
    res = await db.execute(stmt)
    tasks = res.scalars().all()
    
    for t in tasks:
        await create_notification(
            db,
            user_id=t.assegnatario_id,
            title="Task in scadenza oggi",
            message=f"Il task '{t.titolo}' scade oggi",
            type="AVVISO",
            link="/studio-os"
        )

async def notify_tasks_overdue(db: AsyncSession):
    """Notifica i task scaduti ieri agli assegnatari."""
    yesterday = date.today() - timedelta(days=1)
    stmt = select(Task).where(
        Task.data_scadenza == yesterday,
        Task.assegnatario_id.is_not(None),
        ~Task.stato.in_([TaskStatus.PRONTO, TaskStatus.PROGRAMMATO, TaskStatus.PUBBLICATO])
    )
    res = await db.execute(stmt)
    tasks = res.scalars().all()
    
    for t in tasks:
        await create_notification(
            db,
            user_id=t.assegnatario_id,
            title="Task scaduto",
            message=f"Il task '{t.titolo}' è scaduto ieri",
            type="URGENTE",
            link="/studio-os"
        )

async def notify_unpaid_invoices(db: AsyncSession):
    """Notifica fatture scadute non pagate agli ADMIN."""
    today = date.today()
    # Trova fatture scadute in attesa
    from sqlalchemy.orm import selectinload
    stmt = select(FatturaAttiva).options(selectinload(FatturaAttiva.cliente)).where(
        FatturaAttiva.stato_pagamento == "ATTESA",
        FatturaAttiva.data_scadenza < today
    )
    res = await db.execute(stmt)
    invoices = res.scalars().all()
    
    if not invoices:
        return

    # Trova tutti gli admin
    admin_stmt = select(User).where(User.ruolo == UserRole.ADMIN, User.attivo == True)
    admin_res = await db.execute(admin_stmt)
    admins = admin_res.scalars().all()
    
    for inv in invoices:
        cliente_nome = "Cliente"
        if inv.cliente:
            cliente_nome = inv.cliente.ragione_sociale
        
        for admin in admins:
            await create_notification(
                db,
                user_id=admin.id,
                title="Fattura scaduta non pagata",
                message=f"La fattura {inv.numero or ''} di {cliente_nome} è scaduta",
                type="FATTURA",
                link="/fatture"
            )

async def notify_pending_timesheets(db: AsyncSession):
    """Notifica aggregata per i timesheet da approvare agli ADMIN."""
    # Conta timesheet PENDING
    stmt = select(func.count(Timesheet.id)).where(Timesheet.stato == TimesheetStatus.PENDING)
    res = await db.execute(stmt)
    count = res.scalar_one()
    
    if count == 0:
        return

    # Trova tutti gli admin
    admin_stmt = select(User).where(User.ruolo == UserRole.ADMIN, User.attivo == True)
    admin_res = await db.execute(admin_stmt)
    admins = admin_res.scalars().all()
    
    for admin in admins:
        await create_notification(
            db,
            user_id=admin.id,
            title="Timesheet in attesa di approvazione",
            message=f"Ci sono {count} timesheet da approvare",
            type="APPROVAZIONE",
            link="/timesheet"
        )

async def notify_long_timers(db: AsyncSession):
    """Notifica timer attivi da più di 4 ore."""
    limit = datetime.now() - timedelta(hours=4)
    stmt = select(TimerSession).where(
        TimerSession.stopped_at.is_(None),
        TimerSession.started_at < limit
    )
    res = await db.execute(stmt)
    sessions = res.scalars().all()
    
    for sess in sessions:
        hours = (datetime.now() - sess.started_at).seconds // 3600
        await create_notification(
            db,
            user_id=sess.user_id,
            title="Timer attivo da più di 4 ore",
            message=f"Hai un timer attivo da {hours} ore",
            type="AVVISO",
            link="/studio-os"
        )

async def check_commessa_scope_creep(db: AsyncSession, commessa_id: uuid.UUID):
    """Controlla se la commessa ha superato l'80% o il 100% delle ore contratto."""
    from sqlalchemy.orm import selectinload
    stmt = select(Commessa).options(selectinload(Commessa.cliente)).where(Commessa.id == commessa_id)
    res = await db.execute(stmt)
    c = res.scalar_one_or_none()
    if not c or not c.ore_contratto or c.ore_contratto <= 0:
        return

    # Calcola ore reali
    ts_stmt = select(func.sum(Timesheet.durata_minuti)).where(Timesheet.commessa_id == commessa_id)
    ts_res = await db.execute(ts_stmt)
    minuti_totali = ts_res.scalar_one() or 0
    ore_reali = minuti_totali / 60

    percentuale = (ore_reali / float(c.ore_contratto)) * 100
    
    # Trova admin e PM per le notifiche
    staff_stmt = select(User).where(User.ruolo.in_([UserRole.ADMIN, UserRole.PM]), User.attivo == True)
    staff_res = await db.execute(staff_stmt)
    staff_members = staff_res.scalars().all()

    cliente_nome = c.cliente.ragione_sociale if c.cliente else "N/A"
    link = f"/commesse/{c.id}"

    if percentuale >= 100:
        for s in staff_members:
            await create_notification(
                db, user_id=s.id,
                title="SFORAMENTO SCOPE",
                message=f"La commessa {cliente_nome} ha superato lo scope di {ore_reali - float(c.ore_contratto):.1f} ore",
                type="URGENTE", link=link
            )
    elif percentuale >= 80:
        for s in staff_members:
            await create_notification(
                db, user_id=s.id,
                title="Avviso Scope 80%",
                message=f"La commessa {cliente_nome} ha consumato l'80% delle ore incluse ({ore_reali:.1f}/{c.ore_contratto:.1f})",
                type="AVVISO", link=link
            )

async def notify_critical_health_clienti(db: AsyncSession):
    """Notifica clienti con Health Score critico (< 40)."""
    from app.services.services import list_clienti, get_client_health_score
    clienti = await list_clienti(db, attivo=True)
    
    # Trova admin
    admin_stmt = select(User).where(User.ruolo == UserRole.ADMIN, User.attivo == True)
    admin_res = await db.execute(admin_stmt)
    admins = admin_res.scalars().all()

    for c in clienti:
        health = await get_client_health_score(db, c.id)
        if health["score"] < 40:
            for admin in admins:
                await create_notification(
                    db, user_id=admin.id,
                    title="Salute Cliente Critica",
                    message=f"Il cliente {c.ragione_sociale} ha un health score di {health['score']}/100",
                    type="URGENTE", link=f"/clienti/{c.id}"
                )

async def check_and_create_notifications(db: AsyncSession):
    """Controlla tutti gli eventi giornalieri e genera notifiche."""
    try:
        await notify_tasks_due_today(db)
        await notify_tasks_overdue(db)
        await notify_unpaid_invoices(db)
        await notify_pending_timesheets(db)
        await notify_critical_health_clienti(db)
        logger.info("Controllo notifiche giornaliere completato.")
    except Exception as e:
        logger.error(f"Errore durante il controllo notifiche giornaliere: {e}")

async def check_hourly_notifications(db: AsyncSession):
    """Controlla notifiche orarie (es. timer)."""
    try:
        await notify_long_timers(db)
    except Exception as e:
        logger.error(f"Errore durante il controllo notifiche orarie: {e}")
