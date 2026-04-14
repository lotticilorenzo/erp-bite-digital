from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List
import uuid

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import User, UserRole, Risorsa
from app.schemas.schemas import RisorsaCreate, RisorsaUpdate, RisorsaOut

router = APIRouter(prefix="/risorse", tags=["Collaboratori"])

@router.get("", response_model=List[RisorsaOut])
async def get_risorse(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ritorna la lista dei membri del team (risorse) con la loro capacità e servizi.
    """
    result = await db.execute(
        select(Risorsa)
        .options(selectinload(Risorsa.servizi))
        .order_by(Risorsa.nome)
    )
    return result.scalars().all()

@router.get("/{risorsa_id}", response_model=RisorsaOut)
async def get_risorsa(
    risorsa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Risorsa)
        .where(Risorsa.id == risorsa_id)
        .options(selectinload(Risorsa.servizi))
    )
    risorsa = result.scalar_one_or_none()
    if not risorsa:
        raise HTTPException(status_code=404, detail="Risorsa non trovata")
    return risorsa

@router.post("", response_model=RisorsaOut, status_code=status.HTTP_201_CREATED)
async def create_risorsa(
    data: RisorsaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    # Check if a risorsa with same email exists (if email provided)
    if data.email:
        existing = await db.execute(select(Risorsa).where(Risorsa.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Una risorsa con questa email esiste già")

    risorsa = Risorsa(**data.model_dump())
    db.add(risorsa)
    await db.commit()
    await db.refresh(risorsa)
    
    # Re-fetch with services
    result = await db.execute(
        select(Risorsa)
        .where(Risorsa.id == risorsa.id)
        .options(selectinload(Risorsa.servizi))
    )
    return result.scalar_one()

@router.patch("/{risorsa_id}", response_model=RisorsaOut)
async def update_risorsa(
    risorsa_id: uuid.UUID,
    data: RisorsaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    res = await db.execute(
        select(Risorsa)
        .where(Risorsa.id == risorsa_id)
        .options(selectinload(Risorsa.servizi))
    )
    risorsa = res.scalar_one_or_none()
    if not risorsa:
        raise HTTPException(status_code=404, detail="Risorsa non trovata")
    
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(risorsa, field, value)
    
    await db.commit()
    await db.refresh(risorsa)
    return risorsa

@router.delete("/{risorsa_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_risorsa(
    risorsa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    # Soft delete or hard delete? Let's do hard delete for now if requested, 
    # but soft-delete (attivo=False) is usually safer.
    # The user asked for "deactivation" in the plan.
    res = await db.execute(select(Risorsa).where(Risorsa.id == risorsa_id))
    risorsa = res.scalar_one_or_none()
    if not risorsa:
        raise HTTPException(status_code=404, detail="Risorsa non trovata")
    
    risorsa.attivo = False
    await db.commit()
    return None
