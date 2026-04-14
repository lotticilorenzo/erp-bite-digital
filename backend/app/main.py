import logging
import os
import sys
import traceback
import uuid
from datetime import datetime, date, timezone
from typing import Optional

from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
    docs_url="/docs",
    redoc_url=None,
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

def _parse_cors_origins(origins_raw: str) -> list[str]:
    origins: list[str] = []
    for raw in origins_raw.split(","):
        origin = raw.strip()
        if origin and origin not in origins:
            origins.append(origin)
    return origins or ["*"]

logger = logging.getLogger(__name__)
scheduler: AsyncIOScheduler | None = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(settings.CORS_ORIGINS),
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── SECURITY HEADERS MIDDLEWARE ──────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' ws: wss: https:;"
    )
    return response

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        print(f"\n--- ERROR {datetime.now()} ---", file=sys.stderr)
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

@app.get("/")
async def root():
    return {"message": "Bite ERP API is running"}

@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}

app.include_router(router, prefix="/api/v1")

@app.on_event("startup")
async def ensure_schema_tables_on_startup():
    if not settings.AUTO_CREATE_MISSING_TABLES:
        return
    import asyncio
    retries = 5
    while retries > 0:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await conn.execute(text("ALTER TABLE clienti ADD COLUMN IF NOT EXISTS affidabilita VARCHAR(10) DEFAULT 'MEDIA'"))
                await conn.execute(text("UPDATE clienti SET affidabilita = 'MEDIA' WHERE affidabilita IS NULL"))
            logger.info("Schema database garantito.")
            break
        except Exception as e:
            retries -= 1
            logger.warning(f"Database non pronto, riprovo in 2s... ({retries} rimasti). Errore: {e}")
            await asyncio.sleep(2)

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
