"""
services.py — Tutta la business logic separata dagli endpoint.
"""
import uuid
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional, List
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload

from app.models.models import (
    User, Cliente, Progetto, Commessa, CommessaProgetto, Timesheet, Task,
    Costo, AuditLog, CoefficienteAllocazione,
    Fornitore, FatturaAttiva, FatturaPassiva, FicSyncRun,
    UserRole, CommessaStatus, TimesheetStatus
)
from app.schemas.schemas import (
    UserCreate, UserUpdate, ClienteCreate, ClienteUpdate,
    ProgettoCreate, ProgettoUpdate, CommessaCreate, CommessaUpdate,
    TimesheetCreate, CostoCreate, CoefficienteCreate, TimesheetApprova
)
from app.core.config import settings
from app.core.security import hash_password

DEFAULT_COEFFICIENTE_ALLOCAZIONE = Decimal("0.30")
FIC_SYNC_LOCK_KEY = "fic_sync_lock_v1"
FIC_PAGE_SIZE = 100
logger = logging.getLogger(__name__)


async def get_coefficiente_allocazione(db: AsyncSession, mese: date) -> Decimal:
    """Restituisce il coefficiente del mese; fallback 30% se non configurato."""
    mese_norm = mese.replace(day=1)
    result = await db.execute(
        select(CoefficienteAllocazione).where(
            CoefficienteAllocazione.mese_competenza == mese_norm
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        return DEFAULT_COEFFICIENTE_ALLOCAZIONE

    coeff = record.coefficiente
    if coeff is None:
        return DEFAULT_COEFFICIENTE_ALLOCAZIONE
    return Decimal(coeff)


async def calcola_metriche_commessa(
    db: AsyncSession,
    commessa: Commessa,
    coeff_cache: Optional[dict[date, Decimal]] = None,
) -> dict:
    """
    Calcolo marginalità:
    (Fatturabile - (manodopera diretta + costi diretti + quota indiretti)) / Fatturabile
    """
    mese_norm = commessa.mese_competenza.replace(day=1)
    coefficiente = coeff_cache.get(mese_norm) if coeff_cache is not None else None
    if coefficiente is None:
        coefficiente = await get_coefficiente_allocazione(db, mese_norm)
        if coeff_cache is not None:
            coeff_cache[mese_norm] = coefficiente

    valore_fatturabile = commessa.valore_fatturabile_calc
    costo_manodopera = commessa.costo_manodopera or Decimal("0")
    costi_diretti = commessa.costi_diretti or Decimal("0")
    costi_indiretti = costo_manodopera * coefficiente
    margine_euro = valore_fatturabile - (costo_manodopera + costi_diretti + costi_indiretti)

    margine_percentuale = None
    if valore_fatturabile and valore_fatturabile > 0:
        margine_percentuale = round(float((margine_euro / valore_fatturabile) * 100), 1)

    return {
        "valore_fatturabile": valore_fatturabile,
        "coefficiente_allocazione": coefficiente,
        "costi_indiretti_allocati": costi_indiretti,
        "margine_euro": margine_euro,
        "margine_percentuale": margine_percentuale,
    }


# ── AUDIT ─────────────────────────────────────────────────
async def write_audit(
    db: AsyncSession, user_id: uuid.UUID,
    tabella: str, record_id: uuid.UUID,
    azione: str, prima: dict = None, dopo: dict = None
):
    log = AuditLog(
        user_id=user_id, tabella=tabella, record_id=record_id,
        azione=azione, dati_prima=prima, dati_dopo=dopo
    )
    db.add(log)


# ── USER SERVICE ──────────────────────────────────────────
async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID | str) -> Optional[User]:
    user_uuid = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(user_id)
    result = await db.execute(select(User).where(User.id == user_uuid))
    return result.scalar_one_or_none()

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()

async def create_user(db: AsyncSession, data: UserCreate) -> User:
    user = User(
        nome=data.nome, cognome=data.cognome, email=data.email,
        password_hash=hash_password(data.password),
        ruolo=data.ruolo, costo_orario=data.costo_orario,
        data_inizio=data.data_inizio
    )
    db.add(user)
    await db.flush()
    return user

async def list_users(db: AsyncSession, attivo: Optional[bool] = None) -> List[User]:
    q = select(User)
    if attivo is not None:
        q = q.where(User.attivo == attivo)
    result = await db.execute(q.order_by(User.cognome))
    return result.scalars().all()

async def update_user(db: AsyncSession, user_id: uuid.UUID, data: UserUpdate, by_user_id: uuid.UUID) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None
    prima = {"ruolo": user.ruolo, "costo_orario": str(user.costo_orario), "attivo": user.attivo}
    payload = data.model_dump(exclude_none=True)
    new_password = payload.pop("password", None)
    for field, val in payload.items():
        setattr(user, field, val)
    if new_password:
        user.password_hash = hash_password(new_password)
    await write_audit(db, by_user_id, "users", user_id, "UPDATE", prima)
    await db.flush()
    return user


# ── CLIENTE SERVICE ───────────────────────────────────────
async def list_clienti(db: AsyncSession, attivo: Optional[bool] = None) -> List[Cliente]:
    q = select(Cliente)
    if attivo is not None:
        q = q.where(Cliente.attivo == attivo)
    result = await db.execute(q.order_by(Cliente.ragione_sociale))
    return result.scalars().all()

async def get_cliente(db: AsyncSession, cliente_id: uuid.UUID) -> Optional[Cliente]:
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    return result.scalar_one_or_none()

async def create_cliente(db: AsyncSession, data: ClienteCreate) -> Cliente:
    c = Cliente(**data.model_dump())
    db.add(c)
    await db.flush()
    return c

async def update_cliente(db: AsyncSession, cliente_id: uuid.UUID, data: ClienteUpdate, by_user_id: uuid.UUID) -> Optional[Cliente]:
    c = await get_cliente(db, cliente_id)
    if not c:
        return None
    prima = {"ragione_sociale": c.ragione_sociale, "attivo": c.attivo}
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(c, field, val)
    await write_audit(db, by_user_id, "clienti", cliente_id, "UPDATE", prima)
    await db.flush()
    return c


async def delete_cliente(db: AsyncSession, cliente_id: uuid.UUID, by_user_id: uuid.UUID) -> bool:
    c = await get_cliente(db, cliente_id)
    if not c:
        return False
    await write_audit(db, by_user_id, "clienti", cliente_id, "DELETE", {"ragione_sociale": c.ragione_sociale})
    await db.delete(c)
    await db.flush()
    return True

# ── PROGETTO SERVICE ──────────────────────────────────────
async def list_progetti(
    db: AsyncSession,
    cliente_id: Optional[uuid.UUID] = None,
    stato: Optional[str] = None
) -> List[Progetto]:
    q = select(Progetto).options(selectinload(Progetto.cliente))
    if cliente_id:
        q = q.where(Progetto.cliente_id == cliente_id)
    if stato:
        q = q.where(Progetto.stato == stato)
    result = await db.execute(q.order_by(Progetto.nome))
    return result.scalars().all()

async def get_progetto(db: AsyncSession, progetto_id: uuid.UUID) -> Optional[Progetto]:
    result = await db.execute(
        select(Progetto).options(selectinload(Progetto.cliente))
        .where(Progetto.id == progetto_id)
    )
    return result.scalar_one_or_none()

async def create_progetto(db: AsyncSession, data: ProgettoCreate) -> Progetto:
    p = Progetto(**data.model_dump())
    db.add(p)
    await db.flush()
    return p

async def update_progetto(db: AsyncSession, progetto_id: uuid.UUID, data: ProgettoUpdate, by_user_id: uuid.UUID) -> Optional[Progetto]:
    p = await get_progetto(db, progetto_id)
    if not p:
        return None
    prima = {"stato": p.stato, "importo_fisso": str(p.importo_fisso)}
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(p, field, val)
    await write_audit(db, by_user_id, "progetti", progetto_id, "UPDATE", prima)
    await db.flush()
    return p


# ── COMMESSA SERVICE ──────────────────────────────────────
async def list_commesse(
    db: AsyncSession,
    mese: Optional[date] = None,
    stato: Optional[CommessaStatus] = None,
    cliente_id: Optional[uuid.UUID] = None,
    progetto_id: Optional[uuid.UUID] = None,
) -> List[Commessa]:
    q = select(Commessa).options(
        selectinload(Commessa.cliente),
        selectinload(Commessa.righe_progetto).selectinload(CommessaProgetto.progetto),
    )
    if mese:
        q = q.where(Commessa.mese_competenza == mese.replace(day=1))
    if stato:
        q = q.where(Commessa.stato == stato)
    if cliente_id:
        q = q.where(Commessa.cliente_id == cliente_id)
    if progetto_id:
        q = q.join(CommessaProgetto, CommessaProgetto.commessa_id == Commessa.id).where(
            CommessaProgetto.progetto_id == progetto_id
        )
    result = await db.execute(q.order_by(Commessa.mese_competenza.desc()))
    return result.unique().scalars().all()

async def get_commessa(db: AsyncSession, commessa_id: uuid.UUID) -> Optional[Commessa]:
    result = await db.execute(
        select(Commessa)
        .options(
            selectinload(Commessa.cliente),
            selectinload(Commessa.righe_progetto).selectinload(CommessaProgetto.progetto),
        )
        .where(Commessa.id == commessa_id)
    )
    return result.scalar_one_or_none()

async def _build_commessa_righe(
    db: AsyncSession,
    cliente_id: uuid.UUID,
    progetto_ids: Optional[List[uuid.UUID]] = None,
    righe_payload: Optional[list] = None,
) -> List[CommessaProgetto]:
    """Costruisce le righe commessa validando l'appartenenza dei progetti al cliente."""
    from fastapi import HTTPException

    if righe_payload:
        target_project_ids = [r.progetto_id for r in righe_payload]
    elif progetto_ids:
        target_project_ids = progetto_ids
    else:
        result = await db.execute(select(Progetto).where(Progetto.cliente_id == cliente_id))
        target_project_ids = [p.id for p in result.scalars().all()]

    unique_project_ids = list(dict.fromkeys(target_project_ids))
    if not unique_project_ids:
        raise HTTPException(status_code=422, detail="La commessa deve includere almeno un progetto")

    projects_result = await db.execute(
        select(Progetto).where(
            and_(Progetto.id.in_(unique_project_ids), Progetto.cliente_id == cliente_id)
        )
    )
    projects = projects_result.scalars().all()
    project_map = {p.id: p for p in projects}

    if len(project_map) != len(unique_project_ids):
        raise HTTPException(
            status_code=422,
            detail="Uno o piu progetti non appartengono al cliente selezionato",
        )

    payload_map = {r.progetto_id: r for r in (righe_payload or [])}
    righe: List[CommessaProgetto] = []
    for progetto_id in unique_project_ids:
        progetto = project_map[progetto_id]
        payload = payload_map.get(progetto_id)
        righe.append(
            CommessaProgetto(
                progetto_id=progetto_id,
                importo_fisso=(
                    payload.importo_fisso
                    if payload and payload.importo_fisso is not None
                    else progetto.importo_fisso
                ),
                importo_variabile=(
                    payload.importo_variabile
                    if payload and payload.importo_variabile is not None
                    else progetto.importo_variabile
                ),
                delivery_attesa=(
                    payload.delivery_attesa
                    if payload and payload.delivery_attesa is not None
                    else progetto.delivery_attesa
                ),
                delivery_consuntiva=(
                    payload.delivery_consuntiva
                    if payload and payload.delivery_consuntiva is not None
                    else 0
                ),
            )
        )
    return righe

async def create_commessa(db: AsyncSession, data: CommessaCreate) -> Commessa:
    from fastapi import HTTPException

    mese_norm = data.mese_competenza.replace(day=1)
    cliente = await get_cliente(db, data.cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")

    existing = await db.execute(
        select(Commessa).where(
            and_(
                Commessa.cliente_id == data.cliente_id,
                Commessa.mese_competenza == mese_norm,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Commessa cliente/mese gia esistente")

    c = Commessa(
        cliente_id=data.cliente_id,
        mese_competenza=mese_norm,
        costi_diretti=data.costi_diretti,
        note=data.note,
    )
    db.add(c)
    await db.flush()

    righe = await _build_commessa_righe(
        db=db,
        cliente_id=data.cliente_id,
        progetto_ids=data.progetto_ids,
        righe_payload=data.righe_progetto,
    )
    for riga in righe:
        riga.commessa_id = c.id
    db.add_all(righe)
    await db.flush()
    return await get_commessa(db, c.id)

async def update_commessa(
    db: AsyncSession,
    commessa_id: uuid.UUID,
    data: CommessaUpdate,
    current_user: User
) -> Optional[Commessa]:
    c = await get_commessa(db, commessa_id)
    if not c:
        return None

    # Blocco modifica per commesse chiuse: solo ADMIN può
    if c.is_locked and current_user.ruolo not in (UserRole.ADMIN,):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Commessa bloccata: solo ADMIN può modificarla")

    prima = {
        "stato": c.stato,
        "costi_diretti": str(c.costi_diretti),
        "note": c.note,
    }

    if data.stato is not None:
        c.stato = data.stato
    if data.mese_competenza is not None:
        c.mese_competenza = data.mese_competenza
    if data.costi_diretti is not None:
        c.costi_diretti = data.costi_diretti
    if data.note is not None:
        c.note = data.note
    if 'fattura_id' in data.model_fields_set:
        c.fattura_id = data.fattura_id

    if data.righe_progetto:
        from fastapi import HTTPException

        progetto_ids = [r.progetto_id for r in data.righe_progetto]
        existing_rows_result = await db.execute(
            select(CommessaProgetto).where(
                and_(
                    CommessaProgetto.commessa_id == c.id,
                    CommessaProgetto.progetto_id.in_(progetto_ids),
                )
            )
        )
        existing_rows = {r.progetto_id: r for r in existing_rows_result.scalars().all()}

        projects_result = await db.execute(
            select(Progetto).where(
                and_(Progetto.id.in_(progetto_ids), Progetto.cliente_id == c.cliente_id)
            )
        )
        project_map = {p.id: p for p in projects_result.scalars().all()}
        if len(project_map) != len(set(progetto_ids)):
            raise HTTPException(
                status_code=422,
                detail="Una o piu righe progetto non appartengono al cliente della commessa",
            )

        for riga_patch in data.righe_progetto:
            row = existing_rows.get(riga_patch.progetto_id)
            if row is None:
                progetto = project_map[riga_patch.progetto_id]
                row = CommessaProgetto(
                    commessa_id=c.id,
                    progetto_id=progetto.id,
                    importo_fisso=progetto.importo_fisso,
                    importo_variabile=progetto.importo_variabile,
                    delivery_attesa=progetto.delivery_attesa,
                    delivery_consuntiva=0,
                )
                db.add(row)
                existing_rows[progetto.id] = row

            if riga_patch.importo_fisso is not None:
                row.importo_fisso = riga_patch.importo_fisso
            if riga_patch.importo_variabile is not None:
                row.importo_variabile = riga_patch.importo_variabile
            if riga_patch.delivery_attesa is not None:
                row.delivery_attesa = riga_patch.delivery_attesa
            if riga_patch.delivery_consuntiva is not None:
                row.delivery_consuntiva = riga_patch.delivery_consuntiva

    # Aggiustamenti (extra/sconti)
    if hasattr(data, 'aggiustamenti') and data.aggiustamenti is not None:
        c.aggiustamenti = [{'descrizione': a.get('descrizione',''), 'importo': float(a.get('importo',0))} for a in data.aggiustamenti]

    # Se la commessa passa a CHIUSA, registra la data
    if data.stato == CommessaStatus.CHIUSA and not c.data_chiusura:
        c.data_chiusura = date.today()

    await write_audit(db, current_user.id, "commesse", commessa_id, "UPDATE", prima)
    await db.flush()
    return await get_commessa(db, commessa_id)


# ── TIMESHEET SERVICE ─────────────────────────────────────
async def create_timesheet(
    db: AsyncSession,
    data: TimesheetCreate,
    user_id: uuid.UUID
) -> Timesheet:
    t = Timesheet(
        user_id=user_id,
        task_id=data.task_id,
        commessa_id=data.commessa_id,
        data_attivita=data.data_attivita,
        mese_competenza=data.mese_competenza.replace(day=1),
        servizio=data.servizio,
        durata_minuti=data.durata_minuti,
        note=data.note
    )
    db.add(t)
    await db.flush()
    return t

async def list_timesheet(
    db: AsyncSession,
    user_id: Optional[uuid.UUID] = None,
    mese: Optional[date] = None,
    stato: Optional[TimesheetStatus] = None,
    commessa_id: Optional[uuid.UUID] = None,
) -> List[Timesheet]:
    q = select(Timesheet).options(selectinload(Timesheet.user))
    if user_id:
        q = q.where(Timesheet.user_id == user_id)
    if mese:
        q = q.where(Timesheet.mese_competenza == mese.replace(day=1))
    if stato:
        q = q.where(Timesheet.stato == stato)
    if commessa_id:
        q = q.where(Timesheet.commessa_id == commessa_id)
    result = await db.execute(q.order_by(Timesheet.data_attivita.desc()))
    return result.scalars().all()

async def approva_timesheet(
    db: AsyncSession,
    data: TimesheetApprova,
    approver: User
) -> List[Timesheet]:
    """Approva o rifiuta un batch di timesheet. Solo PM e ADMIN."""
    if approver.ruolo not in (UserRole.ADMIN, UserRole.PM):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo PM e ADMIN possono approvare le ore")

    if data.azione == "APPROVA":
        nuovo_stato = TimesheetStatus.APPROVATO
    elif data.azione == "RIFIUTA":
        nuovo_stato = TimesheetStatus.RIFIUTATO
    else:
        nuovo_stato = TimesheetStatus.PENDING
    # Per APPROVA/RIFIUTA filtriamo solo i PENDING; per PENDING accettiamo qualsiasi stato
    if nuovo_stato == TimesheetStatus.PENDING:
        stato_filter = Timesheet.id.in_(data.ids)
    else:
        stato_filter = and_(Timesheet.id.in_(data.ids), Timesheet.stato == TimesheetStatus.PENDING)
    result = await db.execute(
        select(Timesheet).where(stato_filter)
    )
    entries = result.scalars().all()

    # Pre-carica costi orari utente per snapshot all'approvazione.
    user_cost_map: dict[uuid.UUID, Decimal] = {}
    if nuovo_stato == TimesheetStatus.APPROVATO and entries:
        user_ids = {t.user_id for t in entries}
        users_result = await db.execute(
            select(User.id, User.costo_orario).where(User.id.in_(user_ids))
        )
        for row in users_result.all():
            user_cost_map[row.id] = Decimal(row.costo_orario or 0)

    for t in entries:
        t.stato = nuovo_stato
        t.approvato_da = approver.id
        t.approvato_at = datetime.utcnow()
        if nuovo_stato == TimesheetStatus.APPROVATO:
            costo_orario = user_cost_map.get(t.user_id, Decimal("0"))
            costo_lavoro = (Decimal(t.durata_minuti) / Decimal("60")) * costo_orario
            t.costo_orario_snapshot = costo_orario
            t.costo_lavoro = costo_lavoro
        else:
            t.costo_orario_snapshot = None
            t.costo_lavoro = Decimal("0")
            if nuovo_stato == TimesheetStatus.PENDING:
                t.approvato_da = None
                t.approvato_at = None

    await db.flush()
    await db.commit()
    ids = [t.id for t in entries]
    result2 = await db.execute(select(Timesheet).options(selectinload(Timesheet.user)).where(Timesheet.id.in_(ids)))
    return result2.scalars().all()


# ── REPORT SERVICE ────────────────────────────────────────
async def get_dashboard_kpi(db: AsyncSession, mese: date) -> dict:
    mese_norm = mese.replace(day=1)

    from sqlalchemy import text
    r2 = await db.execute(text("""
        WITH commessa_valori AS (
            SELECT
                cp.commessa_id,
                COALESCE(SUM(
                    cp.importo_fisso +
                    CASE
                        WHEN cp.delivery_attesa > 0
                        THEN (cp.importo_variabile::NUMERIC / cp.delivery_attesa) * cp.delivery_consuntiva
                        ELSE 0
                    END
                ), 0) AS valore_fatturabile
            FROM commessa_progetti cp
            GROUP BY cp.commessa_id
        )
        SELECT
            COALESCE(SUM(cv.valore_fatturabile) FILTER (WHERE c.stato IN ('CHIUSA','FATTURATA','INCASSATA')), 0) AS fatturato,
            COUNT(*) FILTER (WHERE c.stato = 'PRONTA_CHIUSURA') AS pronte_chiusura,
            COALESCE(SUM(cv.valore_fatturabile) FILTER (WHERE c.stato IN ('PRONTA_CHIUSURA','APERTA')), 0) AS da_emettere
        FROM commesse c
        LEFT JOIN commessa_valori cv ON cv.commessa_id = c.id
        WHERE c.mese_competenza = :mese
    """), {"mese": mese_norm})
    row = r2.fetchone()

    pending_ts = await db.execute(
        select(func.count(Timesheet.id)).where(Timesheet.stato == TimesheetStatus.PENDING)
    )

    return {
        "mese_competenza": mese_norm,
        "fatturato_competenza": row.fatturato if row else Decimal("0"),
        "fatturato_da_emettere": row.da_emettere if row else Decimal("0"),
        "commesse_pronte_chiusura": row.pronte_chiusura if row else 0,
        "timesheet_pending": pending_ts.scalar() or 0,
    }

async def get_marginalita_clienti(db: AsyncSession, mese: Optional[date] = None) -> List[dict]:
    from sqlalchemy import text
    where = "WHERE c.mese_competenza = :mese" if mese else ""
    params = {"mese": mese.replace(day=1)} if mese else {}
    r = await db.execute(text(f"""
        WITH commessa_valori AS (
            SELECT
                cp.commessa_id,
                COALESCE(SUM(
                    cp.importo_fisso +
                    CASE
                        WHEN cp.delivery_attesa > 0
                        THEN (cp.importo_variabile::NUMERIC / cp.delivery_attesa) * cp.delivery_consuntiva
                        ELSE 0
                    END
                ), 0) AS valore_fatturabile
            FROM commessa_progetti cp
            GROUP BY cp.commessa_id
        )
        SELECT
            cl.id AS cliente_id,
            cl.ragione_sociale,
            COALESCE(SUM(cv.valore_fatturabile), 0) AS fatturato,
            COALESCE(SUM(c.costo_manodopera), 0)    AS costo_manodopera,
            COALESCE(SUM(c.costi_diretti), 0)       AS costi_diretti,
            COALESCE(SUM(c.costo_manodopera * COALESCE(ca.coefficiente, :default_coeff)), 0) AS costi_indiretti_allocati,
            COALESCE(SUM(
                COALESCE(cv.valore_fatturabile, 0)
                - c.costo_manodopera
                - c.costi_diretti
                - (c.costo_manodopera * COALESCE(ca.coefficiente, :default_coeff))
            ), 0) AS margine_euro,
            COUNT(c.id) AS num_commesse
        FROM clienti cl
        JOIN commesse c ON c.cliente_id = cl.id
        LEFT JOIN commessa_valori cv ON cv.commessa_id = c.id
        LEFT JOIN coefficienti_allocazione ca ON ca.mese_competenza = c.mese_competenza
        {where}
        GROUP BY cl.id, cl.ragione_sociale
        ORDER BY margine_euro DESC
    """), {**params, "default_coeff": DEFAULT_COEFFICIENTE_ALLOCAZIONE})
    rows = r.fetchall()
    result = []
    for row in rows:
        pct = None
        if row.fatturato and row.fatturato > 0:
            pct = round(float(row.margine_euro / row.fatturato * 100), 1)
        result.append({
            "cliente_id": row.cliente_id,
            "ragione_sociale": row.ragione_sociale,
            "fatturato": row.fatturato,
            "costo_manodopera": row.costo_manodopera,
            "costi_diretti": row.costi_diretti,
            "costi_indiretti_allocati": row.costi_indiretti_allocati,
            "margine_euro": row.margine_euro,
            "margine_percentuale": pct,
            "num_commesse": row.num_commesse,
        })
    return result


# ── FIC SYNC SERVICE ───────────────────────────────────────
class FicApiRequestError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(message)


def _to_decimal(value: Any) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    text_value = str(value).strip()
    if not text_value:
        return None
    # Formato FIC piu comune: YYYY-MM-DD.
    try:
        return date.fromisoformat(text_value[:10])
    except ValueError:
        return None


def _extract_list_payload(payload: Any, expected_keys: list[str]) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]

    if not isinstance(payload, dict):
        return []

    data = payload.get("data")
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for key in expected_keys:
            value = data.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
        for value in data.values():
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]

    for key in expected_keys:
        value = payload.get(key)
        if isinstance(value, list):
            return [x for x in value if isinstance(x, dict)]

    for value in payload.values():
        if isinstance(value, list):
            return [x for x in value if isinstance(x, dict)]

    return []


def _extract_pagination(payload: Any) -> tuple[Optional[int], Optional[int]]:
    if not isinstance(payload, dict):
        return (None, None)

    candidates = [payload]
    data = payload.get("data")
    if isinstance(data, dict):
        candidates.append(data)

    for candidate in candidates:
        pagination = candidate.get("pagination")
        if isinstance(pagination, dict):
            current = pagination.get("current_page")
            last = pagination.get("last_page")
            if isinstance(current, int) and isinstance(last, int):
                return (current, last)
        current = candidate.get("current_page")
        last = candidate.get("last_page")
        if isinstance(current, int) and isinstance(last, int):
            return (current, last)

    return (None, None)


def _extract_payments(document: dict[str, Any]) -> list[dict[str, Any]]:
    payments = document.get("payments")
    if isinstance(payments, list):
        return [p for p in payments if isinstance(p, dict)]
    if isinstance(payments, dict):
        for key in ("items", "data", "payments"):
            value = payments.get(key)
            if isinstance(value, list):
                return [p for p in value if isinstance(p, dict)]
    return []


def _sum_payments(payments: list[dict[str, Any]]) -> tuple[Decimal, Optional[date]]:
    total = Decimal("0")
    last_date: Optional[date] = None
    for payment in payments:
        amount = (
            payment.get("amount")
            or payment.get("paid_amount")
            or payment.get("amount_paid")
            or payment.get("net")
            or payment.get("gross")
        )
        total += _to_decimal(amount)
        paid_on = _parse_date(payment.get("paid_date") or payment.get("date"))
        if paid_on and (last_date is None or paid_on > last_date):
            last_date = paid_on
    return total, last_date


def _payment_status(total: Decimal, paid: Decimal, due_date: Optional[date], paid_label: str) -> str:
    if total > 0 and paid >= total:
        return paid_label
    if due_date and due_date < date.today():
        return "SCADUTA"
    return "ATTESA"


def _extract_party(document: dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
    party = (
        document.get("entity")
        or document.get("client")
        or document.get("supplier")
        or document.get("customer")
    )
    if isinstance(party, dict):
        party_id = party.get("id")
        party_name = party.get("name") or party.get("business_name")
        return (str(party_id) if party_id is not None else None, party_name)
    party_id = document.get("entity_id") or document.get("client_id") or document.get("supplier_id")
    return (str(party_id) if party_id is not None else None, None)


def _extract_amount_total(document: dict[str, Any]) -> Decimal:
    raw_amount = (
        document.get("amount_gross")
        or document.get("amount")
        or document.get("total_amount")
        or document.get("gross")
    )
    return _to_decimal(raw_amount)


def _extract_due_date(document: dict[str, Any], fallback_days: int = 30) -> Optional[date]:
    from datetime import timedelta
    due = _parse_date(
        document.get("due_date")
        or document.get("date_due")
        or document.get("next_due_date")
        or document.get("date_valid_until")
    )
    if due:
        return due
    # Fallback: data emissione + 30 giorni
    doc_date = _parse_date(document.get("date") or document.get("document_date"))
    if doc_date:
        return doc_date + timedelta(days=fallback_days)
    return None


def _extract_doc_date(document: dict[str, Any]) -> Optional[date]:
    return _parse_date(document.get("date") or document.get("document_date"))


def _extract_number(document: dict[str, Any]) -> Optional[str]:
    num = document.get("numeration") or document.get("number")
    if num is None:
        return None
    return str(num)


def _build_address(entity: dict[str, Any]) -> Optional[str]:
    parts = [
        entity.get("address_street"),
        entity.get("address_city"),
        entity.get("address_postal_code"),
        entity.get("address_province"),
        entity.get("country"),
    ]
    flat = [str(p).strip() for p in parts if p]
    return ", ".join(flat) if flat else None


class FicApiClient:
    def __init__(self) -> None:
        self.base_url = settings.FIC_BASE_URL.rstrip("/")
        self.api_key = settings.FIC_API_KEY.strip()
        self.company_id = settings.FIC_COMPANY_ID.strip()
        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.api_key:
            # Compatibile con i diversi schemi autorizzativi FIC.
            self.headers["Authorization"] = f"Bearer {self.api_key}"
            self.headers["X-API-KEY"] = self.api_key

    async def _get(self, client: httpx.AsyncClient, path: str, params: dict[str, Any]) -> Any:
        url = f"{self.base_url}{path}"
        response = await client.get(url, headers=self.headers, params=params)
        if response.status_code >= 400:
            message = f"HTTP {response.status_code} su {path}: {response.text[:300]}"
            raise FicApiRequestError(response.status_code, message)
        return response.json()

    async def _get_with_fallback_paths(
        self,
        client: httpx.AsyncClient,
        paths: list[str],
        params: dict[str, Any],
    ) -> Any:
        last_error: Optional[Exception] = None
        for path in paths:
            try:
                return await self._get(client, path, params)
            except FicApiRequestError as exc:
                last_error = exc
                # 404: prova path alternativi; per gli altri errori interrompe.
                if exc.status_code != 404:
                    break
        if last_error:
            raise last_error
        raise RuntimeError("Nessun endpoint FIC configurato")

    async def fetch_collection(
        self,
        paths: list[str],
        expected_keys: list[str],
        extra_params: Optional[dict[str, Any]] = None,
    ) -> list[dict[str, Any]]:
        params_base = dict(extra_params or {})
        if self.company_id:
            params_base.setdefault("company_id", self.company_id)

        items_all: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        page = 1
        async with httpx.AsyncClient(timeout=45.0) as client:
            while True:
                params = {
                    **params_base,
                    "page": page,
                    "per_page": FIC_PAGE_SIZE,
                }
                payload = await self._get_with_fallback_paths(client, paths, params)
                items = _extract_list_payload(payload, expected_keys)
                if not items:
                    break

                page_ids = {
                    str(x.get("id"))
                    for x in items
                    if isinstance(x, dict) and x.get("id") is not None
                }
                if page > 1 and page_ids and page_ids.issubset(seen_ids):
                    break

                for row in items:
                    row_id = row.get("id")
                    if row_id is not None:
                        seen_ids.add(str(row_id))
                    items_all.append(row)

                current_page, last_page = _extract_pagination(payload)
                if current_page and last_page and current_page >= last_page:
                    break

                if len(items) < FIC_PAGE_SIZE or page >= 200:
                    break
                page += 1
        return items_all


async def _acquire_fic_sync_lock(db: AsyncSession) -> bool:
    try:
        result = await db.execute(
            text("SELECT pg_try_advisory_lock(hashtext(:k)) AS locked"),
            {"k": FIC_SYNC_LOCK_KEY},
        )
        return bool(result.scalar_one())
    except Exception:
        logger.exception("Impossibile acquisire advisory lock FIC; continuo senza lock.")
        return True


async def _release_fic_sync_lock(db: AsyncSession) -> None:
    try:
        await db.execute(
            text("SELECT pg_advisory_unlock(hashtext(:k))"),
            {"k": FIC_SYNC_LOCK_KEY},
        )
    except Exception:
        logger.exception("Errore rilascio advisory lock FIC")


async def _upsert_fic_clienti(
    db: AsyncSession,
    items: list[dict[str, Any]],
    errors: list[str],
) -> int:
    imported = 0
    for raw in items:
        try:
            fic_id_raw = raw.get("id")
            if fic_id_raw is None:
                continue
            fic_id = str(fic_id_raw)
            result = await db.execute(select(Cliente).where(Cliente.fic_cliente_id == fic_id))
            cliente = result.scalar_one_or_none()
            if not cliente:
                cliente = Cliente(
                    ragione_sociale=raw.get("name") or raw.get("business_name") or f"Cliente FIC {fic_id}",
                    fic_cliente_id=fic_id,
                    attivo=True,
                )
                db.add(cliente)

            cliente.ragione_sociale = raw.get("name") or raw.get("business_name") or cliente.ragione_sociale
            cliente.piva = raw.get("vat_number") or cliente.piva
            cliente.codice_fiscale = raw.get("tax_code") or cliente.codice_fiscale
            cliente.sdi = raw.get("ei_code") or cliente.sdi
            cliente.pec = raw.get("certified_email") or raw.get("pec") or cliente.pec
            cliente.indirizzo = _build_address(raw) or cliente.indirizzo
            cliente.numero_progressivo = int(raw["code"]) if raw.get("code") and str(raw["code"]).isdigit() else cliente.numero_progressivo
            cliente.paese = raw.get("country") or cliente.paese
            cliente.tipologia = raw.get("type") or cliente.tipologia
            cliente.comune = raw.get("address_city") or raw.get("city") or cliente.comune
            cliente.cap = raw.get("address_zip") or raw.get("zip") or cliente.cap
            cliente.provincia = raw.get("address_province") or raw.get("province") or cliente.provincia
            cliente.indirizzo = raw.get("address_street") or cliente.indirizzo
            cliente.telefono = raw.get("phone") or cliente.telefono
            cliente.referente = raw.get("contact_person") or cliente.referente
            cliente.note = raw.get("extra") or cliente.note
            cliente.email = raw.get("email") or cliente.email
            imported += 1
        except Exception as exc:
            errors.append(f"cliente:{raw.get('id')} -> {exc}")
    return imported


async def _upsert_fic_fornitori(
    db: AsyncSession,
    items: list[dict[str, Any]],
    errors: list[str],
) -> int:
    imported = 0
    for raw in items:
        try:
            fic_id_raw = raw.get("id")
            if fic_id_raw is None:
                continue
            fic_id = str(fic_id_raw)
            result = await db.execute(select(Fornitore).where(Fornitore.fic_id == fic_id))
            fornitore = result.scalar_one_or_none()
            if not fornitore:
                fornitore = Fornitore(
                    fic_id=fic_id,
                    ragione_sociale=raw.get("name") or raw.get("business_name") or f"Fornitore FIC {fic_id}",
                    attivo=True,
                )
                db.add(fornitore)

            fornitore.ragione_sociale = raw.get("name") or raw.get("business_name") or fornitore.ragione_sociale
            fornitore.piva = raw.get("vat_number") or fornitore.piva
            fornitore.codice_fiscale = raw.get("tax_code") or fornitore.codice_fiscale
            fornitore.pec = raw.get("certified_email") or raw.get("pec") or fornitore.pec
            fornitore.indirizzo = _build_address(raw) or fornitore.indirizzo
            fornitore.email = raw.get("email") or fornitore.email
            fornitore.telefono = raw.get("phone") or raw.get("phone_number") or fornitore.telefono
            fornitore.fic_raw_data = raw
            imported += 1
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error(f"FORNITORE_ERROR {raw.get('id')}: {exc}", exc_info=True)
            errors.append(f"fornitore:{raw.get('id')} -> {exc}")
    return imported


async def _find_cliente_by_fic_id(
    db: AsyncSession,
    cache: dict[str, Optional[Cliente]],
    fic_cliente_id: Optional[str],
) -> Optional[Cliente]:
    if not fic_cliente_id:
        return None
    if fic_cliente_id in cache:
        return cache[fic_cliente_id]
    result = await db.execute(select(Cliente).where(Cliente.fic_cliente_id == fic_cliente_id))
    cliente = result.scalar_one_or_none()
    cache[fic_cliente_id] = cliente
    return cliente


async def _find_fornitore_by_fic_id(
    db: AsyncSession,
    cache: dict[str, Optional[Fornitore]],
    fic_fornitore_id: Optional[str],
) -> Optional[Fornitore]:
    if not fic_fornitore_id:
        return None
    if fic_fornitore_id in cache:
        return cache[fic_fornitore_id]
    result = await db.execute(select(Fornitore).where(Fornitore.fic_id == fic_fornitore_id))
    fornitore = result.scalar_one_or_none()
    cache[fic_fornitore_id] = fornitore
    return fornitore


async def _upsert_fic_fatture_attive(
    db: AsyncSession,
    items: list[dict[str, Any]],
    errors: list[str],
) -> int:
    imported = 0
    clienti_cache: dict[str, Optional[Cliente]] = {}
    for raw in items:
        try:
            fic_id_raw = raw.get("id")
            if fic_id_raw is None:
                continue
            fic_id = str(fic_id_raw)
            result = await db.execute(select(FatturaAttiva).where(FatturaAttiva.fic_id == fic_id))
            fattura = result.scalar_one_or_none()
            if not fattura:
                fattura = FatturaAttiva(fic_id=fic_id)
                db.add(fattura)

            fic_cliente_id, _ = _extract_party(raw)
            cliente = await _find_cliente_by_fic_id(db, clienti_cache, fic_cliente_id)
            payments = _extract_payments(raw)
            importo_totale = _extract_amount_total(raw)
            importo_pagato, ultimo_incasso = _sum_payments(payments)
            importo_residuo = _to_decimal(raw.get("amount_due")) or (importo_totale - importo_pagato)
            due_date = _extract_due_date(raw)

            fattura.cliente_id = cliente.id if cliente else None
            fattura.fic_cliente_id = fic_cliente_id
            fattura.numero = _extract_number(raw)
            fattura.data_emissione = _extract_doc_date(raw)
            fattura.data_scadenza = due_date
            fattura.importo_totale = importo_totale
            fattura.importo_pagato = importo_pagato
            fattura.importo_residuo = max(importo_residuo, Decimal("0"))
            # Non sovrascrivere se già marcata pagata nel nostro DB
            fic_stato = _payment_status(
                total=importo_totale,
                paid=importo_pagato,
                due_date=due_date,
                paid_label="INCASSATA",
            )
            if fattura.stato_pagamento != 'paid':
                fattura.stato_pagamento = fic_stato
            if not fattura.data_ultimo_incasso:
                fattura.data_ultimo_incasso = ultimo_incasso
            fattura.valuta = raw.get("currency", {}).get("code") if isinstance(raw.get("currency"), dict) else None
            fattura.payments_raw = {"payments": payments}
            fattura.fic_raw_data = raw
            fattura.importo_netto = _to_decimal(raw.get("amount_net")) or Decimal("0")
            fattura.importo_iva = _to_decimal(raw.get("amount_vat")) or Decimal("0")
            imported += 1
        except Exception as exc:
            errors.append(f"fattura_attiva:{raw.get('id')} -> {exc}")
    return imported


async def _next_numero_passiva(db: AsyncSession, anno: int) -> str:
    result = await db.execute(
        select(FatturaPassiva.numero)
        .where(FatturaPassiva.numero.like(f"{anno}/%"))
    )
    numeri = result.scalars().all()
    max_n = 0
    for n in numeri:
        try:
            max_n = max(max_n, int(n.split("/")[1]))
        except:
            pass
    return f"{anno}/{str(max_n + 1).zfill(4)}"


async def _upsert_fic_fatture_passive(
    db: AsyncSession,
    items: list[dict[str, Any]],
    errors: list[str],
) -> int:
    imported = 0
    fornitori_cache: dict[str, Optional[Fornitore]] = {}
    for raw in items:
        try:
            fic_id_raw = raw.get("id")
            if fic_id_raw is None:
                continue
            fic_id = str(fic_id_raw)
            result = await db.execute(select(FatturaPassiva).where(FatturaPassiva.fic_id == fic_id))
            fattura = result.scalar_one_or_none()
            is_new = fattura is None
            if not fattura:
                fattura = FatturaPassiva(fic_id=fic_id)
                db.add(fattura)

            fic_fornitore_id, _ = _extract_party(raw)
            fornitore = await _find_fornitore_by_fic_id(db, fornitori_cache, fic_fornitore_id)
            payments = _extract_payments(raw)
            importo_totale = _extract_amount_total(raw)
            importo_pagato, ultimo_pagamento = _sum_payments(payments)
            importo_residuo = _to_decimal(raw.get("amount_due")) or (importo_totale - importo_pagato)
            due_date = _extract_due_date(raw)

            fattura.fornitore_id = fornitore.id if fornitore else None
            fattura.fic_fornitore_id = fic_fornitore_id
            fattura.data_emissione = _extract_doc_date(raw)
            fattura.data_scadenza = due_date
            fattura.importo_totale = importo_totale
            fattura.importo_pagato = importo_pagato
            fattura.importo_residuo = max(importo_residuo, Decimal("0"))
            fattura.categoria = raw.get("type")
            fattura.valuta = raw.get("currency", {}).get("code") if isinstance(raw.get("currency"), dict) else None
            fattura.payments_raw = {"payments": payments}
            fattura.fic_raw_data = raw
            # Preserva dati inseriti manualmente — non sovrascrivere se già presenti
            if not fattura.numero:
                fic_num = _extract_number(raw)
                if fic_num:
                    fattura.numero = fic_num
                elif is_new:
                    doc_date = _extract_doc_date(raw)
                    anno = doc_date.year if doc_date else date.today().year
                    fattura.numero = await _next_numero_passiva(db, anno)
            if fattura.stato_pagamento not in ('paid', 'PAGATA'):
                fattura.stato_pagamento = _payment_status(
                    total=importo_totale,
                    paid=importo_pagato,
                    due_date=due_date,
                    paid_label="PAGATA",
                )
            if not fattura.data_ultimo_pagamento:
                fattura.data_ultimo_pagamento = ultimo_pagamento
            imported += 1
        except Exception as exc:
            errors.append(f"fattura_passiva:{raw.get('id')} -> {exc}")
    return imported


async def sync_fic_data(db: AsyncSession, triggered_by: Optional[uuid.UUID] = None) -> FicSyncRun:
    """Sync monodirezionale: FIC master, ERP in sola lettura/salvataggio locale."""
    locked = await _acquire_fic_sync_lock(db)
    if not locked:
        skipped = FicSyncRun(
            status="SKIPPED",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            error_count=1,
            errors={"items": ["Sync gia in corso"]},
            triggered_by=triggered_by,
        )
        db.add(skipped)
        await db.commit()
        return skipped

    run = FicSyncRun(
        status="RUNNING",
        started_at=datetime.now(timezone.utc),
        triggered_by=triggered_by,
    )
    db.add(run)
    await db.flush()

    errors: list[str] = []
    try:
        if not settings.FIC_API_KEY.strip():
            errors.append("FIC_API_KEY non configurata")
        if not settings.FIC_COMPANY_ID.strip():
            errors.append("FIC_COMPANY_ID non configurata")

        if not errors:
            fic = FicApiClient()

            # Clienti
            try:
                clienti_raw = await fic.fetch_collection(
                    paths=[f"/c/{settings.FIC_COMPANY_ID}/entities/clients"],
                    expected_keys=["data"],
                    extra_params={"per_page": 100, "fieldset": "detailed"},
                )
                run.imported_clienti = await _upsert_fic_clienti(db, clienti_raw, errors)
                await db.flush()
            except Exception as exc:
                errors.append(f"sync_clienti -> {exc}")

            # Fornitori
            try:
                fornitori_raw = await fic.fetch_collection(
                    paths=[f"/c/{settings.FIC_COMPANY_ID}/entities/suppliers"],
                    expected_keys=["data"],
                    extra_params={"per_page": 100, "fieldset": "detailed"},
                )
                run.imported_fornitori = await _upsert_fic_fornitori(db, fornitori_raw, errors)
                await db.flush()
            except Exception as exc:
                errors.append(f"sync_fornitori -> {exc}")

            # Fatture attive
            try:
                fatture_attive_raw = await fic.fetch_collection(
                    paths=[f"/c/{settings.FIC_COMPANY_ID}/issued_documents"],
                    expected_keys=["data"],
                    extra_params={"type": "invoice", "per_page": 100},
                )
                run.imported_fatture_attive = await _upsert_fic_fatture_attive(db, fatture_attive_raw, errors)
                await db.flush()
            except Exception as exc:
                errors.append(f"sync_fatture_attive -> {exc}")

            # Fatture passive
            try:
                fatture_passive_raw = await fic.fetch_collection(
                    paths=[f"/c/{settings.FIC_COMPANY_ID}/received_documents"],
                    expected_keys=["data"],
                    extra_params={"per_page": 100},
                )
                run.imported_fatture_passive = await _upsert_fic_fatture_passive(db, fatture_passive_raw, errors)
                await db.flush()
            except Exception as exc:
                errors.append(f"sync_fatture_passive -> {exc}")

        run.completed_at = datetime.now(timezone.utc)
        run.error_count = len(errors)
        run.errors = {"items": errors} if errors else None
        imported_total = (
            run.imported_clienti
            + run.imported_fornitori
            + run.imported_fatture_attive
            + run.imported_fatture_passive
        )
        if errors and imported_total == 0:
            run.status = "ERROR"
        elif errors:
            run.status = "PARTIAL"
        else:
            run.status = "OK"

        await db.commit()
        await db.refresh(run)
        return run
    except Exception as outer_exc:
        try:
            await db.rollback()
        except Exception:
            pass
        raise outer_exc
    finally:
        await _release_fic_sync_lock(db)


async def get_last_fic_sync_status(db: AsyncSession) -> Optional[FicSyncRun]:
    result = await db.execute(
        select(FicSyncRun).order_by(FicSyncRun.started_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def list_fornitori(db: AsyncSession) -> List[Fornitore]:
    result = await db.execute(select(Fornitore).order_by(Fornitore.ragione_sociale))
    return result.scalars().all()


async def list_fatture_attive(db: AsyncSession) -> List[FatturaAttiva]:
    result = await db.execute(
        select(FatturaAttiva).order_by(
            FatturaAttiva.data_emissione.desc().nullslast(),
            FatturaAttiva.created_at.desc(),
        )
    )
    return result.scalars().all()


async def list_fatture_passive(db: AsyncSession):
    from app.models.models import Fornitore
    result = await db.execute(
        select(FatturaPassiva, Fornitore.ragione_sociale)
        .outerjoin(Fornitore, FatturaPassiva.fornitore_id == Fornitore.id)
        .order_by(
            FatturaPassiva.data_emissione.desc().nullslast(),
            FatturaPassiva.created_at.desc(),
        )
    )
    rows = result.all()
    fatture = []
    for fp, ragione_sociale in rows:
        d = {c.name: getattr(fp, c.name) for c in fp.__table__.columns}
        d['fornitore_nome'] = ragione_sociale
        fatture.append(d)
    return fatture

async def incassa_fattura(db: AsyncSession, fattura_id: uuid.UUID, data_incasso) -> Optional[FatturaAttiva]:
    result = await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fattura_id))
    fattura = result.scalar_one_or_none()
    if not fattura:
        return None
    fattura.stato_pagamento = 'paid'
    fattura.data_ultimo_incasso = data_incasso
    fattura.importo_pagato = fattura.importo_totale
    fattura.importo_residuo = 0
    await db.commit()
    await db.refresh(fattura)

    # Sincronizza stato commessa collegata
    from app.models.models import Commessa, CommessaStatus
    cm_result = await db.execute(select(Commessa).where(Commessa.fattura_id == fattura_id))
    commessa = cm_result.scalar_one_or_none()
    if commessa and commessa.stato not in (CommessaStatus.INCASSATA,):
        commessa.stato = CommessaStatus.INCASSATA
        await db.commit()

    # Push a FIC
    import httpx, os
    fic_key = os.getenv('FIC_API_KEY','')
    company_id = os.getenv('FIC_COMPANY_ID','')
    if fic_key and company_id and fattura.fic_id:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.put(
                    f"https://api-v2.fattureincloud.it/c/{company_id}/issued_documents/{fattura.fic_id}",
                    headers={"Authorization": f"Bearer {fic_key}"},
                    json={"data": {"payment_method": {"id": 0}, "payments": [{"amount": float(fattura.importo_totale), "date": str(data_incasso), "paid": True}]}}
                )
        except Exception as e:
            print(f"FIC push error: {e}")

    return fattura

async def list_fornitori_full(db: AsyncSession):
    from app.models.models import Fornitore, FatturaPassiva
    from sqlalchemy import func
    result = await db.execute(
        select(
            Fornitore,
            func.count(FatturaPassiva.id).label('num_fatture'),
            func.coalesce(func.sum(FatturaPassiva.importo_totale), 0).label('spesa_totale'),
            func.max(FatturaPassiva.data_emissione).label('ultima_fattura'),
        )
        .outerjoin(FatturaPassiva, FatturaPassiva.fornitore_id == Fornitore.id)
        .group_by(Fornitore.id)
        .order_by(Fornitore.ragione_sociale)
    )
    rows = result.all()
    out = []
    for forn, num_fatture, spesa_totale, ultima_fattura in rows:
        d = {c.name: getattr(forn, c.name) for c in forn.__table__.columns}
        d['num_fatture'] = num_fatture
        d['spesa_totale'] = float(spesa_totale or 0)
        d['ultima_fattura'] = str(ultima_fattura) if ultima_fattura else None
        out.append(d)
    return out

async def update_fornitore(db: AsyncSession, fornitore_id: uuid.UUID, data: dict):
    from app.models.models import Fornitore
    result = await db.execute(select(Fornitore).where(Fornitore.id == fornitore_id))
    forn = result.scalar_one_or_none()
    if not forn:
        return None
    for k, v in data.items():
        setattr(forn, k, v)
    await db.commit()
    await db.refresh(forn)
    return forn

async def update_fattura_passiva(db: AsyncSession, fattura_id: uuid.UUID, data: dict):
    from app.models.models import FatturaPassiva
    result = await db.execute(select(FatturaPassiva).where(FatturaPassiva.id == fattura_id))
    fattura = result.scalar_one_or_none()
    if not fattura:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(fattura, k, v)
    await db.commit()
    await db.refresh(fattura)
    return fattura


async def list_movimenti_cassa(db: AsyncSession):
    from app.models.models import MovimentoCassa
    result = await db.execute(
        select(MovimentoCassa).order_by(MovimentoCassa.data_valuta.desc())
    )
    rows = result.scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def list_costi_fissi(db: AsyncSession):
    from app.models.models import CostoFisso
    result = await db.execute(
        select(CostoFisso).order_by(CostoFisso.categoria, CostoFisso.descrizione)
    )
    rows = result.scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def create_costo_fisso(db: AsyncSession, payload: dict):
    from app.models.models import CostoFisso
    cf = CostoFisso(**{k: v for k, v in payload.items() if hasattr(CostoFisso, k)})
    db.add(cf)
    await db.commit()
    await db.refresh(cf)
    return {c.name: getattr(cf, c.name) for c in cf.__table__.columns}


async def update_costo_fisso(db: AsyncSession, costo_id, payload: dict):
    from app.models.models import CostoFisso
    result = await db.execute(select(CostoFisso).where(CostoFisso.id == costo_id))
    cf = result.scalar_one_or_none()
    if not cf:
        return None
    for k, v in payload.items():
        if hasattr(cf, k):
            setattr(cf, k, v)
    await db.commit()
    await db.refresh(cf)
    return {c.name: getattr(cf, c.name) for c in cf.__table__.columns}


async def delete_costo_fisso(db: AsyncSession, costo_id):
    from app.models.models import CostoFisso
    result = await db.execute(select(CostoFisso).where(CostoFisso.id == costo_id))
    cf = result.scalar_one_or_none()
    if not cf:
        return False
    await db.delete(cf)
    await db.commit()
    return True


# ── REGOLE RICONCILIAZIONE ────────────────────────────────
async def list_regole(db: AsyncSession):
    from app.models.models import RegolaRiconciliazione
    result = await db.execute(
        select(RegolaRiconciliazione).order_by(RegolaRiconciliazione.priorita.desc(), RegolaRiconciliazione.nome)
    )
    rows = result.scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def create_regola(db: AsyncSession, payload: dict):
    from app.models.models import RegolaRiconciliazione
    r = RegolaRiconciliazione(**{k: v for k, v in payload.items() if hasattr(RegolaRiconciliazione, k)})
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return {c.name: getattr(r, c.name) for c in r.__table__.columns}


async def update_regola(db: AsyncSession, regola_id, payload: dict):
    from app.models.models import RegolaRiconciliazione
    result = await db.execute(select(RegolaRiconciliazione).where(RegolaRiconciliazione.id == regola_id))
    r = result.scalar_one_or_none()
    if not r:
        return None
    for k, v in payload.items():
        if hasattr(r, k):
            setattr(r, k, v)
    await db.commit()
    await db.refresh(r)
    return {c.name: getattr(r, c.name) for c in r.__table__.columns}


async def delete_regola(db: AsyncSession, regola_id):
    from app.models.models import RegolaRiconciliazione
    result = await db.execute(select(RegolaRiconciliazione).where(RegolaRiconciliazione.id == regola_id))
    r = result.scalar_one_or_none()
    if not r:
        return False
    await db.delete(r)
    await db.commit()
    return True


async def applica_regole_automatiche(db: AsyncSession):
    import re as re_module
    from app.models.models import RegolaRiconciliazione, MovimentoCassa

    res_regole = await db.execute(
        select(RegolaRiconciliazione)
        .where(RegolaRiconciliazione.attiva == True)
        .order_by(RegolaRiconciliazione.priorita.desc())
    )
    regole = res_regole.scalars().all()

    res_mov = await db.execute(
        select(MovimentoCassa).where(MovimentoCassa.riconciliato == False)
    )
    movimenti = res_mov.scalars().all()

    matched = 0
    for mov in movimenti:
        desc = (mov.descrizione or '').lower()
        for regola in regole:
            pattern = regola.pattern.lower()
            hit = False
            if regola.tipo_match == 'contains':
                hit = pattern in desc
            elif regola.tipo_match == 'startswith':
                hit = desc.startswith(pattern)
            elif regola.tipo_match == 'regex':
                try:
                    hit = bool(re_module.search(pattern, desc))
                except:
                    pass
            if hit:
                if regola.categoria:
                    mov.categoria = regola.categoria
                if regola.auto_riconcilia:
                    mov.riconciliato = True
                    if regola.fattura_passiva_id:
                        mov.fattura_passiva_id = regola.fattura_passiva_id
                regola.contatore_match = (regola.contatore_match or 0) + 1
                matched += 1
                break

    await db.commit()
    return {'movimenti_processati': len(movimenti), 'match_trovati': matched}


async def suggest_riconciliazione(db: AsyncSession, movimento_id: uuid.UUID):
    import re as re_module
    from app.models.models import MovimentoCassa, FatturaPassiva, Fornitore, RegolaRiconciliazione

    res = await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))
    mov = res.scalar_one_or_none()
    if not mov:
        return {'regola': None, 'fatture_importo': []}

    desc = (mov.descrizione or '').lower()
    importo = abs(float(mov.importo or 0))

    res_regole = await db.execute(
        select(RegolaRiconciliazione)
        .where(RegolaRiconciliazione.attiva == True)
        .order_by(RegolaRiconciliazione.priorita.desc())
    )
    regola_match = None
    for r in res_regole.scalars().all():
        pattern = r.pattern.lower()
        hit = False
        if r.tipo_match == 'contains': hit = pattern in desc
        elif r.tipo_match == 'startswith': hit = desc.startswith(pattern)
        elif r.tipo_match == 'regex':
            try: hit = bool(re_module.search(pattern, desc))
            except: pass
        if hit:
            regola_match = {c.name: getattr(r, c.name) for c in r.__table__.columns}
            break

    res_fp = await db.execute(
        select(FatturaPassiva, Fornitore)
        .outerjoin(Fornitore, FatturaPassiva.fornitore_id == Fornitore.id)
        .where(FatturaPassiva.stato_pagamento.notin_(['paid', 'PAGATA']))
        .where(func.abs(FatturaPassiva.importo_totale).between(importo * 0.95, importo * 1.05))
        .limit(5)
    )
    fatture_match = []
    for fp, forn in res_fp.all():
        fatture_match.append({
            'id': str(fp.id),
            'numero': fp.numero,
            'importo': float(fp.importo_totale or 0),
            'fornitore': forn.ragione_sociale if forn else '—',
            'data_emissione': str(fp.data_emissione) if fp.data_emissione else None,
            'match_esatto': abs(float(fp.importo_totale or 0) - importo) < 0.01,
        })

    return {'regola': regola_match, 'fatture_importo': fatture_match}


# ── IMPUTAZIONI FATTURE PASSIVE ───────────────────────────
async def get_imputazioni(db: AsyncSession, fattura_passiva_id: uuid.UUID):
    from app.models.models import FatturaPassivaImputazione, Cliente, Progetto
    result = await db.execute(
        select(FatturaPassivaImputazione, Cliente.ragione_sociale, Progetto.nome)
        .outerjoin(Cliente, FatturaPassivaImputazione.cliente_id == Cliente.id)
        .outerjoin(Progetto, FatturaPassivaImputazione.progetto_id == Progetto.id)
        .where(FatturaPassivaImputazione.fattura_passiva_id == fattura_passiva_id)
        .order_by(FatturaPassivaImputazione.created_at)
    )
    rows = result.all()
    out = []
    for imp, cliente_nome, progetto_nome in rows:
        d = {c.name: getattr(imp, c.name) for c in imp.__table__.columns}
        d['cliente_nome'] = cliente_nome
        d['progetto_nome'] = progetto_nome
        out.append(d)
    return out


async def save_imputazioni(db: AsyncSession, fattura_passiva_id: uuid.UUID, imputazioni: list[dict]):
    from app.models.models import FatturaPassivaImputazione, FatturaPassiva
    from sqlalchemy import delete

    # Verifica che la fattura esista
    fp_res = await db.execute(select(FatturaPassiva).where(FatturaPassiva.id == fattura_passiva_id))
    fp = fp_res.scalar_one_or_none()
    if not fp:
        return None

    # Elimina imputazioni esistenti e ricrea
    await db.execute(delete(FatturaPassivaImputazione).where(FatturaPassivaImputazione.fattura_passiva_id == fattura_passiva_id))

    totale = float(fp.importo_totale or 0)
    for imp in imputazioni:
        perc = float(imp.get('percentuale', 0))
        importo_imp = round(totale * perc / 100, 2)
        obj = FatturaPassivaImputazione(
            fattura_passiva_id=fattura_passiva_id,
            cliente_id=uuid.UUID(imp['cliente_id']) if imp.get('cliente_id') else None,
            progetto_id=uuid.UUID(imp['progetto_id']) if imp.get('progetto_id') else None,
            tipo=imp.get('tipo', 'PROGETTO'),
            percentuale=perc,
            importo=importo_imp,
            note=imp.get('note'),
        )
        db.add(obj)

    await db.commit()
    return await get_imputazioni(db, fattura_passiva_id)


# ── IMPUTAZIONI MOVIMENTI CASSA ───────────────────────────
async def get_imputazioni_movimento(db: AsyncSession, movimento_id: uuid.UUID):
    from app.models.models import MovimentoCassaImputazione, Cliente, Progetto
    result = await db.execute(
        select(MovimentoCassaImputazione, Cliente.ragione_sociale, Progetto.nome)
        .outerjoin(Cliente, MovimentoCassaImputazione.cliente_id == Cliente.id)
        .outerjoin(Progetto, MovimentoCassaImputazione.progetto_id == Progetto.id)
        .where(MovimentoCassaImputazione.movimento_id == movimento_id)
        .order_by(MovimentoCassaImputazione.created_at)
    )
    rows = result.all()
    out = []
    for imp, cliente_nome, progetto_nome in rows:
        d = {c.name: getattr(imp, c.name) for c in imp.__table__.columns}
        d['cliente_nome'] = cliente_nome
        d['progetto_nome'] = progetto_nome
        out.append(d)
    return out


async def save_imputazioni_movimento(db: AsyncSession, movimento_id: uuid.UUID, imputazioni: list[dict]):
    from app.models.models import MovimentoCassaImputazione, MovimentoCassa, FatturaPassivaImputazione
    from sqlalchemy import delete

    res = await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))
    mov = res.scalar_one_or_none()
    if not mov:
        return None

    # Se riconciliato con fattura passiva — verifica congruenza
    if mov.fattura_passiva_id:
        fp_imps = await db.execute(
            select(FatturaPassivaImputazione)
            .where(FatturaPassivaImputazione.fattura_passiva_id == mov.fattura_passiva_id)
        )
        fp_imps_list = fp_imps.scalars().all()
        if fp_imps_list:
            # Eredita automaticamente dalla fattura
            await db.execute(delete(MovimentoCassaImputazione).where(MovimentoCassaImputazione.movimento_id == movimento_id))
            importo_mov = abs(float(mov.importo or 0))
            for fi in fp_imps_list:
                obj = MovimentoCassaImputazione(
                    movimento_id=movimento_id,
                    cliente_id=fi.cliente_id,
                    progetto_id=fi.progetto_id,
                    tipo=fi.tipo,
                    percentuale=fi.percentuale,
                    importo=round(importo_mov * float(fi.percentuale) / 100, 2),
                    ereditata_da_fattura=True,
                    note=fi.note,
                )
                db.add(obj)
            await db.commit()
            return await get_imputazioni_movimento(db, movimento_id)

    # Movimento senza fattura — salva imputazioni proprie
    await db.execute(delete(MovimentoCassaImputazione).where(MovimentoCassaImputazione.movimento_id == movimento_id))
    importo_mov = abs(float(mov.importo or 0))
    for imp in imputazioni:
        perc = float(imp.get('percentuale', 0))
        obj = MovimentoCassaImputazione(
            movimento_id=movimento_id,
            cliente_id=uuid.UUID(imp['cliente_id']) if imp.get('cliente_id') else None,
            progetto_id=uuid.UUID(imp['progetto_id']) if imp.get('progetto_id') else None,
            tipo=imp.get('tipo', 'PROGETTO'),
            percentuale=perc,
            importo=round(importo_mov * perc / 100, 2),
            ereditata_da_fattura=False,
            note=imp.get('note'),
        )
        db.add(obj)
    await db.commit()
    return await get_imputazioni_movimento(db, movimento_id)


