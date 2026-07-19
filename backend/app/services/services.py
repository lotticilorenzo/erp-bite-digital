"""
services.py — Tutta la business logic separata dagli endpoint.
"""
import uuid
import logging
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Optional, List
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text, delete
from sqlalchemy.orm import selectinload, joinedload

from app.models.models import (
    User, Cliente, Progetto, Commessa, CommessaProgetto, Timesheet, Task,
    AuditLog, CoefficienteAllocazione,
    Fornitore, FatturaAttiva, FatturaPassiva, FicSyncRun, CategoriaFornitore,
    Preventivo, PreventivoVoce,
    UserRole, CommessaStatus, TaskStatus, TimesheetStatus, TimerSession, PreventivoStatus,
    ProjectType,
    ProgettoTeam, ServizioProgetto, MovimentoCassa,
    BudgetCategory, WikiCategoria,
    Notification, Pianificazione,
    TaskAssegnatario,
)
from app.schemas.schemas import (
    UserCreate, UserUpdate, ClienteCreate, ClienteUpdate,
    ProgettoCreate, ProgettoUpdate, CommessaCreate, CommessaUpdate,
    TimesheetCreate, TimesheetApprova,
    FornitoreOut,
    PreventivoCreate, PreventivoUpdate
)
from app.core.config import settings
from app.core.security import hash_password, ensure_erp_access_user, has_erp_access
from app.core.permissions import get_user_access_scope, can_access_project
from fastapi import HTTPException

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


# ── MARGINE: FONTE UNICA (brief §4.2) ─────────────────────
# Soglie semaforo sul MARGINE LORDO %: verde >40 / giallo 20–40 / arancio 0–20 / rosso <0.
MARGINE_VERDE_PCT = Decimal("40")
MARGINE_GIALLO_PCT = Decimal("20")
MARGINE_ARANCIO_PCT = Decimal("0")


def semaforo_margine_lordo(pct: Optional[float]) -> str:
    """Semaforo canonico sul margine lordo %. Unica sorgente delle bande (Decisione 3)."""
    if pct is None:
        return "grigio"
    if pct < float(MARGINE_ARANCIO_PCT):
        return "rosso"
    if pct < float(MARGINE_GIALLO_PCT):
        return "arancio"
    if pct < float(MARGINE_VERDE_PCT):
        return "giallo"
    return "verde"


# ── QUOTA LUCA: allocazione pro-forma per output (Prompt 4, brief §2.6) ────
async def _build_quota_cache_mese(db: AsyncSession, mese_norm: date) -> dict:
    """Aggregato pro-mese per la quota pro-forma (1 query). Evita N+1 nell'helper margine.

    proforma = Σ risorse attive con quota_proforma_mensile configurata (destinatari).
    totale/per_cliente = contenuti del mese con cliente RISOLVIBILE, PESATI per tipo (brief §7.5):
    n = SUM(peso) dalla tabella configurabile pesi_contenuto (LEFT JOIN; tipo senza riga pesa 1).
    (commessa→cliente, fallback progetto→cliente). I contenuti senza cliente sono esclusi,
    così Σ quote sui clienti == proforma (ripartizione al 100%, numeratore e denominatore stessa mappa).
    Mese contenuto = COALESCE(pubblicato_at, data_consegna_prevista, created_at).
    """
    pf = await db.execute(text(
        "SELECT COALESCE(SUM(quota_proforma_mensile), 0) FROM risorse "
        "WHERE attivo = true AND quota_proforma_mensile IS NOT NULL"
    ))
    proforma = Decimal(str(pf.scalar() or 0))

    rows = await db.execute(text(
        """
        SELECT COALESCE(comm.cliente_id, prog.cliente_id) AS cliente_id,
               SUM(COALESCE(pc.peso, 1)) AS n
        FROM contenuti ct
        LEFT JOIN commesse comm ON comm.id = ct.commessa_id
        LEFT JOIN progetti prog ON prog.id = ct.progetto_id
        LEFT JOIN pesi_contenuto pc ON pc.tipo = ct.tipo::text
        WHERE date_trunc('month', COALESCE(ct.pubblicato_at, ct.data_consegna_prevista::timestamptz, ct.created_at))::date = :mese
          AND COALESCE(comm.cliente_id, prog.cliente_id) IS NOT NULL
        GROUP BY 1
        """
    ), {"mese": mese_norm})
    per_cliente: dict = {}
    totale = Decimal("0")
    for r in rows.all():
        peso_cli = Decimal(str(r.n or 0))
        per_cliente[r.cliente_id] = peso_cli
        totale += peso_cli
    return {"proforma": proforma, "totale": totale, "per_cliente": per_cliente}


async def calcola_quota_luca(
    db: AsyncSession,
    cliente_id: Optional[uuid.UUID],
    mese: date,
    *,
    quota_cache: Optional[dict] = None,
) -> Decimal:
    """Quota pro-forma allocata a un cliente nel mese = proforma × (contenuti_cliente / contenuti_totali).

    Robustezza: se nessun contenuto allocabile nel mese (totale==0) o nessun pro-forma
    configurato → 0 (niente divisione per zero). Cliente con 0 contenuti → 0.
    """
    mese_norm = mese.replace(day=1)
    entry = quota_cache.get(mese_norm) if quota_cache is not None else None
    if entry is None:
        entry = await _build_quota_cache_mese(db, mese_norm)
        if quota_cache is not None:
            quota_cache[mese_norm] = entry

    if entry["proforma"] == 0:
        return Decimal("0")
    if entry["totale"] == 0:
        logger.info("quota Luca: nessun contenuto allocabile nel mese %s, quota=0", mese_norm)
        return Decimal("0")
    n = entry["per_cliente"].get(cliente_id, 0)
    if n == 0:
        return Decimal("0")
    return (entry["proforma"] * Decimal(n) / Decimal(entry["totale"])).quantize(Decimal("0.01"))


async def calcola_margine_commessa(
    db: AsyncSession,
    commessa: Commessa,
    *,
    coeff_cache: Optional[dict[date, Decimal]] = None,
    quota_cache: Optional[dict] = None,
    ovh_cache: Optional[dict] = None,
    costo_manodopera_override: Optional[Decimal] = None,
) -> dict:
    """FONTE UNICA del margine commessa (brief §4.2).

    Numero-titolo = MARGINE LORDO (PRIMA degli overhead/indiretti):
        margine_lordo = ricavo − costo_manodopera − costi_diretti_totali
    Base manodopera = snapshot approvati (commessa.costo_manodopera), salvo override esplicito
    (usato solo per esporre una stima "live" separata, non canonica).
    Gli overhead restano esposti come campi SEPARATI (costi_indiretti / margine_operativo)
    per il P&L di Fase 3, NON sottratti dal margine canonico.
    """
    mese_norm = commessa.mese_competenza.replace(day=1)
    coefficiente = coeff_cache.get(mese_norm) if coeff_cache is not None else None
    if coefficiente is None:
        coefficiente = await get_coefficiente_allocazione(db, mese_norm)
        if coeff_cache is not None:
            coeff_cache[mese_norm] = coefficiente

    ricavo = commessa.valore_fatturabile_calc  # include righe_progetto + aggiustamenti
    if costo_manodopera_override is not None:
        costo_manodopera = costo_manodopera_override
    else:
        costo_manodopera = commessa.costo_manodopera or Decimal("0")  # snapshot approvati (Decisione 2)
    costi_diretti_totali = commessa.costi_diretti_totali  # manuali + imputati (R3)

    # Quota Luca pro-forma allocata per output (Prompt 4): voce di costo nel margine lordo.
    quota_luca = await calcola_quota_luca(db, commessa.cliente_id, mese_norm, quota_cache=quota_cache)

    # MARGINE LORDO canonico — NON include gli indiretti (Decisione 1, brief §4.2)
    margine_lordo_euro = ricavo - costo_manodopera - costi_diretti_totali - quota_luca

    # Campi SEPARATI per il P&L di Fase 3 (non sono il numero-titolo)
    costi_indiretti = costo_manodopera * coefficiente
    margine_operativo_euro = margine_lordo_euro - costi_indiretti

    margine_lordo_pct = None
    if ricavo and ricavo > 0:
        margine_lordo_pct = round(float((margine_lordo_euro / ricavo) * 100), 1)

    # ── OVH -> MARGINE NETTO (AGGIUNTA, spec §4.5, inv. 17). NON modifica i campi esistenti. ──
    # Coefficiente OVH effective-dated (riga piu' recente <= periodo commessa; None se assente).
    # Base = ricavi (inv. 17 v1). Lo scarto vs overhead reale NON si spalma (resta varianza aziendale).
    from decimal import ROUND_HALF_UP
    if ovh_cache is not None and mese_norm in ovh_cache:
        coeff_ovh = ovh_cache[mese_norm]
    else:
        coeff_ovh = await _ultimo_coefficiente(db, mese_norm, incluso=True)
        if ovh_cache is not None:
            ovh_cache[mese_norm] = coeff_ovh
    ovh_caricato = margine_netto = margine_netto_pct = None
    if coeff_ovh is not None:
        ovh_caricato = (coeff_ovh * ricavo).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        margine_netto = margine_lordo_euro - ovh_caricato
        if ricavo and ricavo > 0:
            margine_netto_pct = round(float((margine_netto / ricavo) * 100), 1)

    return {
        "ricavo": ricavo,
        "costo_manodopera": costo_manodopera,
        "costi_diretti_totali": costi_diretti_totali,
        "margine_lordo_euro": margine_lordo_euro,
        "margine_lordo_pct": margine_lordo_pct,
        "semaforo": semaforo_margine_lordo(margine_lordo_pct),
        "quota_luca": quota_luca,
        "coefficiente_allocazione": coefficiente,
        "costi_indiretti": costi_indiretti,
        "margine_operativo_euro": margine_operativo_euro,
        # Nuovi campi OVH (additivi)
        "coefficiente_ovh_applicato": coeff_ovh,
        "ovh_caricato": ovh_caricato,
        "margine_netto": margine_netto,
        "margine_netto_pct": margine_netto_pct,
    }


async def calcola_metriche_commessa(
    db: AsyncSession,
    commessa: Commessa,
    coeff_cache: Optional[dict[date, Decimal]] = None,
) -> dict:
    """Adapter legacy sopra calcola_margine_commessa (nessuna formula duplicata).

    `margine_euro`/`margine_percentuale` ora sono il MARGINE LORDO canonico (brief §4.2).
    """
    m = await calcola_margine_commessa(db, commessa, coeff_cache=coeff_cache)
    return {
        "valore_fatturabile": m["ricavo"],
        "coefficiente_allocazione": m["coefficiente_allocazione"],
        "costi_indiretti_allocati": m["costi_indiretti"],
        "margine_euro": m["margine_lordo_euro"],
        "margine_percentuale": m["margine_lordo_pct"],
        "margine_operativo_euro": m["margine_operativo_euro"],
        "semaforo": m["semaforo"],
    }


# ── AUDIT ─────────────────────────────────────────────────
async def write_audit(
    db: AsyncSession, user_id: uuid.UUID,
    tabella: str, record_id: uuid.UUID,
    azione: str, prima: dict = None, dopo: dict = None
):
    # I campi dati_prima/dati_dopo sono colonne JSON: vanno resi serializzabili (UUID/Decimal/date
    # -> str) altrimenti l'INSERT fallisce con TypeError. Riuso l'helper gia' usato da audit.emit.
    from app.services.audit import _json_safe
    log = AuditLog(
        user_id=user_id, tabella=tabella, record_id=record_id,
        azione=azione, dati_prima=_json_safe(prima), dati_dopo=_json_safe(dopo)
    )
    db.add(log)


# ── USER SERVICE ──────────────────────────────────────────
async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID | str) -> Optional[User]:
    if isinstance(user_id, str):
        try:
            user_id = uuid.UUID(user_id)
        except ValueError:
            return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_identifier(db: AsyncSession, identifier: str) -> Optional[User]:
    """Cerca utente per email esatta o per 'handle' (parte prima della @)."""
    # 1. Prova email esatta
    user = await get_user_by_email(db, identifier)
    if user:
        return user
    
    # 2. Prova handle (se non contiene @)
    if "@" not in identifier:
        result = await db.execute(
            select(User).where(User.email.like(f"{identifier}@%"))
        )
        return result.scalar_one_or_none()
    
    return None

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
    q = select(Cliente).where(Cliente.is_deleted == False)
    if attivo is not None:
        q = q.where(Cliente.attivo == attivo)
    result = await db.execute(q.order_by(Cliente.ragione_sociale))
    return result.scalars().all()

async def get_cliente(db: AsyncSession, cliente_id: uuid.UUID) -> Optional[Cliente]:
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id, Cliente.is_deleted == False))
    return result.scalar_one_or_none()

async def create_cliente(db: AsyncSession, data: ClienteCreate) -> Cliente:
    c = Cliente(**data.model_dump())
    db.add(c)
    await db.flush()
    
    # Automazione Chat: Crea un canale per il cliente
    try:
        from app.models.models import ChatCanale, ChatMembro, User, UserRole
        chat_id = uuid.uuid4()
        chat = ChatCanale(
            id=chat_id,
            nome=f"Chat: {c.ragione_sociale}",
            tipo="GROUP",
            logo_url=c.logo_url
        )
        db.add(chat)
        
        # Aggiunge tutti gli Admin alla chat automaticamente
        admin_res = await db.execute(select(User).where(User.ruolo == UserRole.ADMIN))
        admins = admin_res.scalars().all()
        for admin in admins:
            db.add(ChatMembro(canale_id=chat_id, user_id=admin.id, ruolo='ADMIN'))
            
        await db.flush()
    except Exception as e:
        logger.error(f"Errore creazione chat automatica cliente: {e}")
        
    return c

async def update_cliente(db: AsyncSession, cliente_id: uuid.UUID, data: ClienteUpdate, by_user_id: uuid.UUID) -> Optional[Cliente]:
    try:
        c = await get_cliente(db, cliente_id)
        if not c:
            return None
        prima = {"ragione_sociale": c.ragione_sociale, "attivo": c.attivo}
        # exclude_unset (non exclude_none): il FE (ClienteDialog) invia uno snapshot completo del
        # form con i null voluti, quindi un campo passato a null deve poter essere azzerato (B-04).
        for field, val in data.model_dump(exclude_unset=True).items():
            setattr(c, field, val)
        await write_audit(db, by_user_id, "clienti", cliente_id, "UPDATE", prima)
        await db.flush()
        return c
    except Exception as e:
        logger.error(f"DATABASE ERROR updating client {cliente_id}: {str(e)}")
        if hasattr(e, 'orig'):
            logger.error(f"Original DB error: {e.orig}")
        raise e

async def delete_cliente(db: AsyncSession, cliente_id: uuid.UUID, by_user_id: uuid.UUID) -> bool:
    from fastapi import HTTPException
    c = await get_cliente(db, cliente_id)
    if not c:
        return False

    # Verifica commesse aperte collegate
    commesse_res = await db.execute(
        select(func.count()).where(
            Commessa.cliente_id == cliente_id,
            Commessa.stato.in_([CommessaStatus.APERTA, CommessaStatus.PRONTA_CHIUSURA])
        )
    )
    n_commesse = commesse_res.scalar_one()
    if n_commesse > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Impossibile eliminare: {n_commesse} commesse aperte collegate al cliente"
        )

    await write_audit(db, by_user_id, "clienti", cliente_id, "DELETE", {"ragione_sociale": c.ragione_sociale})
    from datetime import datetime, timezone
    c.is_deleted = True
    c.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return True

async def get_client_health_score(db: AsyncSession, cliente_id: uuid.UUID) -> dict:
    """
    Calcola un punteggio di salute (0-100) basato su 4 fattori:
    1. Margine (40%): Media ultimi 3 mesi. Target 50% = 100pt.
    2. Pagamenti (30%): Puntualità ultimi 12 mesi.
    3. Revisioni (20%): Scope creep ultimi 12 mesi.
    4. Longevità (10%): Anzianità rapporto (>1 anno = 100pt).
    """
    cliente = await get_cliente(db, cliente_id)
    if not cliente:
        return {"score": 0, "factors": {}}

    one_year_ago = date.today() - timedelta(days=365)
    three_months_ago = date.today() - timedelta(days=90)

    # --- 1. MARGINE (40%) ---
    # Media marginalità sulle commesse ultimi 3 mesi
    m_stmt = select(Commessa).where(
        Commessa.cliente_id == cliente_id, 
        Commessa.mese_competenza >= three_months_ago
    ).options(selectinload(Commessa.righe_progetto))
    m_res = await db.execute(m_stmt)
    commesse_recenti = m_res.scalars().all()
    
    margin_sum = 0
    margin_count = 0
    for c in commesse_recenti:
        metriche = await calcola_metriche_commessa(db, c)
        if metriche["margine_percentuale"] is not None:
            margin_sum += metriche["margine_percentuale"]
            margin_count += 1
    
    avg_margin = margin_sum / margin_count if margin_count > 0 else 0
    # Score: 50% margine = 100pt
    margin_score = min(100, avg_margin * 2) if avg_margin > 0 else 0

    # --- 2. PAGAMENTI (30%) ---
    # Rapporto fatture pagate vs totali ultimi 12 mesi
    f_stmt = select(FatturaAttiva).where(FatturaAttiva.cliente_id == cliente_id, FatturaAttiva.data_emissione >= one_year_ago)
    f_res = await db.execute(f_stmt)
    fatture = f_res.scalars().all()
    
    total_f = len(fatture)
    paid_f = len([f for f in fatture if f.stato_pagamento == "INCASSATA"])
    payment_score = (paid_f / total_f * 100) if total_f > 0 else 100 # Se no fatture, assumiamo buono

    # --- 3. REVISIONI / SCOPE CREEP (20%) ---
    # Ore reali vs ore contratto ultimi 12 mesi
    r_stmt = select(Commessa).where(
        Commessa.cliente_id == cliente_id, 
        Commessa.mese_competenza >= one_year_ago
    ).options(selectinload(Commessa.righe_progetto))
    r_res = await db.execute(r_stmt)
    commesse_anno = r_res.scalars().all()

    # H-05: ore reali per commessa in UNA query aggregata invece di una SELECT per commessa (N+1)
    commessa_ids = [c.id for c in commesse_anno]
    ore_per_commessa: dict = {}
    if commessa_ids:
        agg_res = await db.execute(
            select(Timesheet.commessa_id, func.sum(Timesheet.durata_minuti))
            .where(Timesheet.commessa_id.in_(commessa_ids))
            .group_by(Timesheet.commessa_id)
        )
        ore_per_commessa = {cid: (tot or 0) for cid, tot in agg_res.all()}

    creep_sum = 0
    creep_count = 0
    for c in commesse_anno:
        if c.ore_contratto and c.ore_contratto > 0:
            ore_reali = ore_per_commessa.get(c.id, 0) / 60
            ratio = ore_reali / float(c.ore_contratto)
            creep_sum += ratio
            creep_count += 1
    
    avg_creep_ratio = creep_sum / creep_count if creep_count > 0 else 1.0
    # Se ratio = 1.0 -> 100pt. Se ratio = 1.5 -> 0pt.
    revisions_score = max(0, 100 - (max(0, avg_creep_ratio - 1.0) * 200))

    # --- 4. LONGEVITA (10%) ---
    # Anno di creazione
    days_old = (date.today() - cliente.created_at.date()).days if cliente.created_at else 0
    longevity_score = min(100, (days_old / 365 * 100))

    total_score = round(
        (margin_score * 0.4) + 
        (payment_score * 0.3) + 
        (revisions_score * 0.2) + 
        (longevity_score * 0.1)
    )

    return {
        "score": total_score,
        "factors": {
            "margine": round(margin_score),
            "pagamenti": round(payment_score),
            "revisioni": round(revisions_score),
            "longevita": round(longevity_score)
        },
        "details": {
            "avg_margin_pct": round(avg_margin, 1),
            "invoices_paid": f"{paid_f}/{total_f}",
            "avg_scope_creep": f"{avg_creep_ratio:.2f}x",
            "days_with_us": days_old
        }
    }

# ── PROGETTO SERVICE ──────────────────────────────────────
async def list_progetti(
    db: AsyncSession,
    cliente_id: Optional[uuid.UUID] = None,
    stato: Optional[str] = None
) -> List[Progetto]:
    q = select(Progetto).options(
        selectinload(Progetto.cliente),
        selectinload(Progetto.team).selectinload(ProgettoTeam.user),
        selectinload(Progetto.servizi)
    ).where(Progetto.is_deleted == False)
    if cliente_id:
        q = q.where(Progetto.cliente_id == cliente_id)
    if stato:
        q = q.where(Progetto.stato == stato)
    result = await db.execute(q.order_by(Progetto.nome))
    return result.unique().scalars().all()

async def get_progetto(db: AsyncSession, progetto_id: uuid.UUID) -> Optional[Progetto]:
    result = await db.execute(
        select(Progetto).options(
            selectinload(Progetto.cliente),
            selectinload(Progetto.team).selectinload(ProgettoTeam.user),
            selectinload(Progetto.servizi)
        )
        .where(Progetto.id == progetto_id, Progetto.is_deleted == False)
    )
    return result.unique().scalar_one_or_none()

async def create_progetto(db: AsyncSession, data: ProgettoCreate) -> Progetto:
    # Estrae i dati del team prima di creare l'oggetto Progetto
    team_data = data.team if data.team is not None else []
    
    # Crea il progetto escludendo il team dal dump
    project_dict = data.model_dump(exclude={'team'})
    p = Progetto(**project_dict)
    db.add(p)
    await db.flush()
    
    # Aggiunge i membri del team
    for t_member in team_data:
        db.add(ProgettoTeam(
            progetto_id=p.id,
            user_id=t_member.user_id,
            ruolo_progetto=t_member.ruolo_progetto,
            ore_previste=t_member.ore_previste,
            note=t_member.note
        ))
    
    await db.flush()
    
    # Automazione Chat: Crea un canale per il progetto
    try:
        from app.models.models import ChatCanale, Cliente, ChatMembro, User, UserRole
        # Recupera logo cliente se possibile
        c_res = await db.execute(select(Cliente).where(Cliente.id == p.cliente_id))
        cliente = c_res.scalar_one_or_none()
        
        chat_id = uuid.uuid4()
        chat = ChatCanale(
            id=chat_id,
            nome=f"Progetto: {p.nome}",
            tipo="PROJECT",
            progetto_id=p.id,
            logo_url=cliente.logo_url if cliente else None
        )
        db.add(chat)
        
        # Aggiunge tutti gli Admin alla chat automaticamente
        admin_res = await db.execute(select(User).where(User.ruolo == UserRole.ADMIN))
        admins = admin_res.scalars().all()
        for admin in admins:
            db.add(ChatMembro(canale_id=chat_id, user_id=admin.id, ruolo='ADMIN'))

        await db.flush()
    except Exception as e:
        logger.error(f"Errore creazione chat automatica progetto: {e}")
        
    return p

async def update_progetto(db: AsyncSession, progetto_id: uuid.UUID, data: ProgettoUpdate, by_user_id: uuid.UUID) -> Optional[Progetto]:
    p = await get_progetto(db, progetto_id)
    if not p:
        return None
    prima = {"stato": p.stato, "importo_fisso": str(p.importo_fisso)}
    
    # Estrae il team se presente
    update_dict = data.model_dump(exclude_none=True)
    team_data = update_dict.pop('team', None)
    
    # Aggiorna i campi base
    for field, val in update_dict.items():
        setattr(p, field, val)
    
    # Aggiorna il team se fornito (sovrascrive il precedente)
    if team_data is not None:
        # Rimuove il vecchio team (la relazione ha cascade="all, delete-orphan")
        p.team = [
            ProgettoTeam(
                progetto_id=p.id,
                user_id=t['user_id'],
                ruolo_progetto=t.get('ruolo_progetto'),
                ore_previste=t.get('ore_previste', 0),
                note=t.get('note')
            ) for t in team_data
        ]
        
    await write_audit(db, by_user_id, "progetti", progetto_id, "UPDATE", prima)
    await db.flush()
    return p

async def get_progetto_with_servizi(db: AsyncSession, progetto_id: uuid.UUID) -> Optional[Progetto]:
    result = await db.execute(
        select(Progetto).options(
            selectinload(Progetto.cliente),
            selectinload(Progetto.servizi),
            selectinload(Progetto.team).selectinload(ProgettoTeam.user)
        )
        .where(Progetto.id == progetto_id, Progetto.is_deleted == False)
    )
    return result.unique().scalar_one_or_none()


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
        selectinload(Commessa.timesheet),
        selectinload(Commessa.fattura),
        selectinload(Commessa.pianificazione).selectinload(Pianificazione.lavorazioni)
    ).where(Commessa.is_deleted == False)
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
            selectinload(Commessa.timesheet),
            selectinload(Commessa.fattura),
            selectinload(Commessa.pianificazione).selectinload(Pianificazione.lavorazioni)
        )
        .where(Commessa.id == commessa_id, Commessa.is_deleted == False)
    )
    return result.unique().scalar_one_or_none()

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
        ore_contratto=data.ore_contratto,
        data_inizio=data.data_inizio,
        data_fine=data.data_fine,
        pianificazione_id=data.pianificazione_id,
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
    ensure_erp_access_user(current_user)
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

    if data.righe_progetto is not None:
        from fastapi import HTTPException

        progetto_ids = [r.progetto_id for r in data.righe_progetto]
        
        # 1. Fetch ALL existing rows for this commessa
        existing_rows_result = await db.execute(
            select(CommessaProgetto).where(CommessaProgetto.commessa_id == c.id)
        )
        all_existing_rows = {r.progetto_id: r for r in existing_rows_result.scalars().all()}
        
        # 2. Delete rows that are not in the new payload
        for pid, row in list(all_existing_rows.items()):
            if pid not in progetto_ids:
                await db.delete(row)
                del all_existing_rows[pid]

        # 3. Validate and fetch projects for new/updated rows
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

        # 4. Update or Add rows
        for riga_patch in data.righe_progetto:
            row = all_existing_rows.get(riga_patch.progetto_id)
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

    # Trigger scope creep check
    from app.services.notification_service import check_commessa_scope_creep
    await check_commessa_scope_creep(db, commessa_id)

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

    # Trigger scope creep check se assegnato a una commessa
    if t.commessa_id:
        from app.services.notification_service import check_commessa_scope_creep
        await check_commessa_scope_creep(db, t.commessa_id)

    return t

