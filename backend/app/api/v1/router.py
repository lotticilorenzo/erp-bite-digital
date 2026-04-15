import logging
import uuid
from collections import defaultdict
from datetime import datetime, date, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Optional, List
import secrets
import time

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, Query, Body, File, UploadFile
from fastapi_mail import FastMail, ConnectionConfig, MessageSchema, MessageType
import os
import shutil
import io
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func, and_, or_

from app.db.session import get_db
from app.core.config import settings
from app.core.security import (
    verify_password, create_access_token,
    get_current_user, require_roles
)
from app.models.models import (
    User, UserRole, ProjectStatus, ProjectType, 
    CommessaStatus, TaskStatus, PreventivoStatus,
    TimesheetStatus, ServiceType, ServiceCadenza,
    CostoTipo, MovimentoStatus,
    CRMStage, CRMLead, CRMActivity, Cliente
)
from app.schemas.schemas import (
    LoginRequest, TokenResponse, UserOut, UserCreate, UserUpdate,
    ClienteCreate, ClienteUpdate, ClienteOut,
    ProgettoCreate, ProgettoUpdate, ProgettoOut, ProgettoWithCliente,
    CommessaCreate, CommessaUpdate, CommessaOut,
    TimesheetCreate, TimesheetOut, TimesheetApprova,
    FornitoreOut, FornitoreCreate, FornitoreUpdate,
    FatturaAttivaOut, FatturaAttivaUpdate, FatturaPassivaOut, FatturaPassivaUpdate, FatturaIncassaRequest,
    FicSyncStatusOut, TaskCreate, TaskUpdate, TaskOut,
    CategoriaFornitoreCreate, CategoriaFornitoreOut, CategoriaFornitoreUpdate,
    PreventivoCreate, PreventivoUpdate, PreventivoOut,
    BudgetCategoryCreate, BudgetCategoryOut, BudgetMensileCreate, BudgetMensileUpdate, BudgetMensileOut, BudgetConsuntivoOut,
    WikiCategoriaCreate, WikiCategoriaOut, WikiArticoloCreate, WikiArticoloUpdate, WikiArticoloOut,
    ChatReazioneBase, ChatReazioneRead, ChatMessaggioCreate, ChatMessaggioUpdate, ChatMessaggioRead,
    CRMStageOut, CRMLeadCreate, CRMLeadUpdate, CRMLeadOut, CRMActivityCreate, CRMActivityOut, CRMStatsOut
)
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest
import httpx
from app.services.services import (
    list_tasks, get_task, create_task, update_task, delete_task,
    list_users, get_user_by_email, create_user, update_user,
    get_cliente, create_cliente, update_cliente, delete_cliente,
    get_progetto, create_progetto, update_progetto, get_progetto_with_servizi,
    list_commesse, get_commessa, create_commessa, update_commessa, calcola_metriche_commessa,
    list_timesheet, create_timesheet, approva_timesheet,
    get_dashboard_kpi, get_marginalita_clienti,
    sync_fic_data, get_last_fic_sync_status, list_fatture_attive, incassa_fattura,
    list_fornitori_full, update_fornitore, list_fatture_passive, update_fattura_passiva, list_fornitori,
    list_movimenti_cassa, list_costi_fissi, create_costo_fisso, update_costo_fisso, delete_costo_fisso,
    get_servizi_progetto, create_servizio_progetto, update_servizio_progetto, delete_servizio_progetto,
    elimina_timesheet_bulk, aggiorna_mese_competenza_bulk,
    list_preventivi, get_preventivo, create_preventivo, update_preventivo, delete_preventivo, converti_preventivo_in_commessa
)
from app.api.v1 import timer
from app.api.v1 import ai
from app.api.v1 import planning
from app.api.v1 import pianificazioni
from app.api.v1 import notifications
from app.api.v1 import assenze
from app.api.v1 import risorse_servizi
from app.api.v1 import risorse
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
router.include_router(timer.router)
router.include_router(ai.router)
router.include_router(planning.router)
router.include_router(pianificazioni.router)
router.include_router(risorse.router)
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
@router.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    _check_login_rate(request.client.host if request.client else "unknown")
    from app.services.services import get_user_by_identifier
    user = await get_user_by_identifier(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide")
    if not user.attivo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disattivato")
    token = create_access_token({"sub": str(user.id), "ruolo": user.ruolo})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))

@router.get("/auth/me", response_model=UserOut, tags=["Auth"])
async def me(current_user: User = Depends(get_current_user)):
    return current_user

@router.delete("/auth/sessions", tags=["Auth"])
async def logout_all_sessions(current_user: User = Depends(get_current_user)):
    """Mock endpoint to simulate disconnecting all sessions."""
    return {"message": "Successo"}