# ── RISORSE (HR) ──────────────────────────────────────────
def calcola_costo_orario(r) -> float:
    """Calcola costo orario reale dalla struttura contrattuale."""
    ore_anno = float(r.get('ore_settimanali', 40)) * 52 - 176 - 88  # ferie + festività
    tipo = r.get('tipo_contratto', '')

    if tipo == 'FONDATORE':
        # Usa compenso obiettivo se presente, altrimenti 0
        compenso = float(r.get('compenso_obiettivo') or 0)
        if compenso == 0:
            return 0.0
        costo_anno = compenso * 12 * (1 + float(r.get('contributi_percentuale', 30)) / 100 + float(r.get('tfr_percentuale', 6.91)) / 100)
        return round(costo_anno / ore_anno, 2)

    if tipo in ('FREELANCER', 'PRESTAZIONE_OCCASIONALE'):
        compenso_mensile = float(r.get('compenso_fisso_mensile') or 0)
        if compenso_mensile == 0:
            return 0.0
        ore_mese = float(r.get('ore_settimanali', 40)) * 4.33
        return round(compenso_mensile / ore_mese, 2)

    # Dipendenti (APPRENDISTATO, TEMPO_DETERMINATO, DIPENDENTE)
    ral = float(r.get('ral') or 0)
    if ral == 0:
        return 0.0
    contributi = float(r.get('contributi_percentuale', 30)) / 100
    tfr = float(r.get('tfr_percentuale', 6.91)) / 100
    costo_anno = ral * (1 + contributi + tfr)
    return round(costo_anno / ore_anno, 2)