async def list_timesheet(
    db: AsyncSession,
    user_id: Optional[uuid.UUID] = None,
    mese: Optional[date] = None,
    stato: Optional[TimesheetStatus] = None,
    commessa_id: Optional[uuid.UUID] = None,
    limit: int = 500,
    skip: int = 0,
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
    result = await db.execute(q.order_by(Timesheet.data_attivita.desc()).offset(skip).limit(limit))
    return result.scalars().all()

async def approva_timesheet(
    db: AsyncSession,
    data: TimesheetApprova,
    approver: User
) -> List[Timesheet]:
    """Approva o rifiuta un batch di timesheet. Solo ADMIN, DEVELOPER e COLLABORATORE."""
    if approver.ruolo not in (UserRole.ADMIN, UserRole.DEVELOPER, UserRole.COLLABORATORE):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo ADMIN, DEVELOPER e COLLABORATORE possono approvare le ore")

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

    # Pre-carica i costi orari per lo snapshot all'approvazione.
    # Sorgente primaria: costo orario fully-loaded della risorsa collegata all'utente
    # (risorse.user_id -> users.id). Fallback: users.costo_orario (campo piatto).
    user_cost_map: dict[uuid.UUID, Decimal] = {}      # fallback: users.costo_orario
    risorsa_cost_map: dict[uuid.UUID, Decimal] = {}   # fully-loaded per user_id
    if nuovo_stato == TimesheetStatus.APPROVATO and entries:
        from app.models.models import Risorsa
        user_ids = {t.user_id for t in entries}
        users_result = await db.execute(
            select(User.id, User.costo_orario).where(User.id.in_(user_ids))
        )
        for row in users_result.all():
            user_cost_map[row.id] = Decimal(row.costo_orario or 0)

        # costo_orario_effettivo = override se presente, altrimenti calcolato (fully-loaded)
        risorse_result = await db.execute(
            select(
                Risorsa.user_id,
                Risorsa.costo_orario_override,
                Risorsa.costo_orario_calcolato,
            ).where(Risorsa.user_id.in_(user_ids))
        )
        for row in risorse_result.all():
            fl = row.costo_orario_override or row.costo_orario_calcolato
            if row.user_id is not None and fl and Decimal(fl) > 0:
                risorsa_cost_map[row.user_id] = Decimal(fl)

    commesse_da_ricalcolare: set[uuid.UUID] = set()
    for t in entries:
        t.stato = nuovo_stato
        t.approvato_da = approver.id
        t.approvato_at = datetime.utcnow()
        if t.commessa_id is not None:
            commesse_da_ricalcolare.add(t.commessa_id)
        if nuovo_stato == TimesheetStatus.APPROVATO:
            costo_orario = risorsa_cost_map.get(t.user_id)
            if costo_orario is None:
                # Fallback robusto: risorsa mancante o costo FL nullo/zero.
                costo_orario = user_cost_map.get(t.user_id, Decimal("0"))
                logger.warning(
                    "approva_timesheet: costo fully-loaded assente per user_id=%s; "
                    "uso fallback users.costo_orario=%s",
                    t.user_id, costo_orario,
                )
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

    # R5: ricalcola e PERSISTE commessa.costo_manodopera come snapshot all'approvazione.
    # Solo le commesse toccate dal batch; somma dei costo_lavoro dei timesheet APPROVATI.
    if commesse_da_ricalcolare:
        from app.models.models import Commessa
        sums_result = await db.execute(
            select(
                Timesheet.commessa_id,
                func.coalesce(func.sum(Timesheet.costo_lavoro), 0),
            )
            .where(
                Timesheet.commessa_id.in_(commesse_da_ricalcolare),
                Timesheet.stato == TimesheetStatus.APPROVATO,
            )
            .group_by(Timesheet.commessa_id)
        )
        nuovi_costi = {row[0]: Decimal(row[1] or 0) for row in sums_result.all()}
        commesse_result = await db.execute(
            select(Commessa).where(Commessa.id.in_(commesse_da_ricalcolare))
        )
        for commessa in commesse_result.scalars().all():
            commessa.costo_manodopera = nuovi_costi.get(commessa.id, Decimal("0"))

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
    """Marginalità per cliente — aggrega i valori per-commessa dalla FONTE UNICA del margine.

    Nessuna formula duplicata: somma per cliente i campi di calcola_margine_commessa.
    `margine_euro`/`margine_percentuale` sono il MARGINE LORDO canonico (brief §4.2);
    gli indiretti/operativo restano esposti come campi separati.
    """
    commesse = await list_commesse(db, mese)
    coeff_cache: dict[date, Decimal] = {}
    quota_cache: dict = {}
    ovh_cache: dict = {}

    acc: dict[uuid.UUID, dict] = {}
    for c in commesse:
        m = await calcola_margine_commessa(db, c, coeff_cache=coeff_cache, quota_cache=quota_cache, ovh_cache=ovh_cache)
        agg = acc.get(c.cliente_id)
        if agg is None:
            agg = {
                "cliente_id": c.cliente_id,
                "ragione_sociale": c.cliente.ragione_sociale if c.cliente else "?",
                "fatturato": Decimal("0"),
                "costo_manodopera": Decimal("0"),
                "costi_diretti": Decimal("0"),
                "costi_indiretti_allocati": Decimal("0"),
                "quota_luca": Decimal("0"),
                "margine_euro": Decimal("0"),           # lordo (canonico, al netto quota Luca)
                "margine_operativo_euro": Decimal("0"),
                "ovh_caricato": Decimal("0"),           # AGGIUNTA OVH (inv. 17)
                "_ovh_ok": True,                        # False se una commessa non ha coefficiente
                "num_commesse": 0,
            }
            acc[c.cliente_id] = agg
        agg["fatturato"] += m["ricavo"]
        agg["costo_manodopera"] += m["costo_manodopera"]
        agg["costi_diretti"] += m["costi_diretti_totali"]
        agg["costi_indiretti_allocati"] += m["costi_indiretti"]
        agg["quota_luca"] += m["quota_luca"]
        agg["margine_euro"] += m["margine_lordo_euro"]
        agg["margine_operativo_euro"] += m["margine_operativo_euro"]
        if m["ovh_caricato"] is None:
            agg["_ovh_ok"] = False
        else:
            agg["ovh_caricato"] += m["ovh_caricato"]
        agg["num_commesse"] += 1

    result = []
    for agg in acc.values():
        fatturato = float(agg["fatturato"])
        margine_euro = float(agg["margine_euro"])
        pct = round(margine_euro / fatturato * 100, 1) if fatturato > 0 else 0
        result.append({
            "cliente_id": agg["cliente_id"],
            "ragione_sociale": agg["ragione_sociale"],
            "fatturato": fatturato,
            "costo_manodopera": float(agg["costo_manodopera"]),
            "costi_diretti": float(agg["costi_diretti"]),
            "costi_indiretti_allocati": float(agg["costi_indiretti_allocati"]),
            "quota_luca": float(agg["quota_luca"]),
            "margine_euro": margine_euro,
            "margine_operativo_euro": float(agg["margine_operativo_euro"]),
            "margine_percentuale": pct,
            "semaforo": semaforo_margine_lordo(pct if fatturato > 0 else None),
            # AGGIUNTA OVH: netto = lordo - ovh caricato (None se manca il coefficiente per una commessa)
            "ovh_caricato": float(agg["ovh_caricato"]) if agg["_ovh_ok"] else None,
            "margine_netto": (margine_euro - float(agg["ovh_caricato"])) if agg["_ovh_ok"] else None,
            "margine_netto_percentuale": (
                round((margine_euro - float(agg["ovh_caricato"])) / fatturato * 100, 1)
                if agg["_ovh_ok"] and fatturato > 0 else None),
            "num_commesse": agg["num_commesse"],
        })
    result.sort(key=lambda x: x["margine_euro"], reverse=True)
    return result


# ── DASHBOARD LIQUIDITÀ (brief §5.1) — tutto DERIVATO, nessun ricalcolo ──────────
async def calcola_dashboard_liquidita(
    db: AsyncSession,
    soglia_uscita: Optional[Decimal] = None,
    orizzonte_giorni: int = 90,
) -> dict:
    """KPI liquidità: prossima uscita significativa + fatture scadute per cliente.
    Consuma gli helper di espansione uscite esistenti (NON ricalcola e NON tocca
    calcola_proiezione_cassa, così il suo output resta invariato)."""
    oggi = date.today()
    # Soglia dal registro effective-dated (data operativa = oggi, §19.4); override esplicito > registro
    # > costante di fallback (inv. 22: il valore del registro = 500 -> invarianza).
    if soglia_uscita is None:
        par = await get_parametro(db, "soglia_uscita", oggi)
        soglia_uscita = Decimal(str(par["valore"])) if par and par.get("valore") is not None else Decimal("500")
    fine = oggi + timedelta(days=max(int(orizzonte_giorni), 1))

    # §5.1a — occorrenze datate delle uscite (costi fissi + variabili PREVISTO + fiscali quantificate)
    occ: list[tuple] = []
    for (d, imp, desc) in await _espandi_costi_fissi(db, oggi, fine, Decimal("0")):
        occ.append((d, desc, Decimal(str(imp)), "COSTO_FISSO"))
    for (d, imp, desc) in await _espandi_costi_variabili(db, oggi, fine):
        occ.append((d, desc, Decimal(str(imp)), "COSTO_VARIABILE"))
    scad = await calcola_scadenzario_fiscale(db, oggi, fine)
    for s in scad.get("scadenze", []):
        imp = s.get("importo_stimato")
        if imp is None:
            continue
        impd = Decimal(str(imp))
        if impd <= 0:
            continue
        occ.append((date.fromisoformat(s["data"]), s["voce"], impd, "FISCALE"))

    candidati = sorted(
        [(d, voce, imp, cat) for (d, voce, imp, cat) in occ if d >= oggi and imp > soglia_uscita],
        key=lambda o: o[0],
    )
    prossima_uscita = None
    if candidati:
        d, voce, imp, cat = candidati[0]
        prossima_uscita = {"data": str(d), "voce": voce, "importo": float(imp), "categoria": cat}

    # §5.1b — fatture attive scadute (residuo>0, scadenza passata)
    rows = await db.execute(text(
        """
        SELECT fa.id, fa.cliente_id, COALESCE(c.ragione_sociale, '?') AS ragione_sociale,
               fa.numero, fa.data_scadenza, fa.importo_residuo,
               (CURRENT_DATE - fa.data_scadenza) AS giorni_ritardo
        FROM fatture_attive fa
        LEFT JOIN clienti c ON c.id = fa.cliente_id
        WHERE fa.importo_residuo > 0 AND fa.data_scadenza < CURRENT_DATE
        ORDER BY fa.data_scadenza ASC
        """
    ))
    dettaglio = []
    per_cliente: dict = {}
    totale_scaduto = Decimal("0")
    for r in rows.all():
        residuo = Decimal(str(r.importo_residuo or 0))
        totale_scaduto += residuo
        dettaglio.append({
            "fattura_id": str(r.id),
            "cliente_id": str(r.cliente_id) if r.cliente_id else None,
            "ragione_sociale": r.ragione_sociale,
            "numero": r.numero,
            "data_scadenza": str(r.data_scadenza),
            "importo_residuo": float(residuo),
            "giorni_ritardo": int(r.giorni_ritardo),
        })
        pc = per_cliente.setdefault(r.ragione_sociale, {"ragione_sociale": r.ragione_sociale, "tot": Decimal("0"), "n": 0})
        pc["tot"] += residuo
        pc["n"] += 1
    per_cliente_list = sorted(
        [{"ragione_sociale": v["ragione_sociale"], "totale_scaduto": float(v["tot"]), "num_fatture": v["n"]}
         for v in per_cliente.values()],
        key=lambda x: x["totale_scaduto"], reverse=True,
    )

    return {
        "oggi": str(oggi),
        "soglia_uscita": float(soglia_uscita),
        "orizzonte_giorni": int(orizzonte_giorni),
        "prossima_uscita_significativa": prossima_uscita,
        "fatture_scadute": {
            "totale_scaduto": float(totale_scaduto),
            "num_fatture": len(dettaglio),
            "per_cliente": per_cliente_list,
            "dettaglio": dettaglio,
        },
    }


# ── KPI CONCENTRAZIONE CLIENTI (brief §5.3) — consuma get_marginalita_clienti ────
async def calcola_kpi_clienti(
    db: AsyncSession,
    mese: date,
    soglia_margine_pct: Optional[Decimal] = None,
    soglia_alert_clienti: Optional[int] = None,
) -> dict:
    """KPI clienti: n. clienti a margine basso (+alert) e ricavo medio/cliente con trend MoM.
    Consuma get_marginalita_clienti (FONTE UNICA del margine) — nessuna formula nuova."""
    from dateutil.relativedelta import relativedelta

    mese_norm = mese.replace(day=1)
    # Soglie dal registro (gruppo marginalita, 1 sola query — no N+1). Data operativa = oggi (§19.4).
    # Override esplicito > registro > costante di fallback (inv. 22: valori registro = 20/2 -> invarianza).
    if soglia_margine_pct is None or soglia_alert_clienti is None:
        g = await get_parametri_gruppo(db, "marginalita", date.today())
        if soglia_margine_pct is None:
            soglia_margine_pct = g.get("soglia_margine_pct") if g.get("soglia_margine_pct") is not None else Decimal("20")
        if soglia_alert_clienti is None:
            soglia_alert_clienti = g.get("soglia_alert_clienti") if g.get("soglia_alert_clienti") is not None else 2
    soglia = float(soglia_margine_pct)
    correnti = await get_marginalita_clienti(db, mese_norm)

    # §5.3a — clienti con margine sotto soglia (esclusi i fatturato=0: non significativi)
    bassi = [c for c in correnti if c["fatturato"] > 0 and c["margine_percentuale"] < soglia]
    count = len(bassi)
    clienti_margine_basso = {
        "soglia_margine_pct": soglia,
        "soglia_alert_clienti": int(soglia_alert_clienti),
        "count": count,
        "alert": count > int(soglia_alert_clienti),
        "clienti": [
            {"cliente_id": str(c["cliente_id"]), "ragione_sociale": c["ragione_sociale"],
             "margine_percentuale": c["margine_percentuale"], "fatturato": c["fatturato"]}
            for c in bassi
        ],
    }

    # §5.3b — ricavo medio per cliente + trend mese-su-mese
    def _medio(lst):
        attivi = [c for c in lst if c["fatturato"] > 0]
        tot = sum(c["fatturato"] for c in attivi)
        n = len(attivi)
        return tot, n, (tot / n if n else None)

    tot_c, n_c, med_c = _medio(correnti)
    mese_prec = mese_norm - relativedelta(months=1)
    precedenti = await get_marginalita_clienti(db, mese_prec)
    tot_p, n_p, med_p = _medio(precedenti)

    trend = None
    if med_c is not None and med_p:
        delta = med_c - med_p
        trend = {
            "delta_euro": round(delta, 2),
            "delta_pct": round(delta / med_p * 100, 1),
            "segno": "+" if delta >= 0 else "-",
        }

    ricavo_medio_cliente = {
        "mese": str(mese_norm),
        "ricavo_totale": round(tot_c, 2),
        "n_clienti": n_c,
        "ricavo_medio": round(med_c, 2) if med_c is not None else None,
        "mese_precedente": str(mese_prec),
        "n_clienti_precedente": n_p,
        "ricavo_medio_precedente": round(med_p, 2) if med_p is not None else None,
        "trend": trend,
    }

    return {
        "mese": str(mese_norm),
        "clienti_margine_basso": clienti_margine_basso,
        "ricavo_medio_cliente": ricavo_medio_cliente,
    }


# ── DSO ENGINE + RISCHIO CONCENTRAZIONE (Fase 2, brief §3.1/§5.3) ──────────
DSO_FALLBACK_GIORNI = 30          # se < 2 fatture incassate
DSO_PESSIMISTA_BUFFER = 15        # giorni extra sullo scenario pessimista
DSO_FALLBACK_PESSIMISTA = 45      # fallback pessimista (30 + 15)
CONCENTRAZIONE_TOP1_PCT = 25
CONCENTRAZIONE_TOP3_PCT = 60


async def _dso_storico_per_cliente(db: AsyncSession, finestra_mesi: int = 12) -> tuple[dict, int, Optional[float]]:
    """Storico DSO per cliente da fatture incassate completamente nella FINESTRA ROLLING (spec §4.1).

    Incassata completa = importo_residuo=0 AND data_ultimo_incasso NOT NULL.
    giorni = data_ultimo_incasso − data_emissione (misura da DATA FATTURA, §6.1); NEGATIVI esclusi.
    Finestra: solo fatture con data_emissione negli ultimi `finestra_mesi` mesi.
    Ritorna (storico_per_cliente, scartati, media_aziendale). media_aziendale = DSO medio PONDERATO
    su TUTTE le fatture incassate nella finestra (ogni incasso pesa 1): stabile e non distorto dai
    clienti con pochissime fatture. None se non ci sono incassi nella finestra.
    """
    from dateutil.relativedelta import relativedelta
    cutoff = date.today() - relativedelta(months=max(int(finestra_mesi), 1))
    p = {"cutoff": cutoff}
    rows = await db.execute(text(
        """
        SELECT cliente_id,
               COUNT(*) AS n,
               AVG(data_ultimo_incasso - data_emissione) AS dso_medio,
               MIN(data_ultimo_incasso - data_emissione) AS dso_min,
               MAX(data_ultimo_incasso - data_emissione) AS dso_max
        FROM fatture_attive
        WHERE importo_residuo = 0
          AND data_ultimo_incasso IS NOT NULL
          AND data_emissione IS NOT NULL
          AND cliente_id IS NOT NULL
          AND data_ultimo_incasso >= data_emissione
          AND data_emissione >= :cutoff
        GROUP BY cliente_id
        """
    ), p)
    storico: dict = {}
    for r in rows.all():
        storico[r.cliente_id] = {
            "n": int(r.n),
            "dso_medio": float(r.dso_medio),
            "dso_min": int(r.dso_min),
            "dso_max": int(r.dso_max),
        }
    # Media aziendale ponderata (tutte le fatture incassate nella finestra).
    med = await db.execute(text(
        "SELECT AVG(data_ultimo_incasso - data_emissione) FROM fatture_attive "
        "WHERE importo_residuo = 0 AND data_ultimo_incasso IS NOT NULL AND data_emissione IS NOT NULL "
        "AND data_ultimo_incasso >= data_emissione AND data_emissione >= :cutoff"
    ), p)
    mv = med.scalar()
    media_aziendale = float(mv) if mv is not None else None
    # Conteggio scartati (giorni negativi) nella finestra.
    neg = await db.execute(text(
        "SELECT COUNT(*) FROM fatture_attive "
        "WHERE importo_residuo = 0 AND data_ultimo_incasso IS NOT NULL "
        "AND data_emissione IS NOT NULL AND data_ultimo_incasso < data_emissione "
        "AND data_emissione >= :cutoff"
    ), p)
    scartati = int(neg.scalar() or 0)
    return storico, scartati, media_aziendale


def _dso_cliente(storico: dict, cliente_id, campione_min: int, media_aziendale: Optional[float]) -> dict:
    """DSO effettivo (spec §4.1): PROPRIO se n >= campione_min; altrimenti EREDITATO dalla media
    aziendale; se nemmeno quella è disponibile, ultima rete = costante DSO_FALLBACK_GIORNI."""
    s = storico.get(cliente_id)
    if s and s["n"] >= campione_min:
        return {"dso_medio": round(s["dso_medio"], 1), "dso_min": s["dso_min"], "dso_max": s["dso_max"],
                "n_fatture_finestra": s["n"], "fonte": "proprio", "is_fallback": False}
    n = s["n"] if s else 0
    if media_aziendale is not None:
        return {"dso_medio": round(media_aziendale, 1), "dso_min": None, "dso_max": None,
                "n_fatture_finestra": n, "fonte": "aziendale", "is_fallback": True}
    return {"dso_medio": float(DSO_FALLBACK_GIORNI), "dso_min": None, "dso_max": None,
            "n_fatture_finestra": n, "fonte": "fallback_costante", "is_fallback": True}


async def calcola_dso_aziendale(db: AsyncSession, dal: date = None, al: date = None) -> dict:
    """DSO AZIENDALE (KPI di bilancio, spec §12): (crediti aperti / fatturato periodo) * giorni.
    Distinto dal DSO COMPORTAMENTALE per cliente (_dso_storico_per_cliente / /report/dso), che
    resta invariato. None se fatturato del periodo = 0 (mai divisione per zero, mai 0 come risultato)."""
    al = al or date.today()
    dal = dal or (al - timedelta(days=90))
    giorni = (al - dal).days
    # crediti aperti alla data di riferimento = Σ residuo delle fatture non ancora incassate.
    crediti = (await db.execute(text(
        "SELECT COALESCE(SUM(importo_residuo), 0) FROM fatture_attive "
        "WHERE importo_residuo > 0 AND data_emissione IS NOT NULL AND data_emissione <= :al"
    ), {"al": al})).scalar() or 0
    # fatturato del periodo = Σ imponibile delle fatture emesse in [dal, al].
    fatturato = (await db.execute(text(
        "SELECT COALESCE(SUM(importo_netto), 0) FROM fatture_attive "
        "WHERE data_emissione IS NOT NULL AND data_emissione >= :dal AND data_emissione <= :al"
    ), {"dal": dal, "al": al})).scalar() or 0
    crediti = Decimal(str(crediti))
    fatturato = Decimal(str(fatturato))
    dso = None
    if fatturato > 0:
        dso = float((crediti / fatturato * giorni).quantize(Decimal("0.1")))
    return {
        "dso_aziendale_gg": dso,
        "crediti_aperti": float(crediti),
        "fatturato_periodo": float(fatturato),
        "giorni_periodo": giorni,
        "periodo": {"dal": str(dal), "al": str(al)},
    }


async def calcola_dso(db: AsyncSession, window_mesi: int = 12) -> dict:
    """DSO engine: storico per cliente, scenari incasso sulle fatture aperte, concentrazione ricavo."""
    from app.models.models import Cliente, Commessa, FatturaAttiva
    from dateutil.relativedelta import relativedelta

    warning: list[str] = []
    # Parametri dal registro (effective-dated, data operativa = oggi), fallback ai valori spec.
    oggi = date.today()
    par_f = await get_parametro(db, "dso_finestra_mesi", oggi)
    finestra_mesi = int(par_f["valore"]) if par_f and par_f.get("valore") is not None else 12
    par_c = await get_parametro(db, "dso_campione_minimo", oggi)
    campione_min = int(par_c["valore"]) if par_c and par_c.get("valore") is not None else 5
    storico, scartati, media_aziendale = await _dso_storico_per_cliente(db, finestra_mesi)
    if scartati:
        warning.append(f"{scartati} fatture con data_ultimo_incasso < data_emissione escluse dallo storico (dato sporco).")

    # Nomi clienti (una query)
    cli_rows = await db.execute(select(Cliente.id, Cliente.ragione_sociale))
    nomi = {cid: rs for cid, rs in cli_rows.all()}

    # 1) DSO per cliente (tutti i clienti con storico o con fatture aperte)
    aperte_res = await db.execute(
        select(FatturaAttiva).where(FatturaAttiva.importo_residuo > 0)
    )
    fatture_aperte_rows = aperte_res.scalars().all()
    cliente_ids = set(storico.keys()) | {f.cliente_id for f in fatture_aperte_rows if f.cliente_id}

    clienti = []
    for cid in cliente_ids:
        d = _dso_cliente(storico, cid, campione_min, media_aziendale)
        clienti.append({
            "cliente_id": str(cid),
            "cliente": nomi.get(cid, "?"),
            "dso_medio": d["dso_medio"],
            "dso_min": d["dso_min"],
            "dso_max": d["dso_max"],
            "n_fatture_finestra": d["n_fatture_finestra"],
            "fonte": d["fonte"],              # proprio | aziendale | fallback_costante (provenienza, §4.1)
            "is_fallback": d["is_fallback"],
        })
    clienti.sort(key=lambda x: x["dso_medio"], reverse=True)

    # 2) Scenari per ogni fattura aperta
    fatture_aperte = []
    for f in fatture_aperte_rows:
        d = _dso_cliente(storico, f.cliente_id, campione_min, media_aziendale)
        emiss = f.data_emissione
        if emiss is None:
            warning.append(f"Fattura {f.numero or f.id}: data_emissione mancante, scenari non calcolabili.")
            base = ott = pess = None
        else:
            # base sempre sul dso_medio effettivo (proprio o media aziendale); min/max solo se PROPRIO.
            medio = round(d["dso_medio"])
            base = emiss + timedelta(days=medio)
            ott = emiss + timedelta(days=d["dso_min"] if d["dso_min"] is not None else medio)
            pess_gg = (d["dso_max"] + DSO_PESSIMISTA_BUFFER) if d["dso_max"] is not None else (medio + DSO_PESSIMISTA_BUFFER)
            pess = emiss + timedelta(days=pess_gg)
        fatture_aperte.append({
            "id": str(f.id),
            "numero": f.numero,
            "cliente_id": str(f.cliente_id) if f.cliente_id else None,
            "cliente": nomi.get(f.cliente_id, "?"),
            "importo_residuo": float(f.importo_residuo or 0),
            "data_emissione": str(emiss) if emiss else None,
            "data_attesa_base": str(base) if base else None,
            "data_attesa_ottimista": str(ott) if ott else None,
            "data_attesa_pessimista": str(pess) if pess else None,
            "is_fallback": d["is_fallback"],
        })

    # 3) Concentrazione ricavo (stessa base Fase 1: valore_fatturabile_calc, include aggiustamenti)
    oggi = date.today()
    window_start = (oggi.replace(day=1) - relativedelta(months=max(window_mesi, 1) - 1))
    comm_res = await db.execute(
        select(Commessa).options(
            selectinload(Commessa.righe_progetto), selectinload(Commessa.cliente)
        ).where(Commessa.is_deleted == False, Commessa.mese_competenza >= window_start)
    )
    fatt_per_cliente: dict = {}
    for c in comm_res.scalars().unique().all():
        fatt_per_cliente[c.cliente_id] = fatt_per_cliente.get(c.cliente_id, Decimal("0")) + c.valore_fatturabile_calc

    totale = sum(fatt_per_cliente.values()) or Decimal("0")
    pesi = []
    for cid, fatt in fatt_per_cliente.items():
        peso_pct = round(float(fatt) / float(totale) * 100, 1) if totale > 0 else 0.0
        pesi.append({"cliente_id": str(cid), "cliente": nomi.get(cid, "?"),
                     "fatturato": float(fatt), "peso_pct": peso_pct})
    pesi.sort(key=lambda x: x["peso_pct"], reverse=True)

    top1_pct = pesi[0]["peso_pct"] if pesi else 0.0
    top3_pct = round(sum(p["peso_pct"] for p in pesi[:3]), 1)
    concentrazione = {
        "window_mesi": window_mesi,
        "window_start": str(window_start),
        "ricavo_totale": float(totale),
        "n_clienti": len(pesi),
        "top3": [{"cliente": p["cliente"], "peso_pct": p["peso_pct"]} for p in pesi[:3]],
        "clienti": pesi,
        "alert_top_oltre_25": top1_pct > CONCENTRAZIONE_TOP1_PCT,
        "alert_top3_oltre_60": top3_pct > CONCENTRAZIONE_TOP3_PCT,
    }

    return {
        "clienti": clienti,
        "fatture_aperte": fatture_aperte,
        "concentrazione": concentrazione,
        "warning": warning,
    }


# ── SALDO CASSA + PROIEZIONE CASSA ROLLING 90gg (Fase 2, Layer 3, §4.1) ────
async def get_ultimo_saldo(db: AsyncSession):
    from app.models.models import SaldoCassa
    res = await db.execute(
        select(SaldoCassa).order_by(SaldoCassa.data.desc(), SaldoCassa.created_at.desc()).limit(1)
    )
    return res.scalar_one_or_none()


async def create_saldo(db: AsyncSession, data, saldo, nota=None):
    from app.models.models import SaldoCassa
    obj = SaldoCassa(data=data or date.today(), saldo=Decimal(str(saldo)), nota=nota)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


_PERIODO_MESI = {"mensile": 1, "semestrale": 6, "annuale": 12}
_PERIODO_DIVISORE = {"mensile": Decimal("1"), "semestrale": Decimal("6"), "annuale": Decimal("12")}


async def _espandi_costi_fissi(db: AsyncSession, start: date, end: date, uscite_var: Decimal):
    """Espande i costi fissi attivi in occorrenze (data, importo) nella finestra [start, end].

    Ancora di ricorrenza = giorno di data_inizio; relativedelta gestisce il clamp fine-mese.
    Rispetta data_inizio/data_fine. `uscite_var` (>0) = uscita mensile ancorata al giorno di start.
    """
    from dateutil.relativedelta import relativedelta
    from app.models.models import CostoFisso

    res = await db.execute(select(CostoFisso).where(CostoFisso.attivo == True))
    costi = res.scalars().all()

    occorrenze: list[tuple] = []
    for c in costi:
        step = _PERIODO_MESI.get((c.periodicita or "mensile").lower(), 1)
        anchor = c.data_inizio or start
        importo = c.importo or Decimal("0")
        # porta la prima occorrenza a <= start, poi avanza fino a end
        k = 0
        occ = anchor
        # fast-forward se l'ancora e' molto prima di start
        while occ < start:
            k += 1
            occ = anchor + relativedelta(months=step * k)
        while occ <= end:
            if occ >= start and occ >= anchor and (c.data_fine is None or occ <= c.data_fine):
                occorrenze.append((occ, importo, c.descrizione))
            k += 1
            occ = anchor + relativedelta(months=step * k)

    # Uscite variabili mensili: ancorate al giorno di start
    if uscite_var and uscite_var > 0:
        k = 0
        occ = start
        while occ <= end:
            occorrenze.append((occ, uscite_var, "Uscite variabili (stima)"))
            k += 1
            occ = start + relativedelta(months=k)

    return occorrenze


def _soglia_operativa(costi) -> Decimal:
    """Σ costi fissi attivi normalizzati a €/mese (mensile=1, semestrale/6, annuale/12)."""
    tot = Decimal("0")
    for c in costi:
        div = _PERIODO_DIVISORE.get((c.periodicita or "mensile").lower(), Decimal("1"))
        tot += (c.importo or Decimal("0")) / div
    return tot.quantize(Decimal("0.01"))


def _zona_cassa(saldo: Decimal, soglia: Decimal) -> str:
    if saldo < soglia:
        return "rossa"
    if saldo <= soglia * Decimal("1.5"):
        return "gialla"
    return "verde"


async def _espandi_costi_variabili(db: AsyncSession, start: date, end: date):
    """Espande il registro costi variabili (brief §2.5) in occorrenze (data, importo, descrizione)
    nella finestra [start, end]. Solo stato PREVISTO: lo stato SOSTENUTO e' escluso (gancio anti
    doppio conteggio — diventera'/e' gia' una fattura passiva reale). ricorrenza='MENSILE' espande
    mensilmente da data_prevista (ancora = giorno di data_prevista); altrimenti occorrenza singola.
    NB: questo alimenta SOLO la proiezione cassa, NON margine/P&L."""
    from dateutil.relativedelta import relativedelta
    from app.models.models import CostoVariabile

    res = await db.execute(select(CostoVariabile).where(CostoVariabile.stato == "PREVISTO"))
    occorrenze: list[tuple] = []
    for cv in res.scalars().all():
        anchor = cv.data_prevista
        importo = cv.importo or Decimal("0")
        if (cv.ricorrenza or "").upper() == "MENSILE":
            k = 0
            occ = anchor
            while occ < start:
                k += 1
                occ = anchor + relativedelta(months=k)
            while occ <= end:
                if occ >= start and occ >= anchor:
                    occorrenze.append((occ, importo, cv.descrizione))
                k += 1
                occ = anchor + relativedelta(months=k)
        else:
            if start <= anchor <= end:
                occorrenze.append((anchor, importo, cv.descrizione))
    return occorrenze


async def calcola_proiezione_cassa(
    db: AsyncSession,
    giorni: int = 90,
    uscite_variabili_mensili: Decimal = Decimal("0"),
) -> dict:
    """Proiezione cassa rolling su `giorni`, 3 scenari (base/ottimista/pessimista).

    Entrate = fatture aperte collocate alla data attesa dal DSO (consumato, non ricalcolato).
    Uscite = costi fissi espansi + registro costi variabili (PREVISTO, datati, brief §2.5)
    + param manuale uscite_variabili_mensili (supplemento) + scadenze fiscali QUANTIFICATE
    (IVA dallo scadenzario; le voci con importo null NON entrano nel saldo). Le uscite sono
    identiche nei 3 scenari: cambia solo la DATA delle entrate. I costi variabili NON toccano margine/P&L.
    TODO(Fase 3): saldo da estratto conto/riconciliazione; importi F24/ritenute/IRPEF
    (oggi non quantificati) quando disponibili da cedolino/commercialista.
    """
    from app.models.models import CostoFisso

    warning: list[str] = []
    giorni = max(int(giorni), 1)
    uscite_var = Decimal(str(uscite_variabili_mensili or 0))

    saldo_rec = await get_ultimo_saldo(db)
    if saldo_rec is None:
        start = date.today()
        saldo_iniziale = Decimal("0")
        warning.append("Saldo non impostato: proiezione a partire da 0. Imposta un saldo con POST /saldo-cassa.")
    else:
        start = saldo_rec.data
        saldo_iniziale = saldo_rec.saldo or Decimal("0")
    end = start + timedelta(days=giorni - 1)

    # Entrate dal DSO (consumato)
    dso = await calcola_dso(db)
    scenari = ("base", "ottimista", "pessimista")
    entrate = {s: [Decimal("0")] * giorni for s in scenari}
    for f in dso["fatture_aperte"]:
        residuo = Decimal(str(f.get("importo_residuo") or 0))
        if residuo <= 0:
            continue
        for s, key in (("base", "data_attesa_base"), ("ottimista", "data_attesa_ottimista"), ("pessimista", "data_attesa_pessimista")):
            ds = f.get(key)
            if not ds:
                continue
            d = date.fromisoformat(ds)
            idx = (d - start).days
            if idx < 0:
                idx = 0  # overdue: collocata al giorno 0
            if idx <= giorni - 1:
                entrate[s][idx] += residuo

    # Uscite (identiche nei 3 scenari)
    uscite = [Decimal("0")] * giorni
    for (d, imp, _desc) in await _espandi_costi_fissi(db, start, end, uscite_var):
        idx = (d - start).days
        if 0 <= idx <= giorni - 1:
            uscite[idx] += imp

    # Registro costi variabili (brief §2.5): uscite DATATE, solo stato PREVISTO, identiche nei 3
    # scenari (data fissa, indipendente dal DSO). NON entrano in margine/P&L. Il parametro manuale
    # uscite_variabili_mensili resta come supplemento opzionale per cio' che non e' nel registro.
    uscite_var_registro = Decimal("0")
    for (d, imp, _desc) in await _espandi_costi_variabili(db, start, end):
        idx = (d - start).days
        if 0 <= idx <= giorni - 1:
            uscite[idx] += imp
            uscite_var_registro += imp
    if uscite_var_registro > 0 and uscite_var > 0:
        warning.append(
            "Registro costi variabili E parametro uscite_variabili_mensili entrambi attivi: "
            "assicurati di non contare due volte gli stessi importi."
        )

    # Uscite fiscali QUANTIFICATE (consuma lo scadenzario, non ricalcola l'IVA).
    # Solo importo_stimato non null e > 0 (IVA con saldo>0) entra nel saldo, alla data fissa
    # (indipendente dallo scenario). Le voci con importo null restano fuori, esposte a parte.
    scad = await calcola_scadenzario_fiscale(db, start, end)
    scadenze_fiscali_incluse: list[dict] = []
    scadenze_fiscali_non_quantificate: list[dict] = []
    for s in scad.get("scadenze", []):
        imp = s.get("importo_stimato")
        if imp is None:
            scadenze_fiscali_non_quantificate.append({
                "data": s["data"], "voce": s["voce"], "certezza": s["certezza"], "note": s.get("note"),
            })
            continue
        imp_d = Decimal(str(imp))
        if imp_d <= 0:
            continue  # IVA a credito/zero: non e' un'uscita
        idx = (date.fromisoformat(s["data"]) - start).days
        if 0 <= idx <= giorni - 1:
            uscite[idx] += imp_d
            scadenze_fiscali_incluse.append({"data": s["data"], "voce": s["voce"], "importo": float(imp_d)})
    if scadenze_fiscali_non_quantificate:
        warning.append("Alcune scadenze fiscali non sono quantificate (cedolino/commercialista) e non sono incluse nella curva.")

    # Soglia operativa (solo costi fissi normalizzati)
    costi_attivi = (await db.execute(select(CostoFisso).where(CostoFisso.attivo == True))).scalars().all()
    soglia = _soglia_operativa(costi_attivi)

    # Saldo progressivo per scenario
    saldo = {s: [] for s in scenari}
    for s in scenari:
        acc = saldo_iniziale
        for g in range(giorni):
            acc += entrate[s][g] - uscite[g]
            saldo[s].append(acc)

    Q = lambda x: float(Decimal(x).quantize(Decimal("0.01")))

    # Vista A — giornaliera
    vista_giornaliera = []
    prima_giornata_critica = None
    for g in range(giorni):
        sb = saldo["base"][g]
        if prima_giornata_critica is None and sb < soglia:
            prima_giornata_critica = str(start + timedelta(days=g))
        vista_giornaliera.append({
            "data": str(start + timedelta(days=g)),
            "saldo_base": Q(sb),
            "saldo_ottimista": Q(saldo["ottimista"][g]),
            "saldo_pessimista": Q(saldo["pessimista"][g]),
            "zona": _zona_cassa(sb, soglia),
        })

    # Vista B — settimanale (blocchi di 7gg, scenario base)
    vista_settimanale = []
    n_sett = (giorni + 6) // 7
    for w in range(n_sett):
        a, b = w * 7, min(w * 7 + 6, giorni - 1)
        ent = sum(entrate["base"][a:b + 1], Decimal("0"))
        usc = sum(uscite[a:b + 1], Decimal("0"))
        vista_settimanale.append({
            "settimana": w + 1,
            "settimana_inizio": str(start + timedelta(days=a)),
            "entrate": Q(ent),
            "uscite": Q(usc),
            "saldo_netto": Q(ent - usc),
            "saldo_cumulato": Q(saldo["base"][b]),
        })

    # Vista C — mensile (blocchi di 30gg, scenario base)
    vista_mensile = []
    n_mesi = (giorni + 29) // 30
    for m in range(n_mesi):
        a, b = m * 30, min(m * 30 + 29, giorni - 1)
        ini = saldo["base"][a - 1] if a > 0 else saldo_iniziale
        ent = sum(entrate["base"][a:b + 1], Decimal("0"))
        usc = sum(uscite[a:b + 1], Decimal("0"))
        vista_mensile.append({
            "mese": m + 1,
            "saldo_iniziale": Q(ini),
            "entrate": Q(ent),
            "uscite": Q(usc),
            "saldo_finale": Q(saldo["base"][b]),
        })

    return {
        "giorni": giorni,
        "data_inizio": str(start),
        "saldo_iniziale": Q(saldo_iniziale),
        "soglia_operativa": Q(soglia),
        "prima_giornata_critica": prima_giornata_critica,
        "vista_giornaliera": vista_giornaliera,
        "vista_settimanale": vista_settimanale,
        "vista_mensile": vista_mensile,
        "scadenze_fiscali_incluse": scadenze_fiscali_incluse,
        "scadenze_fiscali_non_quantificate": scadenze_fiscali_non_quantificate,
        "uscite_variabili_registro": Q(uscite_var_registro),
        "warning": warning,
    }


# ── P&L GESTIONALE MENSILE (brief §5.2, Fase 3 core — fiscale escluso) ────
# ARCHITETTURA OVERHEAD (anti doppio conteggio):
#   - risorse.costo_orario_calcolato = costo DIRETTO per ora (lordo+contributi+TFR / ore produttive).
#     NON contiene overhead di struttura (il vecchio +30% e' stato rimosso da calcola_costo_orario).
#   - L'overhead di struttura e' allocato SOLO nel pricing floor via calcola_tasso_overhead (§3.3).
#   - Qui nel P&L i costi fissi di struttura indivisibili sono sottratti UNA sola volta.
# Le categorie STIPENDI/personale restano comunque ESCLUSE dai fissi indivisibili perche' la
# manodopera e' gia' contata nei costi diretti (costo_manodopera): evita di duplicare i salari.
_PL_CATEGORIE_PERSONALE = {"STIPENDI", "PERSONALE", "SALARI", "RAL", "PAYROLL_DIPENDENTI"}

# Ruoli con tariffa gia' fully-loaded: NON caricano overhead di struttura (brief §3.3),
# quindi sono esclusi dal denominatore del tasso overhead.
_RUOLI_FULLY_LOADED = {"FREELANCER", "PRESTAZIONE_OCCASIONALE"}


async def costi_fissi_indivisibili_mese(db: AsyncSession, mese: date) -> tuple[Decimal, list, list]:
    """Costi fissi di struttura INDIVISIBILI del mese, normalizzati EUR/mese.

    FONTE UNICA condivisa da calcola_pl_gestionale (che li sottrae UNA sola volta) e da
    calcola_tasso_overhead (numeratore §3.3). Esclude le categorie 'personale'
    (gia' nel costo orario diretto) per non duplicare la manodopera.
    Ritorna (totale, incluse, escluse).
    """
    from app.models.models import CostoFisso
    from dateutil.relativedelta import relativedelta

    mese_norm = mese.replace(day=1)
    fine_mese = (mese_norm + relativedelta(months=1)) - timedelta(days=1)
    res_cf = await db.execute(select(CostoFisso).where(CostoFisso.attivo == True))
    incluse, escluse = [], []
    totale = Decimal("0")
    for cf in res_cf.scalars().all():
        # filtro temporale: attivo nel mese
        if cf.data_inizio and cf.data_inizio > fine_mese:
            continue
        if cf.data_fine and cf.data_fine < mese_norm:
            continue
        cat = (cf.categoria or "").upper()
        div = _PERIODO_DIVISORE.get((cf.periodicita or "mensile").lower(), Decimal("1"))
        mensile = ((cf.importo or Decimal("0")) / div).quantize(Decimal("0.01"))
        voce = {"descrizione": cf.descrizione, "categoria": cf.categoria,
                "periodicita": cf.periodicita, "importo_mensile": float(mensile)}
        if cat in _PL_CATEGORIE_PERSONALE:
            voce["motivo_esclusione"] = "personale gia' nel costo orario fully-loaded (no doppio conteggio)"
            escluse.append(voce)
        else:
            incluse.append(voce)
            totale += mensile
    return totale, incluse, escluse


async def calcola_tasso_overhead(db: AsyncSession, mese: date) -> dict:
    """Tasso overhead di struttura in EUR/ora produttiva (brief §3.3):

        tasso_overhead = costi_fissi_indivisibili_mensili / ore_produttive_mensili_team

    Allocato SOLO ai ruoli che caricano struttura (dipendenti): i freelancer hanno
    tariffe gia' fully-loaded e sono esclusi dal denominatore. Usato dal PRICING FLOOR;
    NON entra nel costo orario diretto ne' nel margine/P&L (che sottrae i fissi a parte).
    Ore produttive = _ore_vendibili_annue(...) / 12 sulle risorse attive non-freelancer.
    Ritorna un dict con tasso + base di calcolo (per trasparenza nel breakdown).
    """
    from app.models.models import Risorsa

    mese_norm = mese.replace(day=1)
    fissi_mensili, _, _ = await costi_fissi_indivisibili_mese(db, mese_norm)
    res = await db.execute(select(Risorsa).where(Risorsa.attivo == True))
    ore_team = 0.0
    n_dipendenti = 0
    for r in res.scalars().all():
        if (r.tipo_contratto or "").upper() in _RUOLI_FULLY_LOADED:
            continue
        ov = _ore_vendibili_annue(
            float(r.ore_settimanali or 40),
            float(r.giorni_ferie or 26),
            float(r.giorni_malattia or 3),
        ) / 12.0
        if ov > 0:
            ore_team += ov
            n_dipendenti += 1

    if ore_team <= 0:
        return {
            "tasso_overhead": Decimal("0"),
            "costi_fissi_mensili": fissi_mensili,
            "ore_produttive_team_mese": Decimal("0"),
            "n_dipendenti": 0,
            "warning": "Nessuna risorsa dipendente attiva con ore produttive > 0: tasso overhead = 0.",
        }
    tasso = (fissi_mensili / Decimal(str(ore_team))).quantize(Decimal("0.01"))
    return {
        "tasso_overhead": tasso,
        "costi_fissi_mensili": fissi_mensili,
        "ore_produttive_team_mese": Decimal(str(round(ore_team, 2))),
        "n_dipendenti": n_dipendenti,
        "warning": None,
    }


# ── CONFIG MEMO CLIENTE/COLLABORATORE DEDICATO (P&L §7.6) ──
async def get_config_pl_memo(db: AsyncSession):
    """Config singleton del memo §7.6 (riga id=1, creata dalla migration). Ritorna il record o None."""
    from app.models.models import ConfigPlMemo
    return (await db.execute(select(ConfigPlMemo).where(ConfigPlMemo.id == 1))).scalar_one_or_none()


async def update_config_pl_memo(db: AsyncSession, payload: dict):
    from app.models.models import ConfigPlMemo
    cfg = (await db.execute(select(ConfigPlMemo).where(ConfigPlMemo.id == 1))).scalar_one_or_none()
    if cfg is None:
        cfg = ConfigPlMemo(id=1)
        db.add(cfg)
    for k, v in payload.items():
        if hasattr(cfg, k):
            setattr(cfg, k, v)
    await db.commit()
    await db.refresh(cfg)
    return {c.name: getattr(cfg, c.name) for c in cfg.__table__.columns}


async def calcola_pl_gestionale(db: AsyncSession, mese: date) -> dict:
    """Conto economico gestionale del mese (brief §5.2). Consuma calcola_margine_commessa (no ricalcolo).

    Memo §7.6 (cliente dedicato Italfer vs costo collaboratore Paolo G.) IMPLEMENTATO e configurabile
    via config_pl_memo; il costo collaboratore viene dal cedolino (esterno) -> NULL finche' non impostato.
    TODO(Fase 3): scadenzario fiscale IRAP + IRPEF soci (bloccato sul commercialista; Bite e' SAS, no IRES),
    split retainer vs one-shot (dato non strutturato a livello commessa).
    """
    from app.models.models import CostoFisso, FatturaAttiva, FatturaPassiva, ProjectType
    from dateutil.relativedelta import relativedelta

    mese_norm = mese.replace(day=1)
    warning: list[str] = []

    # 1) Ricavi + costi diretti + margine lordo dalle commesse del mese (FONTE UNICA)
    commesse = await list_commesse(db, mese_norm)
    coeff_cache: dict = {}
    quota_cache: dict = {}
    # §7.6: "cliente dedicato" (Italfer) ora da config (id), non piu' match stringa hardcoded.
    cfg_memo = await get_config_pl_memo(db)
    cliente_dedicato_id = cfg_memo.cliente_dedicato_id if cfg_memo else None
    ricavi_totale = Decimal("0")
    ricavi_italfer = Decimal("0")
    ricavi_retainer = Decimal("0")   # §5.2: quota RETAINER dei ricavi non-dedicati
    costi_diretti = Decimal("0")
    margine_lordo = Decimal("0")
    for c in commesse:
        m = await calcola_margine_commessa(db, c, coeff_cache=coeff_cache, quota_cache=quota_cache)
        ricavi_totale += m["ricavo"]
        costi_diretti += m["costo_manodopera"] + m["costi_diretti_totali"] + m["quota_luca"]
        margine_lordo += m["margine_lordo_euro"]
        if cliente_dedicato_id and c.cliente_id == cliente_dedicato_id:
            ricavi_italfer += m["ricavo"]
            continue
        # §5.2: split del ricavo commessa per progetti.tipo (RETAINER vs ONE_OFF).
        # Aggiustamenti (commessa-level, senza tipo) ripartiti PRO-RATA: retainer_part pro-rata
        # l'INTERO ricavo commessa sulla quota righe RETAINER; one_shot e' il residuo (sotto).
        righe_ret = Decimal("0")
        righe_sum = Decimal("0")
        for riga in c.righe_progetto:
            v = riga.valore_fatturabile_calc
            righe_sum += v
            if riga.progetto is not None and riga.progetto.tipo == ProjectType.RETAINER:
                righe_ret += v
        if righe_sum > 0:
            ricavi_retainer += (m["ricavo"] * righe_ret / righe_sum)
        # righe_sum == 0 (soli aggiustamenti / 0 righe) -> retainer_part 0: il ricavo cade nel residuo one_shot.
    # §5.2: one_shot come RESIDUO -> retainer + one_shot + cliente_dedicato == totale ESATTO (al centesimo).
    ricavi_one_shot = (ricavi_totale - ricavi_italfer) - ricavi_retainer
    if ricavi_italfer == 0:
        warning.append("Cliente 'Italfer' non presente: riga ricavo Italfer = 0.")

    # 2) Costi fissi indivisibili = solo gruppo (b), normalizzati EUR/mese, attivi nel mese.
    # FONTE UNICA condivisa col tasso overhead del pricing floor (no doppio conteggio).
    costi_fissi_indivisibili, incluse, escluse = await costi_fissi_indivisibili_mese(db, mese_norm)

    risultato_operativo = margine_lordo - costi_fissi_indivisibili

    # 3) IVA di competenza (MEMO, fuori dal risultato) — per mese di emissione
    iva_a = await db.execute(text(
        "SELECT COALESCE(SUM(importo_iva),0) FROM fatture_attive WHERE date_trunc('month', data_emissione)::date = :m"
    ), {"m": mese_norm})
    iva_p = await db.execute(text(
        "SELECT COALESCE(SUM(importo_iva),0) FROM fatture_passive WHERE date_trunc('month', data_emissione)::date = :m"
    ), {"m": mese_norm})
    iva_attiva = Decimal(str(iva_a.scalar() or 0))
    iva_passiva = Decimal(str(iva_p.scalar() or 0))

    F = lambda x: float(Decimal(x).quantize(Decimal("0.01")))

    # 4) §7.6 MEMO scostamento ricavo cliente dedicato (Italfer) vs costo collaboratore dedicato (Paolo G.).
    # Fuori dal risultato operativo (come l'IVA). Presente SOLO se un cliente dedicato e' configurato.
    # TODO: il costo del collaboratore viene dal cedolino (dato ESTERNO) -> configurabile, NULL finche'
    # non impostato -> scostamento NULL (nessun importo inventato).
    memo_cliente_dedicato = None
    if cliente_dedicato_id:
        from app.models.models import Cliente, Risorsa
        cli_nome = (await db.execute(
            select(Cliente.ragione_sociale).where(Cliente.id == cliente_dedicato_id)
        )).scalar_one_or_none()
        collaboratore_nome = None
        if cfg_memo and cfg_memo.collaboratore_dedicato_id:
            rr = (await db.execute(
                select(Risorsa.nome, Risorsa.cognome).where(Risorsa.id == cfg_memo.collaboratore_dedicato_id)
            )).first()
            if rr:
                collaboratore_nome = f"{rr.nome} {rr.cognome}".strip()
        costo = cfg_memo.costo_collaboratore_mensile if cfg_memo else None
        scostamento = (ricavi_italfer - costo) if costo is not None else None
        memo_cliente_dedicato = {
            "cliente": cli_nome,
            "ricavo_cliente_dedicato": F(ricavi_italfer),
            "collaboratore": collaboratore_nome,
            "costo_collaboratore_dedicato": (F(costo) if costo is not None else None),
            "scostamento": (F(scostamento) if scostamento is not None else None),
            "note": ("Costo collaboratore da cedolino (esterno): impostalo via /config-pl-memo."
                     if costo is None else None),
        }

    # §5.2: valori ricavi quantizzati; one_shot = residuo dei quantizzati -> la somma
    # retainer + one_shot + cliente_dedicato e' ESATTAMENTE == totale al centesimo (invarianza).
    _q = lambda x: Decimal(x).quantize(Decimal("0.01"))
    ric_totale_q = _q(ricavi_totale)
    ric_dedicato_q = _q(ricavi_italfer)
    ric_retainer_q = _q(ricavi_retainer)
    ric_one_shot_q = ric_totale_q - ric_dedicato_q - ric_retainer_q

    out = {
        "mese": str(mese_norm),
        "ricavi": {
            "retainer": float(ric_retainer_q),
            "one_shot": float(ric_one_shot_q),
            "cliente_dedicato": float(ric_dedicato_q),
            "totale": float(ric_totale_q),
        },
        "costi_diretti": F(costi_diretti),
        "margine_lordo_aggregato": F(margine_lordo),
        "costi_fissi_indivisibili": F(costi_fissi_indivisibili),
        "costi_fissi_dettaglio": {"incluse": incluse, "escluse": escluse},
        "risultato_operativo_gestionale": F(risultato_operativo),
        "iva_memo": {"attiva": F(iva_attiva), "passiva": F(iva_passiva), "saldo": F(iva_attiva - iva_passiva)},
        "warning": warning,
    }
    # Chiave aggiunta SOLO se configurato -> con config vuota l'output resta byte-identico (invarianza).
    if memo_cliente_dedicato is not None:
        out["memo_cliente_dedicato"] = memo_cliente_dedicato
    return out


# ── SCADENZARIO FISCALE (brief §3.2 + dashboard IVA §5.1, Fase 3) ──────────
# Importi disponibili SOLO per l'IVA (calcolata dalle fatture). Le altre voci hanno data certa
# ma importo non disponibile in DB → importo_stimato=None + certezza/flag (mai numeri inventati).
# TODO(Fase 3): importi F24 contributi/ritenute da cedolino; acconti IRAP + IRPEF soci da commercialista
# (metodo storico); aggancio alla proiezione cassa (uscite fiscali certe-per-data).
def _trimestre_label(d: date) -> str:
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def _fine_trimestre(inizio: date) -> date:
    from dateutil.relativedelta import relativedelta
    return inizio + relativedelta(months=3) - timedelta(days=1)


async def calcola_scadenzario_fiscale(db: AsyncSession, da_data: date, a_data: date) -> dict:
    """Scadenzario fiscale: IVA trimestrale calcolata dalle fatture + calendario scadenze ricorrenti.
    Stateless, solo lettura. Nessun importo inventato: dove la fonte non esiste → importo_stimato=None.
    """
    from dateutil.relativedelta import relativedelta

    warning: list[str] = []
    if a_data < da_data:
        return {"iva_trimestrale": [], "scadenze": [], "warning": ["Orizzonte non valido (a_data < da_data)."]}

    # IVA per trimestre: 2 query aggregate (stessa fonte dell'IVA memo del P&L)
    async def _iva_per_trimestre(tabella: str) -> dict:
        rows = await db.execute(text(
            f"SELECT date_trunc('quarter', data_emissione)::date AS q, COALESCE(SUM(importo_iva),0) AS iva "
            f"FROM {tabella} WHERE data_emissione IS NOT NULL GROUP BY 1"
        ))
        return {r.q: Decimal(str(r.iva or 0)) for r in rows.all()}

    iva_att = await _iva_per_trimestre("fatture_attive")
    iva_pas = await _iva_per_trimestre("fatture_passive")

    F = lambda x: float(Decimal(x).quantize(Decimal("0.01")))

    # Trimestri con data_versamento (= fine trimestre, da confermare col commercialista) nell'orizzonte
    iva_trimestrale = []
    iva_scadenze = []  # voci IVA da inserire nel calendario
    q_inizio = date(da_data.year, ((da_data.month - 1) // 3) * 3 + 1, 1) - relativedelta(months=3)
    for k in range(8):  # copre ampiamente qualunque orizzonte ragionevole
        qi = q_inizio + relativedelta(months=3 * k)
        versamento = _fine_trimestre(qi)
        if versamento < da_data or versamento > a_data:
            continue
        debito = iva_att.get(qi, Decimal("0"))
        credito = iva_pas.get(qi, Decimal("0"))
        saldo = debito - credito
        iva_trimestrale.append({
            "trimestre": _trimestre_label(qi),
            "iva_debito": F(debito), "iva_credito": F(credito), "saldo": F(saldo),
            "data_versamento": str(versamento),
            "certezza": "MEDIA",
            "note": "Data/regime IVA da confermare col commercialista.",
        })
        iva_scadenze.append({
            "data": str(versamento), "voce": f"IVA trimestrale {_trimestre_label(qi)}",
            "importo_stimato": F(saldo), "certezza": "MEDIA", "fonte": "fatture (calcolato)",
            "note": "Data/regime da confermare col commercialista.",
        })

    # Calendario ricorrente
    scadenze = list(iva_scadenze)

    def _clamp_day(anno: int, mese: int, giorno: int) -> date:
        # gestisce mesi che potrebbero non avere il giorno (non serve per 16/30 giugno-nov, ma sicuro)
        import calendar
        last = calendar.monthrange(anno, mese)[1]
        return date(anno, mese, min(giorno, last))

    # F24 contributi (16/mese) + ritenute (16 del mese successivo al riferimento)
    cur = date(da_data.year, da_data.month, 1)
    while cur <= a_data:
        f24 = _clamp_day(cur.year, cur.month, 16)
        if da_data <= f24 <= a_data:
            scadenze.append({"data": str(f24), "voce": "F24 contributi INPS",
                             "importo_stimato": None, "certezza": "ALTA", "fonte": "ricorrente mensile",
                             "note": "Importo da cedolino/da configurare."})
            scadenze.append({"data": str(f24), "voce": f"Ritenute d'acconto (competenza {_trimestre_label(cur)[:4]}-{(cur - relativedelta(months=1)).month:02d})",
                             "importo_stimato": None, "certezza": "ALTA", "fonte": "ricorrente mensile (16 mese successivo)",
                             "note": "Importo da cedolino/da configurare."})
        cur = cur + relativedelta(months=1)

    # Acconti IRAP (societa) + IRPEF soci: 30/06 e 30/11 di ogni anno nell'orizzonte.
    # Bite e' una SAS -> trasparenza fiscale: la societa NON paga IRES (spec v2 invariante 12).
    # Imposte: IRAP a livello societa + IRPEF/addizionali sui soci per trasparenza.
    for anno in range(da_data.year, a_data.year + 1):
        for (m, etichetta) in [(6, "Acconto IRAP + IRPEF soci (giugno)"), (11, "Acconto IRAP + IRPEF soci (novembre)")]:
            d = _clamp_day(anno, m, 30)
            if da_data <= d <= a_data:
                scadenze.append({"data": str(d), "voce": etichetta, "importo_stimato": None,
                                 "certezza": "DA_ALLINEARE", "fonte": "ricorrente annuale",
                                 "note": "Da commercialista (metodo storico)."})

    scadenze.sort(key=lambda x: x["data"])

    if any(s["importo_stimato"] is None for s in scadenze):
        warning.append("Alcune scadenze (F24/ritenute/IRPEF) hanno importo da configurare: non stimato per evitare numeri non verificati.")
    warning.append("Date/regimi fiscali indicativi: confermare col commercialista.")

    return {
        "orizzonte": {"da": str(da_data), "a": str(a_data)},
        "iva_trimestrale": iva_trimestrale,
        "scadenze": scadenze,
        "warning": warning,
    }


# ── TASK SERVICE ──────────────────────────────────────────
async def list_tasks(
    db: AsyncSession,
    current_user: User,
    progetto_id: Optional[uuid.UUID] = None,
    commessa_id: Optional[uuid.UUID] = None,
    assegnatario_id: Optional[uuid.UUID] = None,
    stato: Optional[TaskStatus] = None,
    parent_only: bool = False,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 200,
    skip: int = 0,
) -> List[Task]:
    # Eager-load di tutte le relazioni esposte da TaskOut (attachments + timer_sessions root incluse):
    # con la lista non più vuota (vedi fix scope sotto) la serializzazione sync ne farebbe lazy-load
    # fuori dal greenlet -> MissingGreenlet/ResponseValidationError. Allineato a _get_task_record.
    q = select(Task).options(
        selectinload(Task.assegnatario),
        selectinload(Task.revisore),
        selectinload(Task.attachments),
        selectinload(Task.timer_sessions),
        selectinload(Task.assegnatari_m2m).selectinload(TaskAssegnatario.user),
        selectinload(Task.subtasks).selectinload(Task.assegnatario),
        selectinload(Task.subtasks).selectinload(Task.revisore),
        selectinload(Task.subtasks).selectinload(Task.attachments),
        selectinload(Task.subtasks).selectinload(Task.timer_sessions),
        selectinload(Task.subtasks).selectinload(Task.assegnatari_m2m).selectinload(TaskAssegnatario.user),
        selectinload(Task.subtasks).selectinload(Task.subtasks),
    )

    # Contratto get_user_access_scope: i ruoli ERP (ADMIN/DEVELOPER) hanno accesso ILLIMITATO
    # (la funzione ritorna set vuoti per loro) -> NESSUN filtro di scope. Calcolo lo scope solo
    # per i ruoli studio-only, che vedono i propri progetti (team) e i task assegnati/in revisione;
    # con set vuoti (nessuna assegnazione) il filtro restituisce 0 task -> corretto.
    if not has_erp_access(current_user.ruolo):
        p_ids, t_ids, _ = await get_user_access_scope(db, current_user)
        if t_ids:
            q = q.where(or_(Task.progetto_id.in_(p_ids), Task.id.in_(t_ids)))
        else:
            q = q.where(Task.progetto_id.in_(p_ids))
    if progetto_id:
        q = q.where(Task.progetto_id == progetto_id)
    if commessa_id:
        q = q.where(Task.commessa_id == commessa_id)
    if assegnatario_id:
        q = q.where(Task.assegnatario_id == assegnatario_id)
    if stato:
        q = q.where(Task.stato == stato)
    if parent_only:
        q = q.where(Task.parent_id == None)
    if start_date:
        q = q.where(Task.data_scadenza >= start_date)
    if end_date:
        q = q.where(Task.data_scadenza <= end_date)

    # Filter out deleted tasks
    q = q.where(Task.is_deleted == False)

    result = await db.execute(q.order_by(Task.created_at.desc()).offset(skip).limit(limit))
    return result.unique().scalars().all()

async def get_project_stats(db: AsyncSession, progetto_id: uuid.UUID, current_user: User) -> dict:
    if not await can_access_project(db, current_user, progetto_id):
        raise HTTPException(status_code=403, detail="Non autorizzato ad accedere a questo progetto")

    from app.models.models import Task, User, ProgettoTeam, TaskStatus
    from datetime import date, timedelta
    from sqlalchemy import func, case
    
    today = date.today()
    next_week = today + timedelta(days=7)
    
    # 1. Aggregated KPIs and Status Distribution in ONE query
    stats_stmt = select(
        func.count(Task.id).label("total"),
        func.count(case((and_(Task.data_scadenza == today, Task.stato != TaskStatus.PUBBLICATO), 1))).label("today"),
        func.count(case((and_(Task.data_scadenza < today, Task.stato != TaskStatus.PUBBLICATO), 1))).label("overdue"),
        func.count(case((and_(Task.data_scadenza > today, Task.data_scadenza <= next_week, Task.stato != TaskStatus.PUBBLICATO), 1))).label("upcoming")
    ).where(Task.progetto_id == progetto_id)
    
    stats_res = await db.execute(stats_stmt)
    kpis = stats_res.mappings().one()
    
    # Status distribution
    status_stmt = select(Task.stato, func.count(Task.id)).where(Task.progetto_id == progetto_id).group_by(Task.stato)
    status_res = await db.execute(status_stmt)
    status_dist = [{"status": s, "count": c} for s, c in status_res.all()]
    
    # 2. Team Stats (Optimized)
    team_stmt = select(
        User.id, User.nome, User.cognome, User.avatar_url,
        func.count(Task.id).label("total_tasks"),
        func.count(case((and_(Task.data_scadenza < today, Task.stato != TaskStatus.PUBBLICATO), 1))).label("overdue_tasks")
    ).join(ProgettoTeam, ProgettoTeam.user_id == User.id)\
     .outerjoin(Task, and_(Task.assegnatario_id == User.id, Task.progetto_id == progetto_id))\
     .where(ProgettoTeam.progetto_id == progetto_id)\
     .group_by(User.id)
     
    team_res = await db.execute(team_stmt)
    team_stats = [dict(r) for r in team_res.mappings().all()]
    
    # 3. Critical (Overdue) Tasks
    critical_stmt = select(Task).options(joinedload(Task.assegnatario))\
        .where(Task.progetto_id == progetto_id, Task.data_scadenza < today, Task.stato != TaskStatus.PUBBLICATO)\
        .order_by(Task.data_scadenza.asc()).limit(10)
    
    critical_res = await db.execute(critical_stmt)
    critical_tasks = [
        {
            "id": t.id,
            "titolo": t.titolo,
            "data_scadenza": t.data_scadenza,
            "assegnatario": {
                "nome": f"{t.assegnatario.nome} {t.assegnatario.cognome}" if t.assegnatario else "Nessuno",
                "avatar_url": t.assegnatario.avatar_url if t.assegnatario else None
            } if t.assegnatario else None
        }
        for t in critical_res.scalars().all()
    ]
        
    return {
        "kpis": kpis,
        "status_distribution": status_dist,
        "team_stats": team_stats,
        "critical_tasks": critical_tasks
    }

async def _get_task_record(db: AsyncSession, task_id: uuid.UUID) -> Optional[Task]:
    # Eager-load di TUTTE le relazioni esposte da TaskOut (attachments incluse: la loro
    # omissione causava MissingGreenlet al serialize). subtasks è ricorsivo: carico anche
    # le relazioni dei subtask (gerarchia Studio a 2 livelli task→subtask).
    result = await db.execute(
        select(Task).options(
            selectinload(Task.assegnatario),
            selectinload(Task.revisore),
            selectinload(Task.attachments),
            selectinload(Task.timer_sessions),
            selectinload(Task.assegnatari_m2m).selectinload(TaskAssegnatario.user),
            selectinload(Task.subtasks).selectinload(Task.assegnatario),
            selectinload(Task.subtasks).selectinload(Task.revisore),
            selectinload(Task.subtasks).selectinload(Task.attachments),
            selectinload(Task.subtasks).selectinload(Task.timer_sessions),
            selectinload(Task.subtasks).selectinload(Task.assegnatari_m2m).selectinload(TaskAssegnatario.user),
            selectinload(Task.subtasks).selectinload(Task.subtasks),
        ).where(Task.id == task_id, Task.is_deleted == False)
    )
    return result.unique().scalar_one_or_none()

async def get_task(db: AsyncSession, task_id: uuid.UUID, current_user: User) -> Optional[Task]:
    ensure_erp_access_user(current_user)
    return await _get_task_record(db, task_id)

async def create_task(db: AsyncSession, data: Any, current_user: User) -> Task: # data: TaskCreate
    ensure_erp_access_user(current_user)
    data_dict = data.model_dump()
    assegnatari_ids = data_dict.pop("assegnatari", None) or []
    t = Task(**data_dict)
    db.add(t)
    await db.flush()
    if assegnatari_ids:
        for user_id in assegnatari_ids:
            db.add(TaskAssegnatario(task_id=t.id, user_id=user_id))
        t.assegnatario_id = assegnatari_ids[0]
        await db.flush()
    return await _get_task_record(db, t.id)

async def update_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    data: Any,
    by_user_id: uuid.UUID,
    current_user: User,
) -> Optional[Task]: # data: TaskUpdate
    ensure_erp_access_user(current_user)
    t = await _get_task_record(db, task_id)
    if not t:
        return None
    prima = {"stato": t.stato, "titolo": t.titolo}
    data_dict = data.model_dump(exclude_none=True)
    assegnatari_ids = data_dict.pop("assegnatari", None)
    for field, val in data_dict.items():
        setattr(t, field, val)
    if assegnatari_ids is not None:
        await db.execute(delete(TaskAssegnatario).where(TaskAssegnatario.task_id == task_id))
        for user_id in assegnatari_ids:
            db.add(TaskAssegnatario(task_id=task_id, user_id=user_id))
        t.assegnatario_id = assegnatari_ids[0] if assegnatari_ids else None
    await write_audit(db, by_user_id, "tasks", task_id, "UPDATE", prima)
    await db.flush()
    if assegnatari_ids is not None:
        # M2M modificato: populate_existing bypassa l'identity-map cache
        # senza lazy-load (safe in async)
        res = await db.execute(
            select(Task).options(
                selectinload(Task.assegnatario),
                selectinload(Task.revisore),
                selectinload(Task.attachments),
                selectinload(Task.timer_sessions),
                selectinload(Task.assegnatari_m2m).selectinload(TaskAssegnatario.user),
                selectinload(Task.subtasks).selectinload(Task.assegnatario),
                selectinload(Task.subtasks).selectinload(Task.revisore),
                selectinload(Task.subtasks).selectinload(Task.attachments),
                selectinload(Task.subtasks).selectinload(Task.timer_sessions),
                selectinload(Task.subtasks).selectinload(Task.assegnatari_m2m).selectinload(TaskAssegnatario.user),
                selectinload(Task.subtasks).selectinload(Task.subtasks),
            ).where(Task.id == task_id, Task.is_deleted == False)
            .execution_options(populate_existing=True)
        )
        return res.unique().scalar_one_or_none()
    return await _get_task_record(db, t.id)

async def delete_task(db: AsyncSession, task_id: uuid.UUID, by_user_id: uuid.UUID, current_user: User) -> bool:
    ensure_erp_access_user(current_user)
    t = await _get_task_record(db, task_id)
    if not t:
        return False
    await write_audit(db, by_user_id, "tasks", task_id, "DELETE", {"titolo": t.titolo})
    t.is_deleted = True
    t.deleted_at = datetime.now()
    # await db.delete(t) # Soft-delete instead
    await db.flush()
    return True


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
    # H-06: prefetch dei clienti esistenti per fic_id (1 query) invece di una SELECT per record
    _fic_ids = [str(r["id"]) for r in items if r.get("id") is not None]
    existing: dict[str, Cliente] = {}
    if _fic_ids:
        _pref = await db.execute(select(Cliente).where(Cliente.fic_cliente_id.in_(_fic_ids)))
        existing = {c.fic_cliente_id: c for c in _pref.scalars().all()}
    for raw in items:
        try:
            fic_id_raw = raw.get("id")
            if fic_id_raw is None:
                continue
            fic_id = str(fic_id_raw)
            cliente = existing.get(fic_id)
            if not cliente:
                cliente = Cliente(
                    ragione_sociale=raw.get("name") or raw.get("business_name") or f"Cliente FIC {fic_id}",
                    fic_cliente_id=fic_id,
                    attivo=True,
                )
                db.add(cliente)
                existing[fic_id] = cliente

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
    # Pre-carica categorie per mapping veloce se possibile
    from sqlalchemy import select
    res_cat = await db.execute(select(CategoriaFornitore))
    all_cats = res_cat.scalars().all()
    cat_map = {c.nome.lower(): c.id for c in all_cats}

    # H-06: prefetch dei fornitori esistenti per fic_id (1 query). I MANUAL-* hanno fic_id non
    # numerico -> non sono tra i fic_id FiC -> non vengono caricati ne' toccati (come prima, B-02).
    _fic_ids = [str(r["id"]) for r in items if r.get("id") is not None]
    existing: dict[str, Fornitore] = {}
    if _fic_ids:
        _pref = await db.execute(select(Fornitore).where(Fornitore.fic_id.in_(_fic_ids)))
        existing = {f.fic_id: f for f in _pref.scalars().all()}
    for raw in items:
        try:
            fic_id_raw = raw.get("id")
            if fic_id_raw is None:
                continue
            fic_id = str(fic_id_raw)
            fornitore = existing.get(fic_id)
            if not fornitore:
                fornitore = Fornitore(
                    fic_id=fic_id,
                    ragione_sociale=raw.get("name") or raw.get("business_name") or f"Fornitore FIC {fic_id}",
                    attivo=True,
                )
                db.add(fornitore)
                existing[fic_id] = fornitore

            fornitore.ragione_sociale = raw.get("name") or raw.get("business_name") or fornitore.ragione_sociale
            fornitore.piva = raw.get("vat_number") or fornitore.piva
            fornitore.codice_fiscale = raw.get("tax_code") or fornitore.codice_fiscale
            fornitore.pec = raw.get("certified_email") or raw.get("pec") or fornitore.pec
            fornitore.indirizzo = _build_address(raw) or fornitore.indirizzo
            fornitore.email = raw.get("email") or fornitore.email
            fornitore.telefono = raw.get("phone") or raw.get("phone_number") or fornitore.telefono
            fornitore.fic_raw_data = raw
            
            # Tenta di mappare la categoria se presente in FIC
            raw_cat = raw.get("category") or raw.get("type")
            if raw_cat and isinstance(raw_cat, str):
                fornitore.categoria = raw_cat
                if raw_cat.lower() in cat_map:
                    fornitore.categoria_id = cat_map[raw_cat.lower()]

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
    # H-06: prefetch delle fatture attive esistenti per fic_id (1 query) invece di una SELECT per record
    _fic_ids = [str(r["id"]) for r in items if r.get("id") is not None]
    existing: dict[str, FatturaAttiva] = {}
    if _fic_ids:
        _pref = await db.execute(select(FatturaAttiva).where(FatturaAttiva.fic_id.in_(_fic_ids)))
        existing = {f.fic_id: f for f in _pref.scalars().all()}
    for raw in items:
        try:
            fic_id_raw = raw.get("id")
            if fic_id_raw is None:
                continue
            fic_id = str(fic_id_raw)
            fattura = existing.get(fic_id)
            if not fattura:
                fattura = FatturaAttiva(fic_id=fic_id)
                db.add(fattura)
                existing[fic_id] = fattura

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
            # R2: la data incasso viene SOLO dalla riconciliazione bancaria, MAI dalla sync FiC.
            # Se FiC dice saldato ma non c'e' (ancora) una riconciliazione che lo conferma, lo stato
            # gestionale e' SALDATO_FIC_DA_RICONCILIARE; INCASSATA + data le scrive solo il recompute.
            if fattura.stato_pagamento not in ('paid', 'INCASSATA'):
                fattura.stato_pagamento = 'SALDATO_FIC_DA_RICONCILIARE' if fic_stato == 'INCASSATA' else fic_stato
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
        except (ValueError, IndexError):
            pass
    return f"{anno}/{str(max_n + 1).zfill(4)}"


async def _upsert_fic_fatture_passive(
    db: AsyncSession,
    items: list[dict[str, Any]],
    errors: list[str],
) -> int:
    imported = 0
    fornitori_cache: dict[str, Optional[Fornitore]] = {}
    # H-06: prefetch delle fatture passive esistenti per fic_id (1 query) invece di una SELECT per record
    _fic_ids = [str(r["id"]) for r in items if r.get("id") is not None]
    existing: dict[str, FatturaPassiva] = {}
    if _fic_ids:
        _pref = await db.execute(select(FatturaPassiva).where(FatturaPassiva.fic_id.in_(_fic_ids)))
        existing = {f.fic_id: f for f in _pref.scalars().all()}
    for raw in items:
        try:
            fic_id_raw = raw.get("id")
            if fic_id_raw is None:
                continue
            fic_id = str(fic_id_raw)
            fattura = existing.get(fic_id)
            is_new = fattura is None
            if not fattura:
                fattura = FatturaPassiva(fic_id=fic_id)
                db.add(fattura)
                existing[fic_id] = fattura

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
            # R2: la data pagamento viene SOLO dalla riconciliazione bancaria, MAI dalla sync FiC.
            if fattura.stato_pagamento not in ('paid', 'PAGATA'):
                fic_stato_p = _payment_status(
                    total=importo_totale,
                    paid=importo_pagato,
                    due_date=due_date,
                    paid_label="PAGATA",
                )
                fattura.stato_pagamento = 'SALDATO_FIC_DA_RICONCILIARE' if fic_stato_p == 'PAGATA' else fic_stato_p
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
    result = await db.execute(
        select(Fornitore)
        .options(selectinload(Fornitore.categoria_rel))
        .order_by(Fornitore.ragione_sociale)
    )
    return result.scalars().all()

async def list_fornitori_full(db: AsyncSession):
    from sqlalchemy import func
    result = await db.execute(
        select(
            Fornitore,
            func.count(FatturaPassiva.id).label('num_fatture'),
            func.coalesce(func.sum(FatturaPassiva.importo_totale), 0).label('spesa_totale'),
            func.max(FatturaPassiva.data_emissione).label('ultima_fattura'),
        )
        .outerjoin(FatturaPassiva, FatturaPassiva.fornitore_id == Fornitore.id)
        .options(selectinload(Fornitore.categoria_rel))
        .group_by(Fornitore.id)
        .order_by(Fornitore.ragione_sociale)
    )
    rows = result.all()
    out = []
    for forn, num_fatture, spesa_totale, ultima_fattura in rows:
        d = FornitoreOut.model_validate(forn).model_dump()
        d['num_fatture'] = num_fatture
        d['spesa_totale'] = float(spesa_totale or 0)
        d['ultima_fattura'] = str(ultima_fattura) if ultima_fattura else None
        out.append(d)
    return out

async def list_fatture_attive(db: AsyncSession) -> List[FatturaAttiva]:
    result = await db.execute(
        select(FatturaAttiva)
        .options(selectinload(FatturaAttiva.cliente))
        .order_by(FatturaAttiva.data_emissione.desc(), FatturaAttiva.numero.desc())
    )
    return result.scalars().all()

async def incassa_fattura(db: AsyncSession, fattura_id: uuid.UUID, data_incasso: date) -> Optional[FatturaAttiva]:
    result = await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fattura_id))
    fattura = result.scalar_one_or_none()
    if not fattura:
        return None
    fattura.stato_pagamento = "INCASSATA"
    fattura.data_ultimo_incasso = data_incasso
    
    # Sincronizza stato commessa
    from app.models.models import Commessa, CommessaStatus
    res_com = await db.execute(select(Commessa).where(Commessa.fattura_id == fattura.id))
    cm = res_com.scalar_one_or_none()
    if cm:
        cm.stato = CommessaStatus.INCASSATA
        
    await db.flush()
    return fattura

