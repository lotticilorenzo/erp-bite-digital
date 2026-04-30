import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_roles
from app.db.session import get_db
from app.models.models import PreventivoStatus, User, UserRole
from app.schemas.schemas import PreventivoCreate, PreventivoOut, PreventivoUpdate
from app.services.services import (
    converti_preventivo_in_commessa,
    create_preventivo,
    delete_preventivo,
    get_preventivo,
    list_preventivi,
    update_preventivo,
)

router = APIRouter(prefix="/preventivi", tags=["Preventivi"])


@router.get("", response_model=List[PreventivoOut])
async def get_preventivi(
    cliente_id: Optional[uuid.UUID] = Query(None),
    stato: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    p_status = None
    if stato:
        try:
            p_status = PreventivoStatus(stato)
        except ValueError:
            raise HTTPException(status_code=400, detail="Stato preventivo non valido")
    return await list_preventivi(db, cliente_id, p_status)


@router.get("/{preventivo_id}", response_model=PreventivoOut)
async def get_single_preventivo(
    preventivo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    p = await get_preventivo(db, preventivo_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    return p


@router.post("", response_model=PreventivoOut, status_code=201)
async def add_preventivo(
    data: PreventivoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    p = await create_preventivo(db, data, current_user.id)
    await db.commit()
    return p


@router.patch("/{preventivo_id}", response_model=PreventivoOut)
async def patch_preventivo(
    preventivo_id: uuid.UUID,
    data: PreventivoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    p = await update_preventivo(db, preventivo_id, data, current_user.id)
    if not p:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    await db.commit()
    return p


@router.delete("/{preventivo_id}", status_code=204)
async def remove_preventivo(
    preventivo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER)),
):
    ok = await delete_preventivo(db, preventivo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    await db.commit()


@router.post("/{preventivo_id}/converti-commessa")
async def converti_preventivo(
    preventivo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    try:
        commessa = await converti_preventivo_in_commessa(db, preventivo_id, current_user)
        await db.commit()
        return {"id": commessa.id, "message": "Preventivo convertito in commessa con successo"}
    except HTTPException as e:
        raise e
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