async def list_risorse(db: AsyncSession):
    from app.models.models import Risorsa
    result = await db.execute(select(Risorsa).order_by(Risorsa.cognome, Risorsa.nome))
    risorse = result.scalars().all()
    out = []
    for r in risorse:
        d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        d['costo_orario_effettivo'] = float(d.get('costo_orario_override') or d.get('costo_orario_calcolato') or 0)
        out.append(d)
    return out


async def create_risorsa(db: AsyncSession, payload: dict):
    from app.models.models import Risorsa
    from decimal import Decimal
    costo = calcola_costo_orario(payload)
    from datetime import date as date_type
    def parse_date(v):
        if not v: return None
        if isinstance(v, date_type): return v
        try: return date_type.fromisoformat(str(v))
        except: return None

    r = Risorsa(
        nome=payload['nome'],
        cognome=payload['cognome'],
        ruolo=payload.get('ruolo'),
        tipo_contratto=payload.get('tipo_contratto', 'DIPENDENTE'),
        data_inizio=parse_date(payload.get('data_inizio')),
        data_fine=parse_date(payload.get('data_fine')),
        ore_settimanali=Decimal(str(payload.get('ore_settimanali', 40))),
        ral=Decimal(str(payload['ral'])) if payload.get('ral') else None,
        compenso_fisso_mensile=Decimal(str(payload['compenso_fisso_mensile'])) if payload.get('compenso_fisso_mensile') else None,
        compenso_obiettivo=Decimal(str(payload['compenso_obiettivo'])) if payload.get('compenso_obiettivo') else None,
        contributi_percentuale=Decimal(str(payload.get('contributi_percentuale', 30))),
        tfr_percentuale=Decimal(str(payload.get('tfr_percentuale', 6.91))),
        costo_orario_override=Decimal(str(payload['costo_orario_override'])) if payload.get('costo_orario_override') else None,
        costo_orario_calcolato=Decimal(str(costo)),
        attivo=payload.get('attivo', True),
        note=payload.get('note'),
        user_id=uuid.UUID(payload['user_id']) if payload.get('user_id') else None,
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


async def update_risorsa(db: AsyncSession, risorsa_id: uuid.UUID, payload: dict):
    from app.models.models import Risorsa
    from decimal import Decimal
    result = await db.execute(select(Risorsa).where(Risorsa.id == risorsa_id))
    r = result.scalar_one_or_none()
    if not r:
        return None
    from datetime import date as date_type
    def parse_date(v):
        if not v: return None
        if isinstance(v, date_type): return v
        try: return date_type.fromisoformat(str(v))
        except: return None

    date_fields = {'data_inizio', 'data_fine'}
    skip_fields = {'id', 'created_at', 'updated_at', 'costo_orario_calcolato'}
    for k, v in payload.items():
        if k in skip_fields: continue
        if hasattr(r, k):
            setattr(r, k, parse_date(v) if k in date_fields else v)
    # Ricalcola costo orario
    d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
    r.costo_orario_calcolato = Decimal(str(calcola_costo_orario(d)))
    await db.commit()
    await db.refresh(r)
    return r


async def delete_risorsa(db: AsyncSession, risorsa_id: uuid.UUID):
    from app.models.models import Risorsa
    result = await db.execute(select(Risorsa).where(Risorsa.id == risorsa_id))
    r = result.scalar_one_or_none()
    if not r:
        return False
    await db.delete(r)
    await db.commit()
    return True

async def get_progetto_with_servizi(db: AsyncSession, progetto_id):
    from app.models.models import Progetto, ServizioProgetto
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Progetto).options(selectinload(Progetto.servizi)).where(Progetto.id == progetto_id)
    )
    return result.scalar_one_or_none()

