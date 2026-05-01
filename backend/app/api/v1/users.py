import io
import os
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.encoders import jsonable_encoder
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import ADMIN_EQUIVALENT_ROLES, get_current_user, require_admin
from app.db.session import get_db
from app.services import audit
from app.models.models import Progetto, ProgettoTeam, Risorsa, Task, TaskStatus, Timesheet, User, UserRole
from app.schemas.schemas import UserCreate, UserOut, UserPublicOut, UserUpdate


def _serialize_user(user: User, actor_role: UserRole) -> dict:
    """Restituisce UserOut completo per admin, UserPublicOut (no costo_orario) per tutti gli altri."""
    if actor_role in ADMIN_EQUIVALENT_ROLES:
        return UserOut.model_validate(user).model_dump(mode="json")
    return UserPublicOut.model_validate(user).model_dump(mode="json")
from app.services.services import (
    create_user,
    get_user_by_email,
    list_users,
    update_user,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserOut])
async def get_users(
    attivo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(require_admin),
):
    return await list_users(db, attivo)


@router.post("", response_model=UserOut, status_code=201)
async def add_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email già registrata")
    new_user = await create_user(db, data)
    await audit.emit_create(
        db,
        tabella="users",
        record_id=new_user.id,
        user_id=actor.id,
        dati={"email": new_user.email, "ruolo": str(new_user.ruolo)},
    )
    await db.commit()
    return new_user


@router.patch("/{user_id}", response_model=UserOut)
async def patch_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump(exclude_unset=True)
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
    await audit.emit_update(
        db,
        tabella="users",
        record_id=user_id,
        user_id=current_user.id,
        dopo={k: str(v) for k, v in payload.items() if k != "password"},
    )
    await db.commit()
    return _serialize_user(user, current_user.ruolo)


@router.patch("/me", response_model=UserOut)
async def patch_current_user(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Shortcut per modificare se stessi senza passare l'ID
    allowed_fields = {"nome", "cognome", "password", "bio", "preferences"}
    payload = data.model_dump(exclude_unset=True)

    if current_user.ruolo != UserRole.ADMIN:
        blocked = [k for k in payload.keys() if k not in allowed_fields]
        if blocked:
            raise HTTPException(status_code=403, detail="Non autorizzato a modificare campi amministrativi")

    updated = await update_user(db, current_user.id, data, current_user.id)
    await db.commit()
    await db.refresh(updated)
    return _serialize_user(updated, current_user.ruolo)


@router.get("/{user_id}/capacity-today")
async def get_user_capacity_today(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calcola la capacità rimanente di un utente per la giornata odierna."""
    # IDOR fix: solo l'utente stesso o admin/pm possono vedere la capacity altrui
    is_self = current_user.id == user_id
    is_manager = current_user.ruolo in (UserRole.ADMIN, UserRole.PM)
    if not is_self and not is_manager:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Non autorizzato")

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
        Task.stato != TaskStatus.PUBBLICATO,
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
        "puo_accettare_task": percentuale_carico < 100,
    }


@router.get("/me/export")
async def export_user_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project_rows = (
        await db.execute(
            select(ProgettoTeam, Progetto.nome)
            .join(Progetto, ProgettoTeam.progetto_id == Progetto.id)
            .where(ProgettoTeam.user_id == current_user.id)
            .order_by(Progetto.nome.asc())
        )
    ).all()
    task_rows = (
        await db.execute(
            select(Task)
            .where(Task.assegnatario_id == current_user.id)
            .order_by(Task.created_at.desc())
        )
    ).scalars().all()
    timesheet_rows = (
        await db.execute(
            select(Timesheet)
            .where(Timesheet.user_id == current_user.id)
            .order_by(Timesheet.data_attivita.desc(), Timesheet.created_at.desc())
        )
    ).scalars().all()

    payload = {
        "meta": {
            "format": "bite-erp-user-export",
            "version": 1,
            "exported_at": datetime.now(timezone.utc).isoformat(),
        },
        "account": UserOut.model_validate(current_user).model_dump(mode="json"),
        "projects": [
            {
                "id": team.id,
                "progetto_id": team.progetto_id,
                "progetto_nome": progetto_nome,
                "ruolo_progetto": team.ruolo_progetto,
                "ore_previste": team.ore_previste,
                "note": team.note,
            }
            for team, progetto_nome in project_rows
        ],
        "tasks": [
            {
                "id": task.id,
                "titolo": task.titolo,
                "stato": task.stato,
                "progetto_id": task.progetto_id,
                "commessa_id": task.commessa_id,
                "data_inizio": task.data_inizio,
                "data_scadenza": task.data_scadenza,
                "stima_minuti": task.stima_minuti,
                "priorita": task.priorita,
                "created_at": task.created_at,
                "updated_at": task.updated_at,
            }
            for task in task_rows
        ],
        "timesheets": [
            {
                "id": row.id,
                "task_id": row.task_id,
                "commessa_id": row.commessa_id,
                "data_attivita": row.data_attivita,
                "mese_competenza": row.mese_competenza,
                "servizio": row.servizio,
                "durata_minuti": row.durata_minuti,
                "stato": row.stato,
                "note": row.note,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
            for row in timesheet_rows
        ],
    }
    return jsonable_encoder(payload)


@router.post("/me/avatar")
async def upload_user_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
        if aspect > 1:  # Landscape
            new_width = int(aspect * 200)
            image = image.resize((new_width, 200), Image.LANCZOS)
            left = (new_width - 200) / 2
            image = image.crop((left, 0, left + 200, 200))
        else:  # Portrait
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


@router.delete("/me/avatar")
async def delete_user_avatar(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
