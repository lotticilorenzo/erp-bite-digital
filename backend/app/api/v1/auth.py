import logging
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    get_current_user,
    verify_password,
)
from app.db.session import get_db
from app.models.models import User
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest
from app.schemas.schemas import LoginRequest, TokenResponse, UserOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

_login_attempts: dict[str, list[float]] = defaultdict(list)
_LOGIN_MAX = 10
_LOGIN_WINDOW = 60.0
password_reset_history: dict[str, list[datetime]] = {}


def _check_login_rate(ip: str) -> None:
    now = time.time()
    attempts = _login_attempts[ip]
    _login_attempts[ip] = [timestamp for timestamp in attempts if now - timestamp < _LOGIN_WINDOW]
    if len(_login_attempts[ip]) >= _LOGIN_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Troppi tentativi. Riprova tra {_LOGIN_WINDOW:.0f} secondi.",
            headers={"Retry-After": str(int(_LOGIN_WINDOW))},
        )
    _login_attempts[ip].append(now)


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    from app.services.services import get_user_by_identifier

    _check_login_rate(request.client.host if request.client else "unknown")
    user = await get_user_by_identifier(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide")
    if not user.attivo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disattivato")
    token = create_access_token({"sub": str(user.id), "ruolo": user.ruolo})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.delete("/sessions")
async def logout_all_sessions(current_user: User = Depends(get_current_user)):
    return {"message": "Successo"}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    from app.services.services import get_user_by_email

    now = datetime.utcnow()
    history = password_reset_history.get(data.email, [])
    history = [timestamp for timestamp in history if now - timestamp < timedelta(hours=1)]
    if len(history) >= 3:
        raise HTTPException(status_code=429, detail="Troppe richieste. Riprova tra un'ora.")

    password_reset_history[data.email] = history + [now]

    user = await get_user_by_email(db, data.email)
    if not user:
        return {"message": "Se l'email esiste, riceverai un link di reset."}

    token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(hours=1)

    await db.execute(
        text("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (:u, :t, :e)"),
        {"u": user.id, "t": token, "e": expires_at},
    )
    await db.commit()

    conf = ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=settings.MAIL_TLS,
        MAIL_SSL_TLS=settings.MAIL_SSL,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
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
        subtype=MessageType.html,
    )

    fm = FastMail(conf)
    try:
        await fm.send_message(message)
    except Exception as exc:
        logger.error("Errore invio email reset password: %s", exc)

    return {"message": "Se l'email esiste, riceverai un link di reset."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    from app.core.security import hash_password

    now = datetime.utcnow()
    result = await db.execute(
        text("SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = :t"),
        {"t": data.token},
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=400, detail="Token non valido")

    user_id, expires_at, used = row

    if now > expires_at:
        raise HTTPException(status_code=400, detail="Token scaduto")

    mark_result = await db.execute(
        text(
            "UPDATE password_reset_tokens SET used = true "
            "WHERE token = :t AND used = false RETURNING user_id"
        ),
        {"t": data.token},
    )
    if not mark_result.fetchone():
        raise HTTPException(status_code=400, detail="Token gia utilizzato")

    hashed_pwd = hash_password(data.new_password)
    await db.execute(
        text("UPDATE users SET password_hash = :h WHERE id = :u"),
        {"h": hashed_pwd, "u": user_id},
    )

    await db.commit()

    return {"message": "Password aggiornata con successo", "success": True}
