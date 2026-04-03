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
async def setup_fic_scheduler():
    global scheduler
    if not settings.FIC_SYNC_SCHEDULE_ENABLED:
        return
    if scheduler and scheduler.running:
        return

    scheduler = AsyncIOScheduler(timezone=settings.FIC_SYNC_TIMEZONE)

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
    scheduler.start()


@app.on_event("shutdown")
async def shutdown_fic_scheduler():
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
    scheduler = None


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