async def list_fatture_passive(db: AsyncSession) -> List[FatturaPassiva]:
    result = await db.execute(
        select(FatturaPassiva)
        .options(selectinload(FatturaPassiva.fornitore))
        .order_by(FatturaPassiva.data_emissione.desc(), FatturaPassiva.numero.desc())
    )
    return result.scalars().all()

async def create_fornitore(db: AsyncSession, data: any) -> Fornitore: # data: FornitoreCreate
    # fic_id e' NOT NULL + unique a DB (valorizzato dalla sync FiC). Per i fornitori creati
    # manualmente genero un sentinella MANUAL-<hex>: non collide mai con gli id numerici FiC,
    # quindi _upsert_fic_fornitori (match per fic_id) non lo sovrascrive ne' duplica.
    f = Fornitore(**data.model_dump(), fic_id=f"MANUAL-{uuid.uuid4().hex}")
    db.add(f)
    await db.flush()
    # Ricarica per avere la relazione categoria
    res = await db.execute(
        select(Fornitore).options(selectinload(Fornitore.categoria_rel)).where(Fornitore.id == f.id)
    )
    return res.scalar_one()

async def update_fornitore(db: AsyncSession, fornitore_id: uuid.UUID, data: dict):
    from app.models.models import Fornitore
    result = await db.execute(
        select(Fornitore)
        .options(selectinload(Fornitore.categoria_rel))
        .where(Fornitore.id == fornitore_id)
    )
    forn = result.scalar_one_or_none()
    if not forn:
        return None
    for k, v in data.items():
        if hasattr(forn, k):
            setattr(forn, k, v)
    await db.flush()
    return forn