# ── SERVIZI PROGETTO ──────────────────────────────────────
async def get_servizi_progetto(db: AsyncSession, progetto_id: uuid.UUID):
    from app.models.models import ServizioProgetto
    result = await db.execute(
        select(ServizioProgetto).where(ServizioProgetto.progetto_id == progetto_id).order_by(ServizioProgetto.created_at)
    )
    return result.scalars().all()

async def create_servizio_progetto(db: AsyncSession, progetto_id: uuid.UUID, data):
    from app.models.models import ServizioProgetto
    s = ServizioProgetto(
        progetto_id=progetto_id,
        tipo=data.tipo,
        nome=data.nome,
        valore_fisso=data.valore_fisso,
        valore_variabile=data.valore_variabile,
        contenuti_previsti=data.contenuti_previsti,
        cadenza=data.cadenza,
        attivo=data.attivo,
        note=data.note,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s

async def update_servizio_progetto(db: AsyncSession, servizio_id: uuid.UUID, data):
    from app.models.models import ServizioProgetto
    result = await db.execute(select(ServizioProgetto).where(ServizioProgetto.id == servizio_id))
    s = result.scalar_one_or_none()
    if not s:
        return None
    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(s, field, val)
    await db.commit()
    await db.refresh(s)
    return s

async def delete_servizio_progetto(db: AsyncSession, servizio_id: uuid.UUID):
    from app.models.models import ServizioProgetto
    result = await db.execute(select(ServizioProgetto).where(ServizioProgetto.id == servizio_id))
    s = result.scalar_one_or_none()
    if s:
        await db.delete(s)
        await db.commit()
    return s


async def elimina_timesheet_bulk(
    db: AsyncSession,
    ids: list,
    approver
) -> dict:
    """Elimina in bulk una lista di timesheet. Solo PM e ADMIN."""
    if approver.ruolo not in (UserRole.ADMIN, UserRole.PM):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo PM e ADMIN possono eliminare le ore")

    result = await db.execute(
        select(Timesheet).where(Timesheet.id.in_(ids))
    )
    entries = result.scalars().all()
    count = len(entries)
    for t in entries:
        await db.delete(t)
    await db.commit()
    return {"eliminati": count}


async def aggiorna_mese_competenza_bulk(
    db: AsyncSession,
    ids: list,
    mese_competenza,
    approver
) -> dict:
    """Aggiorna mese_competenza in bulk. Solo PM e ADMIN."""
    if approver.ruolo not in (UserRole.ADMIN, UserRole.PM):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo PM e ADMIN possono modificare il mese competenza")

    result = await db.execute(
        select(Timesheet).where(Timesheet.id.in_(ids))
    )
    entries = result.scalars().all()
    count = len(entries)
    for t in entries:
        t.mese_competenza = mese_competenza
    await db.flush()
    await db.commit()
    return {"aggiornati": count}
