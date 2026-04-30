import io
import os
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.models import Risorsa, Task, TaskStatus, User, UserRole
from app.schemas.schemas import UserCreate, UserOut, UserUpdate
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
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    return await list_users(db, attivo)


@router.post("", response_model=UserOut, status_code=201)
async def add_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER)),
):
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email già registrata")
    return await create_user(db, data)


@router.patch("/{user_id}", response_model=UserOut)
async def patch_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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


@router.patch("/me", response_model=UserOut)
async def patch_current_user(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Shortcut per modificare se stessi senza passare l'ID
    allowed_fields = {"nome", "cognome", "password", "bio", "preferences"}
    payload = data.model_dump(exclude_none=True)

    if current_user.ruolo != UserRole.ADMIN:
        blocked = [k for k in payload.keys() if k not in allowed_fields]
        if blocked:
            raise HTTPException(status_code=403, detail="Non autorizzato a modificare campi amministrativi")

    return await update_user(db, current_user.id, data, current_user.id)


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
async def export_user_data(current_user: User = Depends(get_current_user)):
    """Mock endpoint to export user data as JSON."""
    return {
        "user": UserOut.model_validate(current_user).model_dump(),
        "exported_at": datetime.utcnow().isoformat(),
        "format": "JSON",
        "message": "Export dei dati completato con successo",
    }


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
