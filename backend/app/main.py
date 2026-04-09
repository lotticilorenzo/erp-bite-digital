import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func, text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal, engine, Base
from app.models.models import User, UserRole
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

from fastapi import Request
from starlette.responses import JSONResponse
import traceback
import sys
from datetime import datetime

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        # Log to stdout for docker logs
        print(f"\n--- ERROR {datetime.now()} ---", file=sys.stderr)
        print(f"URL: {request.url}", file=sys.stderr)
        traceback.print_exc()
        print("-" * 80 + "\n", file=sys.stderr)
        
        # Also write to a file for persistence
        with open("/tmp/error_traceback.txt", "a") as f:
            f.write(f"\n--- ERROR {datetime.now()} ---\n")
            f.write(f"URL: {request.url}\n")
            f.write(traceback.format_exc())
            f.write("-" * 80 + "\n")
            
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error - Traceback logged"}
        )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"\n--- GLOBAL ERROR {datetime.now()} ---", file=sys.stderr)
    print(f"URL: {request.url}", file=sys.stderr)
    traceback.print_exc()
    print("-" * 80 + "\n", file=sys.stderr)
    
    # Scrivi anche su file
    with open("/tmp/error_traceback.txt", "a") as f:
        f.write(f"\n--- GLOBAL ERROR {datetime.now()} ---\n")
        f.write(f"URL: {request.url}\n")
        f.write(traceback.format_exc())
        f.write("-" * 80 + "\n")
        
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error - Global Traceback logged"}
    )

@app.get("/")
async def root():
    return {"message": "Bite ERP API is running"}

app.include_router(router, prefix="/api/v1")


@app.on_event("startup")
async def ensure_schema_tables_on_startup():
    if not settings.AUTO_CREATE_MISSING_TABLES:
        return
    # Crea eventuali tabelle mancanti (utile in ambienti gia avviati senza migrazioni).
    import asyncio
    retries = 5
    while retries > 0:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await conn.execute(
                    text(
                        """
                        ALTER TABLE clienti
                        ADD COLUMN IF NOT EXISTS affidabilita VARCHAR(10) DEFAULT 'MEDIA'
                        """
                    )
                )
                await conn.execute(
                    text(
                        """
                        UPDATE clienti
                        SET affidabilita = 'MEDIA'
                        WHERE affidabilita IS NULL
                        """
                    )
                )
            logger.info("Schema database garantito.")
            break
        except Exception as e:
            retries -= 1
            logger.warning(f"Database non pronto, riprovo tra 2s... ({retries} tentativi rimasti). Errore: {e}")
            await asyncio.sleep(2)
    if retries == 0:
        logger.error("Impossibile connettersi al database dopo diversi tentativi.")


@app.on_event("startup")
async def bootstrap_admin_on_startup():
    if not settings.BOOTSTRAP_ADMIN_ENABLED:
        return

    email = str(settings.BOOTSTRAP_ADMIN_EMAIL).strip().lower()
    password = settings.BOOTSTRAP_ADMIN_PASSWORD.strip()
    if not email or not password:
        return

    # Attendi un istante per assicurarsi che le tabelle siano state create dall'evento precedente
    import asyncio
    await asyncio.sleep(1)

    async with AsyncSessionLocal() as db:
        try:
            # Verifica se la tabella users esiste davvero
            res = await db.execute(text("SELECT to_regclass('public.users')"))
            if not res.scalar_one():
                logger.warning("Tabella 'users' non trovata. Salto bootstrap admin.")
                return

            users_count_res = await db.execute(select(func.count(User.id)))
            users_count = users_count_res.scalar_one()
            if users_count and users_count > 0:
                # Se l'admin esiste già, non fare nulla
                existing_admin = await db.execute(select(User).where(User.email == email))
                if not existing_admin.scalar_one_or_none():
                    logger.info(f"Admin {email} mancante in un DB non vuoto? Controllo manuale richiesto.")
                return

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
            logger.info(f"Bootstrap Admin creato con successo: {email}")
        except Exception as e:
            logger.error(f"Errore durante il bootstrap dell'admin: {e}")


@app.on_event("startup")
async def seed_data_on_startup():
    from app.services.services import seed_default_categories
    import asyncio
    await asyncio.sleep(2) # Attendi che il bootstrap admin finisca (opzionale)
    async with AsyncSessionLocal() as db:
        try:
            await seed_default_categories(db)
            logger.info("Seeding categorie completato.")
        except Exception as e:
            logger.error(f"Errore durante il seeding delle categorie: {e}")


@app.on_event("startup")
async def setup_schedulers():
    global scheduler
    if scheduler and scheduler.running:
        return

    # Inizializza lo scheduler
    scheduler = AsyncIOScheduler(timezone=settings.FIC_SYNC_TIMEZONE)

    # 1. JOB SYNC FIC (se abilitato)
    if settings.FIC_SYNC_SCHEDULE_ENABLED:
        async def scheduled_fic_sync() -> None:
            async with AsyncSessionLocal() as db:
                try:
                    await sync_fic_data(db, triggered_by=None)
                except Exception:
                    logger.exception("Errore sync FIC schedulata")

        scheduler.add_job(
            scheduled_fic_sync,
            trigger=IntervalTrigger(minutes=5),
            id="fic_sync_interval",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )

    # 2. JOB NOTIFICHE GIORNALIERE (09:00)
    async def scheduled_daily_notifications() -> None:
        try:
            async with AsyncSessionLocal() as db:
                await check_and_create_notifications(db)
        except Exception as e:
            logger.error(f"Errore notifiche: {e}")

    scheduler.add_job(
        scheduled_daily_notifications,
        trigger=CronTrigger(hour=9, minute=0),
        id="daily_notifications",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    # 3. JOB NOTIFICHE ORARIE (es. timer)
    async def scheduled_hourly_notifications() -> None:
        async with AsyncSessionLocal() as db:
            await check_hourly_notifications(db)

    scheduler.add_job(
        scheduled_hourly_notifications,
        trigger=IntervalTrigger(hours=1),
        id="hourly_notifications",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler avviato con successo (FIC, Daily & Hourly Notifications)")

@app.on_event("startup")
async def run_notifications_on_startup():
    """Esegue un controllo immediato delle notifiche all'avvio."""
    import asyncio
    await asyncio.sleep(5) # Attendi che il sistema sia pienamente pronto
    async with AsyncSessionLocal() as db:
        logger.info("Esecuzione controllo notifiche immediato allo startup...")
        await check_and_create_notifications(db)
        await check_hourly_notifications(db)

@app.on_event("shutdown")
async def shutdown_fic_scheduler():
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
    scheduler = None


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