# ── CATEGORIE FORNITORI SERVICE ──────────────────────────
async def list_categorie_fornitori(db: AsyncSession) -> List[CategoriaFornitore]:
    result = await db.execute(select(CategoriaFornitore).order_by(CategoriaFornitore.nome))
    return result.scalars().all()

async def create_categoria_fornitore(db: AsyncSession, data: any) -> CategoriaFornitore: # data: CategoriaFornitoreCreate
    cat = CategoriaFornitore(**data.model_dump())
    db.add(cat)
    await db.flush()
    return cat

async def update_categoria_fornitore(db: AsyncSession, cat_id: uuid.UUID, data: any) -> Optional[CategoriaFornitore]:
    result = await db.execute(select(CategoriaFornitore).where(CategoriaFornitore.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        return None
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(cat, k, v)
    await db.flush()
    return cat

async def delete_categoria_fornitore(db: AsyncSession, cat_id: uuid.UUID) -> bool:
    result = await db.execute(select(CategoriaFornitore).where(CategoriaFornitore.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        return False
    await db.delete(cat)
    await db.flush()
    return True

async def seed_budget_categories(db: AsyncSession):
    from app.models.models import BudgetCategory
    defaults = [
        {"nome": "Marketing", "colore": "#ec4899"},
        {"nome": "Software", "colore": "#3b82f6"},
        {"nome": "Struttura", "colore": "#64748b"},
        {"nome": "Consulenza", "colore": "#8b5cf6"},
        {"nome": "Freelancer", "colore": "#10b981"},
        {"nome": "Altro", "colore": "#94a3b8"},
    ]
    for d in defaults:
        res = await db.execute(select(BudgetCategory).where(BudgetCategory.nome == d["nome"]))
        if not res.scalar_one_or_none():
            db.add(BudgetCategory(**d))
    await db.commit()


async def seed_wiki_categories(db: AsyncSession):
    from app.models.models import WikiCategoria
    defaults = [
        {"nome": "Procedure operative", "icona": "ClipboardList", "ordine": 1},
        {"nome": "Onboarding", "icona": "UserPlus", "ordine": 2},
        {"nome": "Guide clienti", "icona": "BookOpen", "ordine": 3},
        {"nome": "Tool e software", "icona": "Cpu", "ordine": 4},
        {"nome": "Policy aziendali", "icona": "ShieldCheck", "ordine": 5},
        {"nome": "FAQ", "icona": "HelpCircle", "ordine": 6},
    ]
    for d in defaults:
        res = await db.execute(select(WikiCategoria).where(WikiCategoria.nome == d["nome"]))
        if not res.scalar_one_or_none():
            db.add(WikiCategoria(**d))
    await db.commit()


async def seed_default_categories(db: AsyncSession):
    defaults = [
        {"nome": "Marketing", "colore": "#ec4899"},
        {"nome": "Software & Tools", "colore": "#3b82f6"},
        {"nome": "Struttura & Ufficio", "colore": "#64748b"},
        {"nome": "Consulenza", "colore": "#8b5cf6"},
        {"nome": "Freelancer", "colore": "#10b981"},
        {"nome": "Utilities", "colore": "#f59e0b"},
        {"nome": "Altro", "colore": "#94a3b8"},
    ]
    for d in defaults:
        res = await db.execute(select(CategoriaFornitore).where(CategoriaFornitore.nome == d["nome"]))
        if not res.scalar_one_or_none():
            db.add(CategoriaFornitore(**d))
    await db.commit()
    await seed_budget_categories(db)
    await seed_wiki_categories(db)

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


async def list_movimenti_cassa(db: AsyncSession, skip: int = 0, limit: int = 200):
    from app.models.models import MovimentoCassa, Riconciliazione
    result = await db.execute(
        select(MovimentoCassa).order_by(MovimentoCassa.data_valuta.desc()).offset(skip).limit(limit)
    )
    rows = result.scalars().all()
    # Espone i derivati di riconciliazione (M2M/parziali) senza N+1: una sola query aggregata.
    mov_ids = [r.id for r in rows]
    sommati: dict = {}
    if mov_ids:
        agg = await db.execute(
            select(Riconciliazione.movimento_id, func.coalesce(func.sum(Riconciliazione.importo), 0))
            .where(Riconciliazione.movimento_id.in_(mov_ids))
            .group_by(Riconciliazione.movimento_id)
        )
        sommati = {mid: Decimal(str(tot or 0)) for mid, tot in agg.all()}
    out = []
    for r in rows:
        d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        riconciliato_importo = sommati.get(r.id, Decimal("0"))
        d["importo_riconciliato"] = float(riconciliato_importo)
        d["residuo_movimento"] = float(abs(r.importo or Decimal("0")) - riconciliato_importo)
        out.append(d)
    return out


def _msg_periodo_bloccato(dc) -> str:
    return f"Periodo {dc.year}-{dc.month:02d} chiuso (hard lock): registra la rettifica nel periodo aperto."


async def create_movimento(db: AsyncSession, payload: dict, user_id=None):
    """Crea un movimento. Enforcement lock competenza (§13.6): la competenza effettiva
    (data_competenza o, se assente, data_valuta) non deve cadere in un periodo hard_lock."""
    from app.models.models import MovimentoCassa
    data = {k: v for k, v in payload.items() if hasattr(MovimentoCassa, k)}
    dc = data.get("data_competenza") or data.get("data_valuta")
    if await periodo_e_bloccato(db, dc):
        raise HTTPException(status_code=400, detail=_msg_periodo_bloccato(dc))
    m = MovimentoCassa(**data)
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return {c.name: getattr(m, c.name) for c in m.__table__.columns}


async def delete_movimento(db: AsyncSession, movimento_id):
    """Elimina un movimento. Bloccato se la sua data_competenza e' in periodo hard_lock (§13.6)."""
    from app.models.models import MovimentoCassa
    m = (await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))).scalar_one_or_none()
    if not m:
        return None
    if await periodo_e_bloccato(db, m.data_competenza):
        raise HTTPException(status_code=400, detail=_msg_periodo_bloccato(m.data_competenza))
    await db.delete(m)
    await db.commit()
    return {"deleted": True}


# ── RICONCILIAZIONE BANCARIA (M2M + parziali, fonte unica — brief §2.2) ──────────
# La tabella `riconciliazioni` e' la FONTE UNICA: importo_pagato/residuo/stato/data delle
# fatture e il flag riconciliato dei movimenti sono SEMPRE derivati da qui (mai scritti a mano,
# salvo l'eccezione documentata /incassa per incassi senza movimento bancario).

async def _ric_query_fattura(fattura_id, is_attiva):
    from app.models.models import Riconciliazione
    col = Riconciliazione.fattura_attiva_id if is_attiva else Riconciliazione.fattura_passiva_id
    return col == fattura_id


async def _sum_riconciliazioni_fattura(db: AsyncSession, fattura_id, is_attiva) -> Decimal:
    from app.models.models import Riconciliazione
    cond = await _ric_query_fattura(fattura_id, is_attiva)
    res = await db.execute(select(func.coalesce(func.sum(Riconciliazione.importo), 0)).where(cond))
    return Decimal(str(res.scalar() or 0))


async def _sum_riconciliazioni_movimento(db: AsyncSession, movimento_id) -> Decimal:
    from app.models.models import Riconciliazione
    res = await db.execute(
        select(func.coalesce(func.sum(Riconciliazione.importo), 0)).where(Riconciliazione.movimento_id == movimento_id)
    )
    return Decimal(str(res.scalar() or 0))


async def _recompute_fattura(db: AsyncSession, fattura, is_attiva: bool):
    """Ricalcola importo_pagato/residuo/stato/data della fattura dalle sue riconciliazioni.
    data (R2) = data della riconciliazione che porta il cumulato >= totale; None se residuo>0."""
    from app.models.models import Riconciliazione
    cond = await _ric_query_fattura(fattura.id, is_attiva)
    res = await db.execute(
        select(Riconciliazione.importo, Riconciliazione.data, Riconciliazione.created_at)
        .where(cond)
        .order_by(Riconciliazione.data.asc(), Riconciliazione.created_at.asc())
    )
    rows = res.all()
    pagato = sum((r.importo for r in rows), Decimal("0"))
    totale = fattura.importo_totale or Decimal("0")
    residuo = totale - pagato
    if residuo < 0:
        residuo = Decimal("0")
    fattura.importo_pagato = pagato
    fattura.importo_residuo = residuo

    data_saldo = None
    if pagato >= totale and totale > 0 and rows:
        cum = Decimal("0")
        for r in rows:
            cum += r.importo
            if cum >= totale:
                data_saldo = r.data
                break
        if data_saldo is None:
            data_saldo = rows[-1].data

    if pagato <= 0:
        stato = "ATTESA"
    elif residuo <= 0:
        stato = "INCASSATA" if is_attiva else "PAGATA"
    else:
        stato = "PARZIALE"
    fattura.stato_pagamento = stato

    if is_attiva:
        fattura.data_ultimo_incasso = data_saldo
        if residuo <= 0 and totale > 0:
            from app.models.models import Commessa, CommessaStatus
            res_c = await db.execute(select(Commessa).where(Commessa.fattura_id == fattura.id))
            for cm in res_c.scalars().all():
                if cm.stato != CommessaStatus.INCASSATA:
                    cm.stato = CommessaStatus.INCASSATA
    else:
        fattura.data_ultimo_pagamento = data_saldo


async def _recompute_movimento(db: AsyncSession, mov) -> dict:
    """riconciliato = (Σ importi riconciliazioni == |importo movimento|). Espone il residuo."""
    somma = await _sum_riconciliazioni_movimento(db, mov.id)
    mov_abs = abs(mov.importo or Decimal("0"))
    mov.riconciliato = bool(somma > 0 and somma == mov_abs)
    return {"importo_movimento": mov_abs, "riconciliato_importo": somma, "residuo_movimento": mov_abs - somma}


async def _load_fattura(db: AsyncSession, *, fattura_attiva_id=None, fattura_passiva_id=None):
    """Ritorna (fattura, is_attiva) o (None, None)."""
    from app.models.models import FatturaAttiva, FatturaPassiva
    if fattura_attiva_id:
        r = await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fattura_attiva_id))
        return r.scalar_one_or_none(), True
    if fattura_passiva_id:
        r = await db.execute(select(FatturaPassiva).where(FatturaPassiva.id == fattura_passiva_id))
        return r.scalar_one_or_none(), False
    return None, None


