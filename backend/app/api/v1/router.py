"""
router.py — Tutti gli endpoint API v1.
"""
import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import (
    verify_password, create_access_token,
    get_current_user, require_roles
)
from app.models.models import User, UserRole, CommessaStatus, TimesheetStatus
from app.schemas.schemas import (
    LoginRequest, TokenResponse, UserOut, UserCreate, UserUpdate,
    ClienteCreate, ClienteUpdate, ClienteOut,
    ProgettoCreate, ProgettoUpdate, ProgettoOut, ProgettoWithCliente,
    CommessaCreate, CommessaUpdate, CommessaOut,
    TimesheetCreate, TimesheetOut, TimesheetApprova,
    FornitoreOut, FatturaAttivaOut, FatturaPassivaOut, FicSyncStatusOut,
)
from app.schemas.schemas import FatturaIncassaRequest, FatturaPassivaUpdate, FornitoreUpdate, FornitoreOut
import httpx
from app.services.services import (
    get_user_by_email, create_user, list_users, update_user,
    list_clienti, get_cliente, create_cliente, update_cliente, delete_cliente,
    list_progetti, get_progetto, create_progetto, update_progetto, get_progetto_with_servizi,
    get_servizi_progetto, create_servizio_progetto, update_servizio_progetto, delete_servizio_progetto,
    list_commesse, get_commessa, create_commessa, update_commessa,
    create_timesheet, list_timesheet, approva_timesheet, elimina_timesheet_bulk, aggiorna_mese_competenza_bulk,
    calcola_metriche_commessa,
    get_dashboard_kpi, get_marginalita_clienti,
    sync_fic_data, get_last_fic_sync_status, list_fornitori, list_fatture_attive, list_fatture_passive, incassa_fattura, update_fattura_passiva, list_fornitori_full, update_fornitore, list_movimenti_cassa, list_costi_fissi, create_costo_fisso, update_costo_fisso, delete_costo_fisso,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════
@router.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide")
    if not user.attivo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disattivato")
    token = create_access_token({"sub": str(user.id), "ruolo": user.ruolo})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))

@router.get("/auth/me", response_model=UserOut, tags=["Auth"])
async def me(current_user: User = Depends(get_current_user)):
    return current_user


