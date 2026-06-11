import logging
from collections import defaultdict
import time
import os
import sys
import traceback
import uuid
from datetime import datetime, date, timezone
from typing import Optional

from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import JSONResponse
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.security import hash_password, get_current_user
from app.db.session import AsyncSessionLocal, engine, Base
from app.models.models import User, UserRole, Cliente
from app.api.v1.router import router
from app.services.services import sync_fic_data
from app.services.notification_service import check_and_create_notifications, check_hourly_notifications

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    # Swagger UI e OpenAPI schema disabilitati in produzione (DEBUG=false).
    # Esporre la documentazione pubblica rivela struttura API, tipi e route.
    docs_url="/docs" if settings.api_docs_enabled else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.api_docs_enabled else None,
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/app/uploads", StaticFiles(directory="app/uploads"), name="uploads")

logger = logging.getLogger(__name__)
# In-memory rate limiting (IP-based)
_request_history = defaultdict(list)
_RATE_LIMIT_MAX = 100  # requests per minute
_RATE_LIMIT_WINDOW = 60.0

scheduler: AsyncIOScheduler | None = None

app.add_middleware(GZipMiddleware, minimum_size=1000)

if settings.trusted_hosts_list:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts_list)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    # Whitelist esplicita — niente wildcard che espone TRACE/CONNECT
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    max_age=3600,
)

# ── SECURITY HEADERS MIDDLEWARE ──────────────────────────

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    if not settings.is_production:
        return await call_next(request)

    # Skip rate limiting for static files
    if request.url.path.startswith("/static"):
        return await call_next(request)
        
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    # Purge old requests
    _request_history[client_ip] = [t for t in _request_history[client_ip] if now - t < _RATE_LIMIT_WINDOW]
    
    if len(_request_history[client_ip]) >= _RATE_LIMIT_MAX:
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        return JSONResponse(
            status_code=429,
            content={"detail": "Troppe richieste. Riprova più tardi."},
            headers={"Retry-After": str(int(_RATE_LIMIT_WINDOW))}
        )
        
    _request_history[client_ip].append(now)
    return await call_next(request)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    script_src = "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " if settings.DEBUG else "script-src 'self'; "
    connect_src = "connect-src 'self' http: https: ws: wss:; " if settings.DEBUG else "connect-src 'self' https: wss:; "
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.ENABLE_HSTS:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        f"{script_src}"
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        f"{connect_src}"
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self';"
    )
    if request.url.path.startswith("/api/v1/auth/") or request.url.path == "/api/v1/users/me/export":
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        # In produzione: log senza stacktrace visibile al client
        logger.error(f"Unhandled exception on {request.method} {request.url.path}: {type(exc).__name__}")
        if settings.DEBUG:
            traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error"}
        )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )

from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 Validation Error on {request.method} {request.url.path}: {exc.errors()} - Body: {exc.body}")
    # jsonable_encoder + custom_encoder: gli errori Pydantic v2 possono avere `ctx` con valori non
    # JSON-nativi (Decimal dai constraint gt/ge, oggetti Exception dai field_validator). Senza questo
    # la JSONResponse falliva la serializzazione e degradava a 500 invece del 422 corretto.
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"detail": exc.errors()}, custom_encoder={Exception: str}),
    )

@app.get("/")
async def root():
    return {"message": "Bite ERP API is running"}

@app.get("/health")
async def health():
    # Non esporre la versione: darebbe info utili per attacchi mirati
    return {"status": "ok"}

app.include_router(router, prefix="/api/v1")

@app.on_event("startup")
async def validate_security_config():
    """Blocca l'avvio se la configurazione di sicurezza è insicura."""
    insecure_defaults = {"CAMBIA_QUESTA_CHIAVE_IN_PRODUZIONE", "secret", "changeme", ""}
    secret = settings.JWT_SECRET or settings.SECRET_KEY
    if secret in insecure_defaults and not settings.DEBUG:
        logger.critical(
            "SICUREZZA: JWT_SECRET non configurato! Imposta JWT_SECRET nel file .env "
            "con un valore casuale di almeno 32 caratteri. Avvio bloccato."
        )
        raise RuntimeError("JWT_SECRET non sicuro — configurare prima di avviare in produzione")
    if len(secret) < 32:
        logger.warning(
            f"SICUREZZA: JWT_SECRET troppo corto ({len(secret)} caratteri). "
            "Consigliato almeno 32 caratteri casuali."
        )
    if not settings.DEBUG and not settings.trusted_hosts_list:
        logger.warning(
            "SICUREZZA: TRUSTED_HOSTS non configurato. "
            "Consigliato impostare gli host pubblici consentiti per mitigare host-header attacks."
        )
    if not settings.DEBUG and settings.AUTO_CREATE_MISSING_TABLES:
        logger.warning(
            "SICUREZZA: AUTO_CREATE_MISSING_TABLES=true in produzione aumenta il rischio di drift schema. "
            "Consigliato disabilitarlo e usare solo migrazioni versionate."
        )