async def riconcilia_movimento(db: AsyncSession, movimento_id, righe: list[dict], user_id=None) -> dict:
    """Crea N righe di riconciliazione per un movimento (pagamento multiplo) con validazione vincoli.
    righe: [{fattura_attiva_id|fattura_passiva_id, importo, note?, data?}]."""
    from app.models.models import MovimentoCassa, Riconciliazione
    res = await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))
    mov = res.scalar_one_or_none()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    if not righe:
        raise HTTPException(status_code=400, detail="Nessuna riga di riconciliazione fornita")

    mov_abs = abs(mov.importo or Decimal("0"))
    running_mov = await _sum_riconciliazioni_movimento(db, movimento_id)
    fattura_running: dict = {}
    fatture_toccate = []
    create_payload = []

    for riga in righe:
        fa_id = riga.get("fattura_attiva_id")
        fp_id = riga.get("fattura_passiva_id")
        if bool(fa_id) == bool(fp_id):
            raise HTTPException(status_code=400, detail="Ogni riga deve referenziare ESATTAMENTE una fattura (attiva XOR passiva)")
        try:
            importo = Decimal(str(riga["importo"]))
        except (KeyError, Exception):
            raise HTTPException(status_code=400, detail="Importo riga mancante o non valido")
        if importo <= 0:
            raise HTTPException(status_code=400, detail="L'importo di riconciliazione deve essere > 0")

        fattura, is_attiva = await _load_fattura(db, fattura_attiva_id=fa_id, fattura_passiva_id=fp_id)
        if not fattura:
            raise HTTPException(status_code=404, detail="Fattura non trovata")

        fkey = (("A", fa_id) if is_attiva else ("P", fp_id))
        if fkey not in fattura_running:
            fattura_running[fkey] = await _sum_riconciliazioni_fattura(db, fattura.id, is_attiva)
        totale = fattura.importo_totale or Decimal("0")
        if fattura_running[fkey] + importo > totale:
            residuo_f = totale - fattura_running[fkey]
            raise HTTPException(status_code=400, detail=f"Importo {importo} supera il residuo della fattura ({residuo_f}).")
        fattura_running[fkey] += importo

        running_mov += importo
        if running_mov > mov_abs:
            raise HTTPException(status_code=400, detail=f"La somma riconciliata supera l'importo del movimento ({mov_abs}).")

        create_payload.append((mov, fa_id, fp_id, importo, riga.get("data") or mov.data_valuta, riga.get("note"), fattura, is_attiva))

    for (mov_, fa_id, fp_id, importo, data_ric, note, fattura, is_attiva) in create_payload:
        # ritardo_gg (spec §5.4): data cassa del movimento - data_scadenza fattura. None se non calcolabile.
        ritardo_gg = None
        if mov_.data_valuta and fattura.data_scadenza:
            ritardo_gg = (mov_.data_valuta - fattura.data_scadenza).days
        db.add(Riconciliazione(
            movimento_id=mov_.id, fattura_attiva_id=fa_id, fattura_passiva_id=fp_id,
            importo=importo, data=data_ric, ritardo_gg=ritardo_gg, note=note,
        ))
        fatture_toccate.append((fattura, is_attiva))
    await db.flush()

    for fattura, is_attiva in fatture_toccate:
        await _recompute_fattura(db, fattura, is_attiva)
    mov_state = await _recompute_movimento(db, mov)

    if user_id:
        await write_audit(db, user_id, "movimenti_cassa", mov.id, "RICONCILIA",
                          dopo={"righe": len(create_payload), "riconciliato": mov.riconciliato})
    await db.commit()
    return {
        "movimento_id": str(mov.id),
        "riconciliato": mov.riconciliato,
        "residuo_movimento": float(mov_state["residuo_movimento"]),
        "righe_create": len(create_payload),
    }


async def elimina_riconciliazione(db: AsyncSession, ric_id) -> bool:
    from app.models.models import Riconciliazione, MovimentoCassa
    res = await db.execute(select(Riconciliazione).where(Riconciliazione.id == ric_id))
    r = res.scalar_one_or_none()
    if not r:
        return False
    movimento_id = r.movimento_id
    fa_id, fp_id = r.fattura_attiva_id, r.fattura_passiva_id
    await db.delete(r)
    await db.flush()
    fattura, is_attiva = await _load_fattura(db, fattura_attiva_id=fa_id, fattura_passiva_id=fp_id)
    if fattura:
        await _recompute_fattura(db, fattura, is_attiva)
    res_m = await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))
    mov = res_m.scalar_one_or_none()
    if mov:
        await _recompute_movimento(db, mov)
    await db.commit()
    return True


async def rimuovi_riconciliazioni_movimento(db: AsyncSession, movimento_id) -> int:
    """Elimina TUTTE le riconciliazioni di un movimento e ricalcola i derivati (retrocompat
    del vecchio PATCH con riconciliato=false)."""
    from app.models.models import Riconciliazione, MovimentoCassa
    res = await db.execute(select(Riconciliazione).where(Riconciliazione.movimento_id == movimento_id))
    righe = res.scalars().all()
    fatture_keys = {("A", r.fattura_attiva_id) if r.fattura_attiva_id else ("P", r.fattura_passiva_id) for r in righe}
    for r in righe:
        await db.delete(r)
    await db.flush()
    for tipo, fid in fatture_keys:
        fattura, is_attiva = await _load_fattura(
            db, fattura_attiva_id=fid if tipo == "A" else None,
            fattura_passiva_id=fid if tipo == "P" else None,
        )
        if fattura:
            await _recompute_fattura(db, fattura, is_attiva)
    res_m = await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))
    mov = res_m.scalar_one_or_none()
    if mov:
        await _recompute_movimento(db, mov)
    await db.commit()
    return len(righe)


async def list_riconciliazioni_movimento(db: AsyncSession, movimento_id):
    from app.models.models import Riconciliazione
    res = await db.execute(
        select(Riconciliazione).where(Riconciliazione.movimento_id == movimento_id).order_by(Riconciliazione.data.asc())
    )
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in res.scalars().all()]


async def list_riconciliazioni_fattura(db: AsyncSession, fattura_id, is_attiva: bool):
    from app.models.models import Riconciliazione
    cond = await _ric_query_fattura(fattura_id, is_attiva)
    res = await db.execute(select(Riconciliazione).where(cond).order_by(Riconciliazione.data.asc()))
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in res.scalars().all()]


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


# ── COSTI VARIABILI (registro forecasting cassa — brief §2.5) ──────────
# I costi variabili sono un registro di FORECASTING di cassa: NON entrano in margine/P&L
# (quelli usano le fatture passive imputate). Solo lo stato PREVISTO alimenta la proiezione.
async def list_costi_variabili(db: AsyncSession, stato: Optional[str] = None,
                               dal: Optional[date] = None, al: Optional[date] = None):
    from app.models.models import CostoVariabile
    q = select(CostoVariabile)
    if stato:
        q = q.where(CostoVariabile.stato == stato)
    if dal:
        q = q.where(CostoVariabile.data_prevista >= dal)
    if al:
        q = q.where(CostoVariabile.data_prevista <= al)
    q = q.order_by(CostoVariabile.data_prevista.asc())
    rows = (await db.execute(q)).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def create_costo_variabile(db: AsyncSession, payload: dict):
    from app.models.models import CostoVariabile
    cv = CostoVariabile(**{k: v for k, v in payload.items() if hasattr(CostoVariabile, k)})
    db.add(cv)
    await db.commit()
    await db.refresh(cv)
    return {c.name: getattr(cv, c.name) for c in cv.__table__.columns}


async def update_costo_variabile(db: AsyncSession, costo_id, payload: dict):
    from app.models.models import CostoVariabile
    cv = (await db.execute(select(CostoVariabile).where(CostoVariabile.id == costo_id))).scalar_one_or_none()
    if not cv:
        return None
    for k, v in payload.items():
        if hasattr(cv, k):
            setattr(cv, k, v)
    await db.commit()
    await db.refresh(cv)
    return {c.name: getattr(cv, c.name) for c in cv.__table__.columns}


async def delete_costo_variabile(db: AsyncSession, costo_id):
    from app.models.models import CostoVariabile
    cv = (await db.execute(select(CostoVariabile).where(CostoVariabile.id == costo_id))).scalar_one_or_none()
    if not cv:
        return False
    await db.delete(cv)
    await db.commit()
    return True


# ── REGISTRO PARAMETRI effective-dated (spec v2 §19.4) ─────────────────────
def _tipizza_parametro(tipo: str, valore):
    """Converte `valore` (TEXT) secondo `tipo`. None resta None (parametro non impostato)."""
    if valore is None:
        return None
    if tipo in ("percentuale", "euro"):
        return Decimal(str(valore))
    if tipo == "intero":
        return int(valore)
    if tipo == "booleano":
        return str(valore).strip().lower() in ("true", "1", "t", "yes", "si", "sì")
    if tipo == "data":
        return date.fromisoformat(str(valore))
    return str(valore)  # enum | testo


async def get_parametro(db: AsyncSession, chiave: str, data_riferimento: Optional[date] = None):
    """Resolver effective-dated: riga con valido_da MASSIMA tra quelle <= data_riferimento
    (default oggi). None + log se nessuna riga applicabile. `valore` gia' tipizzato."""
    from app.models.models import Parametro
    d = data_riferimento or date.today()
    q = (select(Parametro)
         .where(Parametro.chiave == chiave, Parametro.valido_da <= d)
         .order_by(Parametro.valido_da.desc())
         .limit(1))
    row = (await db.execute(q)).scalar_one_or_none()
    if row is None:
        logger.warning("Parametro '%s' non risolto per data %s (nessuna riga valido_da <= data)", chiave, d)
        return None
    return {
        "chiave": row.chiave, "gruppo": row.gruppo, "tipo": row.tipo,
        "valore": _tipizza_parametro(row.tipo, row.valore),
        "valido_da": row.valido_da, "scope": row.scope, "fonte": row.fonte,
    }


async def get_parametri_gruppo(db: AsyncSession, gruppo: str, data_riferimento: Optional[date] = None) -> dict:
    """Legge un dominio intero in 1 query: per ogni chiave del gruppo la riga effective
    (valido_da massima <= data). Restituisce {chiave: valore_tipizzato}."""
    from app.models.models import Parametro
    d = data_riferimento or date.today()
    q = (select(Parametro)
         .where(Parametro.gruppo == gruppo, Parametro.valido_da <= d)
         .order_by(Parametro.chiave, Parametro.valido_da.desc())
         .distinct(Parametro.chiave))
    rows = (await db.execute(q)).scalars().all()
    return {r.chiave: _tipizza_parametro(r.tipo, r.valore) for r in rows}


async def list_parametri(db: AsyncSession, gruppo: Optional[str] = None, data_riferimento: Optional[date] = None):
    """Lista righe (storico incluso) con filtro opzionale gruppo/data. Per la gestione UI."""
    from app.models.models import Parametro
    q = select(Parametro)
    if gruppo:
        q = q.where(Parametro.gruppo == gruppo)
    if data_riferimento:
        q = q.where(Parametro.valido_da <= data_riferimento)
    q = q.order_by(Parametro.gruppo, Parametro.chiave, Parametro.valido_da.desc())
    rows = (await db.execute(q)).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def list_parametro_storico(db: AsyncSession, chiave: str):
    """Tutte le righe di una chiave (storico versioni), piu' recenti prima."""
    from app.models.models import Parametro
    q = select(Parametro).where(Parametro.chiave == chiave).order_by(Parametro.valido_da.desc())
    rows = (await db.execute(q)).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def create_parametro(db: AsyncSession, payload: dict, updated_by=None):
    from app.models.models import Parametro
    data = {k: v for k, v in payload.items() if hasattr(Parametro, k)}
    if updated_by is not None:
        data["updated_by"] = updated_by
    p = Parametro(**data)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {c.name: getattr(p, c.name) for c in p.__table__.columns}


async def update_parametro(db: AsyncSession, parametro_id, payload: dict, updated_by=None):
    from app.models.models import Parametro
    p = (await db.execute(select(Parametro).where(Parametro.id == parametro_id))).scalar_one_or_none()
    if not p:
        return None
    for k, v in payload.items():
        if hasattr(p, k):
            setattr(p, k, v)
    if updated_by is not None:
        p.updated_by = updated_by
    await db.commit()
    await db.refresh(p)
    return {c.name: getattr(p, c.name) for c in p.__table__.columns}


# ── SCADENZE (tabella unificata — spec v2 §5.2). SOLO CRUD: nessun aggancio ai calcoli. ──
def _scadenza_stato_residuo(importo: Decimal, incassato: Decimal, data_attesa: date):
    """Deriva (stato, residuo). Regola spec §5.2: 0 incassato->aperta, parziale->parziale,
    tutto->chiusa; scaduta se data_attesa < oggi e residuo > 0."""
    importo = Decimal(str(importo or 0))
    incassato = Decimal(str(incassato or 0))
    residuo = importo - incassato
    if residuo <= 0:
        stato = "chiusa"
    elif incassato <= 0:
        stato = "aperta"
    else:
        stato = "parziale"
    if stato in ("aperta", "parziale") and data_attesa < date.today():
        stato = "scaduta"
    return stato, residuo


async def list_scadenze(db: AsyncSession, tipo=None, stato=None, dal=None, al=None,
                        controparte_tipo=None, controparte_id=None):
    from app.models.models import Scadenza
    q = select(Scadenza)
    if tipo:
        q = q.where(Scadenza.tipo == tipo)
    if stato:
        q = q.where(Scadenza.stato == stato)
    if dal:
        q = q.where(Scadenza.data_attesa >= dal)
    if al:
        q = q.where(Scadenza.data_attesa <= al)
    if controparte_tipo:
        q = q.where(Scadenza.controparte_tipo == controparte_tipo)
    if controparte_id:
        q = q.where(Scadenza.controparte_id == controparte_id)
    q = q.order_by(Scadenza.data_attesa.asc())
    rows = (await db.execute(q)).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def create_scadenza(db: AsyncSession, payload: dict, created_by=None):
    from app.models.models import Scadenza
    data = {k: v for k, v in payload.items() if hasattr(Scadenza, k)}
    stato, residuo = _scadenza_stato_residuo(data.get("importo"), data.get("importo_incassato", 0), data["data_attesa"])
    data["stato"] = stato
    data["importo_residuo"] = residuo
    if created_by is not None:
        data["created_by"] = created_by
    s = Scadenza(**data)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {c.name: getattr(s, c.name) for c in s.__table__.columns}


async def update_scadenza(db: AsyncSession, scadenza_id, payload: dict):
    from app.models.models import Scadenza
    s = (await db.execute(select(Scadenza).where(Scadenza.id == scadenza_id))).scalar_one_or_none()
    if not s:
        return None
    for k, v in payload.items():
        if hasattr(s, k):
            setattr(s, k, v)
    # Ri-deriva stato/residuo dai valori aggiornati.
    s.stato, s.importo_residuo = _scadenza_stato_residuo(s.importo, s.importo_incassato, s.data_attesa)
    await db.commit()
    await db.refresh(s)
    return {c.name: getattr(s, c.name) for c in s.__table__.columns}


async def delete_scadenza(db: AsyncSession, scadenza_id):
    from app.models.models import Scadenza
    s = (await db.execute(select(Scadenza).where(Scadenza.id == scadenza_id))).scalar_one_or_none()
    if not s:
        return False
    await db.delete(s)
    await db.commit()
    return True


# ── RICORRENZE + MOTORE DI GENERAZIONE (spec v2 §5.3). Genera in `scadenze`, non tocca i calcoli. ──
import calendar as _calendar

_STEP_MESI = {"mensile": 1, "bimestrale": 2, "trimestrale": 3, "semestrale": 6, "annuale": 12}


def _clamp_giorno(year: int, month: int, day: int) -> date:
    """Giorno calendar-aware: se `day` eccede i giorni del mese, usa l'ultimo giorno valido."""
    last = _calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last))


def _occorrenze_ricorrenza(ric, fino_a: date) -> list:
    """Date delle occorrenze in [data_inizio, min(fino_a, data_fine)]. Calendar-aware
    (mese+1 su un 31 -> ultimo giorno del mese target, mai overflow)."""
    from dateutil.relativedelta import relativedelta
    limite = fino_a
    if ric.data_fine and ric.data_fine < limite:
        limite = ric.data_fine
    out = []
    if ric.periodicita == "settimanale":
        d = ric.data_inizio
        while d <= limite:
            out.append(d)
            d = d + timedelta(days=7)
        return out
    step = _STEP_MESI[ric.periodicita]
    ref_day = ric.giorno_riferimento or ric.data_inizio.day
    k = 0
    while k <= 100000:
        base = ric.data_inizio + relativedelta(months=step * k)
        d = _clamp_giorno(base.year, base.month, ref_day)
        if d > limite:
            break
        if d >= ric.data_inizio:  # niente occorrenze prima di data_inizio
            out.append(d)
        k += 1
    return out


def _prossima_data_ricorrenza(ric):
    """Prima occorrenza con data >= oggi (rispettando data_fine). None se esaurita."""
    from dateutil.relativedelta import relativedelta
    oggi = date.today()
    if ric.data_fine and ric.data_fine < oggi:
        return None
    if ric.periodicita == "settimanale":
        d = ric.data_inizio
        while d < oggi:
            d = d + timedelta(days=7)
        return d if not (ric.data_fine and d > ric.data_fine) else None
    step = _STEP_MESI[ric.periodicita]
    ref_day = ric.giorno_riferimento or ric.data_inizio.day
    k = 0
    while k <= 100000:
        base = ric.data_inizio + relativedelta(months=step * k)
        d = _clamp_giorno(base.year, base.month, ref_day)
        if d >= oggi and d >= ric.data_inizio:
            return d if not (ric.data_fine and d > ric.data_fine) else None
        k += 1
    return None


async def genera_occorrenze(db: AsyncSession, ricorrenza_id=None, fino_a: date = None) -> dict:
    """Motore: crea righe in `scadenze` per ogni occorrenza dovuta fino a `fino_a`.
    IDEMPOTENTE: salta le occorrenze gia' presenti (ricorrenza_id + data_attesa)."""
    from app.models.models import Ricorrenza, Scadenza
    if fino_a is None:
        fino_a = date.today()
    q = select(Ricorrenza).where(Ricorrenza.attivo == True)  # noqa: E712 (solo ricorrenze attive)
    if ricorrenza_id:
        q = q.where(Ricorrenza.id == ricorrenza_id)
    ricorrenze = (await db.execute(q)).scalars().all()
    create = 0
    for ric in ricorrenze:
        date_occ = _occorrenze_ricorrenza(ric, fino_a)
        esistenti = set((await db.execute(
            select(Scadenza.data_attesa).where(Scadenza.ricorrenza_id == ric.id)
        )).scalars().all())
        for d in date_occ:
            if d in esistenti:
                continue
            stato, residuo = _scadenza_stato_residuo(ric.importo, Decimal("0"), d)
            db.add(Scadenza(
                tipo=ric.tipo_scadenza, data_attesa=d, importo=ric.importo,
                stato=stato, importo_incassato=Decimal("0"), importo_residuo=residuo,
                controparte_tipo=ric.controparte_tipo, controparte_id=ric.controparte_id,
                categoria_id=ric.categoria_id, documento_rif=ric.descrizione,
                origine="ricorrenza", impatta_cassa_bite=ric.impatta_cassa_bite,
                ricorrenza_id=ric.id,
            ))
            create += 1
        ric.prossima_data = _prossima_data_ricorrenza(ric)
    await db.commit()
    return {"ricorrenze_processate": len(ricorrenze), "occorrenze_create": create}