# ═══════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════
@router.get("/users", response_model=List[UserOut], tags=["Users"])
async def get_users(
    attivo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await list_users(db, attivo)

@router.post("/users", response_model=UserOut, status_code=201, tags=["Users"])
async def add_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email già registrata")
    return await create_user(db, data)

@router.patch("/users/{user_id}", response_model=UserOut, tags=["Users"])
async def patch_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    payload = data.model_dump(exclude_none=True)
    is_admin = current_user.ruolo == UserRole.ADMIN
    is_self = current_user.id == user_id

    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Non autorizzato a modificare questo utente")

    # Utenti non ADMIN: consentito solo aggiornare il proprio profilo base/password.
    if is_self and not is_admin:
        allowed_fields = {"nome", "cognome", "password"}
        blocked = [k for k in payload.keys() if k not in allowed_fields]
        if blocked:
            raise HTTPException(status_code=403, detail="Solo ADMIN può modificare ruolo/costi/stato")

    user = await update_user(db, user_id, data, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return user


# ═══════════════════════════════════════════════════════
# CLIENTI
# ═══════════════════════════════════════════════════════
@router.get("/clienti", response_model=List[ClienteOut], tags=["Clienti"])
async def get_clienti(
    attivo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await list_clienti(db, attivo)

@router.get("/clienti/{cliente_id}", response_model=ClienteOut, tags=["Clienti"])
async def get_single_cliente(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    c = await get_cliente(db, cliente_id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    return c

@router.post("/clienti", response_model=ClienteOut, status_code=201, tags=["Clienti"])
async def add_cliente(
    data: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await create_cliente(db, data)

@router.patch("/clienti/{cliente_id}", response_model=ClienteOut, tags=["Clienti"])
async def patch_cliente(
    cliente_id: uuid.UUID,
    data: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    c = await update_cliente(db, cliente_id, data, current_user.id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    return c


# ═══════════════════════════════════════════════════════
# PROGETTI
# ═══════════════════════════════════════════════════════
@router.delete("/clienti/{cliente_id}", status_code=204, tags=["Clienti"])
async def remove_cliente(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles('ADMIN'))
):
    ok = await delete_cliente(db, cliente_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Cliente non trovato")

@router.get("/progetti", response_model=List[ProgettoWithCliente], tags=["Progetti"])
async def get_progetti(
    cliente_id: Optional[uuid.UUID] = Query(None),
    stato: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await list_progetti(db, cliente_id, stato)

@router.get("/progetti/{progetto_id}", response_model=ProgettoWithCliente, tags=["Progetti"])
async def get_single_progetto(
    progetto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    p = await get_progetto(db, progetto_id)
    if not p:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    return p

@router.post("/progetti", response_model=ProgettoOut, status_code=201, tags=["Progetti"])
async def add_progetto(
    data: ProgettoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    p = await create_progetto(db, data)
    return await get_progetto_with_servizi(db, p.id)

@router.patch("/progetti/{progetto_id}", response_model=ProgettoOut, tags=["Progetti"])
async def patch_progetto(
    progetto_id: uuid.UUID,
    data: ProgettoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    p = await update_progetto(db, progetto_id, data, current_user.id)
    if not p:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    return await get_progetto_with_servizi(db, p.id)


# ═══════════════════════════════════════════════════════
# COMMESSE
# ═══════════════════════════════════════════════════════
async def _enrich_commessa(db: AsyncSession, c, coeff_cache: Optional[dict[date, Decimal]] = None) -> dict:
    """Aggiunge i campi calcolati alla commessa prima della serializzazione."""
    d = CommessaOut.model_validate(c).model_dump()
    metriche = await calcola_metriche_commessa(db, c, coeff_cache)
    d.update(metriche)
    return d

@router.get("/commesse", response_model=List[CommessaOut], tags=["Commesse"])
async def get_commesse(
    mese: Optional[date] = Query(None, description="Formato YYYY-MM-01"),
    stato: Optional[CommessaStatus] = Query(None),
    cliente_id: Optional[uuid.UUID] = Query(None),
    progetto_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    commesse = await list_commesse(db, mese, stato, cliente_id, progetto_id)
    coeff_cache: dict[date, Decimal] = {}
    enriched = []
    for c in commesse:
        enriched.append(await _enrich_commessa(db, c, coeff_cache))
    return enriched

@router.get("/commesse/{commessa_id}", response_model=CommessaOut, tags=["Commesse"])
async def get_single_commessa(
    commessa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = await get_commessa(db, commessa_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")
    return await _enrich_commessa(db, c)

@router.post("/commesse", response_model=CommessaOut, status_code=201, tags=["Commesse"])
async def add_commessa(
    data: CommessaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    c = await create_commessa(db, data)
    return await _enrich_commessa(db, c)

@router.patch("/commesse/{commessa_id}", response_model=CommessaOut, tags=["Commesse"])
async def patch_commessa(
    commessa_id: uuid.UUID,
    data: CommessaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = await update_commessa(db, commessa_id, data, current_user)
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")
    return await _enrich_commessa(db, c)


# ═══════════════════════════════════════════════════════
# TIMESHEET
# ═══════════════════════════════════════════════════════
@router.get("/timesheet", response_model=List[TimesheetOut], tags=["Timesheet"])
async def get_timesheet(
    mese: Optional[date] = Query(None),
    stato: Optional[TimesheetStatus] = Query(None),
    commessa_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # DIPENDENTE e FREELANCER vedono solo le proprie ore
    user_filter = None
    if current_user.ruolo in (UserRole.DIPENDENTE, UserRole.FREELANCER):
        user_filter = current_user.id
    return await list_timesheet(db, user_filter, mese, stato, commessa_id)

@router.post("/timesheet", response_model=TimesheetOut, status_code=201, tags=["Timesheet"])
async def add_timesheet(
    data: TimesheetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await create_timesheet(db, data, current_user.id)

@router.post("/timesheet/approva", response_model=List[TimesheetOut], tags=["Timesheet"])
async def bulk_approva(
    data: TimesheetApprova,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await approva_timesheet(db, data, current_user)


# ═══════════════════════════════════════════════════════
# REPORT / DASHBOARD
# ═══════════════════════════════════════════════════════
@router.get("/dashboard/kpi", tags=["Report"])
async def dashboard_kpi(
    mese: date = Query(..., description="Formato YYYY-MM-01"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await get_dashboard_kpi(db, mese)

@router.get("/report/marginalita", tags=["Report"])
async def report_marginalita(
    mese: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    return await get_marginalita_clienti(db, mese)


# ═══════════════════════════════════════════════════════
# FATTURE IN CLOUD (SYNC MONODIREZIONALE)
# ═══════════════════════════════════════════════════════
@router.post("/fic/sync", response_model=FicSyncStatusOut, tags=["FIC"])
async def run_fic_sync(
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        return await sync_fic_data(db, current_user.id)


@router.get("/fic/sync/status", response_model=FicSyncStatusOut, tags=["FIC"])
async def fic_sync_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    status_obj = await get_last_fic_sync_status(db)
    if not status_obj:
        raise HTTPException(status_code=404, detail="Nessun sync FIC eseguito")
    return status_obj


@router.get("/fatture-attive", response_model=List[FatturaAttivaOut], tags=["FIC"])
async def get_fatture_attive(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await list_fatture_attive(db)

@router.patch("/fatture-attive/{fattura_id}/incassa", response_model=FatturaAttivaOut, tags=["FIC"])
async def patch_incassa_fattura(
    fattura_id: uuid.UUID,
    body: FatturaIncassaRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    fattura = await incassa_fattura(db, fattura_id, body.data_incasso)
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    return fattura


@router.get("/fornitori-full", tags=["Fornitori"])
async def get_fornitori_full(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await list_fornitori_full(db)

@router.patch("/fornitori/{fornitore_id}", response_model=FornitoreOut, tags=["Fornitori"])
async def patch_fornitore(
    fornitore_id: uuid.UUID,
    body: FornitoreUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    forn = await update_fornitore(db, fornitore_id, body.model_dump(exclude_none=True))
    if not forn:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    return forn

@router.get("/fatture-passive", tags=["FIC"])
async def get_fatture_passive(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await list_fatture_passive(db)


@router.patch("/fatture-passive/{fattura_id}", tags=["FIC"])
async def patch_fattura_passiva(
    fattura_id: uuid.UUID,
    body: FatturaPassivaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    fattura = await update_fattura_passiva(db, fattura_id, body.model_dump(exclude_none=True))
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    return fattura

@router.get("/fornitori", response_model=List[FornitoreOut], tags=["FIC"])
async def get_fornitori(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await list_fornitori(db)


@router.get("/movimenti-cassa", tags=["Cassa"])
async def get_movimenti_cassa(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    movimenti = await list_movimenti_cassa(db)
    return {"movimenti_cassa": movimenti}


@router.post("/movimenti-cassa/{movimento_id}/riconcilia", tags=["Cassa"])
async def riconcilia_movimento(
    movimento_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from app.models.models import MovimentoCassa
    from sqlalchemy import select
    from fastapi import HTTPException
    result = await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))
    mov = result.scalar_one_or_none()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    mov.riconciliato = payload.get('riconciliato', True)
    await db.commit()
    return {"id": str(mov.id), "riconciliato": mov.riconciliato}


@router.patch("/movimenti-cassa/{movimento_id}", tags=["Cassa"])
async def patch_movimento_cassa(
    movimento_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from app.models.models import MovimentoCassa, FatturaAttiva, FatturaPassiva
    from sqlalchemy import select
    from fastapi import HTTPException

    result = await db.execute(select(MovimentoCassa).where(MovimentoCassa.id == movimento_id))
    mov = result.scalar_one_or_none()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimento non trovato")

    # Aggiorna campi movimento
    for k, v in payload.items():
        if hasattr(mov, k):
            setattr(mov, k, v)

    # Se si sta riconciliando con fattura attiva -> aggiorna fattura se ancora in ATTESA
    if payload.get('fattura_attiva_id') and payload.get('riconciliato'):
        fa_id = uuid.UUID(payload['fattura_attiva_id']) if isinstance(payload['fattura_attiva_id'], str) else payload['fattura_attiva_id']
        fa_res = await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fa_id))
        fa = fa_res.scalar_one_or_none()
        if fa and fa.stato_pagamento not in ('INCASSATA', 'paid'):
            fa.stato_pagamento = 'INCASSATA'
            fa.data_ultimo_incasso = mov.data_valuta

    # Se si sta riconciliando con fattura passiva -> aggiorna fattura se ancora in ATTESA
    if payload.get('fattura_passiva_id') and payload.get('riconciliato'):
        fp_id = uuid.UUID(payload['fattura_passiva_id']) if isinstance(payload['fattura_passiva_id'], str) else payload['fattura_passiva_id']
        fp_res = await db.execute(select(FatturaPassiva).where(FatturaPassiva.id == fp_id))
        fp = fp_res.scalar_one_or_none()
        if fp and fp.stato_pagamento not in ('paid', 'PAGATA'):
            fp.stato_pagamento = 'paid'
            fp.data_ultimo_pagamento = mov.data_valuta

    # Se si sta annullando la riconciliazione -> riporta fattura ad ATTESA solo se era stata marcata da noi
    if payload.get('riconciliato') == False:
        if mov.fattura_attiva_id:
            fa_res = await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == mov.fattura_attiva_id))
            fa = fa_res.scalar_one_or_none()
            if fa and fa.stato_pagamento == 'INCASSATA':
                fa.stato_pagamento = 'ATTESA'
                fa.data_ultimo_incasso = None
        if mov.fattura_passiva_id:
            fp_res = await db.execute(select(FatturaPassiva).where(FatturaPassiva.id == mov.fattura_passiva_id))
            fp = fp_res.scalar_one_or_none()
            if fp and fp.stato_pagamento in ('paid', 'PAGATA'):
                fp.stato_pagamento = 'ATTESA'
                fp.data_ultimo_pagamento = None

    await db.commit()
    await db.refresh(mov)
    return {c.name: getattr(mov, c.name) for c in mov.__table__.columns}


@router.get("/costi-fissi", tags=["CostiFissi"])
async def get_costi_fissi(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return {"costi_fissi": await list_costi_fissi(db)}


@router.post("/costi-fissi", tags=["CostiFissi"])
async def post_costo_fisso(payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await create_costo_fisso(db, payload)


@router.patch("/costi-fissi/{costo_id}", tags=["CostiFissi"])
@router.delete("/fornitori/{fornitore_id}", tags=["Fornitori"])
async def delete_fornitore_endpoint(
    fornitore_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from app.models.models import Fornitore, FatturaPassiva
    from sqlalchemy import select
    from sqlalchemy import func as sqlfunc
    from fastapi import HTTPException
    # Verifica fatture collegate
    fp_count = await db.execute(
        select(sqlfunc.count()).select_from(FatturaPassiva).where(FatturaPassiva.fornitore_id == fornitore_id)
    )
    count = fp_count.scalar()
    if count > 0:
        raise HTTPException(status_code=400, detail=f"Impossibile eliminare: fornitore ha {count} fatture passive collegate")
    result = await db.execute(select(Fornitore).where(Fornitore.id == fornitore_id))
    forn = result.scalar_one_or_none()
    if not forn:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    await db.delete(forn)
    await db.commit()
    return {"deleted": True}


async def patch_costo_fisso(costo_id: uuid.UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from fastapi import HTTPException
    result = await update_costo_fisso(db, costo_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Costo non trovato")
    return result


@router.delete("/costi-fissi/{costo_id}", tags=["CostiFissi"])
async def delete_costo_fisso_endpoint(costo_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from fastapi import HTTPException
    ok = await delete_costo_fisso(db, costo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Costo non trovato")
    return {"deleted": True}


# ── REGOLE RICONCILIAZIONE ────────────────────────────────
@router.get("/regole-riconciliazione", tags=["Regole"])
async def get_regole(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import list_regole
    return {"regole": await list_regole(db)}


@router.post("/regole-riconciliazione", tags=["Regole"])
async def post_regola(payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import create_regola
    return await create_regola(db, payload)


@router.patch("/regole-riconciliazione/{regola_id}", tags=["Regole"])
async def patch_regola(regola_id: uuid.UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import update_regola
    from fastapi import HTTPException
    r = await update_regola(db, regola_id, payload)
    if not r: raise HTTPException(status_code=404, detail="Regola non trovata")
    return r


@router.delete("/regole-riconciliazione/{regola_id}", tags=["Regole"])
async def delete_regola_endpoint(regola_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import delete_regola
    from fastapi import HTTPException
    ok = await delete_regola(db, regola_id)
    if not ok: raise HTTPException(status_code=404, detail="Regola non trovata")
    return {"deleted": True}


@router.post("/regole-riconciliazione/applica", tags=["Regole"])
async def applica_regole(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import applica_regole_automatiche
    return await applica_regole_automatiche(db)


@router.get("/movimenti-cassa/{movimento_id}/suggest", tags=["Regole"])
async def suggest_mov(movimento_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import suggest_riconciliazione
    return await suggest_riconciliazione(db, movimento_id)


# ── IMPUTAZIONI FATTURE PASSIVE ───────────────────────────
@router.get("/fatture-passive/{fattura_id}/imputazioni", tags=["Imputazioni"])
async def get_imputazioni_fattura(fattura_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import get_imputazioni
    return await get_imputazioni(db, fattura_id)


@router.post("/fatture-passive/{fattura_id}/imputazioni", tags=["Imputazioni"])
async def save_imputazioni_fattura(fattura_id: uuid.UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import save_imputazioni
    from fastapi import HTTPException
    result = await save_imputazioni(db, fattura_id, payload.get('imputazioni', []))
    if result is None:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    return {"imputazioni": result}


# ── IMPUTAZIONI MOVIMENTI CASSA ───────────────────────────
@router.get("/movimenti-cassa/{movimento_id}/imputazioni", tags=["Imputazioni"])
async def get_imputazioni_mov(movimento_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import get_imputazioni_movimento
    return await get_imputazioni_movimento(db, movimento_id)


@router.post("/movimenti-cassa/{movimento_id}/imputazioni", tags=["Imputazioni"])
async def save_imputazioni_mov(movimento_id: uuid.UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import save_imputazioni_movimento
    from fastapi import HTTPException
    result = await save_imputazioni_movimento(db, movimento_id, payload.get('imputazioni', []))
    if result is None:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    return {"imputazioni": result}


# ── DELETE PROGETTO ───────────────────────────────────────
@router.delete("/progetti/{progetto_id}", status_code=204, tags=["Progetti"])
async def delete_progetto(progetto_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.models.models import Progetto
    from sqlalchemy import select
    from fastapi import HTTPException
    result = await db.execute(select(Progetto).where(Progetto.id == progetto_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    await db.delete(p)
    await db.commit()


# ── DELETE COMMESSA ───────────────────────────────────────
@router.delete("/commesse/{commessa_id}", status_code=204, tags=["Commesse"])
async def delete_commessa(commessa_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.models.models import Commessa
    from sqlalchemy import select
    from fastapi import HTTPException
    result = await db.execute(select(Commessa).where(Commessa.id == commessa_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")
    await db.delete(c)
    await db.commit()


# ── RISORSE (HR) ──────────────────────────────────────────
@router.get("/risorse", tags=["HR"])
async def get_risorse(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import list_risorse
    return await list_risorse(db)


@router.post("/risorse", tags=["HR"])
async def post_risorsa(payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import create_risorsa
    return await create_risorsa(db, payload)


@router.patch("/risorse/{risorsa_id}", tags=["HR"])
async def patch_risorsa(risorsa_id: uuid.UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import update_risorsa
    from fastapi import HTTPException
    r = await update_risorsa(db, risorsa_id, payload)
    if not r:
        raise HTTPException(status_code=404, detail="Risorsa non trovata")
    return r


@router.delete("/risorse/{risorsa_id}", status_code=204, tags=["HR"])
async def del_risorsa(risorsa_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import delete_risorsa
    from fastapi import HTTPException
    ok = await delete_risorsa(db, risorsa_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Risorsa non trovata")

# ── SERVIZI PROGETTO ──────────────────────────────────────
@router.get("/progetti/{progetto_id}/servizi")
async def list_servizi_progetto_endpoint(progetto_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    from app.schemas.schemas import ServizioProgettoOut
    items = await get_servizi_progetto(db, progetto_id)
    return [ServizioProgettoOut.model_validate(i) for i in items]

@router.post("/progetti/{progetto_id}/servizi")
async def create_servizio_progetto_endpoint(progetto_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    from app.schemas.schemas import ServizioProgettoCreate, ServizioProgettoOut
    body = await request.json()
    data = ServizioProgettoCreate(**body)
    item = await create_servizio_progetto(db, progetto_id, data)
    return ServizioProgettoOut.model_validate(item)

@router.patch("/progetti/{progetto_id}/servizi/{servizio_id}")
async def update_servizio_progetto_endpoint(progetto_id: uuid.UUID, servizio_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    from app.schemas.schemas import ServizioProgettoUpdate, ServizioProgettoOut
    body = await request.json()
    data = ServizioProgettoUpdate(**body)
    item = await update_servizio_progetto(db, servizio_id, data)
    return ServizioProgettoOut.model_validate(item)

@router.delete("/progetti/{progetto_id}/servizi/{servizio_id}")
async def delete_servizio_progetto_endpoint(progetto_id: uuid.UUID, servizio_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    await delete_servizio_progetto(db, servizio_id)
    return {"ok": True}


@router.delete("/timesheet/bulk", tags=["Timesheet"])
async def bulk_elimina(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    from app.schemas.schemas import TimesheetBulkDelete
    body = await request.json()
    data = TimesheetBulkDelete(**body)
    return await elimina_timesheet_bulk(db, data.ids, current_user)


@router.patch("/timesheet/bulk-mese", tags=["Timesheet"])
async def bulk_cambia_mese(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    from app.schemas.schemas import TimesheetBulkMese
    body = await request.json()
    data = TimesheetBulkMese(**body)
    return await aggiorna_mese_competenza_bulk(db, data.ids, data.mese_competenza, current_user)


# ═══════════════════════════════════════════════════════
# CLICKUP — task lookup per timer
# ═══════════════════════════════════════════════════════

CLICKUP_BASE = "https://api.clickup.com/api/v2"
CLICKUP_TEAM_ID = "9015889235"

async def _cu_get(path: str) -> dict:
    import os
    token = os.getenv("CLICKUP_TOKEN", "")
    if not token:
        raise HTTPException(status_code=500, detail="CLICKUP_TOKEN non configurato")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{CLICKUP_BASE}{path}",
            headers={"Authorization": token}
        )
        r.raise_for_status()
        return r.json()


@router.get("/clickup/users", tags=["ClickUp"])
async def get_clickup_members(
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    """Lista membri workspace ClickUp con ID — per configurare clickup_user_id su users"""
    data = await _cu_get(f"/team/{CLICKUP_TEAM_ID}/member")
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
            f"/team/{CLICKUP_TEAM_ID}/task"
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

    # Risolvi commessa_id se cliente_id fornito
    commessa_id = None
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

    # Crea timesheet
    from sqlalchemy import select as sa_select
    co_res = await db.execute(sa_select(UserModel.costo_orario).where(UserModel.id == current_user.id))
    costo_orario = co_res.scalar_one_or_none() or 0
    costo_lavoro = round((durata / 60.0) * float(costo_orario or 0), 2)

    ts = Timesheet(
        id=uuid.uuid4(),
        user_id=current_user.id,
        commessa_id=commessa_id,
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
    return ts
