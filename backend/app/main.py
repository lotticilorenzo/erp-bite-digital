from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func, text
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.models import User, UserRole
from app.api.v1.router import router


def _parse_cors_origins(origins_raw: str) -> list[str]:
    origins: list[str] = []
    for raw in origins_raw.split(","):
        origin = raw.strip()
        if origin and origin not in origins:
            origins.append(origin)
    return origins or ["*"]


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(settings.CORS_ORIGINS),
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.on_event("startup")
async def bootstrap_admin_on_startup():
    if not settings.BOOTSTRAP_ADMIN_ENABLED:
        return

    email = str(settings.BOOTSTRAP_ADMIN_EMAIL).strip().lower()
    password = settings.BOOTSTRAP_ADMIN_PASSWORD.strip()
    if not email or not password:
        return

    async with AsyncSessionLocal() as db:
        users_table = (await db.execute(text("SELECT to_regclass('public.users')"))).scalar_one()
        if not users_table:
            # Schema non pronto: esce senza errori e riprovera al prossimo restart.
            return

        users_count = (await db.execute(select(func.count(User.id)))).scalar_one()
        if users_count and users_count > 0:
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


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