async def list_ricorrenze(db: AsyncSession, attivo=None, tipo_scadenza=None):
    from app.models.models import Ricorrenza
    q = select(Ricorrenza)
    if attivo is not None:
        q = q.where(Ricorrenza.attivo == attivo)
    if tipo_scadenza:
        q = q.where(Ricorrenza.tipo_scadenza == tipo_scadenza)
    q = q.order_by(Ricorrenza.data_inizio.asc())
    rows = (await db.execute(q)).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def create_ricorrenza(db: AsyncSession, payload: dict, created_by=None):
    from app.models.models import Ricorrenza
    data = {k: v for k, v in payload.items() if hasattr(Ricorrenza, k)}
    if created_by is not None:
        data["created_by"] = created_by
    ric = Ricorrenza(**data)
    ric.prossima_data = _prossima_data_ricorrenza(ric)
    db.add(ric)
    await db.commit()
    await db.refresh(ric)
    return {c.name: getattr(ric, c.name) for c in ric.__table__.columns}


async def update_ricorrenza(db: AsyncSession, ricorrenza_id, payload: dict):
    from app.models.models import Ricorrenza
    ric = (await db.execute(select(Ricorrenza).where(Ricorrenza.id == ricorrenza_id))).scalar_one_or_none()
    if not ric:
        return None
    for k, v in payload.items():
        if hasattr(ric, k):
            setattr(ric, k, v)
    ric.prossima_data = _prossima_data_ricorrenza(ric)
    await db.commit()
    await db.refresh(ric)
    return {c.name: getattr(ric, c.name) for c in ric.__table__.columns}


async def delete_ricorrenza(db: AsyncSession, ricorrenza_id):
    """Soft-delete (attivo=false) se ha scadenze generate; hard-delete se non ne ha."""
    from app.models.models import Ricorrenza, Scadenza
    ric = (await db.execute(select(Ricorrenza).where(Ricorrenza.id == ricorrenza_id))).scalar_one_or_none()
    if not ric:
        return None
    cnt = (await db.execute(
        select(func.count()).select_from(Scadenza).where(Scadenza.ricorrenza_id == ricorrenza_id)
    )).scalar() or 0
    if cnt > 0:
        ric.attivo = False
        await db.commit()
        return {"soft": True, "attivo": False, "scadenze_collegate": int(cnt)}
    await db.delete(ric)
    await db.commit()
    return {"soft": False, "deleted": True}


# ── ALLOCAZIONE fattura attiva -> commessa (Tabella F — spec v2 §7). Non aggancia i calcoli. ──
async def _allocazioni_totali(db: AsyncSession, fattura):
    """(imponibile, allocato_totale, residuo_allocabile) per una fattura attiva."""
    from app.models.models import FatturaAttivaAllocazione
    imponibile = Decimal(str(fattura.importo_netto or 0))
    allocato = (await db.execute(
        select(func.coalesce(func.sum(FatturaAttivaAllocazione.importo_allocato), 0))
        .where(FatturaAttivaAllocazione.fattura_attiva_id == fattura.id)
    )).scalar() or 0
    allocato = Decimal(str(allocato))
    return imponibile, allocato, imponibile - allocato


async def list_allocazioni_fattura(db: AsyncSession, fattura_attiva_id):
    from app.models.models import FatturaAttivaAllocazione, FatturaAttiva, Commessa, Cliente
    fattura = (await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fattura_attiva_id))).scalar_one_or_none()
    if not fattura:
        return None
    rows = (await db.execute(
        select(FatturaAttivaAllocazione, Cliente.ragione_sociale, Commessa.mese_competenza)
        .outerjoin(Commessa, FatturaAttivaAllocazione.commessa_id == Commessa.id)
        .outerjoin(Cliente, Commessa.cliente_id == Cliente.id)
        .where(FatturaAttivaAllocazione.fattura_attiva_id == fattura_attiva_id)
        .order_by(FatturaAttivaAllocazione.created_at)
    )).all()
    imponibile, allocato, residuo = await _allocazioni_totali(db, fattura)
    allocazioni = [{
        "id": a.id, "commessa_id": a.commessa_id, "importo_allocato": float(a.importo_allocato),
        "note": a.note, "cliente": rag, "mese_competenza": mese, "created_at": a.created_at,
    } for (a, rag, mese) in rows]
    return {"allocazioni": allocazioni, "imponibile": float(imponibile),
            "allocato_totale": float(allocato), "residuo_allocabile": float(residuo)}


async def alloca_fattura_commessa(db: AsyncSession, fattura_attiva_id, commessa_id, importo_allocato, note=None, created_by=None):
    """Alloca `importo_allocato` a una commessa con QUADRATURA (invariante 6): la somma non puo'
    superare l'imponibile. Se esiste gia' una riga (fattura, commessa), somma nell'unica riga."""
    from app.models.models import FatturaAttivaAllocazione, FatturaAttiva
    fattura = (await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fattura_attiva_id))).scalar_one_or_none()
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura attiva non trovata")
    importo_allocato = Decimal(str(importo_allocato))
    imponibile, allocato, residuo = await _allocazioni_totali(db, fattura)
    if importo_allocato > residuo:
        raise HTTPException(status_code=400, detail={
            "message": "Allocazione supera l'imponibile della fattura (invariante 6).",
            "imponibile": float(imponibile), "gia_allocato": float(allocato),
            "residuo_allocabile": float(residuo), "richiesto": float(importo_allocato),
        })
    esistente = (await db.execute(
        select(FatturaAttivaAllocazione).where(
            FatturaAttivaAllocazione.fattura_attiva_id == fattura_attiva_id,
            FatturaAttivaAllocazione.commessa_id == commessa_id)
    )).scalar_one_or_none()
    if esistente:
        esistente.importo_allocato = Decimal(str(esistente.importo_allocato)) + importo_allocato
        if note:
            esistente.note = note
        alloc = esistente
    else:
        alloc = FatturaAttivaAllocazione(
            fattura_attiva_id=fattura_attiva_id, commessa_id=commessa_id,
            importo_allocato=importo_allocato, note=note, created_by=created_by)
        db.add(alloc)
    await db.commit()
    await db.refresh(alloc)
    _, allocato2, residuo2 = await _allocazioni_totali(db, fattura)
    return {"id": str(alloc.id), "commessa_id": str(alloc.commessa_id),
            "importo_allocato": float(alloc.importo_allocato),
            "allocato_totale": float(allocato2), "residuo_allocabile": float(residuo2)}


async def rimuovi_allocazione(db: AsyncSession, allocazione_id):
    from app.models.models import FatturaAttivaAllocazione
    a = (await db.execute(select(FatturaAttivaAllocazione).where(FatturaAttivaAllocazione.id == allocazione_id))).scalar_one_or_none()
    if not a:
        return None
    fattura_id = a.fattura_attiva_id
    await db.delete(a)
    await db.commit()
    return {"deleted": True, "fattura_attiva_id": str(fattura_id)}


async def list_allocazioni_commessa(db: AsyncSession, commessa_id):
    from app.models.models import FatturaAttivaAllocazione, FatturaAttiva
    rows = (await db.execute(
        select(FatturaAttivaAllocazione, FatturaAttiva.numero, FatturaAttiva.data_emissione)
        .outerjoin(FatturaAttiva, FatturaAttivaAllocazione.fattura_attiva_id == FatturaAttiva.id)
        .where(FatturaAttivaAllocazione.commessa_id == commessa_id)
        .order_by(FatturaAttivaAllocazione.created_at)
    )).all()
    return [{"id": a.id, "fattura_attiva_id": a.fattura_attiva_id, "numero": num,
             "data_emissione": dem, "importo_allocato": float(a.importo_allocato), "note": a.note}
            for (a, num, dem) in rows]


async def proposta_allocazione(db: AsyncSession, fattura_attiva_id):
    """Proposta (spec §7): replica le allocazioni del mese precedente dello STESSO cliente
    (stesse commesse, stesse proporzioni) scalate sull'imponibile. NON applica nulla."""
    from dateutil.relativedelta import relativedelta
    from app.models.models import FatturaAttivaAllocazione, FatturaAttiva
    fattura = (await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fattura_attiva_id))).scalar_one_or_none()
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura attiva non trovata")
    if not fattura.cliente_id or not fattura.data_emissione:
        return {"proposta": [], "motivo": "Fattura senza cliente o data_emissione."}
    mese_corr = fattura.data_emissione.replace(day=1)
    mese_prec = mese_corr - relativedelta(months=1)
    mese_prec_fine = mese_corr - timedelta(days=1)
    rows = (await db.execute(
        select(FatturaAttivaAllocazione.commessa_id, func.sum(FatturaAttivaAllocazione.importo_allocato))
        .join(FatturaAttiva, FatturaAttivaAllocazione.fattura_attiva_id == FatturaAttiva.id)
        .where(FatturaAttiva.cliente_id == fattura.cliente_id,
               FatturaAttiva.data_emissione >= mese_prec,
               FatturaAttiva.data_emissione <= mese_prec_fine)
        .group_by(FatturaAttivaAllocazione.commessa_id)
    )).all()
    totale = sum((Decimal(str(t or 0)) for _, t in rows), Decimal("0"))
    if totale <= 0:
        return {"proposta": [], "motivo": "Nessuna allocazione nel mese precedente per questo cliente.",
                "mese_riferimento": str(mese_prec)}
    imponibile = Decimal(str(fattura.importo_netto or 0))
    proposta = []
    acc = Decimal("0")
    for i, (cid, tot) in enumerate(rows):
        prop = Decimal(str(tot or 0)) / totale
        if i < len(rows) - 1:
            imp = (imponibile * prop).quantize(Decimal("0.01"))
            acc += imp
        else:
            imp = imponibile - acc  # residuo all'ultima riga: Σ == imponibile esatto
        proposta.append({"commessa_id": str(cid), "proporzione": float(round(prop, 4)),
                         "importo_proposto": float(imp)})
    return {"mese_riferimento": str(mese_prec), "imponibile": float(imponibile), "proposta": proposta}


async def confronto_fatturazione_commessa(db: AsyncSession, commessa_id):
    """Vista di confronto (spec §7): accordo atteso (valore_fatturabile_calc) vs fatturato allocato.
    SOLO lettura, non modifica alcun calcolo."""
    from app.models.models import Commessa, FatturaAttivaAllocazione
    commessa = (await db.execute(
        select(Commessa).where(Commessa.id == commessa_id)
        .options(selectinload(Commessa.righe_progetto))  # valore_fatturabile_calc itera le righe
    )).scalar_one_or_none()
    if not commessa:
        return None
    accordo = Decimal(str(commessa.valore_fatturabile_calc or 0))
    fatturato = (await db.execute(
        select(func.coalesce(func.sum(FatturaAttivaAllocazione.importo_allocato), 0))
        .where(FatturaAttivaAllocazione.commessa_id == commessa_id)
    )).scalar() or 0
    fatturato = Decimal(str(fatturato))
    scarto = fatturato - accordo
    perc = float((scarto / accordo * 100).quantize(Decimal("0.1"))) if accordo > 0 else None
    return {"commessa_id": str(commessa_id), "accordo_atteso": float(accordo),
            "fatturato_allocato": float(fatturato), "scarto": float(scarto), "percentuale": perc}


# ── RATE A MILESTONE (spec §4.4/§4.5). Generano scadenze (cassa), non toccano i calcoli. ──
async def _somma_percentuali_rate(db: AsyncSession, progetto_id) -> Decimal:
    from app.models.models import ProgettoRata
    s = (await db.execute(
        select(func.coalesce(func.sum(ProgettoRata.percentuale), 0))
        .where(ProgettoRata.progetto_id == progetto_id)
    )).scalar() or 0
    return Decimal(str(s))


async def _accordo_progetto(db: AsyncSession, progetto_id):
    """(progetto, accordo_economico). accordo = importo_fisso + importo_variabile."""
    from app.models.models import Progetto
    p = (await db.execute(select(Progetto).where(Progetto.id == progetto_id))).scalar_one_or_none()
    if not p:
        return None, None
    return p, Decimal(str(p.importo_fisso or 0)) + Decimal(str(p.importo_variabile or 0))


async def list_rate(db: AsyncSession, progetto_id):
    from app.models.models import ProgettoRata
    rows = (await db.execute(
        select(ProgettoRata).where(ProgettoRata.progetto_id == progetto_id).order_by(ProgettoRata.numero)
    )).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def verifica_rate(db: AsyncSession, progetto_id) -> dict:
    somma = await _somma_percentuali_rate(db, progetto_id)
    return {"somma_percentuali": float(somma), "completo": somma == Decimal("100"),
            "residuo": float(Decimal("100") - somma)}