@app.on_event("startup")
async def ensure_schema_tables_on_startup():
    if not settings.AUTO_CREATE_MISSING_TABLES:
        return
    import asyncio
    retries = 5
    while retries > 0:
        try:
            async with engine.begin() as conn:
                # 1. Create ORM tables
                await conn.run_sync(Base.metadata.create_all)
                logger.info("Tabelle ORM verificate.")

                # 2. Ensure Types and Extensions
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))
                await conn.execute(text("""
                    DO $$ 
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_start_day_type') THEN
                            CREATE TYPE client_start_day_type AS ENUM ('STANDARD_1', 'CROSS_15');
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pianificazione_status') THEN
                            CREATE TYPE pianificazione_status AS ENUM ('PENDING', 'ACCEPTED', 'CONVERTED');
                        END IF;
                    END $$;
                """))
                
                # 3. Manual Schema Updates (Fallback for missing migrations)
                await conn.execute(text("ALTER TABLE clienti ADD COLUMN IF NOT EXISTS affidabilita VARCHAR(10) DEFAULT 'MEDIA'"))
                await conn.execute(text("ALTER TABLE clienti ADD COLUMN IF NOT EXISTS start_day_type client_start_day_type DEFAULT 'STANDARD_1'"))
                await conn.execute(text("ALTER TABLE clienti ADD COLUMN IF NOT EXISTS google_drive_url VARCHAR(500)"))

                # 4. Critical missing tables
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS piano_commessa (
                        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        cliente_id            UUID NOT NULL REFERENCES clienti(id),
                        commessa_id           UUID REFERENCES commesse(id) ON DELETE SET NULL,
                        preventivo            NUMERIC(10,2) DEFAULT 0,
                        margine_target_pct    NUMERIC(5,2) DEFAULT 40,
                        budget_produttivo     NUMERIC(10,2),
                        ore_budget            NUMERIC(8,2),
                        costo_orario_snapshot NUMERIC(10,2),
                        mese_competenza       DATE,
                        note                  TEXT,
                        created_at            TIMESTAMPTZ DEFAULT NOW(),
                        updated_at            TIMESTAMPTZ DEFAULT NOW()
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS piano_commessa_righe (
                        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        piano_id        UUID NOT NULL REFERENCES piano_commessa(id) ON DELETE CASCADE,
                        risorsa_id      UUID REFERENCES risorse(id) ON DELETE SET NULL,
                        lavorazione     VARCHAR(255) DEFAULT '',
                        ore_pianificate NUMERIC(8,2) DEFAULT 0,
                        note            TEXT,
                        created_at      TIMESTAMPTZ DEFAULT NOW()
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS password_reset_tokens (
                        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        token       VARCHAR(255) UNIQUE NOT NULL,
                        expires_at  TIMESTAMPTZ NOT NULL,
                        used        BOOLEAN DEFAULT FALSE,
                        created_at  TIMESTAMPTZ DEFAULT NOW()
                    )
                """))

                # Add foreign keys only after the referenced tables exist.
                await conn.execute(text("ALTER TABLE commesse ADD COLUMN IF NOT EXISTS pianificazione_id UUID REFERENCES pianificazioni(id)"))
                await conn.execute(text("ALTER TABLE commesse ADD COLUMN IF NOT EXISTS piano_id UUID REFERENCES piano_commessa(id) ON DELETE SET NULL"))
                await conn.execute(text("ALTER TABLE commesse ADD COLUMN IF NOT EXISTS preventivo NUMERIC(10,2) DEFAULT 0"))

                # 5. Performance Indexes
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_timesheet_user_stato     ON timesheet(user_id, stato)"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_timesheet_commessa_stato ON timesheet(commessa_id, stato)"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chat_msg_canale_created  ON chat_messaggi(canale_id, created_at DESC)"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_password_reset_token     ON password_reset_tokens(token)"))

            logger.info("Schema database garantito su startup.")
            return

        except Exception as e:
            retries -= 1
            logger.warning(f"Database non pronto, riprovo in 2s... ({retries} rimasti). Errore: {e}")
            if retries == 0:
                logger.error("Database non disponibile dopo vari tentativi. Esco.")
                raise e
            await asyncio.sleep(2)

@app.on_event("startup")
async def migrate_userrole_enum():
    # Legacy no-op: i nuovi valori enum vengono gestiti da run_db_migrations.py.
    return
    """Aggiunge i nuovi valori DEVELOPER e COLLABORATORE all'enum user_role in PostgreSQL.
    Operazione idempotente: non fa nulla se i valori esistono già."""
    new_roles = ["DEVELOPER", "COLLABORATORE"]
    async with AsyncSessionLocal() as session:
        try:
            async with session.begin():
                for role in new_roles:
                    # PostgreSQL non ha 'ADD VALUE IF NOT EXISTS' prima della v12.
                    # La gestiamo con un check preventivo.
                    check = await session.execute(
                        text("SELECT 1 FROM pg_enum WHERE enumtypid = 'user_role'::regtype::oid AND enumlabel = :role"),
                        {"role": role}
                    )
                    if not check.scalar():
                        # ALTER TYPE non supporta bind parameters — usiamo
                        # un allowlist esplicito per evitare SQL injection.
                        _allowed = {"DEVELOPER", "COLLABORATORE"}
                        if role not in _allowed:
                            logger.error("Ruolo '%s' non consentito nella migrazione enum.", role)
                            continue
                        await session.execute(
                            text(f"ALTER TYPE user_role ADD VALUE '{role}'")  # noqa: S608 — valore da allowlist
                        )
                        logger.info("Migrazione DB: aggiunto ruolo '%s' all'enum user_role.", role)
        except Exception as e:
            logger.warning(f"Migrazione enum user_role saltata (potrebbe già esistere): {e}")

@app.on_event("startup")
async def bootstrap_admin_on_startup():
    if not settings.BOOTSTRAP_ADMIN_ENABLED:
        return
    email = str(settings.BOOTSTRAP_ADMIN_EMAIL).strip().lower()
    password = settings.BOOTSTRAP_ADMIN_PASSWORD.strip()
    if not email or not password:
        return
    async with AsyncSessionLocal() as db:
        try:
            res = await db.execute(text("SELECT to_regclass('public.users')"))
            if not res.scalar_one():
                return
            existing_admin = (
                await db.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            if existing_admin:
                if not existing_admin.attivo:
                    existing_admin.attivo = True
                    await db.commit()
                    logger.info(f"Bootstrap Admin riattivato: {email}")
                return
            count_res = await db.execute(select(func.count(User.id)))
            if count_res.scalar_one() == 0:
                admin = User(
                    nome=settings.BOOTSTRAP_ADMIN_NOME.strip() or "Admin",
                    cognome=settings.BOOTSTRAP_ADMIN_COGNOME.strip() or "Bite",
                    email=email,
                    password_hash=hash_password(password),
                    ruolo=UserRole.ADMIN,
                    attivo=True,
                )
                db.add(admin)
                await db.commit()
                logger.info(f"Bootstrap Admin creato: {email}")
        except Exception as e:
            logger.error(f"Errore bootstrap admin: {e}")

@app.on_event("startup")
async def setup_schedulers():
    global scheduler
    if scheduler and scheduler.running:
        return
    scheduler = AsyncIOScheduler(timezone=settings.FIC_SYNC_TIMEZONE)
    if settings.FIC_SYNC_SCHEDULE_ENABLED:
        async def scheduled_fic_sync() -> None:
            async with AsyncSessionLocal() as db:
                try: await sync_fic_data(db, triggered_by=None)
                except Exception: logger.exception("Errore sync FIC")
        scheduler.add_job(scheduled_fic_sync, trigger=IntervalTrigger(minutes=5), id="fic_sync", max_instances=1, coalesce=True, replace_existing=True)
    
    async def scheduled_daily_notifications() -> None:
        async with AsyncSessionLocal() as db:
            try: await check_and_create_notifications(db)
            except Exception as e: logger.error(f"Errore notifiche: {e}")
    scheduler.add_job(scheduled_daily_notifications, trigger=CronTrigger(hour=9, minute=0), id="daily_notifications")

    async def scheduled_hourly_notifications() -> None:
        async with AsyncSessionLocal() as db:
            await check_hourly_notifications(db)
    scheduler.add_job(scheduled_hourly_notifications, trigger=IntervalTrigger(hours=1), id="hourly_notifications")
    
    scheduler.start()

@app.on_event("shutdown")
async def shutdown_scheduler():
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
    scheduler = None
