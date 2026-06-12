import logging
import uuid
from collections import defaultdict
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Optional, List
import time

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, Query, Body, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func, and_, or_

from app.db.session import get_db
from app.core.config import settings
from app.core.content_pipeline_rules import (
    can_assign_content_to_user,
    can_change_content_scope,
    can_link_new_content_to_scope,
    is_content_manager_role,
    is_limited_content_role,
    template_matches_commessa,
)
from app.core.security import (
    get_current_user,
    require_finance_access,
    require_roles,
    require_admin,
    require_erp_access,
    has_erp_access,
)
from app.models.models import (
    User, UserRole, ProjectStatus, ProjectType, 
    CommessaStatus, TaskStatus, PreventivoStatus,
    TimesheetStatus, ServiceType, ServiceCadenza,
    CostoTipo, MovimentoStatus,
    CRMStage, CRMLead, CRMActivity, Cliente
)
from app.schemas.schemas import (
    UserOut, UserCreate, UserUpdate,
    TimesheetCreate, TimesheetOut, TimesheetApprova,
    FornitoreOut, FornitoreCreate, FornitoreUpdate,
    FatturaAttivaOut, FatturaAttivaUpdate, FatturaPassivaOut, FatturaPassivaUpdate, FatturaIncassaRequest,
    FicSyncStatusOut, TaskCreate, TaskUpdate, TaskOut,
    CategoriaFornitoreCreate, CategoriaFornitoreOut, CategoriaFornitoreUpdate,
    PreventivoCreate, PreventivoUpdate, PreventivoOut,
    BudgetCategoryCreate, BudgetCategoryOut, BudgetMensileCreate, BudgetMensileUpdate, BudgetMensileOut, BudgetConsuntivoOut,
    BudgetVarianceOut, BudgetTrendOut, BudgetTrendPointOut, BudgetTrendSeriesOut,
    WikiCategoriaCreate, WikiCategoriaOut, WikiArticoloCreate, WikiArticoloUpdate, WikiArticoloOut,
    ChatReazioneBase, ChatReazioneRead, ChatMessaggioCreate, ChatMessaggioUpdate, ChatMessaggioRead,
    CRMStageOut, CRMStageCreate, CRMStageUpdate, CRMLeadCreate, CRMLeadUpdate, CRMLeadOut, CRMActivityCreate, CRMActivityOut, CRMStatsOut,
    ProgettoTemplateOut,
    CostoFissoCreate, CostoFissoUpdate,
    CostoVariabileCreate, CostoVariabileUpdate,
    RegolaRiconciliazioneCreate, RegolaRiconciliazioneUpdate,
    MovimentoCassaUpdate, RiconciliaRequest, RiconciliazioniCreate,
    ImputazioniRequest,
    PianoCreate, PianoUpdate, CollegaCommessaRequest,
    SaldoCassaCreate,
)
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest
import httpx
from app.services.services import (
    list_tasks, get_task, create_task, update_task, delete_task,
    list_timesheet, create_timesheet, approva_timesheet,
    get_dashboard_kpi, get_marginalita_clienti, calcola_dso,
    calcola_dashboard_liquidita, calcola_kpi_clienti,
    calcola_proiezione_cassa, get_ultimo_saldo, create_saldo, calcola_pl_gestionale,
    calcola_scadenzario_fiscale,
    sync_fic_data, get_last_fic_sync_status, list_fatture_attive, incassa_fattura,
    list_fornitori_full, update_fornitore, list_fatture_passive, update_fattura_passiva, list_fornitori,
    list_movimenti_cassa, list_costi_fissi, create_costo_fisso, update_costo_fisso, delete_costo_fisso,
    list_costi_variabili, create_costo_variabile, update_costo_variabile, delete_costo_variabile,
    riconcilia_movimento as svc_riconcilia_movimento, elimina_riconciliazione,
    rimuovi_riconciliazioni_movimento, list_riconciliazioni_movimento, list_riconciliazioni_fattura,
    _sum_riconciliazioni_fattura, _load_fattura,
    elimina_timesheet_bulk, aggiorna_mese_competenza_bulk,
    list_preventivi, get_preventivo, create_preventivo, update_preventivo, delete_preventivo, converti_preventivo_in_commessa
)
from app.api.v1 import timer
from app.api.v1 import ai
from app.api.v1 import auth
from app.api.v1 import clienti
from app.api.v1 import progetti
from app.api.v1 import commesse
from app.api.v1 import preventivi
from app.api.v1 import users
from app.api.v1 import fornitori
from app.api.v1 import timesheet
from app.api.v1 import fic
from app.api.v1 import planning
from app.api.v1 import pianificazioni
from app.api.v1 import notifications
from app.api.v1 import assenze
from app.api.v1 import risorse_servizi
from app.api.v1 import risorse
from app.api.v1 import pricing_floor
from app.api.v1 import studio
from app.api.v1 import chat
from app.api.v1 import uploads
from app.api.v1 import documents

# ── Simple in-memory rate limiter (no external deps) ─────────────────────────
_login_attempts: dict[str, list[float]] = defaultdict(list)
_LOGIN_MAX = 10          # max attempts
_LOGIN_WINDOW = 60.0     # seconds

def _check_login_rate(ip: str) -> None:
    now = time.time()
    attempts = _login_attempts[ip]
    # Drop old attempts outside the window
    _login_attempts[ip] = [t for t in attempts if now - t < _LOGIN_WINDOW]
    if len(_login_attempts[ip]) >= _LOGIN_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Troppi tentativi. Riprova tra {_LOGIN_WINDOW:.0f} secondi.",
            headers={"Retry-After": str(int(_LOGIN_WINDOW))},
        )
    _login_attempts[ip].append(now)



# ─────────────────────────────────────────────────────────────────────────────

router = APIRouter()
router.include_router(auth.router)
router.include_router(clienti.router)
router.include_router(progetti.router)
router.include_router(commesse.router)
router.include_router(preventivi.router)
router.include_router(users.router)
router.include_router(fornitori.router)
router.include_router(timesheet.router)
router.include_router(fic.router)
router.include_router(timer.router)
router.include_router(ai.router)
router.include_router(planning.router)
router.include_router(pianificazioni.router)
router.include_router(risorse.router)
router.include_router(pricing_floor.router)
router.include_router(risorse_servizi.router)
router.include_router(studio.router)
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
router.include_router(uploads.router, prefix="/uploads", tags=["Uploads"])
router.include_router(notifications.router, prefix="/notifications", tags=["Notifiche"])
router.include_router(assenze.router, prefix="/assenze", tags=["Assenze"])
router.include_router(documents.router, prefix="/documents", tags=["Documents"])


# ═══════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════
# PREVENTIVI
# ═══════════════════════════════════════════════════════

@router.post("/__legacy_disabled__/auth/forgot-password", tags=["Auth"], include_in_schema=False)
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=410, detail="Endpoint legacy disattivato")


@router.post("/__legacy_disabled__/auth/reset-password", tags=["Auth"], include_in_schema=False)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=410, detail="Endpoint legacy disattivato")