async def create_rata(db: AsyncSession, progetto_id, payload: dict, created_by=None):
    from app.models.models import ProgettoRata, Progetto
    p = (await db.execute(select(Progetto).where(Progetto.id == progetto_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    pct = Decimal(str(payload["percentuale"]))
    somma = await _somma_percentuali_rate(db, progetto_id)
    if somma + pct > Decimal("100"):
        raise HTTPException(status_code=400, detail={
            "message": "La somma delle percentuali supererebbe 100%.",
            "gia_allocato": float(somma), "residuo": float(Decimal("100") - somma), "richiesto": float(pct)})
    data = {k: v for k, v in payload.items() if hasattr(ProgettoRata, k)}
    if created_by is not None:
        data["created_by"] = created_by
    r = ProgettoRata(progetto_id=progetto_id, **data)
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return {c.name: getattr(r, c.name) for c in r.__table__.columns}


async def seed_rate_default(db: AsyncSession, progetto_id, created_by=None):
    """3 rate standard (spec §4.5): 33.33/33.33/33.34 (Σ=100 esatto), solo per creazione_sito_web
    senza rate esistenti."""
    from app.models.models import ProgettoRata, Progetto
    p = (await db.execute(select(Progetto).where(Progetto.id == progetto_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    if p.tipo_servizio != "creazione_sito_web":
        raise HTTPException(status_code=400, detail="Rate di default solo per tipo_servizio=creazione_sito_web")
    cnt = (await db.execute(
        select(func.count()).select_from(ProgettoRata).where(ProgettoRata.progetto_id == progetto_id)
    )).scalar() or 0
    if cnt > 0:
        raise HTTPException(status_code=400, detail="Il progetto ha gia' delle rate")
    default = [(1, Decimal("33.33"), "accordo_siglato"), (2, Decimal("33.33"), "approvazione_layout"),
               (3, Decimal("33.34"), "messa_online")]
    for num, pct, ms in default:
        db.add(ProgettoRata(progetto_id=progetto_id, numero=num, percentuale=pct, milestone=ms, created_by=created_by))
    await db.commit()
    return {"create": 3, "somma_percentuali": 100.0, "rate": [{"numero": n, "percentuale": float(p_), "milestone": m} for n, p_, m in default]}


async def raggiungi_rata(db: AsyncSession, progetto_id, numero, data_raggiungimento, user_id=None):
    """Marca la rata raggiunta e genera la scadenza attiva. Quadratura (invariante 23): l'ultima
    rata (numero max) assorbe il resto di arrotondamento -> Σ scadenze = accordo esatto."""
    from decimal import ROUND_HALF_UP
    from app.models.models import ProgettoRata, Scadenza
    rata = (await db.execute(select(ProgettoRata).where(
        ProgettoRata.progetto_id == progetto_id, ProgettoRata.numero == numero))).scalar_one_or_none()
    if not rata:
        raise HTTPException(status_code=404, detail="Rata non trovata")
    if rata.raggiunta and rata.scadenza_id:
        raise HTTPException(status_code=400, detail="Rata gia' raggiunta con scadenza generata (idempotenza).")
    p, accordo = await _accordo_progetto(db, progetto_id)
    rate = (await db.execute(select(ProgettoRata).where(ProgettoRata.progetto_id == progetto_id))).scalars().all()
    max_num = max(r.numero for r in rate)

    def _r(x):
        return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if numero == max_num:
        altri = sum((_r(accordo * Decimal(str(r.percentuale)) / 100) for r in rate if r.numero != numero), Decimal("0"))
        importo = accordo - altri
    else:
        importo = _r(accordo * Decimal(str(rata.percentuale)) / 100)

    par = await get_parametro(db, "termini_pagamento_default")
    giorni = int(par["valore"]) if par and par.get("valore") is not None else 30
    data_attesa = data_raggiungimento + timedelta(days=giorni)
    stato, residuo = _scadenza_stato_residuo(importo, Decimal("0"), data_attesa)
    scad = Scadenza(
        tipo="attiva", data_attesa=data_attesa, importo=importo, stato=stato,
        importo_incassato=Decimal("0"), importo_residuo=residuo,
        controparte_tipo="cliente", controparte_id=p.cliente_id, progetto_id=progetto_id,
        origine="progetto", milestone=rata.milestone,
        documento_rif=f"Rata {numero} - {rata.milestone}", created_by=user_id)
    db.add(scad)
    await db.flush()
    rata.raggiunta = True
    rata.data_raggiungimento = data_raggiungimento
    rata.scadenza_id = scad.id
    await db.commit()
    return {"rata": numero, "milestone": rata.milestone, "importo": float(importo),
            "data_attesa": str(data_attesa), "giorni_termini": giorni, "scadenza_id": str(scad.id)}


async def annulla_raggiungimento_rata(db: AsyncSession, progetto_id, numero):
    from app.models.models import ProgettoRata, Scadenza
    rata = (await db.execute(select(ProgettoRata).where(
        ProgettoRata.progetto_id == progetto_id, ProgettoRata.numero == numero))).scalar_one_or_none()
    if not rata:
        raise HTTPException(status_code=404, detail="Rata non trovata")
    if rata.scadenza_id:
        scad = (await db.execute(select(Scadenza).where(Scadenza.id == rata.scadenza_id))).scalar_one_or_none()
        if scad and Decimal(str(scad.importo_incassato or 0)) > 0:
            raise HTTPException(status_code=400, detail="La scadenza ha gia' incassi: non si puo' annullare.")
        if scad:
            await db.delete(scad)
    rata.raggiunta = False
    rata.data_raggiungimento = None
    rata.scadenza_id = None
    await db.commit()
    return {"rata": numero, "raggiunta": False, "scadenza_rimossa": True}


async def delete_rata(db: AsyncSession, progetto_id, numero):
    from app.models.models import ProgettoRata
    rata = (await db.execute(select(ProgettoRata).where(
        ProgettoRata.progetto_id == progetto_id, ProgettoRata.numero == numero))).scalar_one_or_none()
    if not rata:
        return False
    await db.delete(rata)
    await db.commit()
    return True


# ── LOCK DI COMPETENZA / CHIUSURA PERIODO (spec §13.6, invariante 18) ──────────
# Fonte unica del lock. Vale sulla COMPETENZA, non sulla cassa.
async def periodo_e_bloccato(db: AsyncSession, data_competenza) -> bool:
    """True SOLO se il mese di `data_competenza` e' in hard_lock. soft_close NON blocca
    (mese in revisione, modifiche permesse). Periodo assente in tabella = aperto = False."""
    from app.models.models import PeriodoContabile
    if data_competenza is None:
        return False
    stato = (await db.execute(
        select(PeriodoContabile.stato).where(
            PeriodoContabile.anno == data_competenza.year,
            PeriodoContabile.mese == data_competenza.month)
    )).scalar_one_or_none()
    return stato == "hard_lock"


async def list_periodi(db: AsyncSession, anno=None):
    from app.models.models import PeriodoContabile
    q = select(PeriodoContabile)
    if anno:
        q = q.where(PeriodoContabile.anno == anno)
    q = q.order_by(PeriodoContabile.anno.desc(), PeriodoContabile.mese.desc())
    rows = (await db.execute(q)).scalars().all()
    periodi = [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]
    # giorno_hard_lock dal registro parametri (promemoria, nessuna automazione).
    par = await get_parametro(db, "giorno_hard_lock")
    giorno = int(par["valore"]) if par and par.get("valore") is not None else None
    return {"periodi": periodi, "giorno_hard_lock": giorno}


async def _get_or_create_periodo(db, anno, mese):
    from app.models.models import PeriodoContabile
    p = (await db.execute(select(PeriodoContabile).where(
        PeriodoContabile.anno == anno, PeriodoContabile.mese == mese))).scalar_one_or_none()
    if not p:
        p = PeriodoContabile(anno=anno, mese=mese, stato="aperto")
        db.add(p)
        await db.flush()
    return p


async def soft_close_periodo(db: AsyncSession, anno, mese, user_id=None):
    p = await _get_or_create_periodo(db, anno, mese)
    p.stato = "soft_close"
    p.soft_closed_at = datetime.now(timezone.utc)
    p.closed_by = user_id
    await db.commit()
    await db.refresh(p)
    return {c.name: getattr(p, c.name) for c in p.__table__.columns}


async def hard_lock_periodo(db: AsyncSession, anno, mese, user_id=None):
    # TODO(spec §13.6): la routine completa di chiusura (snapshot forecast, ricalcolo coefficiente
    # OVH, chiusura margini commessa, calcolo Actual) si comporra' quando quei pezzi esisteranno.
    p = await _get_or_create_periodo(db, anno, mese)
    p.stato = "hard_lock"
    p.hard_locked_at = datetime.now(timezone.utc)
    p.closed_by = user_id
    await db.commit()
    await db.refresh(p)
    return {c.name: getattr(p, c.name) for c in p.__table__.columns}


async def riapri_periodo(db: AsyncSession, anno, mese, motivo, user_id=None):
    from app.models.models import PeriodoContabile
    p = (await db.execute(select(PeriodoContabile).where(
        PeriodoContabile.anno == anno, PeriodoContabile.mese == mese))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Periodo non trovato (mai chiuso)")
    p.stato = "aperto"
    p.riaperto_count = (p.riaperto_count or 0) + 1
    p.ultima_riapertura_at = datetime.now(timezone.utc)
    p.ultima_riapertura_by = user_id
    p.motivo_riapertura = motivo
    await db.commit()
    await db.refresh(p)
    return {c.name: getattr(p, c.name) for c in p.__table__.columns}


async def stato_periodo_data(db: AsyncSession, data):
    from app.models.models import PeriodoContabile
    row = (await db.execute(select(PeriodoContabile).where(
        PeriodoContabile.anno == data.year, PeriodoContabile.mese == data.month))).scalar_one_or_none()
    return {"data": str(data), "anno": data.year, "mese": data.month,
            "stato": row.stato if row else "aperto",
            "bloccato": bool(row and row.stato == "hard_lock")}


# ── COEFFICIENTE OVH ROLLING (v1 deterministica) + VARIANZA (spec §4.5, inv. 17) ──────────
# SOLO calcolo/esposizione: non aggancia calcola_margine_commessa ne' il P&L.
# v1: numeratore e denominatore ancorati alle PARTI DETERMINISTICHE (il forecast 12m non esiste
# ancora, Fase 6). Quando esistera' si sostituira' la FONTE senza cambiare la struttura.
async def _run_rate_mensile_ricavi(db: AsyncSession) -> Decimal:
    """Run-rate mensile ricavi ricorrenti = Σ importo_fisso dei progetti RETAINER attivi."""
    from app.models.models import Progetto, ProjectType, ProjectStatus
    s = (await db.execute(
        select(func.coalesce(func.sum(Progetto.importo_fisso), 0)).where(
            Progetto.tipo == ProjectType.RETAINER,
            Progetto.is_deleted == False,  # noqa: E712
            Progetto.stato == ProjectStatus.ATTIVO)
    )).scalar() or 0
    return Decimal(str(s))


async def _ultimo_coefficiente(db: AsyncSession, periodo, incluso=False):
    """Ultimo coefficiente salvato con periodo_riferimento < periodo (o <= se incluso)."""
    from app.models.models import CoefficienteOvh
    cond = CoefficienteOvh.periodo_riferimento <= periodo if incluso else CoefficienteOvh.periodo_riferimento < periodo
    row = (await db.execute(
        select(CoefficienteOvh.coefficiente).where(cond)
        .order_by(CoefficienteOvh.periodo_riferimento.desc()).limit(1)
    )).scalar_one_or_none()
    return Decimal(str(row)) if row is not None else None


async def calcola_coefficiente_ovh(db: AsyncSession, periodo, orizzonte_mesi=None,
                                   overhead_override=None, base_override=None, salva=False, user_id=None):
    """Coefficiente = overhead 12m / base ricavi 12m (piena precisione). None se base=0.
    Tetto allo scostamento vs coefficiente precedente (ovh_tetto_scostamento_pct)."""
    from app.models.models import CoefficienteOvh
    periodo = periodo.replace(day=1)
    if orizzonte_mesi is None:
        par = await get_parametro(db, "orizzonte_coefficiente_mesi", periodo)
        orizzonte_mesi = int(par["valore"]) if par and par.get("valore") is not None else 12
    # NUMERATORE deterministico: costi struttura mensili x orizzonte
    if overhead_override is not None:
        overhead = Decimal(str(overhead_override))
    else:
        fissi_mese, _, _ = await costi_fissi_indivisibili_mese(db, periodo)
        overhead = Decimal(str(fissi_mese)) * orizzonte_mesi
    # DENOMINATORE deterministico: run-rate ricavi ricorrenti x orizzonte (base = RICAVI, inv. 17)
    if base_override is not None:
        base = Decimal(str(base_override))
    else:
        base = await _run_rate_mensile_ricavi(db) * orizzonte_mesi
    coeff_grezzo = (overhead / base) if base > 0 else None
    # TETTO
    tpar = await get_parametro(db, "ovh_tetto_scostamento_pct", periodo)
    tetto_pct = Decimal(str(tpar["valore"])) if tpar and tpar.get("valore") is not None else Decimal("20")
    coeff = coeff_grezzo
    tetto_applicato = False
    prec = await _ultimo_coefficiente(db, periodo)
    if coeff_grezzo is not None and prec is not None and prec > 0:
        lim = tetto_pct / 100
        cap_max, cap_min = prec * (1 + lim), prec * (1 - lim)
        if coeff_grezzo > cap_max:
            coeff, tetto_applicato = cap_max, True
        elif coeff_grezzo < cap_min:
            coeff, tetto_applicato = cap_min, True
    result = {
        "periodo": str(periodo), "orizzonte_mesi": orizzonte_mesi,
        "overhead_previsto": float(overhead), "base_ricavi_prevista": float(base),
        "coefficiente_grezzo": float(round(coeff_grezzo, 6)) if coeff_grezzo is not None else None,
        "coefficiente": float(round(coeff, 6)) if coeff is not None else None,
        "tetto_applicato": tetto_applicato, "tetto_scostamento_pct": float(tetto_pct),
        "fonte": "deterministico",
    }
    if salva and coeff is not None:
        row = (await db.execute(select(CoefficienteOvh).where(CoefficienteOvh.periodo_riferimento == periodo))).scalar_one_or_none()
        if row:
            row.overhead_previsto = overhead; row.base_ricavi_prevista = base
            row.coefficiente = coeff; row.coefficiente_grezzo = coeff_grezzo
            row.tetto_applicato = tetto_applicato
        else:
            db.add(CoefficienteOvh(periodo_riferimento=periodo, overhead_previsto=overhead,
                                   base_ricavi_prevista=base, coefficiente=coeff,
                                   coefficiente_grezzo=coeff_grezzo, tetto_applicato=tetto_applicato,
                                   fonte="deterministico", created_by=user_id))
        await db.commit()
        result["salvato"] = True
    return result


async def list_coefficienti_ovh_storico(db: AsyncSession):
    from app.models.models import CoefficienteOvh
    rows = (await db.execute(select(CoefficienteOvh).order_by(CoefficienteOvh.periodo_riferimento.desc()))).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def calcola_varianza_assorbimento(db: AsyncSession, periodo, overhead_reale_override=None, caricato_override=None):
    """Varianza = overhead reale del periodo - overhead caricato (coeff x ricavi commesse del periodo).
    VISTA di sola lettura: la varianza resta aziendale, MAI spalmata sulle commesse (inv. 17)."""
    from app.models.models import Commessa
    periodo = periodo.replace(day=1)
    coeff = await _ultimo_coefficiente(db, periodo, incluso=True) or Decimal("0")
    # overhead caricato = coeff x Σ ricavi commesse con competenza nel periodo
    if caricato_override is not None:
        caricato = Decimal(str(caricato_override))
        ricavi = None
    else:
        commesse = (await db.execute(
            select(Commessa).where(Commessa.mese_competenza == periodo)
            .options(selectinload(Commessa.righe_progetto))
        )).scalars().all()
        ricavi = sum((Decimal(str(c.valore_fatturabile_calc or 0)) for c in commesse), Decimal("0"))
        caricato = (coeff * ricavi).quantize(Decimal("0.01"))
    # overhead reale = costi struttura effettivi del periodo
    if overhead_reale_override is not None:
        reale = Decimal(str(overhead_reale_override))
    else:
        fissi, _, _ = await costi_fissi_indivisibili_mese(db, periodo)
        reale = Decimal(str(fissi))
    varianza = reale - caricato
    tipo = "sotto_assorbimento" if reale > caricato else ("sovra_assorbimento" if reale < caricato else "neutro")
    return {"periodo": str(periodo), "coefficiente": float(coeff),
            "ricavi_periodo": float(ricavi) if ricavi is not None else None,
            "overhead_caricato": float(caricato), "overhead_reale": float(reale),
            "varianza": float(varianza), "tipo": tipo}


# ── IVA PER CASSA REALE da movimenti SDI riconciliati (spec §10.1, inv. 13) ──────────
# ISOLATA: l'IVA non tocca MAI CE ne' margine. Convive con calcola_scadenzario_fiscale (stima per
# competenza), che resta invariato. Inerte finche' non ci sono movimenti SDI riconciliati (0 onesto).
async def _periodo_iva(db: AsyncSession, data: date):
    """Confini periodo IVA dalla data, secondo iva_periodicita (registro, effective-dated)."""
    from dateutil.relativedelta import relativedelta
    par = await get_parametro(db, "iva_periodicita", data)
    periodicita = par["valore"] if par and par.get("valore") else "trimestrale"
    if periodicita == "mensile":
        dal = data.replace(day=1)
        al = (dal + relativedelta(months=1)) - timedelta(days=1)
        label = dal.strftime("%Y-%m")
    else:  # trimestrale (default)
        q = (data.month - 1) // 3
        dal = date(data.year, q * 3 + 1, 1)
        al = (dal + relativedelta(months=3)) - timedelta(days=1)
        label = f"{data.year}-Q{q + 1}"
    return dal, al, label, periodicita


async def calcola_liquidazione_iva(db: AsyncSession, data: date = None, dal: date = None, al: date = None):
    """IVA per cassa: debito (incassi SDI) - credito (pagamenti SDI x detraibilita). Saldo>0 versamento,
    saldo<0 credito riportato (NON genera incasso, inv. 13). Fonte: movimento.iva_importo (da FIC)."""
    periodicita = None
    if dal is None or al is None:
        dal, al, label, periodicita = await _periodo_iva(db, data or date.today())
    else:
        label = f"{dal} .. {al}"
    p = {"dal": dal, "al": al}
    debito_row = (await db.execute(text(
        "SELECT COALESCE(SUM(m.iva_importo),0) AS iva, COUNT(*) AS n FROM movimenti_cassa m "
        "WHERE m.data_valuta BETWEEN :dal AND :al AND m.iva_importo IS NOT NULL "
        "AND EXISTS (SELECT 1 FROM riconciliazioni r JOIN fatture_attive f ON f.id=r.fattura_attiva_id "
        "WHERE r.movimento_id=m.id AND f.fattura_elettronica=true)"), p)).one()
    credito_row = (await db.execute(text(
        "SELECT COALESCE(SUM(m.iva_importo * COALESCE(f.detraibilita_pct,0)/100),0) AS iva, "
        "COUNT(DISTINCT m.id) AS n FROM movimenti_cassa m "
        "JOIN riconciliazioni r ON r.movimento_id=m.id "
        "JOIN fatture_passive f ON f.id=r.fattura_passiva_id "
        "WHERE m.data_valuta BETWEEN :dal AND :al AND f.fattura_elettronica=true AND m.iva_importo IS NOT NULL"), p)).one()
    non_sdi = (await db.execute(text(
        "SELECT COUNT(DISTINCT m.id) FROM movimenti_cassa m JOIN riconciliazioni r ON r.movimento_id=m.id "
        "LEFT JOIN fatture_attive fa ON fa.id=r.fattura_attiva_id "
        "LEFT JOIN fatture_passive fp ON fp.id=r.fattura_passiva_id "
        "WHERE m.data_valuta BETWEEN :dal AND :al "
        "AND COALESCE(fa.fattura_elettronica, fp.fattura_elettronica, false)=false"), p)).scalar() or 0
    non_ric = (await db.execute(text(
        "SELECT COUNT(*) FROM movimenti_cassa m WHERE m.data_valuta BETWEEN :dal AND :al "
        "AND NOT EXISTS (SELECT 1 FROM riconciliazioni r WHERE r.movimento_id=m.id)"), p)).scalar() or 0
    debito = Decimal(str(debito_row.iva)).quantize(Decimal("0.01"))
    credito = Decimal(str(credito_row.iva)).quantize(Decimal("0.01"))
    saldo = debito - credito
    esito = "versamento" if saldo > 0 else ("credito_riportato" if saldo < 0 else "neutro")
    return {
        "periodo": label, "periodicita": periodicita, "dal": str(dal), "al": str(al),
        "iva_debito": float(debito), "iva_credito": float(credito), "saldo": float(saldo), "esito": esito,
        "dettaglio": {"n_incassi_sdi": int(debito_row.n), "n_pagamenti_sdi": int(credito_row.n),
                      "esclusi_non_sdi": int(non_sdi), "esclusi_non_riconciliati": int(non_ric)},
    }


# ── PREVENTIVATORE (spec §18): gemello ex-ante della marginalita. Non tocca il consuntivo. ──
def _costo_riga_preventivo(v) -> Decimal:
    """Costo di una riga per NATURA (§18.2). overhead escluso qui (dipende dal prezzo)."""
    tipo = (v.get("tipo") or "").lower()
    if tipo == "lavoro":
        if v.get("ore") is not None and v.get("tariffa") is not None:
            return (Decimal(str(v["ore"])) * Decimal(str(v["tariffa"]))).quantize(Decimal("0.01"))
        return Decimal(str(v.get("costo") or 0))
    if tipo == "socio":
        # quota progettuale pesata (§4.6): STIMA, NON guidata dalle ore. Le ore-socio = solo capacita'.
        return Decimal(str(v.get("costo") or 0))
    if tipo == "esterno":
        return Decimal(str(v.get("costo") or 0))
    return Decimal("0")  # overhead: calcolato a valle sul prezzo


def calcola_economia_preventivo(righe: list, *, modalita=None, markup_pct=None, markup_su="costo_pieno",
                                margine_pct=None, prezzo_dato=None, coeff_ovh=Decimal("0"),
                                margine_target=None) -> dict:
    """Economia del preventivo: costi per natura, prezzo nelle 2 modalita', e SEMPRE markup+margine
    effettivi (markup=prezzo/costo-1, margine=utile/prezzo — §18.1). Budget interno §18.3.
    L'overhead e' % sul prezzo (§18.2), calcolato a valle (no circolarita')."""
    from decimal import ROUND_HALF_UP
    coeff_ovh = Decimal(str(coeff_ovh or 0))
    costo_lavoro = costo_socio = costo_esterni = Decimal("0")
    ha_overhead = False
    per_riga = []
    for v in righe:
        tipo = (v.get("tipo") or "").lower()
        c = _costo_riga_preventivo(v)
        if tipo == "lavoro":
            costo_lavoro += c
        elif tipo == "socio":
            costo_socio += c
        elif tipo == "esterno":
            costo_esterni += c
        elif tipo == "overhead":
            ha_overhead = True
        per_riga.append({"tipo": tipo, "costo": float(c), "is_stima": tipo == "socio"})

    costo_diretto = costo_lavoro + costo_socio + costo_esterni

    # Prezzo secondo la modalita'
    if modalita == "margine" and prezzo_dato is not None:
        prezzo = Decimal(str(prezzo_dato))
    elif modalita == "margine" and margine_pct is not None:
        m = Decimal(str(margine_pct)) / 100
        prezzo = (costo_diretto / (1 - m)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if m < 1 else costo_diretto
    elif modalita == "markup":
        base = costo_lavoro if markup_su == "solo_lavoro" else costo_diretto
        mk = Decimal(str(markup_pct or 0)) / 100
        prezzo = (base * (1 + mk)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        prezzo = Decimal(str(prezzo_dato)) if prezzo_dato is not None else costo_diretto

    overhead_cost = (coeff_ovh * prezzo).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if ha_overhead else Decimal("0")
    costo_totale = costo_diretto + overhead_cost

    markup_eff = float(((prezzo / costo_totale) - 1) * 100) if costo_totale > 0 else None
    margine_eff = float(((prezzo - costo_totale) / prezzo) * 100) if prezzo > 0 else None

    # Budget interno §18.3: B = prezzo - esterni - soci - OVH - margine_target
    mt = Decimal(str(margine_target)) if margine_target is not None else Decimal("0")
    budget_interno = prezzo - costo_esterni - costo_socio - overhead_cost - mt

    # Quadratura (inv. 23): distribuisce il prezzo sulle righe (proporzionale al costo), resto all'ultima.
    costi = [Decimal(str(r["costo"])) for r in per_riga]
    base_tot = sum(costi, Decimal("0"))
    acc = Decimal("0")
    for i, r in enumerate(per_riga):
        if i < len(per_riga) - 1:
            quota = (prezzo * costi[i] / base_tot).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if base_tot > 0 else Decimal("0")
            acc += quota
            r["prezzo_riga"] = float(quota)
        else:
            r["prezzo_riga"] = float(prezzo - acc)  # resto all'ultima -> Σ == prezzo esatto

    return {
        "costo_lavoro": float(costo_lavoro), "costo_socio": float(costo_socio),
        "costo_esterni": float(costo_esterni), "overhead": float(overhead_cost),
        "coefficiente_ovh": float(coeff_ovh), "costo_totale": float(costo_totale),
        "prezzo": float(prezzo), "righe": per_riga,
        "markup_effettivo_pct": round(markup_eff, 2) if markup_eff is not None else None,
        "margine_effettivo_pct": round(margine_eff, 2) if margine_eff is not None else None,
        "budget_interno_lavoro": float(budget_interno),
        "note_socio": "Il costo socio e' una STIMA (quota pesata §4.6), non dipende dalle ore.",
        "note_overhead": "L'overhead include gia' la quota admin/commerciale dei soci: non rimetterla nei costi diretti.",
    }


async def calcola_preventivo(db: AsyncSession, preventivo_id):
    """Carica righe + testata e calcola l'economia. coeff_ovh dal rolling corrente (o 0)."""
    from app.models.models import Preventivo, PreventivoVoce
    p = (await db.execute(select(Preventivo).where(Preventivo.id == preventivo_id))).scalar_one_or_none()
    if not p:
        return None
    voci = (await db.execute(select(PreventivoVoce).where(PreventivoVoce.preventivo_id == preventivo_id).order_by(PreventivoVoce.ordine))).scalars().all()
    righe = [{"tipo": v.tipo, "ore": v.ore, "tariffa": v.tariffa, "costo": v.costo, "ricarico_pct": v.ricarico_pct} for v in voci]
    coeff = await _ultimo_coefficiente(db, date.today(), incluso=True) or Decimal("0")
    eco = calcola_economia_preventivo(
        righe, modalita=p.modalita_prezzo, markup_pct=p.markup_pct, markup_su=p.markup_su or "costo_pieno",
        margine_pct=p.margine_pct, prezzo_dato=p.prezzo, coeff_ovh=coeff, margine_target=p.margine_target)
    eco["preventivo_id"] = str(preventivo_id)
    eco["stato_commerciale"] = {"BOZZA": "bozza", "INVIATO": "offerta", "ACCETTATO": "accettato",
                                 "RIFIUTATO": "perso", "SCADUTO": "perso"}.get(getattr(p.stato, "value", str(p.stato)), None)
    return eco


def simula_budget_interno(budget: Decimal, risorse_fisse: list, tariffa_variabile: Decimal) -> dict:
    """Frontiera §18.3: fissate le ore di alcune risorse (dipendenti), max ore per una risorsa variabile.
    h_F <= (B - Σ ore_i*r_i) / r_F. Vale SOLO per risorse a ore; i soci sono capacita', esclusi."""
    budget = Decimal(str(budget)); tr = Decimal(str(tariffa_variabile))
    consumato = sum((Decimal(str(r["ore"])) * Decimal(str(r["tariffa"])) for r in risorse_fisse), Decimal("0"))
    residuo = budget - consumato
    max_ore = float((residuo / tr)) if tr > 0 else None
    return {"budget_interno": float(budget), "consumato_fisse": float(consumato),
            "residuo": float(residuo), "tariffa_variabile": float(tr),
            "max_ore_variabile": round(max_ore, 2) if max_ore is not None else None,
            "nota": "Frontiera valida solo tra risorse a ore (dipendenti). I soci sono capacita', non budget."}


async def list_servizi_catalogo(db: AsyncSession):
    from app.models.models import ServizioCatalogo
    rows = (await db.execute(select(ServizioCatalogo).where(ServizioCatalogo.attivo == True).order_by(ServizioCatalogo.nome))).scalars().all()  # noqa: E712
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


# ── BUDGET & FORECAST: strutture versionate (spec §13). Nessun calcolo: solo CRUD + versioning. ──
async def _versione_o_404(db: AsyncSession, versione_id):
    from app.models.models import BudgetVersione
    v = (await db.execute(select(BudgetVersione).where(BudgetVersione.id == versione_id))).scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Versione budget non trovata")
    return v


def _assert_modificabile(v):
    """§13: una versione approvata/archiviata e' IMMUTABILE. Le correzioni entrano come NUOVA
    versione forecast, non riscrivendo la storia (stesso principio del lock di competenza)."""
    if v.stato != "bozza":
        raise HTTPException(status_code=400, detail=(
            f"Versione {v.tipo} {v.anno} v{v.versione} in stato '{v.stato}': immutabile. "
            "Crea una nuova versione forecast per registrare la correzione."))


async def list_budget_versioni(db: AsyncSession, anno=None, tipo=None, stato=None):
    from app.models.models import BudgetVersione
    q = select(BudgetVersione)
    if anno:
        q = q.where(BudgetVersione.anno == anno)
    if tipo:
        q = q.where(BudgetVersione.tipo == tipo)
    if stato:
        q = q.where(BudgetVersione.stato == stato)
    q = q.order_by(BudgetVersione.anno.desc(), BudgetVersione.tipo, BudgetVersione.versione.desc())
    rows = (await db.execute(q)).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def create_budget_versione(db: AsyncSession, payload: dict, user_id=None):
    from app.models.models import BudgetVersione
    data = {k: v for k, v in payload.items() if hasattr(BudgetVersione, k)}
    if not data.get("versione"):  # auto-incrementa per (anno, tipo)
        mx = (await db.execute(select(func.max(BudgetVersione.versione)).where(
            BudgetVersione.anno == data["anno"], BudgetVersione.tipo == data["tipo"]))).scalar()
        data["versione"] = int(mx or 0) + 1
    if user_id is not None:
        data["created_by"] = user_id
    v = BudgetVersione(**data)
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return {c.name: getattr(v, c.name) for c in v.__table__.columns}


async def update_budget_versione(db: AsyncSession, versione_id, payload: dict):
    v = await _versione_o_404(db, versione_id)
    for k, val in payload.items():
        if hasattr(v, k) and k not in ("id", "created_by", "approvato_at", "approvato_by"):
            setattr(v, k, val)
    await db.commit()
    await db.refresh(v)
    return {c.name: getattr(v, c.name) for c in v.__table__.columns}


async def delete_budget_versione(db: AsyncSession, versione_id):
    v = await _versione_o_404(db, versione_id)
    if v.stato != "bozza":
        raise HTTPException(status_code=400, detail=f"Versione in stato '{v.stato}': eliminabile solo in bozza.")
    await db.delete(v)  # le righe seguono per ON DELETE CASCADE
    await db.commit()
    return {"deleted": True}


async def approva_budget_versione(db: AsyncSession, versione_id, user_id=None):
    v = await _versione_o_404(db, versione_id)
    v.stato = "approvato"
    v.approvato_at = datetime.now(timezone.utc)
    v.approvato_by = user_id
    await db.commit()
    await db.refresh(v)
    return {c.name: getattr(v, c.name) for c in v.__table__.columns}


async def list_budget_righe(db: AsyncSession, versione_id):
    from app.models.models import BudgetRiga
    rows = (await db.execute(select(BudgetRiga).where(BudgetRiga.versione_id == versione_id)
                             .order_by(BudgetRiga.mese, BudgetRiga.voce_tipo))).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def create_budget_righe(db: AsyncSession, versione_id, righe: list):
    from app.models.models import BudgetRiga
    v = await _versione_o_404(db, versione_id)
    _assert_modificabile(v)
    create = []
    for r in righe:
        data = {k: val for k, val in r.items() if hasattr(BudgetRiga, k)}
        data["versione_id"] = versione_id
        if data.get("anno") is None:   # default = anno della versione (model_dump passa None esplicito)
            data["anno"] = v.anno
        create.append(BudgetRiga(**data))
    db.add_all(create)
    await db.commit()
    return {"create": len(create)}


async def update_budget_riga(db: AsyncSession, riga_id, payload: dict):
    from app.models.models import BudgetRiga
    r = (await db.execute(select(BudgetRiga).where(BudgetRiga.id == riga_id))).scalar_one_or_none()
    if not r:
        return None
    _assert_modificabile(await _versione_o_404(db, r.versione_id))
    for k, val in payload.items():
        if hasattr(r, k) and k not in ("id", "versione_id"):
            setattr(r, k, val)
    await db.commit()
    await db.refresh(r)
    return {c.name: getattr(r, c.name) for c in r.__table__.columns}


async def delete_budget_riga(db: AsyncSession, riga_id):
    from app.models.models import BudgetRiga
    r = (await db.execute(select(BudgetRiga).where(BudgetRiga.id == riga_id))).scalar_one_or_none()
    if not r:
        return None
    _assert_modificabile(await _versione_o_404(db, r.versione_id))
    await db.delete(r)
    await db.commit()
    return {"deleted": True}


async def totali_budget_versione(db: AsyncSession, versione_id):
    """Aggregati di sola lettura: per voce_tipo (anno) e per mese."""
    from app.models.models import BudgetRiga
    await _versione_o_404(db, versione_id)
    per_voce = (await db.execute(
        select(BudgetRiga.voce_tipo, func.coalesce(func.sum(BudgetRiga.importo), 0))
        .where(BudgetRiga.versione_id == versione_id).group_by(BudgetRiga.voce_tipo)
    )).all()
    per_mese = (await db.execute(
        select(BudgetRiga.mese, BudgetRiga.voce_tipo, func.coalesce(func.sum(BudgetRiga.importo), 0))
        .where(BudgetRiga.versione_id == versione_id).group_by(BudgetRiga.mese, BudgetRiga.voce_tipo)
        .order_by(BudgetRiga.mese)
    )).all()
    return {
        "versione_id": str(versione_id),
        "per_voce_tipo": {v: float(t) for v, t in per_voce},
        "per_mese": [{"mese": m, "voce_tipo": v, "importo": float(t)} for m, v, t in per_mese],
    }


# ── ACTUAL + CONFRONTO BUDGET/CONSUNTIVO (spec §13). Sola lettura: non modifica nulla. ──
# FONTI (Passo 0): l'Actual RIUSA calcola_pl_gestionale -> per costruzione coincide col P&L.
#   ricavo          -> pl["ricavi"]["totale"]        (fonte unica: commesse del mese)
#   costo_diretto   -> pl["costi_diretti"]           (manodopera + diretti + quota Luca)
#   costo_struttura -> pl["costi_fissi_indivisibili"](esclude 'personale', come il P&L)
#   altro           -> None (nessuna fonte affidabile: mai 0 inventato)
async def calcola_actual(db: AsyncSession, anno: int, mese: int = None) -> dict:
    """Consuntivo per voce_tipo. Se `mese` e' None calcola tutti i 12 mesi dell'anno.
    NB: 0 = zero REALE (nessun ricavo/costo quel mese); None = voce non calcolabile (nessuna fonte)."""
    mesi = [mese] if mese else list(range(1, 13))
    out = []
    for m in mesi:
        pl = await calcola_pl_gestionale(db, date(anno, m, 1))
        out.append({
            "mese": m,
            "ricavo": pl["ricavi"]["totale"],
            "costo_diretto": pl["costi_diretti"],
            "costo_struttura": pl["costi_fissi_indivisibili"],
            "altro": None,  # nessuna fonte affidabile
        })
    tot = {v: (sum(r[v] for r in out) if v != "altro" else None)
           for v in ("ricavo", "costo_diretto", "costo_struttura", "altro")}
    return {"anno": anno, "mesi": out, "totale": tot,
            "fonte": "calcola_pl_gestionale (coerenza garantita col P&L)"}


_VOCI_BUDGET = ("ricavo", "costo_diretto", "costo_struttura", "altro")


def _favorevole(voce_tipo: str, scostamento):
    """Segno esplicito: sui RICAVI uno scostamento positivo e' buono, sui COSTI e' cattivo.
    None se non calcolabile o se lo scostamento e' esattamente zero (neutro)."""
    if scostamento is None or scostamento == 0:
        return None
    return scostamento > 0 if voce_tipo == "ricavo" else scostamento < 0


async def confronto_budget_actual(db: AsyncSession, versione_id, mese: int = None, ytd: bool = False):
    """Confronto Budget vs Actual per voce_tipo. `ytd=True` cumula da gennaio al mese richiesto."""
    from app.models.models import BudgetRiga
    v = await _versione_o_404(db, versione_id)
    anno = v.anno
    # Perimetro mesi
    if mese and ytd:
        mesi = list(range(1, mese + 1)); etichetta = f"YTD gen-{mese:02d}"
    elif mese:
        mesi = [mese]; etichetta = f"mese {mese:02d}"
    else:
        mesi = list(range(1, 13)); etichetta = "anno"
    # Budget aggregato per voce sul perimetro
    rows = (await db.execute(
        select(BudgetRiga.voce_tipo, func.coalesce(func.sum(BudgetRiga.importo), 0))
        .where(BudgetRiga.versione_id == versione_id, BudgetRiga.mese.in_(mesi))
        .group_by(BudgetRiga.voce_tipo)
    )).all()
    budget_map = {vt: Decimal(str(t)) for vt, t in rows}
    # Actual aggregato sullo stesso perimetro
    act = await calcola_actual(db, anno)
    act_map = {}
    for voce in _VOCI_BUDGET:
        vals = [r[voce] for r in act["mesi"] if r["mese"] in mesi]
        act_map[voce] = None if any(x is None for x in vals) else sum(vals)

    voci = []
    for voce in _VOCI_BUDGET:
        b = budget_map.get(voce)
        a = act_map.get(voce)
        sc = (Decimal(str(a)) - b) if (a is not None and b is not None) else None
        pct = float((sc / b * 100).quantize(Decimal("0.1"))) if (sc is not None and b and b != 0) else None
        voci.append({
            "voce_tipo": voce,
            "budget": float(b) if b is not None else None,
            "actual": float(a) if a is not None else None,
            "scostamento": float(sc) if sc is not None else None,
            "scostamento_pct": pct,
            "favorevole": _favorevole(voce, sc),
        })
    return {"versione_id": str(versione_id), "anno": anno, "tipo": v.tipo, "versione": v.versione,
            "perimetro": etichetta, "mesi": mesi, "voci": voci}


# ── PESI CONTENUTO (configurabile, driver quota Luca — brief §7.5) ──
async def list_pesi_contenuto(db: AsyncSession):
    from app.models.models import PesoContenuto
    rows = (await db.execute(select(PesoContenuto).order_by(PesoContenuto.tipo.asc()))).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


async def update_peso_contenuto(db: AsyncSession, tipo: str, peso):
    from app.models.models import PesoContenuto
    pc = (await db.execute(select(PesoContenuto).where(PesoContenuto.tipo == tipo))).scalar_one_or_none()
    if not pc:
        return None
    pc.peso = peso
    await db.commit()
    await db.refresh(pc)
    return {c.name: getattr(pc, c.name) for c in pc.__table__.columns}


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


async def applica_regole_automatiche(db: AsyncSession, user_id=None):
    import re as re_module
    from app.models.models import RegolaRiconciliazione, MovimentoCassa, Riconciliazione, FatturaPassiva

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
    riconciliati = 0
    # Tracciamento per audit APPLICA (chiude R7: log regole non piu' vuoto)
    regola_match: dict = {}   # regola.id -> {"nome", "match", "riconciliati"}
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
                except re_module.error:
                    pass
            if hit:
                if regola.categoria:
                    mov.categoria = regola.categoria
                stat = regola_match.setdefault(regola.id, {"nome": regola.nome, "match": 0, "riconciliati": 0})
                # Auto-riconciliazione: crea la RIGA riconciliazioni (fonte unica), non il solo FK.
                if regola.auto_riconcilia and regola.fattura_passiva_id:
                    fp_res = await db.execute(select(FatturaPassiva).where(FatturaPassiva.id == regola.fattura_passiva_id))
                    fp = fp_res.scalar_one_or_none()
                    if fp:
                        esistenti = await _sum_riconciliazioni_fattura(db, fp.id, False)
                        residuo = (fp.importo_totale or Decimal("0")) - esistenti
                        importo = min(abs(mov.importo or Decimal("0")), residuo)
                        if importo > 0:
                            db.add(Riconciliazione(
                                movimento_id=mov.id, fattura_passiva_id=fp.id, importo=importo,
                                data=mov.data_valuta, note=f"Auto-regola: {regola.nome}",
                            ))
                            await db.flush()
                            await _recompute_fattura(db, fp, False)
                            await _recompute_movimento(db, mov)
                            riconciliati += 1
                            stat["riconciliati"] += 1
                regola.contatore_match = (regola.contatore_match or 0) + 1
                stat["match"] += 1
                matched += 1
                break

    # Audit APPLICA per ogni regola che ha avuto almeno un match (R7)
    for rid, stat in regola_match.items():
        await write_audit(db, user_id, "regole_riconciliazione", rid, "APPLICA",
                          dopo={"nome": stat["nome"], "match": stat["match"], "riconciliati": stat["riconciliati"]})

    await db.commit()
    return {'movimenti_processati': len(movimenti), 'match_trovati': matched, 'riconciliati': riconciliati}


async def dry_run_regole_automatiche(db: AsyncSession):
    """Simula l'applicazione delle regole senza modificare il DB."""
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

    preview = []
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
                except re_module.error:
                    pass
            if hit:
                preview.append({
                    'movimento_id': str(mov.id),
                    'movimento_descrizione': mov.descrizione,
                    'movimento_importo': float(mov.importo or 0),
                    'movimento_data': str(mov.data_valuta) if mov.data_valuta else None,
                    'regola_id': str(regola.id),
                    'regola_nome': regola.nome,
                    'regola_pattern': regola.pattern,
                    'azione': 'RICONCILIA_AUTO' if regola.auto_riconcilia else 'CATEGORIZZA',
                    'categoria_prevista': regola.categoria,
                })
                break

    return {
        'movimenti_non_riconciliati': len(movimenti),
        'match_previsti': len(preview),
        'preview': preview,
    }


async def get_regola_application_log(db: AsyncSession, regola_id: uuid.UUID):
    """Recupera lo storico applicazioni di una regola dall'audit_log."""
    from app.models.models import AuditLog, User as UserModel
    res = await db.execute(
        select(AuditLog, UserModel.nome, UserModel.cognome)
        .outerjoin(UserModel, AuditLog.user_id == UserModel.id)
        .where(
            AuditLog.tabella == 'regole_riconciliazione',
            AuditLog.record_id == str(regola_id),
            AuditLog.azione == 'APPLICA'
        )
        .order_by(AuditLog.created_at.desc())
        .limit(50)
    )
    rows = res.all()
    return {
        'log': [
            {
                'id': str(row.AuditLog.id),
                'applicato_at': row.AuditLog.created_at.isoformat() if row.AuditLog.created_at else None,
                'applicato_da': f"{row.nome} {row.cognome}".strip() if row.nome else None,
                'dati': row.AuditLog.dati_dopo,
            }
            for row in rows
        ]
    }


async def suggest_riconciliazione(db: AsyncSession, movimento_id: uuid.UUID):
    import re as re_module
    from app.models.models import MovimentoCassa, FatturaPassiva, Fornitore, RegolaRiconciliazione

    res = await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))
    mov = res.scalar_one_or_none()
    if not mov:
        return {'regola': None, 'fatture_importo': []}

    desc = (mov.descrizione or '').lower()
    # Match/proposta sul RESIDUO del movimento (M2M/parziali): un bonifico gia' parzialmente
    # riconciliato propone solo la parte non ancora coperta.
    gia_riconciliato = await _sum_riconciliazioni_movimento(db, mov.id)
    mov_residuo = float(abs(mov.importo or Decimal("0")) - gia_riconciliato)
    importo = max(mov_residuo, 0.0)

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
            except re_module.error: pass
        if hit:
            regola_match = {c.name: getattr(r, c.name) for c in r.__table__.columns}
            break

    # Fatture passive con residuo aperto, matchate sul RESIDUO ~ residuo movimento (±5%).
    res_fp = await db.execute(
        select(FatturaPassiva, Fornitore)
        .outerjoin(Fornitore, FatturaPassiva.fornitore_id == Fornitore.id)
        .where(FatturaPassiva.importo_residuo > 0)
        .where(func.abs(FatturaPassiva.importo_residuo).between(importo * 0.95, importo * 1.05))
        .limit(5)
    )
    fatture_match = []
    for fp, forn in res_fp.all():
        residuo_fp = float(fp.importo_residuo or 0)
        fatture_match.append({
            'id': str(fp.id),
            'numero': fp.numero,
            'importo': float(fp.importo_totale or 0),
            'importo_residuo': residuo_fp,
            'importo_suggerito': round(min(mov_residuo, residuo_fp), 2),
            'fornitore': forn.ragione_sociale if forn else '—',
            'data_emissione': str(fp.data_emissione) if fp.data_emissione else None,
            'match_esatto': abs(residuo_fp - importo) < 0.01,
        })

    return {'regola': regola_match, 'movimento_residuo': round(mov_residuo, 2), 'fatture_importo': fatture_match}


# ── IMPUTAZIONI FATTURE PASSIVE ───────────────────────────
def _coerce_uuid(value) -> Optional[uuid.UUID]:
    """Accetta str o uuid.UUID (o None). Robusto: il payload Pydantic puo' gia' fornire UUID."""
    if not value:
        return None
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


async def _commesse_impattate_da_fattura(db: AsyncSession, fattura_passiva_id: uuid.UUID) -> set[uuid.UUID]:
    """Commesse impattate dalle imputazioni di una fattura passiva.

    Legame di competenza (R3): cliente effettivo = COALESCE(imputazione.cliente_id,
    progetto.cliente_id); mese = mese di emissione della fattura passiva.
    """
    rows = await db.execute(
        text(
            """
            SELECT DISTINCT c.id
            FROM fatture_passive_imputazioni i
            JOIN fatture_passive fp ON fp.id = i.fattura_passiva_id
            LEFT JOIN progetti p ON p.id = i.progetto_id
            JOIN commesse c
              ON c.cliente_id = COALESCE(i.cliente_id, p.cliente_id)
             AND c.mese_competenza = date_trunc('month', fp.data_emissione)::date
            WHERE i.fattura_passiva_id = :fid
            """
        ),
        {"fid": str(fattura_passiva_id)},
    )
    return {r[0] for r in rows.all()}


async def ricalcola_costi_diretti_imputati(db: AsyncSession, commessa_ids: set[uuid.UUID]) -> None:
    """Ricalcola e PERSISTE costi_diretti_imputati per le commesse date (R3).

    Pattern snapshot: somma da zero TUTTE le imputazioni di fatture passive che
    competono a ciascuna commessa (cliente effettivo + mese di emissione). Non
    tocca costi_diretti (input manuale). Non esegue commit: lo gestisce il chiamante.
    """
    if not commessa_ids:
        return
    await db.execute(
        text(
            """
            UPDATE commesse c SET costi_diretti_imputati = COALESCE((
                SELECT SUM(i.importo)
                FROM fatture_passive_imputazioni i
                JOIN fatture_passive fp ON fp.id = i.fattura_passiva_id
                LEFT JOIN progetti p ON p.id = i.progetto_id
                WHERE COALESCE(i.cliente_id, p.cliente_id) = c.cliente_id
                  AND date_trunc('month', fp.data_emissione)::date = c.mese_competenza
            ), 0)
            WHERE c.id = ANY(:ids)
            """
        ),
        {"ids": [str(cid) for cid in commessa_ids]},
    )


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

    # R3: commesse impattate dalle imputazioni correnti (prima della modifica)
    impatto = await _commesse_impattate_da_fattura(db, fattura_passiva_id)

    # Elimina imputazioni esistenti e ricrea
    await db.execute(delete(FatturaPassivaImputazione).where(FatturaPassivaImputazione.fattura_passiva_id == fattura_passiva_id))

    totale = float(fp.importo_totale or 0)
    for imp in imputazioni:
        perc = float(imp.get('percentuale', 0))
        importo_imp = round(totale * perc / 100, 2)
        obj = FatturaPassivaImputazione(
            fattura_passiva_id=fattura_passiva_id,
            cliente_id=_coerce_uuid(imp.get('cliente_id')),
            progetto_id=_coerce_uuid(imp.get('progetto_id')),
            tipo=imp.get('tipo', 'PROGETTO'),
            percentuale=perc,
            importo=importo_imp,
            note=imp.get('note'),
        )
        db.add(obj)

    # R3: aggiunge le commesse impattate dalle NUOVE imputazioni e ricalcola l'unione
    await db.flush()
    impatto |= await _commesse_impattate_da_fattura(db, fattura_passiva_id)
    await ricalcola_costi_diretti_imputati(db, impatto)

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
def _ore_vendibili_annue(ore_sett: float, ferie_giorni: float, malattia_giorni: float) -> float:
    """Ore produttive/vendibili annue di una risorsa: anno lavorativo al netto di
    festivi (88h), ferie e malattia, con saturazione 70%. Sorgente unica condivisa
    da calcola_costo_orario (costo diretto) e calcola_tasso_overhead (allocazione struttura)."""
    return (ore_sett * 52 - 88 - ferie_giorni * 8 - malattia_giorni * 8) * 0.70


def calcola_costo_orario(r) -> float:
    """Calcola il COSTO DIRETTO per ora produttiva dalla struttura contrattuale.

    Formula: Costo annuo diretto / Ore vendibili anno (NESSUN overhead di struttura).
    L'overhead e' allocato separatamente nel pricing floor via calcola_tasso_overhead
    (brief 3.3), per non contarlo due volte: i costi fissi di struttura sono gia'
    sottratti UNA sola volta nel P&L gestionale.
    Ore vendibili = (ore_sett * 52 - festivi 88h - ferie - malattia) * 70% saturazione
    Dipendenti CCNL Commercio: contributi + TFR su RAL
    Fondatori: compenso_fisso_mensile * 12, nessun contributo
    Freelancer: compenso_fisso_mensile / ore_mese (tariffa gia' fully-loaded)
    """
    tipo = r.get('tipo_contratto', '')
    ore_sett = float(r.get('ore_settimanali', 40))
    ferie_giorni = float(r.get('giorni_ferie', 26))
    malattia_giorni = float(r.get('giorni_malattia', 3))

    if tipo in ('FONDATORE',):
        compenso_mensile = float(r.get('compenso_fisso_mensile') or 0)
        if compenso_mensile == 0:
            return 0.0
        costo_anno = compenso_mensile * 12
        ore_vendibili = _ore_vendibili_annue(ore_sett, ferie_giorni, malattia_giorni)
        if ore_vendibili <= 0:
            return 0.0
        return round(costo_anno / ore_vendibili, 2)

    if tipo in ('FREELANCER', 'PRESTAZIONE_OCCASIONALE'):
        compenso_mensile = float(r.get('compenso_fisso_mensile') or 0)
        if compenso_mensile == 0:
            return 0.0
        ore_mese = ore_sett * 4.33
        if ore_mese <= 0:
            return 0.0
        return round(compenso_mensile / ore_mese, 2)

    # Dipendenti: APPRENDISTATO, TEMPO_DETERMINATO, DIPENDENTE
    ral = float(r.get('ral') or 0)
    if ral == 0:
        return 0.0
    contributi = float(r.get('contributi_percentuale', 30)) / 100
    tfr = float(r.get('tfr_percentuale', 6.91)) / 100
    costo_anno = ral * (1 + contributi + tfr)
    ore_vendibili = _ore_vendibili_annue(ore_sett, ferie_giorni, malattia_giorni)
    if ore_vendibili <= 0:
        return 0.0
    return round(costo_anno / ore_vendibili, 2)


# NOTE (D-02): list_risorse/create_risorsa/update_risorsa rimossi: erano usati solo dalle rotte
# inline /risorse shadowed (D-01). Le risorse sono servite da risorse.py. calcola_costo_orario (sopra)
# resta disponibile per il costing (E-02, da cablare nella create/update live in un task separato).


async def get_progetto_with_servizi(db: AsyncSession, progetto_id):
    result = await db.execute(
        select(Progetto).options(
            selectinload(Progetto.cliente),
            selectinload(Progetto.servizi),
            selectinload(Progetto.team).selectinload(ProgettoTeam.user),
        ).where(Progetto.id == progetto_id)
    )
    return result.unique().scalar_one_or_none()

# ── SERVIZI PROGETTO ──────────────────────────────────────
async def get_servizi_progetto(db: AsyncSession, progetto_id: uuid.UUID):
    result = await db.execute(
        select(ServizioProgetto).where(ServizioProgetto.progetto_id == progetto_id).order_by(ServizioProgetto.created_at)
    )
    return result.scalars().all()

async def create_servizio_progetto(db: AsyncSession, progetto_id: uuid.UUID, data):
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


# ── TIMER SYSTEM ──────────────────────────────────────────
async def start_timer(db: AsyncSession, task_id: uuid.UUID, user_id: uuid.UUID) -> TimerSession:
    # 1. Stop any active timer for this user
    result = await db.execute(
        select(TimerSession)
        .where(TimerSession.user_id == user_id)
        .where(TimerSession.stopped_at == None)
    )
    active_session = result.scalar_one_or_none()
    if active_session:
        await stop_timer(db, active_session.id)
    
    # 2. Create new session
    new_session = TimerSession(
        task_id=task_id,
        user_id=user_id,
        started_at=datetime.now(timezone.utc),
        salvato_timesheet=False
    )
    db.add(new_session)
    await db.commit()
    
    # Reload with task for the response model
    result = await db.execute(
        select(TimerSession)
        .options(selectinload(TimerSession.task))
        .where(TimerSession.id == new_session.id)
    )
    return result.scalar_one()

async def stop_timer(db: AsyncSession, session_id: uuid.UUID, note: Optional[str] = None) -> Optional[TimerSession]:
    result = await db.execute(select(TimerSession).where(TimerSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.stopped_at:
        return session
    
    session.stopped_at = datetime.now(timezone.utc)
    if note:
        session.note = note
    
    # Calculate duration in minutes (rounded up)
    delta = session.stopped_at - session.started_at
    session.durata_minuti = max(1, int(delta.total_seconds() / 60))
    
    await db.commit()
    
    # Reload with task for the response model
    result = await db.execute(
        select(TimerSession)
        .options(selectinload(TimerSession.task))
        .where(TimerSession.id == session.id)
    )
    return result.scalar_one()

async def get_active_timer(db: AsyncSession, user_id: uuid.UUID) -> Optional[dict]:
    result = await db.execute(
        select(TimerSession, Task.titolo)
        .outerjoin(Task, TimerSession.task_id == Task.id)
        .where(TimerSession.user_id == user_id)
        .where(TimerSession.stopped_at == None)
        .order_by(TimerSession.started_at.desc())
    )
    row = result.fetchone()
    if not row:
        return None
    
    session, task_title = row
    # Create a dict that matches TimerSessionOut + task_title
    d = {c.name: getattr(session, c.name) for c in session.__table__.columns}
    d['task_title'] = task_title
    return d

async def get_all_active_timers(db: AsyncSession) -> List[dict]:
    result = await db.execute(
        select(TimerSession, Task.titolo, User.nome, User.cognome)
        .join(User, TimerSession.user_id == User.id)
        .outerjoin(Task, TimerSession.task_id == Task.id)
        .where(TimerSession.stopped_at == None)
        .order_by(TimerSession.started_at.desc())
    )
    rows = result.all()
    timers = []
    for row in rows:
        session, task_title, nome, cognome = row
        d = {c.name: getattr(session, c.name) for c in session.__table__.columns}
        d['task_title'] = task_title
        d['user_name'] = f"{nome} {cognome}"
        timers.append(d)
    return timers

async def list_timer_sessions(db: AsyncSession, task_id: uuid.UUID) -> List[TimerSession]:
    result = await db.execute(
        select(TimerSession)
        .options(selectinload(TimerSession.task))
        .where(TimerSession.task_id == task_id)
        .order_by(TimerSession.started_at.desc())
    )
    return result.scalars().all()

async def save_timer_to_timesheet(
    db: AsyncSession, 
    session_ids: List[uuid.UUID], 
    user: User,
    commessa_id: Optional[uuid.UUID] = None,
    note: Optional[str] = None
) -> List[Timesheet]:
    result = await db.execute(
        select(TimerSession)
        .options(selectinload(TimerSession.task))
        .where(TimerSession.id.in_(session_ids))
        .where(TimerSession.user_id == user.id)
        .where(TimerSession.stopped_at != None)
        .where(TimerSession.salvato_timesheet == False)
    )
    sessions = result.scalars().all()
    if not sessions:
        return []
    
    # Group by task_id and date
    groups = {}
    for s in sessions:
        key = (s.task_id, s.started_at.date())
        if key not in groups:
            groups[key] = {"durata": 0, "sessions": []}
        groups[key]["durata"] += s.durata_minuti or 0
        groups[key]["sessions"].append(s)
    
    created_timesheets = []
    for (task_id, data_attivita), info in groups.items():
        # Create timesheet entry
        ts = Timesheet(
            user_id=user.id,
            task_id=task_id,
            commessa_id=commessa_id,
            data_attivita=data_attivita,
            mese_competenza=data_attivita.replace(day=1),
            durata_minuti=info["durata"],
            note=note or "; ".join([s.note for s in info["sessions"] if s.note]),
            stato=TimesheetStatus.PENDING
        )
        db.add(ts)
        # Mark sessions as saved
        for s in info["sessions"]:
            s.salvato_timesheet = True
        
        created_timesheets.append(ts)
    
    await db.commit()
    for ts in created_timesheets:
        await db.refresh(ts)
    return created_timesheets

# ── PREVENTIVO SERVICE ────────────────────────────────────
async def list_preventivi(
    db: AsyncSession,
    cliente_id: Optional[uuid.UUID] = None,
    stato: Optional[PreventivoStatus] = None
) -> List[Preventivo]:
    q = select(Preventivo).options(selectinload(Preventivo.cliente), selectinload(Preventivo.voci))
    if cliente_id:
        q = q.where(Preventivo.cliente_id == cliente_id)
    if stato:
        q = q.where(Preventivo.stato == stato)
    result = await db.execute(q.order_by(Preventivo.created_at.desc()))
    return result.unique().scalars().all()

async def get_preventivo(db: AsyncSession, preventivo_id: uuid.UUID) -> Optional[Preventivo]:
    result = await db.execute(
        select(Preventivo).options(selectinload(Preventivo.cliente), selectinload(Preventivo.voci))
        .where(Preventivo.id == preventivo_id)
    )
    return result.scalar_one_or_none()

async def create_preventivo(db: AsyncSession, data: PreventivoCreate, user_id: uuid.UUID) -> Preventivo:
    importo_totale = sum(v.quantita * v.prezzo_unitario for v in data.voci)
    
    p = Preventivo(
        id=uuid.uuid4(),
        cliente_id=data.cliente_id,
        numero=data.numero,
        titolo=data.titolo,
        descrizione=data.descrizione,
        data_scadenza=data.data_scadenza,
        note=data.note,
        importo_totale=importo_totale,
        created_by=user_id,
        stato=PreventivoStatus.BOZZA,
        # §18.1 modalita prezzo
        modalita_prezzo=data.modalita_prezzo,
        markup_su=data.markup_su or "costo_pieno",
        prezzo=data.prezzo,
        margine_pct=data.margine_pct,
        markup_pct=data.markup_pct,
        margine_target=data.margine_target,
        valido_fino=data.valido_fino,
    )
    db.add(p)
    await db.flush()

    voci = []
    for v in data.voci:
        riga = PreventivoVoce(
            id=uuid.uuid4(),
            preventivo_id=p.id,
            descrizione=v.descrizione,
            quantita=v.quantita,
            prezzo_unitario=v.prezzo_unitario,
            totale=v.quantita * v.prezzo_unitario,
            ordine=v.ordine,
            # §18.2 natura riga
            tipo=v.tipo, servizio_id=v.servizio_id, risorsa_id=v.risorsa_id, ruolo=v.ruolo,
            ore=v.ore, tariffa=v.tariffa, costo=v.costo, ricarico_pct=v.ricarico_pct,
            is_stima=(v.tipo == "socio"),
        )
        voci.append(riga)
    db.add_all(voci)
    await db.flush()
    return await get_preventivo(db, p.id)

async def update_preventivo(db: AsyncSession, preventivo_id: uuid.UUID, data: PreventivoUpdate, user_id: uuid.UUID) -> Optional[Preventivo]:
    p = await get_preventivo(db, preventivo_id)
    if not p:
        return None
    
    payload = data.model_dump(exclude_none=True)
    voci_data = payload.pop("voci", None)
    
    for field, val in payload.items():
        setattr(p, field, val)
    
    if voci_data is not None:
        # Semplice: rimuovi vecchie e aggiungi nuove
        await db.execute(text("DELETE FROM preventivo_voci WHERE preventivo_id = :pid"), {"pid": str(preventivo_id)})
        voci = []
        importo_totale = Decimal("0")
        for v in voci_data:
            tot = Decimal(str(v["quantita"])) * Decimal(str(v["prezzo_unitario"]))
            riga = PreventivoVoce(
                id=uuid.uuid4(),
                preventivo_id=p.id,
                descrizione=v["descrizione"],
                quantita=v["quantita"],
                prezzo_unitario=v["prezzo_unitario"],
                totale=tot,
                ordine=v.get("ordine", 0)
            )
            voci.append(riga)
            importo_totale += tot
        db.add_all(voci)
        p.importo_totale = importo_totale

    await db.flush()
    return await get_preventivo(db, p.id)

async def delete_preventivo(db: AsyncSession, preventivo_id: uuid.UUID) -> bool:
    p = await get_preventivo(db, preventivo_id)
    if not p:
        return False
    await db.delete(p)
    await db.flush()
    return True

async def converti_preventivo_in_commessa(db: AsyncSession, preventivo_id: uuid.UUID, current_user: User) -> Commessa:
    from fastapi import HTTPException
    p = await get_preventivo(db, preventivo_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")

    # §18.8: accordo_economico = prezzo del preventivo (fallback importo_totale); le righe lavoro
    # diventano budget-ore pianificato della commessa (per il confronto ex-post con la marginalita reale).
    from app.models.models import PreventivoVoce
    accordo = p.prezzo if p.prezzo is not None else p.importo_totale
    voci_p = (await db.execute(select(PreventivoVoce).where(PreventivoVoce.preventivo_id == p.id))).scalars().all()
    budget_ore = sum((Decimal(str(v.ore or 0)) for v in voci_p if (v.tipo or "") == "lavoro"), Decimal("0"))

    # 1. Trova o Crea Progetto
    proj_res = await db.execute(select(Progetto).where(Progetto.cliente_id == p.cliente_id, Progetto.nome == p.titolo))
    progetto = proj_res.scalar_one_or_none()

    if not progetto:
        progetto = Progetto(
            id=uuid.uuid4(),
            cliente_id=p.cliente_id,
            nome=p.titolo,
            tipo=ProjectType.ONE_OFF,
            importo_fisso=accordo,
            note=f"Creato da preventivo {p.numero}"
        )
        db.add(progetto)
        await db.flush()
    
    # 2. Crea Commessa per il mese corrente
    today = date.today().replace(day=1)
    
    comm_res = await db.execute(select(Commessa).where(Commessa.cliente_id == p.cliente_id, Commessa.mese_competenza == today))
    commessa = comm_res.scalar_one_or_none()
    
    if not commessa:
        commessa = Commessa(
            id=uuid.uuid4(),
            cliente_id=p.cliente_id,
            mese_competenza=today,
            stato=CommessaStatus.APERTA,
            ore_contratto=budget_ore,  # §18.8: budget-ore pianificato dalle righe lavoro
            note=f"Aperta da preventivo {p.numero}",
        )
        db.add(commessa)
        await db.flush()
    
    # 3. Aggiungi riga progetto alla commessa
    link_res = await db.execute(select(CommessaProgetto).where(CommessaProgetto.commessa_id == commessa.id, CommessaProgetto.progetto_id == progetto.id))
    link = link_res.scalar_one_or_none()
    
    if not link:
        link = CommessaProgetto(
            id=uuid.uuid4(),
            commessa_id=commessa.id,
            progetto_id=progetto.id,
            importo_fisso=progetto.importo_fisso,
            delivery_attesa=0,
            delivery_consuntiva=0
        )
        db.add(link)
    
    # 4. Aggiorna stato preventivo
    p.stato = PreventivoStatus.ACCETTATO
    p.data_accettazione = date.today()
    
    await db.flush()
    return await get_commessa(db, commessa.id)


async def get_costi_dettaglio_commessa(db: AsyncSession, commessa_id: uuid.UUID):
    """Breakdown costi diretti: manuali + da fatture passive + da movimenti cassa."""
    from app.models.models import (
        Commessa, FatturaPassivaImputazione, MovimentoCassaImputazione,
        FatturaPassiva, MovimentoCassa, Cliente, Progetto
    )

    res = await db.execute(select(Commessa).where(Commessa.id == commessa_id))
    commessa = res.scalar_one_or_none()
    if not commessa:
        return None

    # Imputazioni da fatture passive (cerca commessa via progetto)
    res_fp = await db.execute(
        select(FatturaPassivaImputazione, FatturaPassiva.numero, FatturaPassiva.data_emissione)
        .join(FatturaPassiva, FatturaPassivaImputazione.fattura_passiva_id == FatturaPassiva.id)
        .where(FatturaPassivaImputazione.commessa_id == commessa_id)
    )
    imp_fatture = []
    for row in res_fp.all():
        imp = {c.name: getattr(row.FatturaPassivaImputazione, c.name)
               for c in row.FatturaPassivaImputazione.__table__.columns}
        imp['fonte'] = 'fattura_passiva'
        imp['fonte_numero'] = row.numero
        imp['fonte_data'] = str(row.data_emissione) if row.data_emissione else None
        imp_fatture.append(imp)

    # Imputazioni da movimenti cassa
    res_mc = await db.execute(
        select(MovimentoCassaImputazione, MovimentoCassa.descrizione, MovimentoCassa.data_valuta)
        .join(MovimentoCassa, MovimentoCassaImputazione.movimento_id == MovimentoCassa.id)
        .where(MovimentoCassaImputazione.commessa_id == commessa_id)
    )
    imp_movimenti = []
    for row in res_mc.all():
        imp = {c.name: getattr(row.MovimentoCassaImputazione, c.name)
               for c in row.MovimentoCassaImputazione.__table__.columns}
        imp['fonte'] = 'movimento_cassa'
        imp['fonte_descrizione'] = row.descrizione
        imp['fonte_data'] = str(row.data_valuta) if row.data_valuta else None
        imp_movimenti.append(imp)

    totale_fatture = sum(float(i.get('importo') or 0) for i in imp_fatture)
    totale_movimenti = sum(float(i.get('importo') or 0) for i in imp_movimenti)
    costi_manuali = float(commessa.costi_diretti or 0) - totale_fatture - totale_movimenti

    return {
        'commessa_id': str(commessa_id),
        'costi_diretti_totale': float(commessa.costi_diretti or 0),
        'breakdown': {
            'manuali': round(max(costi_manuali, 0), 2),
            'da_fatture_passive': round(totale_fatture, 2),
            'da_movimenti_cassa': round(totale_movimenti, 2),
        },
        'imputazioni_fatture': imp_fatture,
        'imputazioni_movimenti': imp_movimenti,
    }
