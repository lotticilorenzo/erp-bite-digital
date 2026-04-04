from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
import uuid
from datetime import date

from app.db.session import get_db
from app.models.models import Assenza, User, UserRole
from app.schemas.assenza import AssenzaCreate, AssenzaOut
from app.core.security import get_current_user, require_roles

router = APIRouter()

@router.get("/", response_model=List[AssenzaOut])
async def get_assenze(
    user_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    query = select(Assenza)
    if user_id:
        query = query.where(Assenza.user_id == user_id)
    if start_date:
        query = query.where(Assenza.data_fine >= start_date)
    if end_date:
        query = query.where(Assenza.data_inizio <= end_date)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=AssenzaOut, status_code=201)
async def create_assenza(
    data: AssenzaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only Admin/PM can create for others, users can create for themselves
    if current_user.ruolo not in [UserRole.ADMIN, UserRole.PM] and current_user.id != data.user_id:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    new_assenza = Assenza(**data.dict())
    db.add(new_assenza)
    await db.commit()
    await db.refresh(new_assenza)
    return new_assenza

@router.delete("/{assenza_id}", status_code=204)
async def remove_assenza(
    assenza_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Assenza).where(Assenza.id == assenza_id))
    assenza = result.scalar_one_or_none()
    if not assenza:
        raise HTTPException(status_code=404, detail="Assenza non trovata")
    
    if current_user.ruolo not in [UserRole.ADMIN, UserRole.PM] and current_user.id != assenza.user_id:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    await db.delete(assenza)
    await db.commit()
    return None
