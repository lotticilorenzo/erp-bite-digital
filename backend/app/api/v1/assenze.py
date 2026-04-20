from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_
from typing import List, Optional
import uuid
from datetime import date, timedelta

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


@router.get("/me", response_model=List[AssenzaOut])
async def get_my_assenze(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Assenza).where(Assenza.user_id == current_user.id).order_by(Assenza.data_inizio.desc()))
    return result.scalars().all()


@router.get("/team", response_model=List[AssenzaOut])
async def get_team_assenze(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    stato: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    query = select(Assenza).order_by(Assenza.data_inizio.desc())
    if start_date:
        query = query.where(Assenza.data_fine >= start_date)
    if end_date:
        query = query.where(Assenza.data_inizio <= end_date)
    if stato:
        query = query.where(Assenza.stato == stato)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/availability")
async def get_team_availability(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns list of dates where team members are absent (approved only)."""
    result = await db.execute(
        select(Assenza).where(
            and_(
                Assenza.stato == "APPROVATA",
                Assenza.data_fine >= start_date,
                Assenza.data_inizio <= end_date,
            )
        )
    )
    assenze = result.scalars().all()

    availability: dict = {}
    delta = end_date - start_date
    for i in range(delta.days + 1):
        day = start_date + timedelta(days=i)
        availability[str(day)] = []

    for a in assenze:
        d = a.data_inizio
        while d <= a.data_fine:
            key = str(d)
            if key in availability:
                availability[key].append({
                    "user_id": str(a.user_id),
                    "tipo": a.tipo,
                })
            d += timedelta(days=1)

    return {"availability": availability}


@router.patch("/{assenza_id}/approva", response_model=AssenzaOut)
async def approva_assenza(
    assenza_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    result = await db.execute(select(Assenza).where(Assenza.id == assenza_id))
    assenza = result.scalar_one_or_none()
    if not assenza:
        raise HTTPException(status_code=404, detail="Assenza non trovata")
    assenza.stato = "APPROVATA"
    assenza.approvato_da = current_user.id
    await db.commit()
    await db.refresh(assenza)
    return assenza


@router.patch("/{assenza_id}/rifiuta", response_model=AssenzaOut)
async def rifiuta_assenza(
    assenza_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    result = await db.execute(select(Assenza).where(Assenza.id == assenza_id))
    assenza = result.scalar_one_or_none()
    if not assenza:
        raise HTTPException(status_code=404, detail="Assenza non trovata")
    assenza.stato = "RIFIUTATA"
    assenza.approvato_da = current_user.id
    await db.commit()
    await db.refresh(assenza)
    return assenza
