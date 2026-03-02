"""
router.py — Tutti gli endpoint API v1.
"""
import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
    FornitoreOut, FatturaAttivaOut, FatturaPassivaOut, FatturaPassivaUpdate, FicSyncStatusOut,
)
from app.services.services import (
    get_user_by_email, create_user, list_users, update_user,
    list_clienti, get_cliente, create_cliente, update_cliente,
    list_progetti, get_progetto, create_progetto, update_progetto,
    list_commesse, get_commessa, create_commessa, update_commessa,
    create_timesheet, list_timesheet, approva_timesheet,
    calcola_metriche_commessa,
    get_dashboard_kpi, get_marginalita_clienti,
    sync_fic_data, get_last_fic_sync_status, list_fornitori, list_fatture_attive, list_fatture_passive, update_fattura_passiva,
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
    return await create_progetto(db, data)

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
    return p


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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
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


@router.get("/fatture-passive", response_model=List[FatturaPassivaOut], tags=["FIC"])
async def get_fatture_passive(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await list_fatture_passive(db)


@router.patch("/fatture-passive/{fattura_id}", response_model=FatturaPassivaOut, tags=["FIC"])
async def patch_fattura_passiva(
    fattura_id: uuid.UUID,
    data: FatturaPassivaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    f = await update_fattura_passiva(db, fattura_id, data, current_user.id)
    if not f:
        raise HTTPException(status_code=404, detail="Fattura passiva non trovata")
    return f


@router.get("/fornitori", response_model=List[FornitoreOut], tags=["FIC"])
async def get_fornitori(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    return await list_fornitori(db)