# ═══════════════════════════════════════════════════════
# PREVENTIVI
# ═══════════════════════════════════════════════════════
@router.get("/preventivi", response_model=List[PreventivoOut], tags=["Preventivi"])
async def get_preventivi(
    cliente_id: Optional[uuid.UUID] = Query(None),
    stato: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.models.models import PreventivoStatus
    p_status = None
    if stato:
        try:
            p_status = PreventivoStatus(stato)
        except ValueError:
            raise HTTPException(status_code=400, detail="Stato preventivo non valido")
    return await list_preventivi(db, cliente_id, p_status)

@router.get("/preventivi/{preventivo_id}", response_model=PreventivoOut, tags=["Preventivi"])
async def get_single_preventivo(
    preventivo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    p = await get_preventivo(db, preventivo_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    return p

@router.post("/preventivi", response_model=PreventivoOut, status_code=201, tags=["Preventivi"])
async def add_preventivo(
    data: PreventivoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    p = await create_preventivo(db, data, current_user.id)
    await db.commit()
    return p

@router.patch("/preventivi/{preventivo_id}", response_model=PreventivoOut, tags=["Preventivi"])
async def patch_preventivo(
    preventivo_id: uuid.UUID,
    data: PreventivoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    p = await update_preventivo(db, preventivo_id, data, current_user.id)
    if not p:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    await db.commit()
    return p

@router.delete("/preventivi/{preventivo_id}", status_code=204, tags=["Preventivi"])
async def remove_preventivo(
    preventivo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    ok = await delete_preventivo(db, preventivo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    await db.commit()

@router.post("/preventivi/{preventivo_id}/converti-commessa", tags=["Preventivi"])
async def converti_preventivo(
    preventivo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    try:
        commessa = await converti_preventivo_in_commessa(db, preventivo_id, current_user)
        await db.commit()
        return {"id": commessa.id, "message": "Preventivo convertito in commessa con successo"}
    except HTTPException as e:
        raise e
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Rate limiting in-memory (semplice)
password_reset_history = {} # {email: [timestamp1, timestamp2, ...]}

@router.post("/auth/forgot-password", tags=["Auth"])
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    from app.services.services import get_user_by_email
    
    # 1. Rate limiting
    now = datetime.utcnow()
    history = password_reset_history.get(data.email, [])
    history = [t for t in history if now - t < timedelta(hours=1)]
    if len(history) >= 3:
        # In produzione eviteremmo di dire ESATTAMENTE che è rate limited per sicurezza, 
        # ma qui seguiamo la logica richiesta.
        raise HTTPException(status_code=429, detail="Troppe richieste. Riprova tra un'ora.")
    
    password_reset_history[data.email] = history + [now]
    
    # 2. Cerca utente
    user = await get_user_by_email(db, data.email)
    if not user:
        # Per sicurezza non diciamo se l'email esiste
        return {"message": "Se l'email esiste, riceverai un link di reset."}
    
    # 3. Genera token
    token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(hours=1)
    
    # 4. Salva token (SQL diretto per velocità)
    await db.execute(
        text("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (:u, :t, :e)"),
        {"u": user.id, "t": token, "e": expires_at}
    )
    await db.commit()
    
    # 5. Invia email
    conf = ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=settings.MAIL_TLS,
        MAIL_SSL_TLS=settings.MAIL_SSL,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True
    )
    
    reset_link = f"{settings.FRONTEND_BASE_URL}/reset-password?token={token}"
    
    html = f"""
    <html>
    <body style="font-family: sans-serif; background-color: #f8f9fa; padding: 40px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="background: #1e293b; padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.02em;">BITE DIGITAL</h1>
            </div>
            <div style="padding: 40px; text-align: center;">
                <h2 style="color: #1e293b; margin-top: 0;">Hai richiesto il reset della password</h2>
                <p style="color: #64748b; line-height: 1.6; font-size: 16px;">
                    Clicca il pulsante qui sotto per impostare una nuova password per il tuo account Bite ERP.
                </p>
                <div style="margin: 40px 0;">
                    <a href="{reset_link}" style="background: #8b5cf6; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
                        Reimposta Password
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; margin-bottom: 0;">
                    Il link scade tra 1 ora.
                </p>
            </div>
            <div style="background: #f1f5f9; padding: 20px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    Se non hai richiesto questo reset, ignora pure questa email.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Reset Password - Bite ERP",
        recipients=[data.email],
        body=html,
        subtype=MessageType.html
    )
    
    fm = FastMail(conf)
    try:
        await fm.send_message(message)
    except Exception as e:
        logger.error("Errore invio email reset password: %s", e)
        # In produzione loggheresti l'errore ma all'utente diciamo comunque successo per non dare info
    
    return {"message": "Se l'email esiste, riceverai un link di reset."}

@router.post("/auth/reset-password", tags=["Auth"])
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    from app.core.security import hash_password
    
    # 1. Verifica token
    now = datetime.utcnow()
    result = await db.execute(
        text("SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = :t"),
        {"t": data.token}
    )
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=400, detail="Token non valido")

    user_id, expires_at, used = row

    if now > expires_at:
        raise HTTPException(status_code=400, detail="Token scaduto")

    # 2. Marca token come usato in modo ATOMICO (anti-race-condition).
    #    Se il token è già stato usato da una richiesta concorrente, RETURNING
    #    non restituisce righe e blocchiamo l'operazione prima di toccare la password.
    mark_result = await db.execute(
        text(
            "UPDATE password_reset_tokens SET used = true "
            "WHERE token = :t AND used = false RETURNING user_id"
        ),
        {"t": data.token}
    )
    if not mark_result.fetchone():
        raise HTTPException(status_code=400, detail="Token già utilizzato")

    # 3. Aggiorna password solo dopo aver acquisito il lock sul token
    hashed_pwd = hash_password(data.new_password)
    await db.execute(
        text("UPDATE users SET password_hash = :h WHERE id = :u"),
        {"h": hashed_pwd, "u": user_id}
    )

    await db.commit()
    
    return {"message": "Password aggiornata con successo", "success": True}


# ═══════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════
@router.get("/users", response_model=List[UserOut], tags=["Users"])
async def get_users(
    attivo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    return await list_users(db, attivo)

@router.post("/users", response_model=UserOut, status_code=201, tags=["Users"])
async def add_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
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

@router.patch("/users/me", response_model=UserOut, tags=["Users"])
async def patch_current_user(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Shortcut per modificare se stessi senza passare l'ID
    allowed_fields = {"nome", "cognome", "password", "bio", "preferences"}
    payload = data.model_dump(exclude_none=True)
    
    if current_user.ruolo != UserRole.ADMIN:
        blocked = [k for k in payload.keys() if k not in allowed_fields]
        if blocked:
            raise HTTPException(status_code=403, detail="Non autorizzato a modificare campi amministrativi")

    return await update_user(db, current_user.id, data, current_user.id)

@router.get("/users/{user_id}/capacity-today", tags=["Users"])
async def get_user_capacity_today(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Calcola la capacità rimanente di un utente per la giornata odierna."""
    # IDOR fix: solo l'utente stesso o admin/pm possono vedere la capacity altrui
    is_self = current_user.id == user_id
    is_manager = current_user.ruolo in (UserRole.ADMIN, UserRole.PM)
    if not is_self and not is_manager:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Non autorizzato")

    from sqlalchemy import select, func
    from app.models.models import Risorsa, Task, TaskStatus

    # 1. Recupera ore giornaliere (ore_settimanali / 5)
    res_stmt = select(Risorsa).where(Risorsa.user_id == user_id)
    res_result = await db.execute(res_stmt)
    risorsa = res_result.scalar_one_or_none()
    
    ore_giornaliere = float(risorsa.ore_settimanali / 5) if risorsa else 8.0

    # 2. Somma stima_minuti dei task assegnati oggi non completati
    today = date.today()
    task_stmt = select(func.sum(Task.stima_minuti)).where(
        Task.assegnatario_id == user_id,
        Task.data_scadenza == today,
        Task.stato != TaskStatus.PRONTO,
        Task.stato != TaskStatus.PUBBLICATO
    )
    task_result = await db.execute(task_stmt)
    minuti_assegnati = task_result.scalar_one() or 0
    ore_assegnate = minuti_assegnati / 60

    ore_rimanenti = ore_giornaliere - ore_assegnate
    percentuale_carico = (ore_assegnate / ore_giornaliere) * 100 if ore_giornaliere > 0 else 0

    return {
        "ore_disponibili_oggi": round(ore_giornaliere, 2),
        "ore_gia_assegnate": round(ore_assegnate, 2),
        "ore_rimanenti": round(ore_rimanenti, 2),
        "percentuale_carico": round(percentuale_carico, 1),
        "puo_accettare_task": percentuale_carico < 100
    }

@router.get("/users/me/export", tags=["Users"])
async def export_user_data(current_user: User = Depends(get_current_user)):
    """Mock endpoint to export user data as JSON."""
    return {
        "user": UserOut.model_validate(current_user).model_dump(),
        "exported_at": datetime.utcnow().isoformat(),
        "format": "JSON",
        "message": "Export dei dati completato con successo"
    }

@router.post("/users/me/avatar", tags=["Users"])
async def upload_user_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validazione estensione
    allowed_exts = {".png", ".jpg", ".jpeg", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Formato file non supportato (PNG, JPG, WebP)")

    # Validazione dimensione (5MB)
    MAX_SIZE = 5 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File troppo grande (max 5MB)")
    
    try:
        # Elaborazione immagine con Pillow
        image = Image.open(io.BytesIO(content))
        
        # Conversione in RGB se necessario (es. PNG con trasparenza in JPG)
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            
        # Ridimensionamento proporzionale (cover style 200x200)
        # Cerchiamo di riempire il quadrato 200x200
        width, height = image.size
        aspect = width / height
        if aspect > 1: # Landscape
            new_width = int(aspect * 200)
            image = image.resize((new_width, 200), Image.LANCZOS)
            left = (new_width - 200) / 2
            image = image.crop((left, 0, left + 200, 200))
        else: # Portrait
            new_height = int(200 / aspect)
            image = image.resize((200, new_height), Image.LANCZOS)
            top = (new_height - 200) / 2
            image = image.crop((0, top, 200, top + 200))

        # Assicurati che la directory esista
        os.makedirs(os.path.join("static", "avatars"), exist_ok=True)
        
        # Salvataggio fisico come JPG per ottimizzazione
        filename = f"{current_user.id}.jpg"
        filepath = os.path.join("static", "avatars", filename)
        image.save(filepath, "JPEG", quality=85)
        
        # Aggiornamento DB
        current_user.avatar_url = f"/static/avatars/{filename}"
        await db.commit()
        await db.refresh(current_user)
        
        return {"avatar_url": current_user.avatar_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante l'elaborazione dell'immagine: {str(e)}")

@router.delete("/users/me/avatar", tags=["Users"])
async def delete_user_avatar(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.avatar_url and current_user.avatar_url.startswith("/static/avatars/"):
        _avatars_root = Path("static/avatars").resolve()
        _av = (_avatars_root / Path(current_user.avatar_url).name).resolve()
        if str(_av).startswith(str(_avatars_root)) and _av.exists():
            try:
                _av.unlink()
            except OSError:
                pass
    
    current_user.avatar_url = None
    await db.commit()
    return {"success": True}


# ═══════════════════════════════════════════════════════
# CATEGORIE FORNITORI
# ═══════════════════════════════════════════════════════
@router.get("/categorie-fornitori", response_model=List[CategoriaFornitoreOut], tags=["Fornitori"])
async def get_categorie_fornitori(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.services.services import list_categorie_fornitori
    return await list_categorie_fornitori(db)

@router.post("/categorie-fornitori", response_model=CategoriaFornitoreOut, status_code=201, tags=["Fornitori"])
async def add_categoria_fornitore(
    data: CategoriaFornitoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    from app.services.services import create_categoria_fornitore
    try:
        cat = await create_categoria_fornitore(db, data)
        await db.commit()
        await db.refresh(cat)
        return cat
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/categorie-fornitori/{cat_id}", response_model=CategoriaFornitoreOut, tags=["Fornitori"])
async def patch_categoria_fornitore(
    cat_id: uuid.UUID,
    data: CategoriaFornitoreUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    from app.services.services import update_categoria_fornitore
    cat = await update_categoria_fornitore(db, cat_id, data)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    await db.commit()
    await db.refresh(cat)
    return cat

@router.delete("/categorie-fornitori/{cat_id}", status_code=204, tags=["Fornitori"])
async def remove_categoria_fornitore(
    cat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    from app.services.services import delete_categoria_fornitore
    ok = await delete_categoria_fornitore(db, cat_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    await db.commit()


# ═══════════════════════════════════════════════════════
# CLIENTI
# ═══════════════════════════════════════════════════════
@router.get("/clienti", response_model=List[ClienteOut], tags=["Clienti"])
async def get_clienti(
    attivo: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, description="Ricerca per ragione sociale"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.models.models import Cliente as ClienteModel
    q = select(ClienteModel)
    if attivo is not None:
        q = q.where(ClienteModel.attivo == attivo)
    if search:
        q = q.where(ClienteModel.ragione_sociale.ilike(f"%{search}%"))
    q = q.order_by(ClienteModel.ragione_sociale).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()

@router.get("/clienti/{cliente_id}", response_model=ClienteOut, tags=["Clienti"])
async def get_single_cliente(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    c = await get_cliente(db, cliente_id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    return c

@router.get("/clienti/{cliente_id}/health-score", tags=["Clienti"])
async def get_cliente_health(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.services.services import get_client_health_score
    return await get_client_health_score(db, cliente_id)

@router.post("/clienti", response_model=ClienteOut, status_code=201, tags=["Clienti"])
async def add_cliente(
    data: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    return await create_cliente(db, data)

@router.patch("/clienti/{cliente_id}", response_model=ClienteOut, tags=["Clienti"])
async def patch_cliente(
    cliente_id: uuid.UUID,
    data: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    c = await update_cliente(db, cliente_id, data, current_user.id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    return c

@router.post("/clienti/{cliente_id}/logo", tags=["Clienti"])
async def upload_cliente_logo(
    cliente_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    # Validazione estensione
    allowed_exts = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Formato file non supportato")

    # Validazione dimensione (2MB)
    MAX_SIZE = 2 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File troppo grande (max 2MB)")
    
    # Rinomina file in modo univoco
    filename = f"{cliente_id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join("static", "logos", filename)
    
    # Salvataggio fisico
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Aggiornamento DB
    from app.models.models import Cliente
    from sqlalchemy import select as _sel_c
    res = await db.execute(_sel_c(Cliente).where(Cliente.id == cliente_id))
    c = res.scalar_one_or_none()
    if not c:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    
    # Cancella vecchio logo se presente e se diverso
    if c.logo_url and c.logo_url.startswith("/static/logos/"):
        _logos_root = Path("static/logos").resolve()
        _old = (_logos_root / Path(c.logo_url).name).resolve()
        # Controllo anti-path-traversal: il file deve stare dentro static/logos/
        if str(_old).startswith(str(_logos_root)) and _old.exists() and _old != Path(filepath).resolve():
            try:
                _old.unlink()
            except OSError:
                pass

    c.logo_url = f"/static/logos/{filename}"
    await db.commit()
    await db.refresh(c)
    return {"logo_url": c.logo_url}

@router.delete("/clienti/{cliente_id}/logo", tags=["Clienti"])
async def delete_cliente_logo(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.models.models import Cliente
    from sqlalchemy import select as _sel_c
    res = await db.execute(_sel_c(Cliente).where(Cliente.id == cliente_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    
    if c.logo_url and c.logo_url.startswith("/static/logos/"):
        _logos_root = Path("static/logos").resolve()
        _lp = (_logos_root / Path(c.logo_url).name).resolve()
        if str(_lp).startswith(str(_logos_root)) and _lp.exists():
            try:
                _lp.unlink()
            except OSError:
                pass

    c.logo_url = None
    await db.commit()
    return {"success": True}


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
    search: Optional[str] = Query(None, description="Ricerca per nome progetto"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.models.models import Progetto as ProgettoModel
    from sqlalchemy.orm import selectinload
    q = select(ProgettoModel).options(
        selectinload(ProgettoModel.cliente),
        selectinload(ProgettoModel.servizi),
        selectinload(ProgettoModel.team),
    )
    if cliente_id:
        q = q.where(ProgettoModel.cliente_id == cliente_id)
    if stato:
        q = q.where(ProgettoModel.stato == stato)
    if search:
        q = q.where(ProgettoModel.nome.ilike(f"%{search}%"))
    q = q.order_by(ProgettoModel.nome).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()

@router.get("/progetti/{progetto_id}", response_model=ProgettoWithCliente, tags=["Progetti"])
async def get_single_progetto(
    progetto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    p = await get_progetto(db, progetto_id)
    if not p:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    return p

@router.post("/progetti", response_model=ProgettoOut, status_code=201, tags=["Progetti"])
async def add_progetto(
    data: ProgettoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    p = await create_progetto(db, data)
    await db.commit()
    await db.refresh(p)
    return await get_progetto_with_servizi(db, p.id)

@router.patch("/progetti/{progetto_id}", response_model=ProgettoOut, tags=["Progetti"])
async def patch_progetto(
    progetto_id: uuid.UUID,
    data: ProgettoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    p = await update_progetto(db, progetto_id, data, current_user.id)
    if not p:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    return await get_progetto_with_servizi(db, p.id)


# ═══════════════════════════════════════════════════════
# COMMESSE
# ═══════════════════════════════════════════════════════
async def _enrich_commessa(db: AsyncSession, c, coeff_cache: Optional[dict[date, Decimal]] = None) -> dict:
    """Aggiunge i campi calcolati alla commessa prima della serializzazione senza chiamate SQL addizionali."""
    # Calcolo costo manodopera e ore reali iterando sui timesheet gia caricati in memoria (niente chiamate N+1 DB)
    minuti_totali = 0
    costo_manodopera_calc = Decimal("0")
    if hasattr(c, "timesheet"):
        for t in c.timesheet:
            minuti_totali += (t.durata_minuti or 0)
            costo_manodopera_calc += (t.costo_lavoro or Decimal("0"))
    
    ore_reali = minuti_totali / 60.0

    # Escludi campi computed che richiedono lazy load
    d = CommessaOut.model_validate(c, from_attributes=True, strict=False).model_dump(warnings=False)
    d["ore_reali"] = float(ore_reali)
    
    # Sovrascrivo costo_manodopera con il costo REALE al momento calcolato da tutti i timesheet
    d["costo_manodopera"] = float(costo_manodopera_calc)
    
    # Calcola margine manualmente dalle righe già caricate
    try:
        fattCalc = sum(r.valore_fatturabile_calc for r in c.righe_progetto)
        for ag in (c.aggiustamenti or []):
            from decimal import Decimal as _D
            fattCalc += _D(str(ag.get('importo', 0)))
        d['margine_euro'] = float(fattCalc - costo_manodopera_calc - (c.costi_diretti or Decimal("0")))
        d['margine_percentuale'] = round(d['margine_euro'] / float(fattCalc) * 100, 1) if fattCalc > 0 else None
    except Exception:
        d['margine_euro'] = None
        d['margine_percentuale'] = None
        
    metriche = await calcola_metriche_commessa(db, c, coeff_cache)
    # Aggiorna metriche con il valore costo elaborato al volo
    d.update(metriche)
    
    d["aggiustamenti"] = c.aggiustamenti or []
    d["data_inizio"] = str(c.data_inizio) if c.data_inizio else None
    d["data_fine"] = str(c.data_fine) if c.data_fine else None
    
    # Utilizza la relazione .fattura se pre-caricata anziche' eseguire un'altra query SQL
    if hasattr(c, "fattura") and c.fattura:
        d["fattura_id"] = c.fattura.id
        d["fattura_numero"] = c.fattura.numero
        d["fattura_data"] = str(c.fattura.data_emissione) if c.fattura.data_emissione else None
        d["fattura_importo"] = float(c.fattura.importo_netto) if hasattr(c.fattura, "importo_netto") and c.fattura.importo_netto else None
        d["fattura_stato"] = c.fattura.stato_pagamento if hasattr(c.fattura, "stato_pagamento") else None
    
    return d

@router.get("/commesse", tags=["Commesse"])
async def get_commesse(
    mese: Optional[date] = Query(None, description="Formato YYYY-MM-01"),
    stato: Optional[CommessaStatus] = Query(None),
    cliente_id: Optional[uuid.UUID] = Query(None),
    progetto_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    commesse = await list_commesse(db, mese, stato, cliente_id, progetto_id)
    coeff_cache: dict[date, Decimal] = {}
    enriched = []
    for c in commesse:
        enriched.append(await _enrich_commessa(db, c, coeff_cache))
    return enriched

@router.get("/commesse/{commessa_id}", tags=["Commesse"])
async def get_single_commessa(
    commessa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = await get_commessa(db, commessa_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")
    return await _enrich_commessa(db, c)

@router.get("/commesse/{commessa_id}/profitability", tags=["Commesse"])
async def get_commessa_profitability(
    commessa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ritorna metriche di profittabilità in tempo reale per una commessa."""
    c = await get_commessa(db, commessa_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")

    # Ore consumate e costo manodopera dai timesheet
    minuti_totali = sum(t.durata_minuti or 0 for t in c.timesheet)
    costo_manodopera = float(sum(t.costo_lavoro or Decimal("0") for t in c.timesheet))
    ore_consumate = minuti_totali / 60.0
    ore_budget = float(c.ore_contratto or 0)

    # Valore fatturabile dalle righe progetto + aggiustamenti
    try:
        valore_fatturabile = float(sum(r.valore_fatturabile_calc for r in c.righe_progetto))
        for ag in (c.aggiustamenti or []):
            valore_fatturabile += float(ag.get("importo", 0))
    except Exception:
        valore_fatturabile = 0.0

    costi_diretti = float(c.costi_diretti or 0)
    margine_euro = valore_fatturabile - costo_manodopera - costi_diretti
    margine_percentuale = round(margine_euro / valore_fatturabile * 100, 1) if valore_fatturabile > 0 else None

    # Percentuale ore consumate rispetto al budget
    perc_ore = round(ore_consumate / ore_budget * 100, 1) if ore_budget > 0 else None

    # Livello alert
    if margine_percentuale is None:
        alert_level = "NO_DATA"
    elif margine_percentuale < 15:
        alert_level = "CRITICAL"
    elif margine_percentuale < 30:
        alert_level = "WARNING"
    else:
        alert_level = "OK"

    return {
        "commessa_id": str(commessa_id),
        "ore_budget": ore_budget,
        "ore_consumate": round(ore_consumate, 2),
        "perc_ore_consumate": perc_ore,
        "valore_fatturabile": valore_fatturabile,
        "costo_manodopera": round(costo_manodopera, 2),
        "costi_diretti": costi_diretti,
        "margine_euro": round(margine_euro, 2),
        "margine_percentuale": margine_percentuale,
        "alert_level": alert_level,
    }


@router.post("/commesse", status_code=201, tags=["Commesse"])
async def add_commessa(
    data: CommessaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    c = await create_commessa(db, data)
    c = await get_commessa(db, c.id)
    return await _enrich_commessa(db, c)

@router.patch("/commesse/{commessa_id}", tags=["Commesse"])
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
    if current_user.ruolo in (UserRole.DIPENDENTE, UserRole.FREELANCER, UserRole.COLLABORATORE):
        user_filter = current_user.id
    return await list_timesheet(db, user_filter, mese, stato, commessa_id)

async def _check_margin_and_notify(db: AsyncSession, commessa_id: Optional[uuid.UUID]) -> None:
    """Dopo l'inserimento di un timesheet, controlla il margine e crea notifiche se sotto soglia."""
    if not commessa_id:
        return
    try:
        from app.services.notification_service import create_notification
        from app.models.models import Commessa, CommessaProgetto, Timesheet as TS
        from sqlalchemy.orm import selectinload as sil

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
            for ag in (c.aggiustamenti or []):
                valore_fatturabile += float(ag.get("importo", 0))
        except Exception:
            valore_fatturabile = 0.0

        if valore_fatturabile <= 0:
            return

        costi_diretti = float(c.costi_diretti or 0)
        margine_euro = valore_fatturabile - costo_manodopera - costi_diretti
        margine_pct = round(margine_euro / valore_fatturabile * 100, 1)
        cliente_nome = c.cliente.nome if c.cliente else "?"
        mese_str = c.mese_competenza.strftime("%B %Y") if c.mese_competenza else "?"

        if margine_pct < 15:
            alert_type = "CRITICAL"
            title = f"⚠️ Margine CRITICO — {cliente_nome}"
            message = f"Commessa {mese_str}: margine sceso al {margine_pct}% (soglia critica: 15%)"
        elif margine_pct < 30:
            alert_type = "WARNING"
            title = f"Attenzione Margine — {cliente_nome}"
            message = f"Commessa {mese_str}: margine al {margine_pct}% (soglia warning: 30%)"
        else:
            return  # Tutto OK, nessuna notifica

        link = f"/commesse/{commessa_id}"

        # Notifica tutti gli ADMIN e PM
        admins_result = await db.execute(
            select(User).where(User.ruolo.in_([UserRole.ADMIN, UserRole.PM]))
        )
        for admin in admins_result.scalars().all():
            await create_notification(db, admin.id, title, message, alert_type, link)

    except Exception as e:
        logger.warning(f"Errore controllo margine commessa {commessa_id}: {e}")


@router.post("/timesheet", response_model=TimesheetOut, status_code=201, tags=["Timesheet"])
async def add_timesheet(
    data: TimesheetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ts = await create_timesheet(db, data, current_user.id)
    await _check_margin_and_notify(db, ts.commessa_id)
    return ts

@router.post("/timesheet/approva", response_model=List[TimesheetOut], tags=["Timesheet"])
async def bulk_approva(
    data: TimesheetApprova,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    return await approva_timesheet(db, data, current_user)


# ═══════════════════════════════════════════════════════
# REPORT / DASHBOARD
# ═══════════════════════════════════════════════════════
@router.get("/dashboard/kpi", tags=["Report"])
async def dashboard_kpi(
    response: Response,
    mese: date = Query(..., description="Formato YYYY-MM-01"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    response.headers["Cache-Control"] = "private, max-age=120"
    return await get_dashboard_kpi(db, mese)

@router.get("/report/marginalita", tags=["Report"])
async def report_marginalita(
    response: Response,
    mese: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    response.headers["Cache-Control"] = "private, max-age=120"
    return await get_marginalita_clienti(db, mese)


# ═══════════════════════════════════════════════════════
# FATTURE IN CLOUD (SYNC MONODIREZIONALE)
# ═══════════════════════════════════════════════════════
@router.post("/fic/sync", response_model=FicSyncStatusOut, tags=["FIC"])
async def run_fic_sync(
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        return await sync_fic_data(db, current_user.id)


@router.get("/fic/sync/status", response_model=FicSyncStatusOut, tags=["FIC"])
async def fic_sync_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    status_obj = await get_last_fic_sync_status(db)
    if not status_obj:
        raise HTTPException(status_code=404, detail="Nessun sync FIC eseguito")
    return status_obj


@router.get("/fatture-attive", response_model=List[FatturaAttivaOut], tags=["FIC"])
async def get_fatture_attive(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    return await list_fatture_attive(db)

@router.patch("/fatture-attive/{fattura_id}/incassa", response_model=FatturaAttivaOut, tags=["FIC"])
async def patch_incassa_fattura(
    fattura_id: uuid.UUID,
    body: FatturaIncassaRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    fattura = await incassa_fattura(db, fattura_id, body.data_incasso)
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    return fattura


@router.patch("/fatture-attive/{fattura_id}", response_model=FatturaAttivaOut, tags=["FIC"])
async def patch_fattura_attiva(
    fattura_id: uuid.UUID,
    body: FatturaAttivaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.models.models import FatturaAttiva
    from sqlalchemy import select
    result = await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fattura_id))
    fattura = result.scalar_one_or_none()
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(fattura, key, value)
    
    await db.commit()
    await db.refresh(fattura)
    return fattura


@router.delete("/fatture-attive/{fattura_id}", status_code=204, tags=["FIC"])
async def delete_fattura_attiva(
    fattura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    from app.models.models import FatturaAttiva
    from sqlalchemy import select
    result = await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fattura_id))
    fattura = result.scalar_one_or_none()
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    await db.delete(fattura)
    await db.commit()


@router.get("/fornitori-full", tags=["Fornitori"])
async def get_fornitori_full(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    return await list_fornitori_full(db)

@router.post("/fornitori", response_model=FornitoreOut, status_code=201, tags=["Fornitori"])
async def add_fornitore(
    data: FornitoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from app.services.services import create_fornitore
    try:
        forn = await create_fornitore(db, data)
        await db.commit()
        return forn
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/fornitori/{fornitore_id}", response_model=FornitoreOut, tags=["Fornitori"])
async def patch_fornitore(
    fornitore_id: uuid.UUID,
    body: FornitoreUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    forn = await update_fornitore(db, fornitore_id, body.model_dump(exclude_none=True))
    if not forn:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    await db.commit()
    return forn

@router.get("/fatture-passive", tags=["FIC"])
async def get_fatture_passive(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    return await list_fatture_passive(db)


@router.patch("/fatture-passive/{fattura_id}", tags=["FIC"])
async def patch_fattura_passiva(
    fattura_id: uuid.UUID,
    body: FatturaPassivaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    fattura = await update_fattura_passiva(db, fattura_id, body.model_dump(exclude_none=True))
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    return fattura


@router.delete("/fatture-passive/{fattura_id}", status_code=204, tags=["FIC"])
async def delete_fattura_passive(
    fattura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    from app.models.models import FatturaPassiva
    from sqlalchemy import select
    result = await db.execute(select(FatturaPassiva).where(FatturaPassiva.id == fattura_id))
    fattura = result.scalar_one_or_none()
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    await db.delete(fattura)
    await db.commit()

@router.get("/fornitori", response_model=List[FornitoreOut], tags=["FIC"])
async def get_fornitori(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    return await list_fornitori(db)


@router.get("/movimenti-cassa", tags=["Cassa"])
async def get_movimenti_cassa(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER)),
):
    movimenti = await list_movimenti_cassa(db)
    return {"movimenti_cassa": movimenti}


@router.post("/movimenti-cassa/{movimento_id}/riconcilia", tags=["Cassa"])
async def riconcilia_movimento(
    movimento_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER)),
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
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER)),
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
            # Sincronizza stato commessa collegata alla fattura
            from app.models.models import Commessa, CommessaStatus
            from sqlalchemy import select as _sel
            cm_res = await db.execute(_sel(Commessa).where(Commessa.fattura_id == fa.id))
            cm = cm_res.scalar_one_or_none()
            if cm and cm.stato not in (CommessaStatus.INCASSATA,):
                cm.stato = CommessaStatus.INCASSATA

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
async def get_costi_fissi(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    return {"costi_fissi": await list_costi_fissi(db)}


@router.post("/costi-fissi", tags=["CostiFissi"])
async def post_costo_fisso(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
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
async def get_regole(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    from app.services.services import list_regole
    return {"regole": await list_regole(db)}


@router.post("/regole-riconciliazione", tags=["Regole"])
async def post_regola(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
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
async def applica_regole(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    from app.services.services import applica_regole_automatiche
    return await applica_regole_automatiche(db)


@router.get("/movimenti-cassa/{movimento_id}/suggest", tags=["Regole"])
async def suggest_mov(movimento_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from app.services.services import suggest_riconciliazione
    return await suggest_riconciliazione(db, movimento_id)


# ── IMPUTAZIONI FATTURE PASSIVE ───────────────────────────
@router.get("/fatture-passive/{fattura_id}/imputazioni", tags=["Imputazioni"])
async def get_imputazioni_fattura(
    fattura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
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
@router.patch("/commesse/{commessa_id}/fattura", response_model=CommessaOut, tags=["Commesse"])
async def collega_fattura_commessa(
    commessa_id: uuid.UUID,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    """Collega o scollega una fattura da una commessa. body: {fattura_id: uuid | null}"""
    from sqlalchemy import select as _sel
    c = await get_commessa(db, commessa_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commessa non trovata")
    fattura_id = body.get("fattura_id")
    if fattura_id:
        fa_res = await db.execute(_sel(FatturaAttiva).where(FatturaAttiva.id == uuid.UUID(str(fattura_id))))
        fa = fa_res.scalar_one_or_none()
        if not fa:
            raise HTTPException(status_code=404, detail="Fattura non trovata")
        c.fattura_id = fa.id
    else:
        c.fattura_id = None
    await db.commit()
    await db.refresh(c)
    return await _enrich_commessa(db, c)

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
async def get_risorse(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
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


# ── PIANIFICAZIONE COMMESSA ──────────────────────────────
@router.get("/piani", tags=["Pianificazione"])
async def list_piani(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
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
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
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
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from sqlalchemy import text
    from datetime import date as _date
    mese_str = payload.get("mese_competenza")
    mese = None
    if mese_str:
        try:
            parts = str(mese_str).split("-")
            mese = _date(int(parts[0]), int(parts[1]), 1)
        except (ValueError, IndexError, TypeError):
            mese = None
    res = await db.execute(text("""
        INSERT INTO piano_commessa (cliente_id, preventivo, margine_target_pct, budget_produttivo, ore_budget, costo_orario_snapshot, mese_competenza, note)
        VALUES (:cid, :prev, :marg, :budg, :ore, :co, :mese, :note) RETURNING id
    """), {
        "cid": payload["cliente_id"], "prev": payload.get("preventivo", 0),
        "marg": payload.get("margine_target_pct", 40), "budg": payload.get("budget_produttivo"),
        "ore": payload.get("ore_budget"), "co": payload.get("costo_orario_snapshot"),
        "mese": mese, "note": payload.get("note")
    })
    piano_id = str(res.fetchone()[0])
    for riga in payload.get("righe", []):
        await db.execute(text("INSERT INTO piano_commessa_righe (piano_id, risorsa_id, lavorazione, ore_pianificate, note) VALUES (:pid,:rid,:l,:o,:n)"),
            {"pid": piano_id, "rid": riga.get("risorsa_id") or None, "l": riga.get("lavorazione",""), "o": riga.get("ore_pianificate", 0), "n": riga.get("note")})
    await db.commit()
    return await get_piano(uuid.UUID(piano_id), db, current_user)

@router.patch("/piani/{piano_id}", tags=["Pianificazione"])
async def update_piano(
    piano_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    from sqlalchemy import text
    await db.execute(text("""
        UPDATE piano_commessa SET preventivo=:prev, margine_target_pct=:marg, budget_produttivo=:budg,
        ore_budget=:ore, costo_orario_snapshot=:co, mese_competenza=:mese, note=:note, updated_at=NOW()
        WHERE id=:pid
    """), {
        "prev": payload.get("preventivo", 0), "marg": payload.get("margine_target_pct", 40),
        "budg": payload.get("budget_produttivo"), "ore": payload.get("ore_budget"),
        "co": payload.get("costo_orario_snapshot"), "mese": payload.get("mese_competenza"),
        "note": payload.get("note"), "pid": str(piano_id)
    })
    await db.execute(text("DELETE FROM piano_commessa_righe WHERE piano_id=:pid"), {"pid": str(piano_id)})
    for riga in payload.get("righe", []):
        await db.execute(text("INSERT INTO piano_commessa_righe (piano_id, risorsa_id, lavorazione, ore_pianificate, note) VALUES (:pid,:rid,:l,:o,:n)"),
            {"pid": str(piano_id), "rid": riga.get("risorsa_id") or None, "l": riga.get("lavorazione",""), "o": riga.get("ore_pianificate", 0), "n": riga.get("note")})
    await db.commit()
    return await get_piano(piano_id, db, current_user)

@router.patch("/piani/{piano_id}/collega-commessa", tags=["Pianificazione"])
async def collega_commessa_piano(piano_id: uuid.UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from sqlalchemy import text
    commessa_id = payload.get("commessa_id")
    await db.execute(text("UPDATE piano_commessa SET commessa_id=:cid, updated_at=NOW() WHERE id=:pid"),
        {"cid": commessa_id, "pid": str(piano_id)})
    if commessa_id:
        await db.execute(text("UPDATE commesse SET piano_id=:pid, preventivo=COALESCE((SELECT preventivo FROM piano_commessa WHERE id=:pid),0) WHERE id=:cid"),
            {"pid": str(piano_id), "cid": commessa_id})
    await db.commit()
    return {"ok": True}

@router.get("/piani/{piano_id}/consuntivo", tags=["Pianificazione"])
async def get_consuntivo_piano(piano_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
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
async def delete_piano(piano_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from sqlalchemy import text
    await db.execute(text("DELETE FROM piano_commessa WHERE id=:pid"), {"pid": str(piano_id)})
    await db.commit()

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
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
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
    await _check_margin_and_notify(db, commessa_id)
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

# ═══════════════════════════════════════════════════════
# ── DASHBOARD & STATS ───────────────────────────────────

@router.get("/projects/{progetto_id}/stats", tags=["Dashboard", "Progetti"])
async def get_project_dashboard_stats(
    progetto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restituisce le statistiche per la dashboard del progetto."""
    from app.services.services import get_project_stats
    return await get_project_stats(db, progetto_id)

@router.get("/clienti/{cliente_id}/stats", tags=["Dashboard", "Clienti"])
async def get_client_dashboard_stats(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restituisce le statistiche aggregate per tutti i progetti di un cliente."""
    from app.services.services import get_project_stats
    from app.models.models import Progetto
    from sqlalchemy import select
    
    # 1. Recupera tutti i progetti del cliente
    result = await db.execute(select(Progetto.id).where(Progetto.cliente_id == cliente_id))
    project_ids = result.scalars().all()
    
    if not project_ids:
        return {
            "kpis": {"total": 0, "today": 0, "overdue": 0, "upcoming": 0},
            "status_distribution": [],
            "team_stats": [],
            "critical_tasks": []
        }
    
    # 2. Aggrega i dati (per ora riutilizziamo la logica di progetto ma su scala cliente)
    # Una versione più efficiente farebbe una singola query, ma per ora aggreghiamo
    all_stats = []
    for pid in project_ids:
        all_stats.append(await get_project_stats(db, pid))
        
    # Semplice merge dei dati
    merged_kpis = {"total": 0, "today": 0, "overdue": 0, "upcoming": 0}
    merged_status = {}
    merged_team = {}
    merged_critical = []
    
    for s in all_stats:
        for k in merged_kpis:
            merged_kpis[k] += s["kpis"][k]
        for item in s["status_distribution"]:
            merged_status[item["status"]] = merged_status.get(item["status"], 0) + item["count"]
        for team in s["team_stats"]:
            tid = str(team["id"])
            if tid not in merged_team:
                merged_team[tid] = team
            else:
                merged_team[tid]["total_tasks"] += team["total_tasks"]
                merged_team[tid]["overdue_tasks"] += team["overdue_tasks"]
        merged_critical.extend(s["critical_tasks"])
        
    merged_critical.sort(key=lambda x: x["data_scadenza"] or date.max)
    
    return {
        "kpis": merged_kpis,
        "status_distribution": [{"status": s, "count": c} for s, c in merged_status.items()],
        "team_stats": list(merged_team.values()),
        "critical_tasks": merged_critical[:10]
    }

# ═══════════════════════════════════════════════════════

@router.get("/tasks", response_model=List[TaskOut], tags=["Tasks"])
async def get_tasks(
    progetto_id: Optional[uuid.UUID] = Query(None),
    commessa_id: Optional[uuid.UUID] = Query(None),
    assegnatario_id: Optional[uuid.UUID] = Query(None),
    stato: Optional[TaskStatus] = Query(None),
    parent_only: bool = Query(False),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await list_tasks(db, progetto_id, commessa_id, assegnatario_id, stato, parent_only, start_date, end_date)

@router.get("/tasks/{task_id}", response_model=TaskOut, tags=["Tasks"])
async def get_single_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    t = await get_task(db, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task non trovata")
    return t

@router.post("/tasks", response_model=TaskOut, status_code=201, tags=["Tasks"])
async def add_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await create_task(db, data)

@router.patch("/tasks/{task_id}", response_model=TaskOut, tags=["Tasks"])
async def patch_task(
    task_id: uuid.UUID,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    t = await update_task(db, task_id, data, current_user.id)
    if not t:
        raise HTTPException(status_code=404, detail="Task non trovata")
    return t

@router.delete("/tasks/{task_id}", status_code=204, tags=["Tasks"])
async def remove_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ok = await delete_task(db, task_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Task non trovata")
    await db.commit()


# ── BUDGET ────────────────────────────────────────────────

@router.get("/budget/categorie", response_model=List[BudgetCategoryOut], tags=["Budget"])
async def list_budget_categories_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import BudgetCategory
    result = await db.execute(select(BudgetCategory).order_by(BudgetCategory.nome))
    return result.scalars().all()

@router.post("/budget/categorie", response_model=BudgetCategoryOut, status_code=201, tags=["Budget"])
async def create_budget_category_endpoint(
    data: BudgetCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
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
    current_user: User = Depends(get_current_user)
):
    from app.models.models import BudgetMensile
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
    await db.refresh(b)
    return b

@router.post("/budget/copia", tags=["Budget"])
async def copy_prev_month_budget(
    mese_corrente: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
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

@router.get("/budget/consuntivo", response_model=List[BudgetConsuntivoOut], tags=["Budget"])
async def get_budget_consuntivo(
    mese: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
    await db.refresh(article)
    
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
    await db.refresh(art)
    return art

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
    await db.refresh(article)
    return article

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
async def get_crm_stages(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    res = await db.execute(select(CRMStage).order_by(CRMStage.ordine))
    return res.scalars().all()

@router.get("/crm/lead", response_model=List[CRMLeadOut], tags=["CRM"])
async def get_crm_leads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import select, or_
    from sqlalchemy.orm import joinedload, selectinload
    
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
    await db.refresh(lead)
    return lead

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
    await db.refresh(lead)
    return lead

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
        ragione_sociale=lead.nome_azienda,
        referente=lead.nome_contatto,
        email=lead.email,
        telefono=lead.telefono,
        note=f"Convertito da CRM lead il {date.today()}\n{lead.note or ''}"
    )
    db.add(new_client)
    
    # 2. Aggiorna Lead Stadio (Vinto)
    res_stadi = await db.execute(select(CRMStage).where(CRMStage.nome == 'Chiuso Vinto'))
    stadio_vinto = res_stadi.scalar_one_or_none()
    if stadio_vinto:
        lead.stadio_id = stadio_vinto.id
        lead.probabilita_chiusura = 100
        
    await db.commit()
    return {"message": "Lead convertito in cliente con successo", "cliente_id": new_client.id}

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