# ═══════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════
# CATEGORIE FORNITORI
# ═══════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════
# TIMESHEET
# ═══════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════
# REPORT / DASHBOARD
# ═══════════════════════════════════════════════════════
@router.get("/dashboard/kpi", tags=["Report"])
async def dashboard_kpi(
    response: Response,
    mese: date = Query(..., description="Formato YYYY-MM-01"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    response.headers["Cache-Control"] = "private, max-age=120"
    return await get_dashboard_kpi(db, mese)

@router.get("/dashboard/liquidita", tags=["Report"])
async def dashboard_liquidita(
    response: Response,
    soglia_uscita: float = Query(500, ge=0, description="Soglia €: uscite oltre questa sono 'significative'"),
    orizzonte_giorni: int = Query(90, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    """Dashboard liquidità (brief §5.1): prossima uscita significativa + fatture scadute per cliente.
    Derivato dagli helper esistenti; non ricalcola margine/proiezione."""
    response.headers["Cache-Control"] = "private, max-age=120"
    from decimal import Decimal
    return await calcola_dashboard_liquidita(db, Decimal(str(soglia_uscita)), orizzonte_giorni)


@router.get("/dashboard/kpi-clienti", tags=["Report"])
async def dashboard_kpi_clienti(
    response: Response,
    mese: Optional[date] = Query(None, description="Mese YYYY-MM-01 (default: mese corrente)"),
    soglia_margine_pct: float = Query(20, ge=0, le=100, description="Soglia % margine basso"),
    soglia_alert_clienti: int = Query(2, ge=0, description="Alert se i clienti sotto soglia superano questo numero"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    """KPI concentrazione clienti (brief §5.3): clienti a margine basso (+alert) e ricavo medio/cliente
    con trend mese-su-mese. Consuma get_marginalita_clienti (nessuna formula nuova)."""
    response.headers["Cache-Control"] = "private, max-age=120"
    from decimal import Decimal
    return await calcola_kpi_clienti(db, mese or date.today(), Decimal(str(soglia_margine_pct)), soglia_alert_clienti)

@router.get("/analytics/forecast", tags=["Analytics"])
async def get_analytics_forecast(
    mesi: int = Query(3, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    """Forecast ricavi prossimi N mesi: commesse certe + CRM pipeline + storico."""
    from app.models.models import Commessa, CommessaStatus, CRMLead
    from sqlalchemy.orm import selectinload as sil
    from dateutil.relativedelta import relativedelta

    today = date.today()
    base_month = date(today.year, today.month, 1)

    # Genera mesi futuri
    forecast_months = [base_month + relativedelta(months=i) for i in range(1, mesi + 1)]

    # ── 1. Commesse future (ricavo certo) ─────────────────
    future_result = await db.execute(
        select(Commessa)
        .options(sil(Commessa.righe_progetto), sil(Commessa.cliente))
        .where(
            Commessa.mese_competenza.in_(forecast_months),
            Commessa.stato.in_([CommessaStatus.APERTA, CommessaStatus.PRONTA_CHIUSURA])
        )
    )
    future_commesse = future_result.scalars().unique().all()
    commesse_by_month: dict[date, list] = {m: [] for m in forecast_months}
    for c in future_commesse:
        if c.mese_competenza in commesse_by_month:
            commesse_by_month[c.mese_competenza].append(c)

    # ── 2. Storico (media ultimi 24 mesi per stesso mese calendario) ──
    cutoff = base_month - relativedelta(months=24)
    hist_result = await db.execute(
        select(Commessa)
        .options(sil(Commessa.righe_progetto))
        .where(Commessa.mese_competenza >= cutoff, Commessa.mese_competenza < base_month)
    )
    hist_by_month_num: dict[int, list[float]] = {}
    for c in hist_result.scalars().unique().all():
        val = float(c.valore_fatturabile_calc)
        if val > 0:
            hist_by_month_num.setdefault(c.mese_competenza.month, []).append(val)
    storico_avg = {mn: sum(vals) / len(vals) for mn, vals in hist_by_month_num.items()}

    # ── 3. CRM Pipeline ────────────────────────────────────
    leads_result = await db.execute(
        select(CRMLead)
        .options(sil(CRMLead.stadio))
        .where(CRMLead.valore_stimato > 0)
    )
    crm_by_month: dict[date, list[dict]] = {m: [] for m in forecast_months}
    for lead in leads_result.scalars().all():
        prob = lead.probabilita_chiusura
        if prob == 0 and lead.stadio:
            prob = lead.stadio.probabilita
        if prob <= 0 or prob >= 100:
            continue
        # Assegna al mese basandosi su data_prossimo_followup, altrimenti al più vicino
        target = forecast_months[0]
        if lead.data_prossimo_followup:
            fm = date(lead.data_prossimo_followup.year, lead.data_prossimo_followup.month, 1)
            if fm in crm_by_month:
                target = fm
        crm_by_month[target].append({
            "id": str(lead.id),
            "nome": lead.nome_azienda,
            "valore": float(lead.valore_stimato),
            "probabilita": prob,
            "valore_pesato": round(float(lead.valore_stimato) * prob / 100, 2),
        })

    # ── Costruisci risposta ────────────────────────────────
    months_out = []
    for m in forecast_months:
        commesse = commesse_by_month[m]
        ricavo_certo = sum(float(c.valore_fatturabile_calc) for c in commesse)
        crm_leads = crm_by_month[m]
        ricavo_pipeline = sum(l["valore_pesato"] for l in crm_leads)
        storico = storico_avg.get(m.month, 0.0)
        months_out.append({
            "mese": m.strftime("%Y-%m-%d"),
            "ricavo_certo": round(ricavo_certo, 2),
            "ricavo_pipeline_crm": round(ricavo_pipeline, 2),
            "ricavo_totale": round(ricavo_certo + ricavo_pipeline, 2),
            "ricavo_storico": round(storico, 2),
            "num_commesse": len(commesse),
            "num_lead_crm": len(crm_leads),
            "top_lead": sorted(crm_leads, key=lambda x: x["valore_pesato"], reverse=True)[:3],
            "commesse_detail": [
                {"id": str(c.id), "cliente": c.cliente.ragione_sociale if c.cliente else "?",
                 "valore": float(c.valore_fatturabile_calc), "stato": c.stato}
                for c in commesse
            ],
        })

    total_certo = sum(r["ricavo_certo"] for r in months_out)
    total_pipeline = sum(r["ricavo_pipeline_crm"] for r in months_out)
    return {
        "mesi": months_out,
        "kpi": {
            "ricavi_certi": round(total_certo, 2),
            "pipeline_crm": round(total_pipeline, 2),
            "totale_previsto": round(total_certo + total_pipeline, 2),
        },
    }


@router.get("/report/marginalita", tags=["Report"])
async def report_marginalita(
    response: Response,
    mese: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    response.headers["Cache-Control"] = "private, max-age=120"
    return await get_marginalita_clienti(db, mese)


@router.get("/report/dso", tags=["Report"])
async def report_dso(
    mesi: int = Query(12, ge=1, le=60, description="Finestra concentrazione in mesi (default 12)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    """DSO engine (Fase 2): storico incassi per cliente, scenari incasso sulle fatture aperte,
    rischio concentrazione ricavo. Solo lettura."""
    return await calcola_dso(db, mesi)


@router.get("/report/pl-gestionale", tags=["Report"])
async def report_pl_gestionale(
    mese: Optional[date] = Query(None, description="Mese di competenza YYYY-MM-01 (default: mese corrente)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    """P&L gestionale mensile (Fase 3 core, fiscale escluso): ricavi, costi diretti, margine lordo
    aggregato, costi fissi indivisibili, risultato operativo + IVA memo. Solo lettura."""
    return await calcola_pl_gestionale(db, mese or date.today())


@router.get("/report/scadenzario-fiscale", tags=["Report"])
async def report_scadenzario_fiscale(
    mesi: int = Query(6, ge=0, le=24, description="Orizzonte in mesi (default 6)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    """Scadenzario fiscale (Fase 3): IVA trimestrale calcolata dalle fatture + calendario scadenze
    ricorrenti. Importi non disponibili in DB (F24/ritenute/IRPEF) = null + flag. Solo lettura."""
    from dateutil.relativedelta import relativedelta
    oggi = date.today()
    return await calcola_scadenzario_fiscale(db, oggi, oggi + relativedelta(months=mesi))


# ── SALDO CASSA + PROIEZIONE CASSA (Fase 2, Layer 3) ──────
@router.post("/saldo-cassa", tags=["Cassa"])
async def post_saldo_cassa(
    payload: SaldoCassaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    s = await create_saldo(db, payload.data, payload.saldo, payload.nota)
    return {"id": str(s.id), "data": str(s.data), "saldo": float(s.saldo), "nota": s.nota}


@router.get("/saldo-cassa", tags=["Cassa"])
async def get_saldo_cassa(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    s = await get_ultimo_saldo(db)
    if not s:
        return None
    return {"id": str(s.id), "data": str(s.data), "saldo": float(s.saldo), "nota": s.nota}


@router.get("/report/proiezione-cassa", tags=["Report"])
async def report_proiezione_cassa(
    giorni: int = Query(90, ge=7, le=365),
    uscite_variabili_mensili: float = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    """Proiezione cassa rolling (Fase 2): 3 viste (giornaliera/settimanale/mensile) + scenari + soglie.
    Consuma il DSO engine per le entrate. Solo lettura."""
    from decimal import Decimal
    return await calcola_proiezione_cassa(db, giorni, Decimal(str(uscite_variabili_mensili)))


# ═══════════════════════════════════════════════════════
# FATTURE IN CLOUD (SYNC MONODIREZIONALE)
# ═══════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════
# MOVIMENTI CASSA
# ═══════════════════════════════════════════════════════


@router.get("/movimenti-cassa", tags=["Cassa"])
async def get_movimenti_cassa(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    movimenti = await list_movimenti_cassa(db, skip=skip, limit=limit)
    return {"movimenti_cassa": movimenti}


@router.post("/movimenti-cassa/{movimento_id}/riconcilia", tags=["Cassa"])
async def riconcilia_movimento(
    movimento_id: uuid.UUID,
    payload: RiconciliaRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    from app.models.models import MovimentoCassa
    from sqlalchemy import select
    result = await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))
    mov = result.scalar_one_or_none()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    mov.riconciliato = payload.riconciliato
    await db.commit()
    return {"id": str(mov.id), "riconciliato": mov.riconciliato}


@router.patch("/movimenti-cassa/{movimento_id}", tags=["Cassa"])
async def patch_movimento_cassa(
    movimento_id: uuid.UUID,
    payload: MovimentoCassaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    """Retro-compat del matching 1:1: internamente delega alla tabella `riconciliazioni`
    (fonte unica). riconciliato=True+fattura -> crea UNA riconciliazione piena (min |mov|, residuo);
    riconciliato=False -> elimina le riconciliazioni del movimento. Stati/date sono ricalcolati."""
    from app.models.models import MovimentoCassa

    result = await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))
    mov = result.scalar_one_or_none()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimento non trovato")

    # Campi scalari non legati alla riconciliazione (la riconciliazione la gestisce il service)
    data = payload.model_dump(exclude_unset=True)
    for k in ("categoria", "descrizione", "note", "fattura_attiva_id", "fattura_passiva_id"):
        if k in data:
            setattr(mov, k, data[k])

    # Riconciliazione 1:1 -> crea una riga piena via service (valida i vincoli)
    if payload.riconciliato is True and (payload.fattura_attiva_id or payload.fattura_passiva_id):
        is_attiva = bool(payload.fattura_attiva_id)
        fid = payload.fattura_attiva_id or payload.fattura_passiva_id
        fattura, _ = await _load_fattura(
            db, fattura_attiva_id=fid if is_attiva else None,
            fattura_passiva_id=None if is_attiva else fid,
        )
        if not fattura:
            raise HTTPException(status_code=404, detail="Fattura non trovata")
        esistenti = await _sum_riconciliazioni_fattura(db, fid, is_attiva)
        residuo_fatt = (fattura.importo_totale or Decimal("0")) - esistenti
        importo = min(abs(mov.importo or Decimal("0")), residuo_fatt)
        if importo <= 0:
            await db.commit()
            await db.refresh(mov)
            return {c.name: getattr(mov, c.name) for c in mov.__table__.columns}
        key = "fattura_attiva_id" if is_attiva else "fattura_passiva_id"
        await svc_riconcilia_movimento(db, movimento_id, [{key: fid, "importo": importo}], current_user.id)
        await db.refresh(mov)
        return {c.name: getattr(mov, c.name) for c in mov.__table__.columns}

    # Annullamento riconciliazione -> elimina le righe del movimento + recompute
    if payload.riconciliato is False:
        await rimuovi_riconciliazioni_movimento(db, movimento_id)
        await db.refresh(mov)
        return {c.name: getattr(mov, c.name) for c in mov.__table__.columns}

    await db.commit()
    await db.refresh(mov)
    return {c.name: getattr(mov, c.name) for c in mov.__table__.columns}


# ── RICONCILIAZIONI (M2M + parziali — brief §2.2) ─────────
@router.post("/movimenti-cassa/{movimento_id}/riconciliazioni", tags=["Cassa"])
async def post_riconciliazioni(
    movimento_id: uuid.UUID,
    payload: RiconciliazioniCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    righe = [r.model_dump(exclude_unset=True) for r in payload.righe]
    return await svc_riconcilia_movimento(db, movimento_id, righe, current_user.id)


@router.delete("/riconciliazioni/{ric_id}", tags=["Cassa"])
async def delete_riconciliazione(
    ric_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    ok = await elimina_riconciliazione(db, ric_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Riconciliazione non trovata")
    return {"deleted": True}


@router.get("/movimenti-cassa/{movimento_id}/riconciliazioni", tags=["Cassa"])
async def get_riconciliazioni_movimento(
    movimento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return {"riconciliazioni": await list_riconciliazioni_movimento(db, movimento_id)}


@router.get("/fatture-attive/{fattura_id}/riconciliazioni", tags=["Cassa"])
async def get_riconciliazioni_fattura_attiva(
    fattura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return {"riconciliazioni": await list_riconciliazioni_fattura(db, fattura_id, True)}


@router.get("/fatture-passive/{fattura_id}/riconciliazioni", tags=["Cassa"])
async def get_riconciliazioni_fattura_passiva(
    fattura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return {"riconciliazioni": await list_riconciliazioni_fattura(db, fattura_id, False)}


@router.get("/costi-fissi", tags=["CostiFissi"])
async def get_costi_fissi(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    return {"costi_fissi": await list_costi_fissi(db)}


@router.post("/costi-fissi", tags=["CostiFissi"])
async def post_costo_fisso(
    payload: CostoFissoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return await create_costo_fisso(db, payload.model_dump())


@router.patch("/costi-fissi/{costo_id}", tags=["CostiFissi"])
async def patch_costo_fisso(
    costo_id: uuid.UUID,
    payload: CostoFissoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    result = await update_costo_fisso(db, costo_id, payload.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Costo non trovato")
    return result


@router.delete("/costi-fissi/{costo_id}", tags=["CostiFissi"])
async def delete_costo_fisso_endpoint(
    costo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    from fastapi import HTTPException
    ok = await delete_costo_fisso(db, costo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Costo non trovato")
    return {"deleted": True}


# ── COSTI VARIABILI (registro forecasting cassa — brief §2.5) ──
@router.get("/costi-variabili", tags=["CostiVariabili"])
async def get_costi_variabili(
    stato: Optional[str] = Query(None, description="PREVISTO | SOSTENUTO"),
    dal: Optional[date] = Query(None, description="data_prevista >= (YYYY-MM-DD)"),
    al: Optional[date] = Query(None, description="data_prevista <= (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return {"costi_variabili": await list_costi_variabili(db, stato=stato, dal=dal, al=al)}


@router.post("/costi-variabili", tags=["CostiVariabili"], status_code=201)
async def post_costo_variabile(
    payload: CostoVariabileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return await create_costo_variabile(db, payload.model_dump())


@router.patch("/costi-variabili/{costo_id}", tags=["CostiVariabili"])
async def patch_costo_variabile(
    costo_id: uuid.UUID,
    payload: CostoVariabileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    result = await update_costo_variabile(db, costo_id, payload.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Costo variabile non trovato")
    return result


@router.delete("/costi-variabili/{costo_id}", tags=["CostiVariabili"])
async def delete_costo_variabile_endpoint(
    costo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    ok = await delete_costo_variabile(db, costo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Costo variabile non trovato")
    return {"deleted": True}


# ── REGOLE RICONCILIAZIONE ────────────────────────────────
@router.get("/regole-riconciliazione", tags=["Regole"])
async def get_regole(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    from app.services.services import list_regole
    return {"regole": await list_regole(db)}


@router.post("/regole-riconciliazione", tags=["Regole"])
async def post_regola(
    payload: RegolaRiconciliazioneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    from app.services.services import create_regola
    return await create_regola(db, payload.model_dump())


@router.patch("/regole-riconciliazione/{regola_id}", tags=["Regole"])
async def patch_regola(
    regola_id: uuid.UUID,
    payload: RegolaRiconciliazioneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    from app.services.services import update_regola
    r = await update_regola(db, regola_id, payload.model_dump(exclude_unset=True))
    if not r:
        raise HTTPException(status_code=404, detail="Regola non trovata")
    return r


@router.delete("/regole-riconciliazione/{regola_id}", tags=["Regole"])
async def delete_regola_endpoint(
    regola_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    from app.services.services import delete_regola
    from fastapi import HTTPException
    ok = await delete_regola(db, regola_id)
    if not ok: raise HTTPException(status_code=404, detail="Regola non trovata")
    return {"deleted": True}


@router.post("/regole-riconciliazione/applica", tags=["Regole"])
async def applica_regole(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    from app.services.services import applica_regole_automatiche
    return await applica_regole_automatiche(db, current_user.id)


@router.post("/regole-riconciliazione/dry-run", tags=["Regole"])
async def dry_run_regole(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    """Preview di cosa verrebbe riconciliato senza applicare modifiche al DB."""
    from app.services.services import dry_run_regole_automatiche
    return await dry_run_regole_automatiche(db)


@router.get("/regole-riconciliazione/{regola_id}/log", tags=["Regole"])
async def get_regola_log(
    regola_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    """Storico applicazioni di una singola regola (da audit_log)."""
    from app.services.services import get_regola_application_log
    return await get_regola_application_log(db, regola_id)


@router.get("/movimenti-cassa/{movimento_id}/suggest", tags=["Regole"])
async def suggest_mov(
    movimento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    from app.services.services import suggest_riconciliazione
    return await suggest_riconciliazione(db, movimento_id)


# ── IMPUTAZIONI FATTURE PASSIVE ───────────────────────────
@router.get("/fatture-passive/{fattura_id}/imputazioni", tags=["Imputazioni"])
async def get_imputazioni_fattura(
    fattura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    from app.services.services import get_imputazioni
    return await get_imputazioni(db, fattura_id)


@router.post("/fatture-passive/{fattura_id}/imputazioni", tags=["Imputazioni"])
async def save_imputazioni_fattura(
    fattura_id: uuid.UUID,
    payload: ImputazioniRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    from app.services.services import save_imputazioni
    items = [i.model_dump() for i in payload.imputazioni]
    result = await save_imputazioni(db, fattura_id, items)
    if result is None:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    return {"imputazioni": result}


# ── IMPUTAZIONI MOVIMENTI CASSA ───────────────────────────
@router.get("/movimenti-cassa/{movimento_id}/imputazioni", tags=["Imputazioni"])
async def get_imputazioni_mov(
    movimento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    from app.services.services import get_imputazioni_movimento
    return await get_imputazioni_movimento(db, movimento_id)


@router.post("/movimenti-cassa/{movimento_id}/imputazioni", tags=["Imputazioni"])
async def save_imputazioni_mov(
    movimento_id: uuid.UUID,
    payload: ImputazioniRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    from app.services.services import save_imputazioni_movimento
    items = [i.model_dump() for i in payload.imputazioni]
    result = await save_imputazioni_movimento(db, movimento_id, items)
    if result is None:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    return {"imputazioni": result}


@router.delete("/fatture-passive/{fattura_id}/imputazioni", tags=["Imputazioni"], status_code=204)
async def delete_imputazioni_fattura(
    fattura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    """Elimina tutte le imputazioni di una fattura passiva."""
    from app.models.models import FatturaPassivaImputazione
    from app.services.services import _commesse_impattate_da_fattura, ricalcola_costi_diretti_imputati
    # R3: cattura le commesse impattate PRIMA della delete, poi ricalcola i loro costi imputati
    impatto = await _commesse_impattate_da_fattura(db, fattura_id)
    await db.execute(
        __import__('sqlalchemy', fromlist=['delete']).delete(FatturaPassivaImputazione)
        .where(FatturaPassivaImputazione.fattura_passiva_id == fattura_id)
    )
    await db.flush()
    await ricalcola_costi_diretti_imputati(db, impatto)
    await db.commit()


@router.delete("/movimenti-cassa/{movimento_id}/imputazioni", tags=["Imputazioni"], status_code=204)
async def delete_imputazioni_movimento(
    movimento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    """Elimina tutte le imputazioni di un movimento cassa."""
    from app.models.models import MovimentoCassaImputazione
    await db.execute(
        __import__('sqlalchemy', fromlist=['delete']).delete(MovimentoCassaImputazione)
        .where(MovimentoCassaImputazione.movimento_id == movimento_id)
    )
    await db.commit()


# ── RISORSE (HR) ──────────────────────────────────────────
# Le rotte GET/POST/PATCH/DELETE /risorse sono servite da risorse.py (incluso sopra come
# risorse.router). Le versioni inline qui erano shadowed/morte (D-01) e sono state rimosse
# insieme ai service inutilizzati list_risorse/create_risorsa/update_risorsa (D-02).
# L'endpoint hard-delete duplicato è stato rimosso (route shadowing + rischio FK).


# ── PIANIFICAZIONE COMMESSA ──────────────────────────────
@router.get("/piani", tags=["Pianificazione"])
async def list_piani(
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(require_finance_access),
):
    from sqlalchemy import text
    rows = await db.execute(text("""
        SELECT p.*, cl.ragione_sociale as cliente_nome, cl.codice_cliente
        FROM piano_commessa p
        JOIN clienti cl ON cl.id=p.cliente_id
        ORDER BY p.created_at DESC
    """))
    return [dict(r) for r in rows.mappings().fetchall()]

@router.get("/piani/{piano_id}", tags=["Pianificazione"])
async def get_piano(
    piano_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(require_finance_access),
):
    from sqlalchemy import text
    row = await db.execute(text("SELECT p.*, cl.ragione_sociale as cliente_nome, cl.codice_cliente FROM piano_commessa p JOIN clienti cl ON cl.id=p.cliente_id WHERE p.id=:pid"), {"pid": str(piano_id)})
    piano = row.mappings().fetchone()
    if not piano:
        return None
    righe = await db.execute(text("SELECT pcr.*, r.nome||' '||r.cognome as risorsa_nome FROM piano_commessa_righe pcr LEFT JOIN risorse r ON r.id=pcr.risorsa_id WHERE pcr.piano_id=:pid ORDER BY pcr.created_at"), {"pid": str(piano_id)})
    return {**dict(piano), "righe": [dict(r) for r in righe.mappings().fetchall()]}

@router.post("/piani", tags=["Pianificazione"])
async def create_piano(
    payload: PianoCreate,
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(require_finance_access),
):
    from sqlalchemy import text
    res = await db.execute(text("""
        INSERT INTO piano_commessa (cliente_id, preventivo, margine_target_pct, budget_produttivo, ore_budget, costo_orario_snapshot, mese_competenza, note)
        VALUES (:cid, :prev, :marg, :budg, :ore, :co, :mese, :note) RETURNING id
    """), {
        "cid": str(payload.cliente_id),
        "prev": payload.preventivo,
        "marg": payload.margine_target_pct,
        "budg": payload.budget_produttivo,
        "ore": payload.ore_budget,
        "co": payload.costo_orario_snapshot,
        "mese": payload.mese_competenza,
        "note": payload.note,
    })
    piano_id = str(res.fetchone()[0])
    for riga in payload.righe:
        await db.execute(
            text("INSERT INTO piano_commessa_righe (piano_id, risorsa_id, lavorazione, ore_pianificate, note) VALUES (:pid,:rid,:l,:o,:n)"),
            {"pid": piano_id, "rid": str(riga.risorsa_id) if riga.risorsa_id else None,
             "l": riga.lavorazione, "o": riga.ore_pianificate, "n": riga.note},
        )
    await db.commit()
    return await get_piano(uuid.UUID(piano_id), db, _auth)


@router.patch("/piani/{piano_id}", tags=["Pianificazione"])
async def update_piano(
    piano_id: uuid.UUID,
    payload: PianoUpdate,
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(require_finance_access),
):
    from sqlalchemy import text
    await db.execute(text("""
        UPDATE piano_commessa SET preventivo=:prev, margine_target_pct=:marg, budget_produttivo=:budg,
        ore_budget=:ore, costo_orario_snapshot=:co, mese_competenza=:mese, note=:note, updated_at=NOW()
        WHERE id=:pid
    """), {
        "prev": payload.preventivo or 0,
        "marg": payload.margine_target_pct or 40,
        "budg": payload.budget_produttivo,
        "ore": payload.ore_budget,
        "co": payload.costo_orario_snapshot,
        "mese": payload.mese_competenza,
        "note": payload.note,
        "pid": str(piano_id),
    })
    await db.execute(text("DELETE FROM piano_commessa_righe WHERE piano_id=:pid"), {"pid": str(piano_id)})
    for riga in payload.righe:
        await db.execute(
            text("INSERT INTO piano_commessa_righe (piano_id, risorsa_id, lavorazione, ore_pianificate, note) VALUES (:pid,:rid,:l,:o,:n)"),
            {"pid": str(piano_id), "rid": str(riga.risorsa_id) if riga.risorsa_id else None,
             "l": riga.lavorazione, "o": riga.ore_pianificate, "n": riga.note},
        )
    await db.commit()
    return await get_piano(piano_id, db, _auth)


@router.patch("/piani/{piano_id}/collega-commessa", tags=["Pianificazione"])
async def collega_commessa_piano(
    piano_id: uuid.UUID,
    payload: CollegaCommessaRequest,
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(require_finance_access),
):
    from sqlalchemy import text
    commessa_id = str(payload.commessa_id) if payload.commessa_id else None
    await db.execute(
        text("UPDATE piano_commessa SET commessa_id=:cid, updated_at=NOW() WHERE id=:pid"),
        {"cid": commessa_id, "pid": str(piano_id)},
    )
    if commessa_id:
        await db.execute(
            text("UPDATE commesse SET piano_id=:pid, preventivo=COALESCE((SELECT preventivo FROM piano_commessa WHERE id=:pid),0) WHERE id=:cid"),
            {"pid": str(piano_id), "cid": commessa_id},
        )
    await db.commit()
    return {"ok": True}

@router.get("/piani/{piano_id}/consuntivo", tags=["Pianificazione"])
async def get_consuntivo_piano(
    piano_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(require_finance_access),
):
    from sqlalchemy import text
    piano = await db.execute(text("SELECT commessa_id FROM piano_commessa WHERE id=:pid"), {"pid": str(piano_id)})
    p = piano.fetchone()
    if not p or not p[0]:
        return {"righe": [], "totali": {}}
    commessa_id = str(p[0])
    righe = await db.execute(text("""
        SELECT t.servizio, r.nome||' '||r.cognome as risorsa_nome,
            SUM(t.durata_minuti) as minuti_totali, SUM(t.costo_lavoro) as costo_totale,
            MIN(t.data_attivita) as prima_data, MAX(t.data_attivita) as ultima_data
        FROM timesheet t LEFT JOIN risorse r ON r.user_id=t.user_id
        WHERE t.commessa_id=:cid AND t.stato='APPROVATO'
        GROUP BY t.servizio, r.nome, r.cognome ORDER BY minuti_totali DESC
    """), {"cid": commessa_id})
    totali = await db.execute(text("SELECT SUM(durata_minuti) as minuti_totali, SUM(costo_lavoro) as costo_totale FROM timesheet WHERE commessa_id=:cid AND stato='APPROVATO'"), {"cid": commessa_id})
    return {"righe": [dict(r) for r in righe.mappings().fetchall()], "totali": dict(totali.mappings().fetchone() or {})}

@router.delete("/piani/{piano_id}", status_code=204, tags=["Pianificazione"])
async def delete_piano(piano_id: uuid.UUID, db: AsyncSession = Depends(get_db), _auth: User = Depends(require_finance_access)):
    from sqlalchemy import text
    await db.execute(text("DELETE FROM piano_commessa WHERE id=:pid"), {"pid": str(piano_id)})
    await db.commit()

@router.delete("/timesheet/bulk", tags=["Timesheet"])
async def bulk_elimina(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.schemas.schemas import TimesheetBulkDelete
    body = await request.json()
    data = TimesheetBulkDelete(**body)
    return await elimina_timesheet_bulk(db, data.ids, current_user)


@router.patch("/timesheet/bulk-mese", tags=["Timesheet"])
async def bulk_cambia_mese(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.schemas.schemas import TimesheetBulkMese
    body = await request.json()
    data = TimesheetBulkMese(**body)
    return await aggiorna_mese_competenza_bulk(db, data.ids, data.mese_competenza, current_user)


# ═══════════════════════════════════════════════════════
# CLICKUP — task lookup per timer
# ═══════════════════════════════════════════════════════

async def _cu_get(path: str) -> dict:
    token = settings.CLICKUP_API_TOKEN
    if not token:
        raise HTTPException(status_code=500, detail="CLICKUP_API_TOKEN non configurato")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{settings.CLICKUP_BASE_URL}{path}",
            headers={"Authorization": token}
        )
        r.raise_for_status()
        return r.json()


@router.get("/clickup/users", tags=["ClickUp"])
async def get_clickup_members(
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    """Lista membri workspace ClickUp con ID — per configurare clickup_user_id su users"""
    data = await _cu_get(f"/team/{settings.CLICKUP_TEAM_ID}/member")
    members = []
    for m in data.get("members", []):
        u = m.get("user", {})
        members.append({
            "clickup_id": u.get("id"),
            "username": u.get("username"),
            "email": u.get("email"),
        })
    return {"members": members}


@router.get("/clickup/tasks", tags=["ClickUp"])
async def get_clickup_tasks_per_utente(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ritorna i task ClickUp open assegnati all utente corrente.
    Usa /team/tasks con filtro assignee — 1 sola chiamata API invece di N*M.
    """
    from sqlalchemy import select
    from app.models.models import User as UserModel
    result = await db.execute(
        select(UserModel.clickup_user_id).where(UserModel.id == current_user.id)
    )
    row = result.fetchone()
    if not row or not row.clickup_user_id:
        raise HTTPException(
            status_code=400,
            detail="clickup_user_id non configurato — chiedi all admin di impostarlo"
        )
    cu_user_id = str(row.clickup_user_id)

    # 1 chiamata per tutti i task assegnati, include subtask, escludi chiusi
    # Pagina fino a 200 task (sufficiente per un team piccolo)
    all_tasks = []
    page = 0
    while True:
        data = await _cu_get(
            f"/team/{settings.CLICKUP_TEAM_ID}/task"
            f"?assignees[]={cu_user_id}"
            f"&include_closed=false&subtasks=true"
            f"&page={page}&order_by=due_date&reverse=true"
        )
        batch = data.get("tasks", [])
        all_tasks.extend(batch)
        if len(batch) < 100 or page >= 1:
            break
        page += 1

    # Mappa id → {name, folder} per risolvere parent e cliente
    id_to_task = {t["id"]: t for t in all_tasks}

    tasks_out = []
    for task in all_tasks:
        parent_id = task.get("parent")
        folder = task.get("folder", {})
        space = task.get("space", {})

        # Salta task dello space BITE (interno)
        if space.get("id") == "90153479822":
            continue

        cliente_nome = folder.get("name", "—")
        folder_id = folder.get("id", "")

        if parent_id:
            parent_task = id_to_task.get(parent_id)
            parent_name = parent_task["name"] if parent_task else parent_id
            display_name = f"{parent_name} · {task['name']}"
        else:
            display_name = task["name"]

        tasks_out.append({
            "id": task["id"],
            "name": task["name"],
            "display_name": display_name,
            "parent_id": parent_id,
            "parent_name": id_to_task[parent_id]["name"] if parent_id and parent_id in id_to_task else None,
            "cliente_nome": cliente_nome,
            "folder_id": folder_id,
            "list_name": task.get("list", {}).get("name", ""),
            "status": task.get("status", {}).get("status", ""),
            "url": task.get("url", ""),
        })

    # Raggruppa per cliente
    grouped = {}
    for t in tasks_out:
        k = t["cliente_nome"]
        if k not in grouped:
            grouped[k] = {"cliente_nome": k, "folder_id": t["folder_id"], "tasks": []}
        grouped[k]["tasks"].append(t)

    return {"clienti": list(grouped.values()), "totale_task": len(tasks_out)}


# ═══════════════════════════════════════════════════════
# TIMESHEET MANUALE (da timer o inserimento libero)
# ═══════════════════════════════════════════════════════

@router.post("/timesheet/manuale", response_model=TimesheetOut, status_code=201, tags=["Timesheet"])
async def add_timesheet_manuale(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crea un timesheet da timer BiteERP o inserimento manuale.
    Accetta: cliente_id, clickup_task_id, clickup_parent_task_id,
             task_display_name, servizio, durata_minuti, data_attivita, note
    """
    from app.models.models import Timesheet, TimesheetStatus, Commessa
    from sqlalchemy import select
    import calendar

    body = await request.json()

    # Valida campi obbligatori
    durata = body.get("durata_minuti")
    data_str = body.get("data_attivita")
    if not durata or durata <= 0:
        raise HTTPException(status_code=400, detail="durata_minuti obbligatorio e > 0")
    if not data_str:
        raise HTTPException(status_code=400, detail="data_attivita obbligatorio")

    data_att = date.fromisoformat(data_str)
    mese_comp = date(data_att.year, data_att.month, 1)

    # Risolvi commessa_id
    commessa_id = None
    if body.get("commessa_id"):
        commessa_id = uuid.UUID(body["commessa_id"])
    else:
        cliente_id = body.get("cliente_id")
        if cliente_id:
            cm_result = await db.execute(
                select(Commessa).where(
                    Commessa.cliente_id == uuid.UUID(cliente_id),
                    Commessa.mese_competenza == mese_comp
                )
            )
            cm = cm_result.scalar_one_or_none()
            if cm:
                commessa_id = cm.id
            else:
                # Crea commessa APERTA per il mese corrente se non esiste
                new_cm = Commessa(
                    id=uuid.uuid4(),
                    cliente_id=uuid.UUID(cliente_id),
                    mese_competenza=mese_comp,
                    stato=CommessaStatus.APERTA,
                    costo_manodopera=0
                )
                db.add(new_cm)
                await db.flush()
                commessa_id = new_cm.id

    # Risolvi task_id
    task_id = None
    if body.get("task_id"):
        task_id = uuid.UUID(body["task_id"])

    # Crea timesheet
    from sqlalchemy import select as sa_select
    from app.models.models import User as UserModel
    co_res = await db.execute(sa_select(UserModel.costo_orario).where(UserModel.id == current_user.id))
    costo_orario = co_res.scalar_one_or_none() or 0
    costo_lavoro = round((durata / 60.0) * float(costo_orario or 0), 2)

    ts = Timesheet(
        id=uuid.uuid4(),
        user_id=current_user.id,
        commessa_id=commessa_id,
        task_id=task_id,
        data_attivita=data_att,
        mese_competenza=mese_comp,
        servizio=body.get("servizio"),
        durata_minuti=durata,
        costo_orario_snapshot=costo_orario,
        costo_lavoro=costo_lavoro,
        stato=TimesheetStatus.PENDING,
        note=body.get("note"),
        clickup_task_id=body.get("clickup_task_id"),
        clickup_parent_task_id=body.get("clickup_parent_task_id"),
        task_display_name=body.get("task_display_name"),
    )
    db.add(ts)
    await db.commit()
    await db.refresh(ts)
    await timesheet._check_margin_and_notify(db, commessa_id)
    return ts


@router.patch("/timesheet/{timesheet_id}", response_model=TimesheetOut, tags=["Timesheet"])
async def update_timesheet_manuale(
    timesheet_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import Timesheet, Commessa, CommessaStatus
    from sqlalchemy import select
    from datetime import date
    body = await request.json()
    
    result = await db.execute(select(Timesheet).where(Timesheet.id == timesheet_id))
    ts = result.scalar_one_or_none()
    if not ts:
        raise HTTPException(status_code=404, detail="Timesheet non trovato")

    if "durata_minuti" in body:
        if body["durata_minuti"] <= 0:
            raise HTTPException(status_code=400, detail="durata_minuti deve essere > 0")
        ts.durata_minuti = body["durata_minuti"]
        costo_orario = ts.costo_orario_snapshot or 0
        ts.costo_lavoro = round((body["durata_minuti"] / 60.0) * float(costo_orario), 2)

    if "data_attivita" in body:
        data_att = date.fromisoformat(body["data_attivita"])
        ts.data_attivita = data_att
        ts.mese_competenza = date(data_att.year, data_att.month, 1)

    if "servizio" in body:
        ts.servizio = body["servizio"]
    if "note" in body:
        ts.note = body["note"]

    if "commessa_id" in body and body["commessa_id"]:
        ts.commessa_id = uuid.UUID(body["commessa_id"])
    elif "cliente_id" in body and body["cliente_id"]:
        mese_comp = ts.mese_competenza
        cm_result = await db.execute(
            select(Commessa).where(
                Commessa.cliente_id == uuid.UUID(body["cliente_id"]),
                Commessa.mese_competenza == mese_comp
            )
        )
        cm = cm_result.scalar_one_or_none()
        if cm:
            ts.commessa_id = cm.id
        else:
            new_cm = Commessa(
                id=uuid.uuid4(),
                cliente_id=uuid.UUID(body["cliente_id"]),
                mese_competenza=mese_comp,
                stato=CommessaStatus.APERTA,
                costo_manodopera=0
            )
            db.add(new_cm)
            await db.flush()
            ts.commessa_id = new_cm.id

    if "task_id" in body:
        ts.task_id = uuid.UUID(body["task_id"]) if body["task_id"] else None

    await db.commit()
    await db.refresh(ts)
    return ts


@router.delete("/timesheet/{timesheet_id}", status_code=204, tags=["Timesheet"])
async def delete_timesheet_singolo(
    timesheet_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Elimina un singolo timesheet. ADMIN/PM possono eliminare qualsiasi; DIPENDENTE solo i propri PENDING."""
    from app.models.models import Timesheet as TimesheetModel, TimesheetStatus
    result = await db.execute(select(TimesheetModel).where(TimesheetModel.id == timesheet_id))
    ts = result.scalar_one_or_none()
    if not ts:
        raise HTTPException(status_code=404, detail="Timesheet non trovato")

    if current_user.ruolo in (UserRole.DIPENDENTE, UserRole.FREELANCER, UserRole.COLLABORATORE):
        if ts.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Non autorizzato")
        if ts.stato != TimesheetStatus.PENDING:
            raise HTTPException(status_code=400, detail="Solo i timesheet in stato PENDING possono essere eliminati")

    await db.delete(ts)
    await db.commit()


# ═══════════════════════════════════════════════════════
# TASKS (NATIVI)
@router.get("/tasks/time-estimate", tags=["Tasks"])
async def get_task_time_estimate(
    user_id: uuid.UUID,
    task_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stima il tempo richiesto per un task basandosi sullo storico dell'utente."""
    # A-03 (IDOR): lo storico/produttivita di un altro utente e' visibile solo a chi ha accesso
    # pieno (manager/admin, has_erp_access); altrimenti si puo' interrogare solo il proprio.
    if user_id != current_user.id and not has_erp_access(current_user.ruolo):
        raise HTTPException(status_code=403, detail="Non autorizzato")
    from sqlalchemy import select, and_, func
    from app.models.models import TimerSession, Task
    from datetime import datetime, timedelta, timezone

    # 1. Recupera sessioni dell'utente per task simili (ILIKE sul titolo)
    # Escludiamo sessioni < 1 minuto come concordato
    stmt = select(TimerSession.durata_minuti, TimerSession.started_at).join(Task).where(
        TimerSession.user_id == user_id,
        TimerSession.durata_minuti >= 1,
        Task.titolo.ilike(f"%{task_type}%")
    )
    result = await db.execute(stmt)
    sessions = result.all()

    if not sessions:
        return {
            "stima_minuti": 0,
            "confidenza": "NESSUNA",
            "sessioni_analizzate": 0,
            "media_minuti": 0,
            "min_minuti": 0,
            "max_minuti": 0
        }

    # 2. Calcolo media pesata
    now = datetime.now(timezone.utc)
    total_weighted_minutes = 0.0
    total_weight = 0.0
    durations = []

    for durata, started_at in sessions:
        durata = durata or 0
        durations.append(durata)
        
        # Pesi: <30gg = 3x, <90gg = 2x, oltre = 1x
        days_ago = (now - started_at).days
        weight = 1.0
        if days_ago <= 30:
            weight = 3.0
        elif days_ago <= 90:
            weight = 2.0
            
        total_weighted_minutes += (durata * weight)
        total_weight += weight

    weighted_avg = total_weighted_minutes / total_weight
    count = len(sessions)
    
    confidenza = "NESSUNA"
    if count >= 10:
        confidenza = "ALTA"
    elif count >= 3:
        confidenza = "MEDIA"
    elif count >= 1:
        confidenza = "BASSA"

    return {
        "stima_minuti": round(weighted_avg),
        "confidenza": confidenza,
        "sessioni_analizzate": count,
        "media_minuti": round(sum(durations) / count),
        "min_minuti": min(durations),
        "max_minuti": max(durations)
    }

@router.get("/users/{user_id}/capacity-today", tags=["Users", "Planning"])
async def get_user_capacity_today(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Calcola la capacità oraria residua per l'utente loggato."""
    from sqlalchemy import select, func
    from app.models.models import Risorsa, Task
    from datetime import date

    # 1. Recupera risorsa per ore_settimanali
    stmt = select(Risorsa).where(Risorsa.user_id == user_id)
    result = await db.execute(stmt)
    resource = result.scalar_one_or_none()
    
    # Default 8 ore/giorno se non specificato (collaboratori piva)
    ore_giornaliere = 8.0
    if resource and resource.ore_settimanali:
        ore_giornaliere = float(resource.ore_settimanali) / 5.0

    # 2. Somma stime task assegnati oggi non completati
    # Consideriamo task con data_scadenza == oggi e stato != 'PUBBLICATO'
    today = date.today()
    stmt_tasks = select(func.sum(Task.stima_minuti)).where(
        Task.assegnatario_id == user_id,
        Task.data_scadenza == today,
        Task.stato != 'PUBBLICATO'
    )
    result_tasks = await db.execute(stmt_tasks)
    total_minutes = result_tasks.scalar() or 0
    total_hours_assigned = float(total_minutes) / 60.0

    rem_hours = max(0, ore_giornaliere - total_hours_assigned)
    perc = (total_hours_assigned / ore_giornaliere) * 100 if ore_giornaliere > 0 else 100

    return {
        "ore_disponibili_oggi": round(ore_giornaliere, 1),
        "ore_gia_assegnate": round(total_hours_assigned, 1),
        "ore_rimanenti": round(rem_hours, 1),
        "percentuale_carico": round(perc, 1),
        "puo_accettare_task": rem_hours > 0
    }

@router.get("/tasks", response_model=List[TaskOut], tags=["Tasks"])
async def get_tasks(
    progetto_id: Optional[uuid.UUID] = Query(None),
    commessa_id: Optional[uuid.UUID] = Query(None),
    assegnatario_id: Optional[uuid.UUID] = Query(None),
    stato: Optional[TaskStatus] = Query(None),
    parent_only: bool = Query(False),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access)
):
    return await list_tasks(
        db,
        current_user,
        progetto_id,
        commessa_id,
        assegnatario_id,
        stato,
        parent_only,
        start_date,
        end_date,
        limit=limit,
        skip=skip,
    )

@router.get("/tasks/{task_id}", response_model=TaskOut, tags=["Tasks"])
async def get_single_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access)
):
    t = await get_task(db, task_id, current_user)
    if not t:
        raise HTTPException(status_code=404, detail="Task non trovata")
    return t

@router.post("/tasks", response_model=TaskOut, status_code=201, tags=["Tasks"])
async def add_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access)
):
    return await create_task(db, data, current_user)

@router.patch("/tasks/{task_id}", response_model=TaskOut, tags=["Tasks"])
async def patch_task(
    task_id: uuid.UUID,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access)
):
    t = await update_task(db, task_id, data, current_user.id, current_user)
    if not t:
        raise HTTPException(status_code=404, detail="Task non trovata")
    return t

@router.delete("/tasks/{task_id}", status_code=204, tags=["Tasks"])
async def remove_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access)
):
    ok = await delete_task(db, task_id, current_user.id, current_user)
    if not ok:
        raise HTTPException(status_code=404, detail="Task non trovata")
    await db.commit()


# ═══════════════════════════════════════════════════════
# TASK TEMPLATES (Recurring Tasks)
# ═══════════════════════════════════════════════════════

async def _pick_user_id_for_role(db: AsyncSession, role_name: Optional[str]) -> Optional[uuid.UUID]:
    if not role_name:
        return None
    try:
        role = UserRole(role_name)
    except ValueError:
        return None

    result = await db.execute(
        select(User)
        .where(User.ruolo == role, User.attivo == True)
        .order_by(User.nome, User.cognome)
        .limit(1)
    )
    user = result.scalar_one_or_none()
    return user.id if user else None


async def _task_template_item_exists(
    db: AsyncSession,
    commessa_id: uuid.UUID,
    titolo: str,
    data_scadenza: Optional[date],
) -> bool:
    from app.models.models import Task

    stmt = select(func.count()).select_from(Task).where(
        Task.commessa_id == commessa_id,
        Task.titolo == titolo,
    )
    if data_scadenza is None:
        stmt = stmt.where(Task.data_scadenza.is_(None))
    else:
        stmt = stmt.where(Task.data_scadenza == data_scadenza)
    result = await db.execute(stmt)
    return bool(result.scalar_one())


def _commessa_project_types(commessa) -> set[str]:
    tipi: set[str] = set()
    for riga in getattr(commessa, "righe_progetto", []) or []:
        progetto = getattr(riga, "progetto", None)
        if progetto and getattr(progetto, "tipo", None):
            tipo = getattr(progetto, "tipo")
            tipi.add(tipo.value if hasattr(tipo, "value") else str(tipo))
    return tipi


def _template_matches_commessa(template, commessa) -> bool:
    return template_matches_commessa(template, commessa)


@router.get("/task-templates", tags=["TaskTemplates"])
async def list_task_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import TaskTemplate
    from sqlalchemy.orm import selectinload as sil
    result = await db.execute(
        select(TaskTemplate)
        .options(sil(TaskTemplate.items))
        .order_by(TaskTemplate.nome)
    )
    templates = result.scalars().unique().all()
    return [
        {
            "id": str(t.id),
            "nome": t.nome,
            "descrizione": t.descrizione,
            "progetto_tipo": t.progetto_tipo,
            "attivo": t.attivo,
            "num_items": len(t.items),
            "items": [
                {
                    "id": str(i.id),
                    "titolo": i.titolo,
                    "descrizione": i.descrizione,
                    "servizio": i.servizio,
                    "stima_minuti": i.stima_minuti,
                    "priorita": i.priorita,
                    "giorno_scadenza": i.giorno_scadenza,
                    "assegnatario_ruolo": i.assegnatario_ruolo,
                    "ordine": i.ordine,
                }
                for i in t.items
            ],
            "created_at": t.created_at.isoformat(),
        }
        for t in templates
    ]


@router.post("/task-templates", status_code=201, tags=["TaskTemplates"])
async def create_task_template(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.models.models import TaskTemplate, TaskTemplateItem
    items_data = data.pop("items", [])
    template = TaskTemplate(
        id=uuid.uuid4(),
        created_by=current_user.id,
        **{k: v for k, v in data.items() if k in ("nome", "descrizione", "progetto_tipo", "attivo")}
    )
    db.add(template)
    await db.flush()
    for idx, item in enumerate(items_data):
        db.add(TaskTemplateItem(
            id=uuid.uuid4(),
            template_id=template.id,
            ordine=idx,
            **{k: v for k, v in item.items() if k in ("titolo", "descrizione", "servizio", "stima_minuti", "priorita", "giorno_scadenza", "assegnatario_ruolo")}
        ))
    await db.commit()
    return {"id": str(template.id), "nome": template.nome}


@router.put("/task-templates/{template_id}", tags=["TaskTemplates"])
async def update_task_template(
    template_id: uuid.UUID,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.models.models import TaskTemplate, TaskTemplateItem
    from sqlalchemy.orm import selectinload as sil
    result = await db.execute(
        select(TaskTemplate).options(sil(TaskTemplate.items)).where(TaskTemplate.id == template_id)
    )
    t = result.unique().scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template non trovato")

    for field in ("nome", "descrizione", "progetto_tipo", "attivo"):
        if field in data:
            setattr(t, field, data[field])

    if "items" in data:
        # Replace all items
        for old_item in list(t.items):
            await db.delete(old_item)
        await db.flush()
        for idx, item in enumerate(data["items"]):
            db.add(TaskTemplateItem(
                id=uuid.uuid4(),
                template_id=template_id,
                ordine=idx,
                **{k: v for k, v in item.items() if k in ("titolo", "descrizione", "servizio", "stima_minuti", "priorita", "giorno_scadenza", "assegnatario_ruolo")}
            ))

    await db.commit()
    return {"id": str(template_id), "nome": t.nome}


@router.delete("/task-templates/{template_id}", status_code=204, tags=["TaskTemplates"])
async def delete_task_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.models.models import TaskTemplate
    result = await db.execute(select(TaskTemplate).where(TaskTemplate.id == template_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template non trovato")
    await db.delete(t)
    await db.commit()


@router.post("/task-templates/{template_id}/genera", tags=["TaskTemplates"])
async def genera_task_da_template(
    template_id: uuid.UUID,
    commessa_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    """Genera i task del template per la commessa indicata."""
    from app.models.models import TaskTemplate, Task, TaskStatus, Commessa, CommessaProgetto, Progetto
    from sqlalchemy.orm import selectinload as sil
    import calendar

    tpl_result = await db.execute(
        select(TaskTemplate).options(sil(TaskTemplate.items)).where(TaskTemplate.id == template_id)
    )
    tpl = tpl_result.unique().scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template non trovato")

    cm_result = await db.execute(
        select(Commessa)
        .options(
            sil(Commessa.righe_progetto)
            .selectinload(CommessaProgetto.progetto)
            .selectinload(Progetto.servizi)
        )
        .where(Commessa.id == commessa_id)
    )
    cm = cm_result.unique().scalar_one_or_none()
    if not cm:
        raise HTTPException(status_code=404, detail="Commessa non trovata")
    if not _template_matches_commessa(tpl, cm):
        raise HTTPException(status_code=422, detail="Template non compatibile con i progetti della commessa")

    created = []
    skipped = []
    mese = cm.mese_competenza
    _, days_in_month = calendar.monthrange(mese.year, mese.month)

    for item in tpl.items:
        scadenza = None
        if item.giorno_scadenza:
            day = min(item.giorno_scadenza, days_in_month)
            scadenza = date(mese.year, mese.month, day)
        if await _task_template_item_exists(db, commessa_id, item.titolo, scadenza):
            skipped.append(item.titolo)
            continue
        assegnatario_id = await _pick_user_id_for_role(db, item.assegnatario_ruolo)

        task = Task(
            id=uuid.uuid4(),
            commessa_id=commessa_id,
            titolo=item.titolo,
            descrizione=item.descrizione,
            servizio=item.servizio,
            stima_minuti=item.stima_minuti,
            priorita=item.priorita or "media",
            data_scadenza=scadenza,
            assegnatario_id=assegnatario_id,
            stato=TaskStatus.DA_FARE,
        )
        db.add(task)
        created.append({"titolo": task.titolo, "scadenza": str(scadenza) if scadenza else None})

    await db.commit()
    return {"template": tpl.nome, "generati": len(created), "saltati": len(skipped), "tasks": created}


@router.post("/task-templates/genera-tutti", tags=["TaskTemplates"])
async def genera_tutti_task_mese(
    mese: date = Query(..., description="Formato YYYY-MM-01"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    """Genera i task da tutti i template attivi per le commesse aperte del mese."""
    from app.models.models import TaskTemplate, Task, TaskStatus, Commessa, CommessaProgetto, CommessaStatus, Progetto
    from sqlalchemy.orm import selectinload as sil
    import calendar

    # Commesse aperte nel mese
    cm_result = await db.execute(
        select(Commessa)
        .options(
            sil(Commessa.righe_progetto)
            .selectinload(CommessaProgetto.progetto)
            .selectinload(Progetto.servizi)
        )
        .where(
            Commessa.mese_competenza == mese,
            Commessa.stato.in_([CommessaStatus.APERTA, CommessaStatus.PRONTA_CHIUSURA])
        )
    )
    commesse = cm_result.scalars().unique().all()

    # Template attivi
    tpl_result = await db.execute(
        select(TaskTemplate).options(sil(TaskTemplate.items)).where(TaskTemplate.attivo == True)
    )
    templates = tpl_result.scalars().unique().all()

    _, days_in_month = calendar.monthrange(mese.year, mese.month)
    total = 0
    skipped = 0

    for cm in commesse:
        for tpl in templates:
            if not _template_matches_commessa(tpl, cm):
                continue
            for item in tpl.items:
                scadenza = None
                if item.giorno_scadenza:
                    day = min(item.giorno_scadenza, days_in_month)
                    scadenza = date(mese.year, mese.month, day)
                if await _task_template_item_exists(db, cm.id, item.titolo, scadenza):
                    skipped += 1
                    continue
                assegnatario_id = await _pick_user_id_for_role(db, item.assegnatario_ruolo)
                task = Task(
                    id=uuid.uuid4(),
                    commessa_id=cm.id,
                    titolo=item.titolo,
                    descrizione=item.descrizione,
                    servizio=item.servizio,
                    stima_minuti=item.stima_minuti,
                    priorita=item.priorita or "media",
                    data_scadenza=scadenza,
                    assegnatario_id=assegnatario_id,
                    stato=TaskStatus.DA_FARE,
                )
                db.add(task)
                total += 1

    await db.commit()
    return {"mese": str(mese), "commesse_processate": len(commesse), "task_generati": total, "task_saltati": skipped}


# ═══════════════════════════════════════════════════════
# CONTENUTI (Pipeline Approvazione)
# ═══════════════════════════════════════════════════════

_STATO_TRANSITIONS: dict[str, list[str]] = {
    "BOZZA":                        ["IN_REVISIONE_INTERNA"],
    "IN_REVISIONE_INTERNA":         ["MODIFICHE_RICHIESTE_INTERNE", "APPROVATO_INTERNAMENTE"],
    "MODIFICHE_RICHIESTE_INTERNE":  ["IN_REVISIONE_INTERNA"],
    "APPROVATO_INTERNAMENTE":       ["INVIATO_AL_CLIENTE"],
    "INVIATO_AL_CLIENTE":           ["MODIFICHE_RICHIESTE_CLIENTE", "APPROVATO_CLIENTE"],
    "MODIFICHE_RICHIESTE_CLIENTE":  ["INVIATO_AL_CLIENTE"],
    "APPROVATO_CLIENTE":            ["PUBBLICATO"],
    "PUBBLICATO":                   ["ARCHIVIATO"],
    "ARCHIVIATO":                   [],
}

_STATO_NOTIFICHE: dict[str, tuple[str, str]] = {
    "IN_REVISIONE_INTERNA":        ("INFO",     "Contenuto in revisione interna"),
    "MODIFICHE_RICHIESTE_INTERNE": ("WARNING",  "Modifiche richieste"),
    "APPROVATO_INTERNAMENTE":      ("INFO",     "Approvato internamente - pronto per il cliente"),
    "INVIATO_AL_CLIENTE":          ("INFO",     "Inviato al cliente per approvazione"),
    "MODIFICHE_RICHIESTE_CLIENTE": ("WARNING",  "Il cliente ha richiesto modifiche"),
    "APPROVATO_CLIENTE":           ("INFO",     "Approvato dal cliente!"),
    "PUBBLICATO":                  ("INFO",     "Contenuto pubblicato"),
}

def _contenuto_event_to_dict(evento) -> dict:
    return {
        "id": str(evento.id),
        "stato_precedente": evento.stato_precedente,
        "stato_nuovo": evento.stato_nuovo,
        "nota": evento.nota,
        "autore_id": str(evento.autore_id) if evento.autore_id else None,
        "autore_nome": (
            f"{evento.autore.nome} {evento.autore.cognome}"
            if getattr(evento, "autore", None) else None
        ),
        "created_at": evento.created_at.isoformat(),
    }


def _parse_optional_uuid_field(value, field_name: str) -> Optional[uuid.UUID]:
    if value in (None, ""):
        return None
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"Campo '{field_name}' non valido")


def _parse_optional_date_field(value, field_name: str) -> Optional[date]:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"Campo '{field_name}' non valido")


def _parse_contenuto_tipo_field(value, field_name: str = "tipo"):
    from app.models.models import ContenutoTipo

    if value in (None, ""):
        return None
    try:
        return ContenutoTipo(str(value))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"Campo '{field_name}' non valido")


def _is_content_manager(user: User) -> bool:
    return is_content_manager_role(getattr(user, "ruolo", None))


def _is_limited_content_user(user: User) -> bool:
    return is_limited_content_role(getattr(user, "ruolo", None))


async def _validate_contenuto_relations(
    db: AsyncSession,
    commessa_id: Optional[uuid.UUID],
    progetto_id: Optional[uuid.UUID],
    assegnatario_id: Optional[uuid.UUID],
) -> None:
    from app.models.models import Commessa, CommessaProgetto, Progetto

    if assegnatario_id:
        assignee_result = await db.execute(
            select(User).where(User.id == assegnatario_id, User.attivo == True)
        )
        if not assignee_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Assegnatario non valido o non attivo")

    if commessa_id:
        commessa_result = await db.execute(select(Commessa.id).where(Commessa.id == commessa_id))
        if not commessa_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Commessa non trovata")

    if progetto_id:
        progetto_result = await db.execute(select(Progetto.id).where(Progetto.id == progetto_id))
        if not progetto_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Progetto non trovato")

    if commessa_id and progetto_id:
        link_result = await db.execute(
            select(CommessaProgetto.id).where(
                CommessaProgetto.commessa_id == commessa_id,
                CommessaProgetto.progetto_id == progetto_id,
            )
        )
        if not link_result.scalar_one_or_none():
            raise HTTPException(
                status_code=422,
                detail="Il progetto selezionato non appartiene alla commessa indicata",
            )


def _contenuto_to_dict(c) -> dict:
    return {
        "id": str(c.id),
        "titolo": c.titolo,
        "tipo": c.tipo,
        "stato": c.stato,
        "commessa_id": str(c.commessa_id) if c.commessa_id else None,
        "progetto_id": str(c.progetto_id) if c.progetto_id else None,
        "assegnatario_id": str(c.assegnatario_id) if c.assegnatario_id else None,
        "assegnatario_nome": f"{c.assegnatario.nome} {c.assegnatario.cognome}" if c.assegnatario else None,
        "cliente_nome": c.commessa.cliente.ragione_sociale if (c.commessa and hasattr(c.commessa, "cliente") and c.commessa.cliente) else None,
        "data_consegna_prevista": str(c.data_consegna_prevista) if c.data_consegna_prevista else None,
        "url_preview": c.url_preview,
        "testo": c.testo,
        "note_revisione": c.note_revisione,
        "approvato_da": str(c.approvato_da) if c.approvato_da else None,
        "approvato_at": c.approvato_at.isoformat() if c.approvato_at else None,
        "pubblicato_at": c.pubblicato_at.isoformat() if c.pubblicato_at else None,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
        "transizioni_possibili": _STATO_TRANSITIONS.get(c.stato, []),
        "eventi": [_contenuto_event_to_dict(e) for e in getattr(c, "eventi", [])],
    }


@router.get("/contenuti", tags=["Contenuti"])
async def list_contenuti(
    commessa_id: Optional[uuid.UUID] = Query(None),
    stato: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    assegnatario_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import Contenuto, ContenutoEvento, Commessa
    from sqlalchemy.orm import selectinload as sil
    q = select(Contenuto).options(
        sil(Contenuto.assegnatario),
        sil(Contenuto.commessa).selectinload(Commessa.cliente),
        sil(Contenuto.eventi).selectinload(ContenutoEvento.autore),
    ).order_by(Contenuto.created_at.desc())
    if commessa_id:
        q = q.where(Contenuto.commessa_id == commessa_id)
    if stato:
        q = q.where(Contenuto.stato == stato)
    if tipo:
        q = q.where(Contenuto.tipo == tipo)
    if assegnatario_id:
        q = q.where(Contenuto.assegnatario_id == assegnatario_id)
    if _is_limited_content_user(current_user):
        q = q.where(Contenuto.assegnatario_id == current_user.id)
    result = await db.execute(q)
    return [_contenuto_to_dict(c) for c in result.scalars().unique().all()]


@router.post("/contenuti", status_code=201, tags=["Contenuti"])
async def create_contenuto(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import Contenuto, ContenutoEvento, ContenutoStatus, ContenutoTipo, Commessa
    from sqlalchemy.orm import selectinload as sil
    can_manage_content = _is_content_manager(current_user)
    requested_assignee_id = _parse_optional_uuid_field(
        data.get("assegnatario_id", current_user.id),
        "assegnatario_id",
    )
    if not can_assign_content_to_user(can_manage_content, requested_assignee_id, current_user.id):
        raise HTTPException(status_code=403, detail="Non puoi assegnare contenuti ad altri utenti")

    commessa_id = _parse_optional_uuid_field(data.get("commessa_id"), "commessa_id")
    progetto_id = _parse_optional_uuid_field(data.get("progetto_id"), "progetto_id")
    if not can_link_new_content_to_scope(can_manage_content, commessa_id, progetto_id):
        raise HTTPException(
            status_code=403,
            detail="Solo PM/Admin/Developer possono collegare nuovi contenuti a commesse o progetti",
        )
    assegnatario_id = requested_assignee_id if can_manage_content else current_user.id
    await _validate_contenuto_relations(db, commessa_id, progetto_id, assegnatario_id)

    c = Contenuto(
        id=uuid.uuid4(),
        titolo=data.get("titolo", "Senza titolo"),
        tipo=_parse_contenuto_tipo_field(data.get("tipo"), "tipo") or ContenutoTipo.POST_SOCIAL,
        stato=ContenutoStatus.BOZZA,
        commessa_id=commessa_id,
        progetto_id=progetto_id,
        assegnatario_id=assegnatario_id,
        data_consegna_prevista=_parse_optional_date_field(data.get("data_consegna_prevista"), "data_consegna_prevista"),
        url_preview=data.get("url_preview"),
        testo=data.get("testo"),
        note_revisione=data.get("note_revisione"),
    )
    db.add(c)
    db.add(ContenutoEvento(
        id=uuid.uuid4(),
        contenuto_id=c.id,
        autore_id=current_user.id,
        stato_precedente=None,
        stato_nuovo=ContenutoStatus.BOZZA,
        nota=data.get("note_revisione"),
    ))
    await db.commit()
    result = await db.execute(
        select(Contenuto)
        .options(
            sil(Contenuto.assegnatario),
            sil(Contenuto.commessa).selectinload(Commessa.cliente),
            sil(Contenuto.eventi).selectinload(ContenutoEvento.autore),
        )
        .where(Contenuto.id == c.id)
    )
    return _contenuto_to_dict(result.unique().scalar_one())


@router.put("/contenuti/{contenuto_id}", tags=["Contenuti"])
async def update_contenuto(
    contenuto_id: uuid.UUID,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import Contenuto, ContenutoEvento, Commessa
    from sqlalchemy.orm import selectinload as sil
    can_manage_content = _is_content_manager(current_user)
    result = await db.execute(
        select(Contenuto).options(
            sil(Contenuto.assegnatario),
            sil(Contenuto.commessa).selectinload(Commessa.cliente),
            sil(Contenuto.eventi).selectinload(ContenutoEvento.autore),
        )
        .where(Contenuto.id == contenuto_id)
    )
    c = result.unique().scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")
    if _is_limited_content_user(current_user) and c.assegnatario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permesso negato")
    for field in ("titolo", "url_preview", "testo", "note_revisione", "data_consegna_prevista"):
        if field in data:
            val = data[field]
            if val == "":
                val = None
            if field == "data_consegna_prevista" and val:
                val = _parse_optional_date_field(val, "data_consegna_prevista")
            setattr(c, field, val)

    if "tipo" in data:
        parsed_tipo = _parse_contenuto_tipo_field(data.get("tipo"), "tipo")
        if parsed_tipo is not None:
            c.tipo = parsed_tipo

    next_commessa_id = c.commessa_id
    next_progetto_id = c.progetto_id
    next_assegnatario_id = c.assegnatario_id

    if "commessa_id" in data:
        next_commessa_id = _parse_optional_uuid_field(data.get("commessa_id"), "commessa_id")
        if not can_change_content_scope(can_manage_content, c.commessa_id, next_commessa_id):
            raise HTTPException(status_code=403, detail="Non puoi cambiare la commessa del contenuto")

    if "progetto_id" in data:
        next_progetto_id = _parse_optional_uuid_field(data.get("progetto_id"), "progetto_id")
        if not can_change_content_scope(can_manage_content, c.progetto_id, next_progetto_id):
            raise HTTPException(status_code=403, detail="Non puoi cambiare il progetto del contenuto")

    if "assegnatario_id" in data:
        next_assegnatario_id = _parse_optional_uuid_field(data.get("assegnatario_id"), "assegnatario_id")
        if not can_change_content_scope(can_manage_content, c.assegnatario_id, next_assegnatario_id):
            raise HTTPException(status_code=403, detail="Non puoi riassegnare il contenuto")

    await _validate_contenuto_relations(db, next_commessa_id, next_progetto_id, next_assegnatario_id)
    c.commessa_id = next_commessa_id
    c.progetto_id = next_progetto_id
    c.assegnatario_id = next_assegnatario_id
    await db.commit()
    result = await db.execute(
        select(Contenuto)
        .options(
            sil(Contenuto.assegnatario),
            sil(Contenuto.commessa).selectinload(Commessa.cliente),
            sil(Contenuto.eventi).selectinload(ContenutoEvento.autore),
        )
        .where(Contenuto.id == contenuto_id)
    )
    return _contenuto_to_dict(result.unique().scalar_one())


@router.put("/contenuti/{contenuto_id}/stato", tags=["Contenuti"])
async def cambia_stato_contenuto(
    contenuto_id: uuid.UUID,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import Contenuto, ContenutoEvento, ContenutoStatus
    from app.services.notification_service import create_notification
    from sqlalchemy.orm import selectinload as sil
    from app.models.models import Commessa

    result = await db.execute(
        select(Contenuto)
        .options(sil(Contenuto.assegnatario), sil(Contenuto.commessa).selectinload(Commessa.cliente))
        .where(Contenuto.id == contenuto_id)
    )
    c = result.unique().scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")

    nuovo_stato = data.get("stato")
    if not nuovo_stato:
        raise HTTPException(status_code=400, detail="Campo 'stato' obbligatorio")

    transizioni_ok = _STATO_TRANSITIONS.get(c.stato, [])
    if nuovo_stato not in transizioni_ok:
        raise HTTPException(status_code=422, detail=f"Transizione non consentita: {c.stato} -> {nuovo_stato}")

    # Permessi: solo PM/ADMIN possono approvare o inviare al cliente
    stati_pm_only = {"APPROVATO_INTERNAMENTE", "INVIATO_AL_CLIENTE", "APPROVATO_CLIENTE", "PUBBLICATO"}
    if nuovo_stato in stati_pm_only and current_user.ruolo not in (UserRole.ADMIN, UserRole.PM, UserRole.DEVELOPER):
        raise HTTPException(status_code=403, detail="Permesso negato")
    if _is_limited_content_user(current_user) and c.assegnatario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permesso negato")
    if nuovo_stato in {"MODIFICHE_RICHIESTE_INTERNE", "MODIFICHE_RICHIESTE_CLIENTE"} and not data.get("note_revisione"):
        raise HTTPException(status_code=422, detail="Inserisci una nota revisione per richiedere modifiche")

    vecchio_stato = c.stato
    c.stato = nuovo_stato
    if data.get("note_revisione"):
        c.note_revisione = data["note_revisione"]
    if nuovo_stato in ("APPROVATO_INTERNAMENTE", "APPROVATO_CLIENTE"):
        c.approvato_da = current_user.id
        c.approvato_at = datetime.now()
    if nuovo_stato == "PUBBLICATO":
        c.pubblicato_at = datetime.now()
    db.add(ContenutoEvento(
        id=uuid.uuid4(),
        contenuto_id=c.id,
        autore_id=current_user.id,
        stato_precedente=vecchio_stato,
        stato_nuovo=nuovo_stato,
        nota=data.get("note_revisione"),
    ))

    await db.commit()

    # Notifiche automatiche
    notif_info = _STATO_NOTIFICHE.get(nuovo_stato)
    if notif_info and c.assegnatario_id:
        tipo_notif, msg_suffix = notif_info
        cliente_str = ""
        if c.commessa and c.commessa.cliente:
            cliente_str = f" - {c.commessa.cliente.ragione_sociale}"
        msg = f'"{c.titolo}"{cliente_str}: {msg_suffix}'
        # Notifica assegnatario
        await create_notification(db, c.assegnatario_id, f"Aggiornamento contenuto", msg, tipo_notif, f"/contenuti")
        # Se in revisione interna, notifica PM/ADMIN
        if nuovo_stato == "IN_REVISIONE_INTERNA":
            pm_result = await db.execute(select(User).where(User.ruolo.in_([UserRole.ADMIN, UserRole.PM])))
            for pm in pm_result.scalars().all():
                if pm.id != current_user.id:
                    await create_notification(db, pm.id, "Contenuto da revisionare", msg, "INFO", "/contenuti")

    return {"id": str(c.id), "stato_precedente": vecchio_stato, "stato_nuovo": nuovo_stato}


@router.delete("/contenuti/{contenuto_id}", status_code=204, tags=["Contenuti"])
async def delete_contenuto(
    contenuto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import Contenuto
    result = await db.execute(select(Contenuto).where(Contenuto.id == contenuto_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")
    if c.assegnatario_id != current_user.id and current_user.ruolo not in (UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM):
        raise HTTPException(status_code=403, detail="Permesso negato")
    await db.delete(c)
    await db.commit()


# ── BUDGET ────────────────────────────────────────────────

def _normalize_budget_month(value: str | date) -> date:
    if isinstance(value, date):
        return value.replace(day=1)

    raw = (value or "").strip()
    try:
        if len(raw) == 7:
            return datetime.strptime(f"{raw}-01", "%Y-%m-%d").date()
        return date.fromisoformat(raw).replace(day=1)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Formato mese non valido. Usa YYYY-MM o YYYY-MM-DD") from exc


def _normalize_budget_category_name(value: Optional[str]) -> str:
    return (value or "").strip().casefold()


def _budget_status(percentuale_utilizzo: float) -> str:
    if percentuale_utilizzo > 100:
        return "over"
    if percentuale_utilizzo >= 80:
        return "warning"
    return "ok"


def _budget_periodicity_divisor(periodicita: Optional[str]) -> Decimal:
    value = (periodicita or "").strip().lower()
    if "semes" in value:
        return Decimal("6")
    if "annual" in value or "annua" in value:
        return Decimal("12")
    return Decimal("1")


def _budget_fixed_cost_amount_for_month(costo_fisso, mese_start: date) -> Decimal:
    if not costo_fisso.attivo and not costo_fisso.data_fine:
        return Decimal("0")

    start_month = (costo_fisso.data_inizio or mese_start).replace(day=1)
    end_month = (costo_fisso.data_fine or mese_start).replace(day=1)

    if mese_start < start_month or mese_start > end_month:
        return Decimal("0")

    amount = Decimal(costo_fisso.importo or 0)
    divisor = _budget_periodicity_divisor(costo_fisso.periodicita)
    return (amount / divisor).quantize(Decimal("0.01")) if divisor > 0 else amount


async def _build_budget_variance_rows(
    db: AsyncSession,
    mese_start: date,
    *,
    notify_admins: bool = False,
) -> list[BudgetVarianceOut]:
    from dateutil.relativedelta import relativedelta
    from app.models.models import (
        BudgetCategory,
        BudgetMensile,
        CostoFisso,
        FatturaPassiva,
        FatturaPassivaImputazione,
        MovimentoCassa,
        MovimentoCassaImputazione,
        Notification,
    )

    next_month = mese_start + relativedelta(months=1)

    res_cats = await db.execute(select(BudgetCategory).order_by(BudgetCategory.nome))
    categories = res_cats.scalars().all()
    categories_by_key = {_normalize_budget_category_name(cat.nome): cat for cat in categories}

    res_budgets = await db.execute(select(BudgetMensile).where(BudgetMensile.mese_competenza == mese_start))
    budgets_map = {b.categoria_id: b for b in res_budgets.scalars().all()}

    spent_by_category: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    res_costi_fissi = await db.execute(
        select(CostoFisso).where(
            and_(
                CostoFisso.attivo == True,
                or_(CostoFisso.data_fine == None, CostoFisso.data_fine >= mese_start),
            )
        )
    )
    for costo in res_costi_fissi.scalars().all():
        key = _normalize_budget_category_name(costo.categoria)
        if key in categories_by_key:
            spent_by_category[key] += _budget_fixed_cost_amount_for_month(costo, mese_start)

    res_invoice_alloc = await db.execute(
        select(
            FatturaPassivaImputazione.fattura_passiva_id,
            func.coalesce(func.sum(FatturaPassivaImputazione.importo), 0),
        )
        .join(FatturaPassiva, FatturaPassivaImputazione.fattura_passiva_id == FatturaPassiva.id)
        .where(
            and_(
                FatturaPassiva.data_emissione >= mese_start,
                FatturaPassiva.data_emissione < next_month,
            )
        )
        .group_by(FatturaPassivaImputazione.fattura_passiva_id)
    )
    invoice_alloc_map = {row[0]: Decimal(row[1] or 0) for row in res_invoice_alloc.all()}

    res_invoices = await db.execute(
        select(FatturaPassiva.id, FatturaPassiva.categoria, FatturaPassiva.importo_totale).where(
            and_(
                FatturaPassiva.data_emissione >= mese_start,
                FatturaPassiva.data_emissione < next_month,
            )
        )
    )
    for invoice_id, categoria, importo_totale in res_invoices.all():
        key = _normalize_budget_category_name(categoria)
        if key not in categories_by_key:
            continue
        spent_by_category[key] += invoice_alloc_map.get(invoice_id) or Decimal(importo_totale or 0)

    res_movement_alloc = await db.execute(
        select(
            MovimentoCassaImputazione.movimento_id,
            func.coalesce(func.sum(MovimentoCassaImputazione.importo), 0),
        )
        .join(MovimentoCassa, MovimentoCassaImputazione.movimento_id == MovimentoCassa.id)
        .where(
            and_(
                MovimentoCassa.data_valuta >= mese_start,
                MovimentoCassa.data_valuta < next_month,
                MovimentoCassa.importo < 0,
                MovimentoCassa.fattura_passiva_id == None,
            )
        )
        .group_by(MovimentoCassaImputazione.movimento_id)
    )
    movement_alloc_map = {row[0]: Decimal(row[1] or 0) for row in res_movement_alloc.all()}

    res_movements = await db.execute(
        select(MovimentoCassa.id, MovimentoCassa.categoria, MovimentoCassa.importo).where(
            and_(
                MovimentoCassa.data_valuta >= mese_start,
                MovimentoCassa.data_valuta < next_month,
                MovimentoCassa.importo < 0,
                MovimentoCassa.fattura_passiva_id == None,
            )
        )
    )
    for movimento_id, categoria, importo in res_movements.all():
        key = _normalize_budget_category_name(categoria)
        if key not in categories_by_key:
            continue
        allocated = movement_alloc_map.get(movimento_id)
        amount = Decimal(allocated if allocated and allocated > 0 else abs(importo or 0))
        spent_by_category[key] += amount

    rows: list[BudgetVarianceOut] = []
    over_items: list[BudgetVarianceOut] = []
    for category in categories:
        budget_row = budgets_map.get(category.id)
        budget_amount = Decimal(budget_row.importo_budget or 0) if budget_row else Decimal("0")
        spent_amount = spent_by_category[_normalize_budget_category_name(category.nome)]
        variance_amount = spent_amount - budget_amount
        usage_pct = float(spent_amount / budget_amount * 100) if budget_amount > 0 else (100.0 if spent_amount > 0 else 0.0)
        variance_pct = float(variance_amount / budget_amount * 100) if budget_amount > 0 else (100.0 if spent_amount > 0 else 0.0)
        row = BudgetVarianceOut(
            categoria_id=category.id,
            categoria_nome=category.nome,
            categoria_colore=category.colore or "#7c3aed",
            budget=budget_amount.quantize(Decimal("0.01")),
            speso=spent_amount.quantize(Decimal("0.01")),
            varianza=variance_amount.quantize(Decimal("0.01")),
            varianza_pct=round(variance_pct, 1),
            percentuale_utilizzo=round(usage_pct, 1),
            status=_budget_status(usage_pct),
            note=budget_row.note if budget_row else None,
        )
        rows.append(row)
        if row.percentuale_utilizzo > 110:
            over_items.append(row)

    if notify_admins and over_items:
        admins_res = await db.execute(
            select(User).where(
                User.attivo == True,
                User.ruolo == UserRole.ADMIN,
            )
        )
        admins = admins_res.scalars().all()
        month_start_dt = datetime.combine(mese_start, datetime.min.time())
        next_month_dt = datetime.combine(next_month, datetime.min.time())
        link = f"/budget?mese={mese_start.isoformat()}"

        for item in over_items:
            title = f"Budget oltre soglia: {item.categoria_nome}"
            message = (
                f"{item.categoria_nome} ha superato il budget del {item.varianza_pct:.1f}% "
                f"({item.speso}€ vs {item.budget}€) nel mese {mese_start.strftime('%m/%Y')}"
            )
            for admin in admins:
                existing = await db.execute(
                    select(Notification.id).where(
                        and_(
                            Notification.user_id == admin.id,
                            Notification.title == title,
                            Notification.link == link,
                            Notification.created_at >= month_start_dt,
                            Notification.created_at < next_month_dt,
                        )
                    )
                )
                if existing.scalar_one_or_none():
                    continue
                db.add(Notification(
                    user_id=admin.id,
                    type="ERROR",
                    title=title,
                    message=message,
                    link=link,
                ))

    return rows


@router.get("/budget/categorie", response_model=List[BudgetCategoryOut], tags=["Budget"])
async def list_budget_categories_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    from app.models.models import BudgetCategory
    result = await db.execute(select(BudgetCategory).order_by(BudgetCategory.nome))
    return result.scalars().all()

@router.post("/budget/categorie", response_model=BudgetCategoryOut, status_code=201, tags=["Budget"])
async def create_budget_category_endpoint(
    data: BudgetCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    from app.models.models import BudgetCategory
    cat = BudgetCategory(**data.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat

@router.get("/budget", response_model=List[BudgetMensileOut], tags=["Budget"])
async def get_budgets_endpoint(
    mese: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    from app.models.models import BudgetMensile
    from sqlalchemy.orm import selectinload
    mese_start = mese.replace(day=1)
    result = await db.execute(
        select(BudgetMensile).options(selectinload(BudgetMensile.categoria))
        .where(BudgetMensile.mese_competenza == mese_start)
    )
    return result.scalars().all()

@router.post("/budget", response_model=BudgetMensileOut, status_code=201, tags=["Budget"])
async def upsert_budget_endpoint(
    data: BudgetMensileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    from app.models.models import BudgetMensile
    from sqlalchemy.orm import selectinload
    mese_start = data.mese_competenza.replace(day=1)
    
    # Upsert logic
    stmt = select(BudgetMensile).where(
        BudgetMensile.categoria_id == data.categoria_id,
        BudgetMensile.mese_competenza == mese_start
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    
    if existing:
        existing.importo_budget = data.importo_budget
        existing.note = data.note
        b = existing
    else:
        b = BudgetMensile(
            categoria_id=data.categoria_id,
            mese_competenza=mese_start,
            importo_budget=data.importo_budget,
            note=data.note
        )
        db.add(b)

    await db.commit()
    # re-fetch con categoria eager: BudgetMensileOut espone la relazione `categoria` (lazy dopo refresh).
    res2 = await db.execute(
        select(BudgetMensile).where(BudgetMensile.id == b.id).options(selectinload(BudgetMensile.categoria))
    )
    return res2.scalar_one()

@router.post("/budget/copia", tags=["Budget"])
async def copy_prev_month_budget(
    mese_corrente: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    from app.models.models import BudgetMensile
    from dateutil.relativedelta import relativedelta
    
    current_start = mese_corrente.replace(day=1)
    prev_start = current_start - relativedelta(months=1)
    
    # Get prev budgets
    res_prev = await db.execute(select(BudgetMensile).where(BudgetMensile.mese_competenza == prev_start))
    prev_budgets = res_prev.scalars().all()
    
    count = 0
    for pb in prev_budgets:
        # Check if already exists for current
        res_curr = await db.execute(select(BudgetMensile).where(
            BudgetMensile.categoria_id == pb.categoria_id,
            BudgetMensile.mese_competenza == current_start
        ))
        if not res_curr.scalar_one_or_none():
            new_b = BudgetMensile(
                categoria_id=pb.categoria_id,
                mese_competenza=current_start,
                importo_budget=pb.importo_budget,
                note=pb.note
            )
            db.add(new_b)
            count += 1
            
    await db.commit()
    return {"status": "ok", "clonati": count}

@router.get("/budget/variance", response_model=List[BudgetVarianceOut], tags=["Budget"])
async def get_budget_variance(
    mese: str = Query(..., description="Formato YYYY-MM oppure YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    mese_start = _normalize_budget_month(mese)
    rows = await _build_budget_variance_rows(db, mese_start, notify_admins=True)
    await db.commit()
    return rows

@router.get("/budget/trend", response_model=BudgetTrendOut, tags=["Budget"])
async def get_budget_trend(
    mesi: int = Query(6, ge=1, le=12),
    mese_fine: Optional[str] = Query(None, description="Mese finale opzionale, formato YYYY-MM"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    from dateutil.relativedelta import relativedelta

    end_month = _normalize_budget_month(mese_fine or date.today())
    month_list = [end_month - relativedelta(months=offset) for offset in reversed(range(mesi))]
    labels: list[str] = []
    series_map: dict[uuid.UUID, dict] = {}

    for month_start in month_list:
        labels.append(month_start.strftime("%Y-%m"))
        rows = await _build_budget_variance_rows(db, month_start)
        for row in rows:
            series = series_map.setdefault(row.categoria_id, {
                "categoria_id": row.categoria_id,
                "categoria_nome": row.categoria_nome,
                "categoria_colore": row.categoria_colore,
                "data": [],
            })
            series["data"].append(BudgetTrendPointOut(
                mese=month_start.strftime("%Y-%m"),
                budget=row.budget,
                speso=row.speso,
                varianza=row.varianza,
                varianza_pct=row.varianza_pct,
                percentuale_utilizzo=row.percentuale_utilizzo,
                status=row.status,
            ))

    ordered_series = [
        BudgetTrendSeriesOut(**series_map[key])
        for key in sorted(series_map, key=lambda category_id: series_map[category_id]["categoria_nome"].lower())
    ]
    return BudgetTrendOut(mesi=labels, series=ordered_series)

@router.get("/budget/consuntivo", response_model=List[BudgetConsuntivoOut], tags=["Budget"])
async def get_budget_consuntivo(
    mese: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access)
):
    from app.models.models import BudgetCategory, BudgetMensile, MovimentoCassa, FatturaPassiva, Notification
    from sqlalchemy import and_, or_
    
    mese_start = mese.replace(day=1)
    from dateutil.relativedelta import relativedelta
    next_month = mese_start + relativedelta(months=1)
    
    # 1. Get Categories and Budgets
    res_cats = await db.execute(select(BudgetCategory))
    categories = res_cats.scalars().all()
    
    res_budgets = await db.execute(select(BudgetMensile).where(BudgetMensile.mese_competenza == mese_start))
    budgets_map = {b.categoria_id: b for b in res_budgets.scalars().all()}
    
    # 2. Get Expenses (Cassa + Fatture)
    # Movimenti Cassa (Negative only, to avoid doubling if pay is revenue)
    # Filter out if already linked to fattura_passiva
    res_m = await db.execute(
        select(MovimentoCassa).where(
            and_(
                MovimentoCassa.data_valuta >= mese_start,
                MovimentoCassa.data_valuta < next_month,
                MovimentoCassa.importo < 0,
                MovimentoCassa.fattura_passiva_id == None
            )
        )
    )
    movements = res_m.scalars().all()
    
    # Fatture Passive
    res_f = await db.execute(
        select(FatturaPassiva).where(
            and_(
                FatturaPassiva.data_emissione >= mese_start,
                FatturaPassiva.data_emissione < next_month
            )
        )
    )
    invoices = res_f.scalars().all()
    
    # 3. Aggregate by category name matching
    results = []
    for cat in categories:
        b = budgets_map.get(cat.id)
        budget_amt = b.importo_budget if b else Decimal("0")
        
        # Spent from cassa
        spent_cassa = sum(abs(m.importo) for m in movements if m.categoria == cat.nome)
        # Spent from fatture
        spent_fatture = sum(f.importo_totale for f in invoices if f.categoria == cat.nome)
        
        total_spent = Decimal(str(spent_cassa)) + Decimal(str(spent_fatture))
        
        rimanente = budget_amt - total_spent
        perc = (float(total_spent) / float(budget_amt) * 100) if budget_amt > 0 else (100.0 if total_spent > 0 else 0.0)
        
        # 4. Handle Alerts (Notifications)
        if budget_amt > 0:
            threshold_80 = budget_amt * Decimal("0.8")
            threshold_100 = budget_amt
            
            alert_type = None
            msg = ""
            
            if total_spent >= threshold_100:
                alert_type = "ERROR"
                msg = f"Budget SUPERATO per {cat.nome}: {total_spent}€ / {budget_amt}€"
            elif total_spent >= threshold_80:
                alert_type = "WARNING"
                msg = f"Budget quasi esaurito (80%) per {cat.nome}: {total_spent}€ / {budget_amt}€"

            if alert_type:
                # Check if notification already exists for this month/category/type
                check_stmt = select(Notification).where(
                    and_(
                        Notification.type == alert_type,
                        Notification.title.like(f"%{cat.nome}%"),
                        Notification.created_at >= datetime.combine(mese_start, datetime.min.time())
                    )
                )
                res_check = await db.execute(check_stmt)
                if not res_check.scalar_one_or_none():
                    new_notif = Notification(
                        user_id=current_user.id,
                        type=alert_type,
                        title=f"Alert Budget: {cat.nome}",
                        message=msg,
                        link=f"/budget?mese={mese_start.isoformat()}"
                    )
                    db.add(new_notif)
        
        results.append(BudgetConsuntivoOut(
            categoria_id=cat.id,
            categoria_nome=cat.nome,
            categoria_colore=cat.colore or "#7c3aed",
            importo_budget=budget_amt,
            importo_speso=total_spent,
            rimanente=rimanente,
            percentuale=round(perc, 1),
            note=b.note if b else None
        ))
    
    await db.commit()
    return results


# ── WIKI ──────────────────────────────────────────────────

@router.get("/wiki/categorie", response_model=List[WikiCategoriaOut], tags=["Wiki"])
async def list_wiki_categories_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import WikiCategoria
    result = await db.execute(select(WikiCategoria).order_by(WikiCategoria.ordine, WikiCategoria.nome))
    return result.scalars().all()

@router.post("/wiki/categorie", response_model=WikiCategoriaOut, status_code=201, tags=["Wiki"])
async def create_wiki_category_endpoint(
    data: WikiCategoriaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import WikiCategoria
    cat = WikiCategoria(**data.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat

@router.get("/wiki/articoli", response_model=List[WikiArticoloOut], tags=["Wiki"])
async def list_wiki_articles_endpoint(
    categoria_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import WikiArticolo
    from sqlalchemy.orm import joinedload
    stmt = select(WikiArticolo).options(joinedload(WikiArticolo.autore), joinedload(WikiArticolo.categoria))
    if categoria_id:
        stmt = stmt.where(WikiArticolo.categoria_id == categoria_id)
    result = await db.execute(stmt.order_by(WikiArticolo.ultimo_aggiornamento.desc()))
    articles = result.scalars().all()
    for a in articles:
        a.autore_nome = f"{a.autore.nome} {a.autore.cognome}" if a.autore else "Anonimo"
    
    return articles

@router.get("/wiki/articoli/{articolo_id}", response_model=WikiArticoloOut, tags=["Wiki"])
async def get_wiki_article_endpoint(
    articolo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import WikiArticolo
    from sqlalchemy.orm import joinedload
    stmt = select(WikiArticolo).options(joinedload(WikiArticolo.autore), joinedload(WikiArticolo.categoria)).where(WikiArticolo.id == articolo_id)
    result = await db.execute(stmt)
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Articolo non trovato")
    
    # Increment views
    article.visualizzazioni += 1
    await db.commit()
    # re-fetch con autore+categoria eager (il refresh espirerebbe le relazioni -> lazy-load 500)
    return await _reload_wiki_article(db, articolo_id)

async def _reload_wiki_article(db: AsyncSession, article_id: uuid.UUID):
    """Re-fetch articolo wiki con autore+categoria eager-caricati: WikiArticoloOut espone la relazione
    `categoria`, che dopo un semplice db.refresh() resterebbe lazy -> MissingGreenlet alla serializzazione."""
    from app.models.models import WikiArticolo
    from sqlalchemy.orm import joinedload
    res = await db.execute(
        select(WikiArticolo)
        .options(joinedload(WikiArticolo.autore), joinedload(WikiArticolo.categoria))
        .where(WikiArticolo.id == article_id)
    )
    article = res.scalar_one()
    article.autore_nome = f"{article.autore.nome} {article.autore.cognome}" if article.autore else "Anonimo"
    return article


@router.post("/wiki/articoli", response_model=WikiArticoloOut, status_code=201, tags=["Wiki"])
async def create_wiki_article_endpoint(
    data: WikiArticoloCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import WikiArticolo
    art = WikiArticolo(**data.model_dump(), autore_id=current_user.id)
    db.add(art)
    await db.commit()
    return await _reload_wiki_article(db, art.id)

@router.patch("/wiki/articoli/{articolo_id}", response_model=WikiArticoloOut, tags=["Wiki"])
async def update_wiki_article_endpoint(
    articolo_id: uuid.UUID,
    data: WikiArticoloUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import WikiArticolo
    stmt = select(WikiArticolo).where(WikiArticolo.id == articolo_id)
    res = await db.execute(stmt)
    article = res.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Articolo non trovato")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(article, key, value)

    await db.commit()
    return await _reload_wiki_article(db, articolo_id)

@router.delete("/wiki/articoli/{articolo_id}", tags=["Wiki"])
async def delete_wiki_article_endpoint(
    articolo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import WikiArticolo
    stmt = select(WikiArticolo).where(WikiArticolo.id == articolo_id)
    res = await db.execute(stmt)
    article = res.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Articolo non trovato")
    
    await db.delete(article)
    await db.commit()
    return {"status": "ok"}

@router.get("/wiki/cerca", response_model=List[WikiArticoloOut], tags=["Wiki"])
async def search_wiki_articles_endpoint(
    q: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import WikiArticolo
    from sqlalchemy.orm import joinedload
    from sqlalchemy import or_
    
    stmt = select(WikiArticolo).options(joinedload(WikiArticolo.autore), joinedload(WikiArticolo.categoria)).where(
        or_(
            WikiArticolo.titolo.ilike(f"%{q}%"),
            WikiArticolo.contenuto.ilike(f"%{q}%")
        )
    ).order_by(WikiArticolo.ultimo_aggiornamento.desc())
    
    result = await db.execute(stmt)
    articles = result.scalars().all()
    for a in articles:
        a.autore_nome = f"{a.autore.nome} {a.autore.cognome}" if a.autore else "Anonimo"
    return articles


# ═══════════════════════════════════════════════════════
# CRM
# ═══════════════════════════════════════════════════════


# ── CRM ───────────────────────────────────────────────────

@router.get("/crm/stadi", response_model=List[CRMStageOut], tags=["CRM"])
async def get_crm_stages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_erp_access),
):
    from sqlalchemy import select
    res = await db.execute(select(CRMStage).order_by(CRMStage.ordine))
    return res.scalars().all()

@router.post("/crm/stadi", response_model=CRMStageOut, status_code=201, tags=["CRM"])
async def add_crm_stage(
    data: CRMStageCreate,
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(require_admin)
):
    stage = CRMStage(**data.model_dump())
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    return stage

@router.patch("/crm/stadi/{stage_id}", response_model=CRMStageOut, tags=["CRM"])
async def update_crm_stage(
    stage_id: uuid.UUID,
    data: CRMStageUpdate,
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(require_admin)
):
    stage = await db.get(CRMStage, stage_id)
    if not stage: raise HTTPException(status_code=404)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(stage, k, v)
    await db.commit()
    await db.refresh(stage)
    return stage

@router.delete("/crm/stadi/{stage_id}", tags=["CRM"])
async def delete_crm_stage(
    stage_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(require_admin)
):
    stage = await db.get(CRMStage, stage_id)
    if not stage: raise HTTPException(status_code=404)
    # Check if any leads are in this stage
    from sqlalchemy import func
    res = await db.execute(select(func.count(CRMLead.id)).where(CRMLead.stadio_id == stage_id))
    if res.scalar_one() > 0:
        raise HTTPException(status_code=400, detail="Impossibile eliminare uno stadio con lead associati")
    await db.delete(stage)
    await db.commit()
    return {"success": True}

@router.get("/crm/lead", response_model=List[CRMLeadOut], tags=["CRM"])
async def get_crm_leads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import select, or_
    from sqlalchemy.orm import joinedload, selectinload
    from app.services.crm_service import CRMService
    
    stmt = select(CRMLead).options(
        joinedload(CRMLead.stadio),
        joinedload(CRMLead.assegnato_a),
        selectinload(CRMLead.attivita)
    )
    
    # Security: Se non è ADMIN, vedi solo i tuoi lead o quelli non assegnati? 
    # Di solito in un ERP vedi solo i tuoi.
    if current_user.ruolo != UserRole.ADMIN:
        stmt = stmt.where(or_(CRMLead.assegnato_a_id == current_user.id, CRMLead.assegnato_a_id == None))
        
    stmt = stmt.order_by(CRMLead.created_at.desc())
    res = await db.execute(stmt)
    leads = res.scalars().all()
    
    # Map virtual fields
    for l in leads:
        if l.assegnato_a:
            l.assegnato_a_nome = f"{l.assegnato_a.nome} {l.assegnato_a.cognome}"
            
    return leads

async def _reload_crm_lead(db: AsyncSession, lead_id: uuid.UUID):
    """Re-fetch lead con stadio+assegnato_a+attivita eager-caricati: CRMLeadOut espone le relazioni
    `stadio` e `attivita`, che dopo un semplice db.refresh() resterebbero lazy -> MissingGreenlet.
    Popola i campi virtuali assegnato_a_nome e autore_nome delle attività (come get_single_crm_lead)."""
    from sqlalchemy.orm import joinedload, selectinload
    res = await db.execute(
        select(CRMLead).where(CRMLead.id == lead_id).options(
            joinedload(CRMLead.stadio),
            joinedload(CRMLead.assegnato_a),
            selectinload(CRMLead.attivita),
        )
    )
    lead = res.scalar_one()
    if lead.assegnato_a:
        lead.assegnato_a_nome = f"{lead.assegnato_a.nome} {lead.assegnato_a.cognome}"
    for act in lead.attivita:
        author = await db.get(User, act.autore_id)
        if author:
            act.autore_nome = f"{author.nome} {author.cognome}"
    return lead


@router.post("/crm/lead", response_model=CRMLeadOut, status_code=201, tags=["CRM"])
async def add_crm_lead(
    data: CRMLeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lead = CRMLead(**data.model_dump())
    # Di default assegna a chi lo crea se non specificato
    if not lead.assegnato_a_id:
        lead.assegnato_a_id = current_user.id
    db.add(lead)
    await db.commit()
    return await _reload_crm_lead(db, lead.id)

@router.get("/crm/lead/{lead_id}", response_model=CRMLeadOut, tags=["CRM"])
async def get_single_crm_lead(
    lead_id: uuid.UUID, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload, selectinload
    stmt = select(CRMLead).where(CRMLead.id == lead_id).options(
        joinedload(CRMLead.stadio),
        joinedload(CRMLead.assegnato_a),
        selectinload(CRMLead.attivita)
    )
    res = await db.execute(stmt)
    lead = res.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead non trovato")
        
    # Security check
    if current_user.ruolo != UserRole.ADMIN and lead.assegnato_a_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non hai i permessi per visualizzare questo lead")
        
    if lead.assegnato_a:
        lead.assegnato_a_nome = f"{lead.assegnato_a.nome} {lead.assegnato_a.cognome}"
        
    # Add author names to activities
    for act in lead.attivita:
        author = await db.get(User, act.autore_id)
        if author:
            act.autore_nome = f"{author.nome} {author.cognome}"
            
    lead.suggerimento_ai = await CRMService.get_ai_suggestion(db, lead.id)
    return lead

@router.patch("/crm/lead/{lead_id}", response_model=CRMLeadOut, tags=["CRM"])
async def patch_crm_lead(
    lead_id: uuid.UUID, 
    data: CRMLeadUpdate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lead = await db.get(CRMLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead non trovato")
        
    # Security check
    if current_user.ruolo != UserRole.ADMIN and lead.assegnato_a_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non hai i permessi per modificare questo lead")
        
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lead, key, value)

    await db.commit()
    return await _reload_crm_lead(db, lead_id)

@router.delete("/crm/lead/{lead_id}", status_code=204, tags=["CRM"])
async def remove_crm_lead(
    lead_id: uuid.UUID, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lead = await db.get(CRMLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead non trovato")
        
    # Security check
    if current_user.ruolo != UserRole.ADMIN and lead.assegnato_a_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non hai i permessi per eliminare questo lead")
    await db.delete(lead)
    await db.commit()

@router.patch("/crm/lead/{lead_id}/stadio", tags=["CRM"])
async def update_lead_stage(
    lead_id: uuid.UUID, 
    stadio_id: uuid.UUID = Body(..., embed=True), 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lead = await db.get(CRMLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead non trovato")
        
    # Security check
    if current_user.ruolo != UserRole.ADMIN and lead.assegnato_a_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non hai i permessi per modificare questo lead")
    
    stage = await db.get(CRMStage, stadio_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Stadio non trovato")
        
    lead.stadio_id = stadio_id
    lead.probabilita_chiusura = stage.probabilita
    await db.commit()
    return {"message": "Stadio aggiornato con successo"}

@router.post("/crm/lead/{lead_id}/attivita", response_model=CRMActivityOut, tags=["CRM"])
async def add_crm_activity(lead_id: uuid.UUID, data: CRMActivityCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    lead = await db.get(CRMLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead non trovato")
        
    act = CRMActivity(**data.model_dump(), lead_id=lead_id, autore_id=current_user.id)
    db.add(act)
    await db.commit()
    await db.refresh(act)
    
    act.autore_nome = f"{current_user.nome} {current_user.cognome}"
    return act

@router.post("/crm/lead/{lead_id}/converti", tags=["CRM"])
async def convert_lead(
    lead_id: uuid.UUID, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import select
    lead = await db.get(CRMLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead non trovato")
        
    # Security check
    if current_user.ruolo != UserRole.ADMIN and lead.assegnato_a_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non hai i permessi per convertire questo lead")
        
    # 1. Crea Cliente
    new_client = Cliente(
        id=uuid.uuid4(),
        ragione_sociale=lead.nome_azienda,
        referente=lead.nome_contatto,
        email=lead.email,
        telefono=lead.telefono,
        note=f"Convertito da CRM lead il {date.today()}\n{lead.note or ''}"
    )
    db.add(new_client)
    await db.flush()

    # 2. Crea Progetto
    from app.models.models import Progetto, ProjectStatus, ProjectType
    new_project = Progetto(
        id=uuid.uuid4(),
        nome=f"Progetto {lead.nome_azienda}",
        cliente_id=new_client.id,
        stato=ProjectStatus.ATTESA,
        tipo=ProjectType.RETAINER, # Default
        note=f"Progetto creato automaticamente da conversione lead CRM."
    )
    db.add(new_project)
    
    # 3. Aggiorna Lead Stadio (Vinto)
    res_stadi = await db.execute(select(CRMStage).where(CRMStage.nome == 'Chiuso Vinto'))
    stadio_vinto = res_stadi.scalar_one_or_none()
    if stadio_vinto:
        lead.stadio_id = stadio_vinto.id
        lead.probabilita_chiusura = 100
        
    await db.commit()
    return {
        "message": "Lead convertito in cliente e progetto con successo", 
        "cliente_id": new_client.id,
        "progetto_id": new_project.id
    }

@router.get("/crm/statistiche", response_model=CRMStatsOut, tags=["CRM"])
async def get_crm_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from sqlalchemy import select, func
    
    # Valore totale e numero lead
    res_leads = await db.execute(select(CRMLead))
    all_leads = res_leads.scalars().all()
    
    valore_totale = sum(l.valore_stimato for l in all_leads)
    numero_attivi = len([l for l in all_leads if l.probabilita_chiusura < 100 and l.probabilita_chiusura > 0])
    
    # Tasso conversione
    res_vinti = await db.execute(select(func.count(CRMLead.id)).where(CRMLead.probabilita_chiusura == 100))
    vinti = res_vinti.scalar()
    totali = len(all_leads)
    tasso = (vinti / totali * 100) if totali > 0 else 0
    
    # Previsione ricavi
    previsione = sum((l.valore_stimato * Decimal(l.probabilita_chiusura / 100)) for l in all_leads)
    
    return {
        "valore_totale_pipeline": valore_totale,
        "numero_lead_attivi": numero_attivi,
        "tasso_conversione": tasso,
        "previsione_ricavi": previsione
    }


# ── PROGETTO TEMPLATES ───────────────────────────────────────
@router.get("/progetto-templates", response_model=List[ProgettoTemplateOut], tags=["ProgettoTemplates"])
async def list_progetto_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy.orm import selectinload as sil
    from app.models.models import ProgettoTemplate
    result = await db.execute(
        select(ProgettoTemplate)
        .options(sil(ProgettoTemplate.tasks), sil(ProgettoTemplate.milestones))
        .order_by(ProgettoTemplate.nome)
    )
    return result.scalars().unique().all()

@router.post("/progetto-templates/{id}/applica", tags=["ProgettoTemplates"])
async def applica_template_progetto(
    id: uuid.UUID,
    progetto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.models.models import Progetto, Task, TaskStatus, ProgettoMilestone, ProgettoTemplate
    template = await db.get(ProgettoTemplate, id)
    if not template: raise HTTPException(status_code=404, detail="Template non trovato")
    progetto = await db.get(Progetto, progetto_id)
    if not progetto: raise HTTPException(status_code=404, detail="Progetto non trovato")
    
    # Crea Task
    for t_tpl in template.tasks:
        new_task = Task(
            id=uuid.uuid4(),
            progetto_id=progetto_id,
            titolo=t_tpl.titolo,
            descrizione=t_tpl.descrizione,
            stato=TaskStatus.DA_FARE,
            stima_minuti=int(t_tpl.stima_ore * 60) if t_tpl.stima_ore else 0,
            ordine=t_tpl.ordine,
            categoria=t_tpl.categoria
        )
        db.add(new_task)
    
    # Crea Milestones
    for m_tpl in template.milestones:
        new_milestone = ProgettoMilestone(
            id=uuid.uuid4(),
            progetto_id=progetto_id,
            nome=m_tpl.nome,
            data_scadenza=(date.today() + timedelta(days=m_tpl.giorni_dalla_creazione)) if m_tpl.giorni_dalla_creazione else None,
            completata=False
        )
        db.add(new_milestone)
    
    await db.commit()
    return {"success": True, "message": f"Template '{template.nome}' applicato con successo"}


# ── AUDIT LOG ─────────────────────────────────────────────
def _apply_audit_filters(
    query,
    audit_model,
    *,
    tabella: Optional[str] = None,
    record_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
):
    if tabella:
        query = query.where(audit_model.tabella == tabella)
    if record_id:
        query = query.where(audit_model.record_id == record_id)
    if user_id:
        query = query.where(audit_model.user_id == user_id)
    if from_date:
        query = query.where(audit_model.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        query = query.where(audit_model.created_at < datetime.combine(to_date + timedelta(days=1), datetime.min.time()))
    return query


def _serialize_audit_rows(rows):
    items = []
    for log, user_nome, user_cognome in rows:
        nome_completo = " ".join(part for part in [user_nome, user_cognome] if part).strip() or None
        items.append(
            {
                "id": str(log.id),
                "user_id": str(log.user_id) if log.user_id else None,
                "user_nome": nome_completo,
                "tabella": log.tabella,
                "record_id": str(log.record_id),
                "azione": log.azione,
                "dati_prima": log.dati_prima,
                "dati_dopo": log.dati_dopo,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
        )
    return items


@router.get("/audit-log", tags=["AuditLog"])
async def get_audit_log(
    tabella: Optional[str] = Query(None),
    record_id: Optional[uuid.UUID] = Query(None),
    user_id: Optional[uuid.UUID] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    from app.models.models import AuditLog, User as UserModel

    count_query = _apply_audit_filters(
        select(AuditLog.id),
        AuditLog,
        tabella=tabella,
        record_id=record_id,
        user_id=user_id,
        from_date=from_date,
        to_date=to_date,
    )
    total_res = await db.execute(select(func.count()).select_from(count_query.subquery()))
    total = total_res.scalar() or 0

    query = (
        select(AuditLog, UserModel.nome, UserModel.cognome)
        .outerjoin(UserModel, AuditLog.user_id == UserModel.id)
        .order_by(AuditLog.created_at.desc())
    )
    query = _apply_audit_filters(
        query,
        AuditLog,
        tabella=tabella,
        record_id=record_id,
        user_id=user_id,
        from_date=from_date,
        to_date=to_date,
    )
    result = await db.execute(query.offset(offset).limit(limit))

    return {
        "total": total,
        "items": _serialize_audit_rows(result.all()),
    }


@router.get("/audit-log/entity/{tabella}/{record_id}", tags=["AuditLog"])
async def get_entity_audit_log(
    tabella: str,
    record_id: uuid.UUID,
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(20, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.models.models import AuditLog, User as UserModel

    count_query = _apply_audit_filters(
        select(AuditLog.id),
        AuditLog,
        tabella=tabella,
        record_id=record_id,
        from_date=from_date,
        to_date=to_date,
    )
    total_res = await db.execute(select(func.count()).select_from(count_query.subquery()))
    total = total_res.scalar() or 0

    query = (
        select(AuditLog, UserModel.nome, UserModel.cognome)
        .outerjoin(UserModel, AuditLog.user_id == UserModel.id)
        .order_by(AuditLog.created_at.desc())
    )
    query = _apply_audit_filters(
        query,
        AuditLog,
        tabella=tabella,
        record_id=record_id,
        from_date=from_date,
        to_date=to_date,
    )
    result = await db.execute(query.offset(offset).limit(limit))

    return {
        "total": total,
        "items": _serialize_audit_rows(result.all()),
    }
