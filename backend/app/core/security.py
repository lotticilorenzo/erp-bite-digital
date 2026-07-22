from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security.utils import get_authorization_scheme_param
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db.session import get_db
from app.models.models import UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Ruoli che vedono solo Studio OS — nessun accesso finance o ERP.
# PM è deprecated (→ COLLABORATORE/ADMIN) ma finché esiste in DB deve essere limitato.
STUDIO_ONLY_ROLES = frozenset({
    UserRole.COLLABORATORE,
    UserRole.DIPENDENTE,
    UserRole.FREELANCER,
    UserRole.PM,
})

# Ruoli con accesso ERP e Finance.
# DEVELOPER equivale ad ADMIN per accesso funzionale (account sviluppo gestionale).
# MANUTENTORE (Fase M, super-admin) e' un superset di ADMIN: non deve mai perdere un accesso.
ERP_ACCESS_ROLES = frozenset({UserRole.ADMIN, UserRole.DEVELOPER, UserRole.MANUTENTORE})
FINANCE_ACCESS_ROLES = ERP_ACCESS_ROLES

# Ruoli admin-equivalenti: possono creare utenti, accedere a HR, etc.
ADMIN_EQUIVALENT_ROLES = frozenset({UserRole.ADMIN, UserRole.DEVELOPER, UserRole.MANUTENTORE})

# Solo il super-admin (Fase M): gestione utenti (creazione account, cambio ruolo) e
# impostazioni di sistema. Riservato — non equivale ad ADMIN, e' sopra.
MANUTENTORE_ROLES = frozenset({UserRole.MANUTENTORE})
ACCESS_TOKEN_SCOPE = "access"
CHAT_WS_TOKEN_SCOPE = "chat_ws"
CHAT_WS_TICKET_TTL = timedelta(seconds=60)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _jwt_secret() -> str:
    # Compatibilita: supporta JWT_SECRET e SECRET_KEY (fallback).
    return settings.JWT_SECRET or settings.SECRET_KEY


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    return _create_signed_token(data, scope=ACCESS_TOKEN_SCOPE, expires_delta=expires_delta)


def _create_signed_token(data: dict, scope: str, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "scope": scope})
    return jwt.encode(to_encode, _jwt_secret(), algorithm=settings.ALGORITHM)


def _normalize_role(role: UserRole | str | None) -> UserRole | None:
    if role is None:
        return None
    if isinstance(role, UserRole):
        return role
    try:
        return UserRole(str(role).upper())
    except ValueError:
        return None


def is_studio_only_role(role: UserRole | str | None) -> bool:
    return _normalize_role(role) in STUDIO_ONLY_ROLES


def has_finance_access(role: UserRole | str | None) -> bool:
    return _normalize_role(role) in FINANCE_ACCESS_ROLES


def has_erp_access(role: UserRole | str | None) -> bool:
    return _normalize_role(role) in ERP_ACCESS_ROLES


def ensure_erp_access_user(current_user):
    if not has_erp_access(getattr(current_user, "ruolo", None)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accesso ERP consentito solo agli amministratori",
        )
    return current_user


def create_chat_ws_ticket(data: dict) -> str:
    return _create_signed_token(data, scope=CHAT_WS_TOKEN_SCOPE, expires_delta=CHAT_WS_TICKET_TTL)


def hash_opaque_token(token: str) -> str:
    secret = _jwt_secret()
    return sha256(f"{secret}:{token}".encode("utf-8")).hexdigest()


def _scope_is_allowed(payload_scope: str | None, required_scope: str | None) -> bool:
    if required_scope is None:
        return True
    if required_scope == ACCESS_TOKEN_SCOPE:
        return payload_scope in (None, ACCESS_TOKEN_SCOPE)
    return payload_scope == required_scope


def _token_version(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


async def get_user_from_token(db: AsyncSession, token: str, required_scope: str | None = ACCESS_TOKEN_SCOPE):
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[settings.ALGORITHM])
        if not _scope_is_allowed(payload.get("scope"), required_scope):
            return None
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None

    from app.services.services import get_user_by_id
    user = await get_user_by_id(db, user_id)
    if user is None or not user.attivo:
        return None
    if _token_version(payload.get("ver")) != _token_version(getattr(user, "token_version", 0)):
        return None
    return user


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token non valido o scaduto",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = request.cookies.get("access_token")
    if not token:
        authorization = request.headers.get("Authorization")
        if authorization:
            scheme, param = get_authorization_scheme_param(authorization)
            if scheme.lower() == "bearer":
                token = param

    if not token:
        raise credentials_exception

    user = await get_user_from_token(db, token, required_scope=ACCESS_TOKEN_SCOPE)
    if user is None:
        raise credentials_exception
    return user


def require_roles(*roles):
    """Decorator per limitare l'accesso per ruolo.

    FIX CENTRALE (Fase M): dove e' ammesso ADMIN sono ammessi TUTTI gli admin-equivalenti
    (ADMIN_EQUIVALENT_ROLES: ADMIN, DEVELOPER, MANUTENTORE). Le firme storiche scrivevano gli
    enum a mano (es. require_roles(ADMIN, PM)) e ogni nuovo ruolo admin-equivalente prendeva
    403 a caso; risolvere qui copre ogni occorrenza presente e futura, senza allargare nulla
    dove ADMIN non e' gia' ammesso."""
    async def role_checker(current_user=Depends(get_current_user)):
        role = _normalize_role(getattr(current_user, "ruolo", None))
        allowed = set(roles)
        if UserRole.ADMIN in allowed:
            allowed |= ADMIN_EQUIVALENT_ROLES
        if role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Ruolo {current_user.ruolo} non autorizzato per questa operazione"
            )
        return current_user
    return role_checker


async def require_finance_access(current_user=Depends(get_current_user)):
    """Permette l'accesso solo ai ruoli autorizzati all'area finance."""
    if not has_finance_access(getattr(current_user, "ruolo", None)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accesso area finanziaria consentito solo agli amministratori",
        )
    return current_user


async def require_erp_access(current_user=Depends(get_current_user)):
    """Permette l'accesso solo ai ruoli autorizzati all'ERP."""
    return ensure_erp_access_user(current_user)


async def require_admin(current_user=Depends(get_current_user)):
    """Guard per operazioni che richiedono ruolo ADMIN o DEVELOPER."""
    role = _normalize_role(getattr(current_user, "ruolo", None))
    if role not in ADMIN_EQUIVALENT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operazione consentita solo agli amministratori",
        )
    return current_user


async def require_manutentore(current_user=Depends(get_current_user)):
    """Guard per il super-admin (Fase M): creazione utenti, cambio ruolo, impostazioni sistema.
    Piu' stretto di require_admin — un ADMIN normale non basta."""
    role = _normalize_role(getattr(current_user, "ruolo", None))
    if role not in MANUTENTORE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operazione consentita solo al manutentore di sistema",
        )
    return current_user
