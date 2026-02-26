"""
services.py — Tutta la business logic separata dagli endpoint.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.models.models import (
    User, Cliente, Progetto, Commessa, CommessaProgetto, Timesheet, Task,
    Costo, AuditLog, CoefficienteAllocazione,
    UserRole, CommessaStatus, TimesheetStatus
)
from app.schemas.schemas import (
    UserCreate, UserUpdate, ClienteCreate, ClienteUpdate,
    ProgettoCreate, ProgettoUpdate, CommessaCreate, CommessaUpdate,
    TimesheetCreate, CostoCreate, CoefficienteCreate, TimesheetApprova
)
from app.core.security import hash_password

DEFAULT_COEFFICIENTE_ALLOCAZIONE = Decimal("0.30")


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
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(user, field, val)
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
    if data.costi_diretti is not None:
        c.costi_diretti = data.costi_diretti
    if data.note is not None:
        c.note = data.note

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

    nuovo_stato = TimesheetStatus.APPROVATO if data.azione == "APPROVA" else TimesheetStatus.RIFIUTATO
    result = await db.execute(
        select(Timesheet).where(
            and_(Timesheet.id.in_(data.ids), Timesheet.stato == TimesheetStatus.PENDING)
        )
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

    await db.flush()
    return entries


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
