"""Audit logging service.

Writes to the audit_log table for security-relevant events.
Call emit() from endpoint handlers — it never raises so it cannot break
the main request flow.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ── Azione constants ──────────────────────────────────────────────────────────
LOGIN_OK = "LOGIN_OK"
LOGIN_FAIL = "LOGIN_FAIL"
LOGOUT_ALL = "LOGOUT_ALL"
CREATE = "CREATE"
UPDATE = "UPDATE"
DELETE = "DELETE"
APPROVE = "APPROVE"
REJECT = "REJECT"
SYNC = "SYNC"
EXPORT = "EXPORT"
PERMISSION_DENIED = "PERMISSION_DENIED"


def _json_safe(value: Any) -> Any:
    """Convert common Python/ORM values to JSON-safe primitives."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value

    if isinstance(value, uuid.UUID):
        return str(value)

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Enum):
        return value.value

    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]

    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return _json_safe(model_dump())

    return str(value)


async def emit(
    db: AsyncSession,
    *,
    tabella: str,
    azione: str,
    record_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    dati_prima: Optional[dict] = None,
    dati_dopo: Optional[dict] = None,
) -> None:
    """Write one audit log row. Never raises — failures are logged and swallowed."""
    try:
        from app.models.models import AuditLog
        log_entry = AuditLog(
            user_id=user_id,
            tabella=tabella,
            record_id=record_id or uuid.uuid4(),
            azione=azione,
            dati_prima=_json_safe(dati_prima),
            dati_dopo=_json_safe(dati_dopo),
        )
        db.add(log_entry)
        # flush without committing so the audit row goes in the same transaction
        await db.flush()
    except Exception:
        logger.exception("audit.emit failed silently — tabella=%s azione=%s", tabella, azione)


async def emit_login(
    db: AsyncSession,
    *,
    user_id: Optional[uuid.UUID],
    email: str,
    success: bool,
    ip: Optional[str] = None,
) -> None:
    await emit(
        db,
        tabella="users",
        azione=LOGIN_OK if success else LOGIN_FAIL,
        record_id=user_id or uuid.UUID(int=0),
        user_id=user_id,
        dati_dopo={"email": email, "ip": ip, "success": success},
    )


async def emit_create(
    db: AsyncSession,
    *,
    tabella: str,
    record_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    dati: Optional[dict] = None,
) -> None:
    await emit(db, tabella=tabella, azione=CREATE, record_id=record_id, user_id=user_id, dati_dopo=dati)


async def emit_update(
    db: AsyncSession,
    *,
    tabella: str,
    record_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    prima: Optional[dict] = None,
    dopo: Optional[dict] = None,
) -> None:
    await emit(db, tabella=tabella, azione=UPDATE, record_id=record_id, user_id=user_id, dati_prima=prima, dati_dopo=dopo)


async def emit_delete(
    db: AsyncSession,
    *,
    tabella: str,
    record_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    dati: Optional[dict] = None,
) -> None:
    await emit(db, tabella=tabella, azione=DELETE, record_id=record_id, user_id=user_id, dati_prima=dati)


async def emit_approve(
    db: AsyncSession,
    *,
    tabella: str,
    record_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    azione: str = APPROVE,
    note: Optional[str] = None,
) -> None:
    await emit(db, tabella=tabella, azione=azione, record_id=record_id, user_id=user_id, dati_dopo={"note": note} if note else None)
