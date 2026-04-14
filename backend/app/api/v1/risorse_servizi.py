from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List
import uuid

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import User, UserRole, Risorsa, RisorsaServizio
from app.schemas.schemas import RisorsaServizioCreate, RisorsaServizioUpdate, RisorsaServizioOut

router = APIRouter(prefix="/risorse", tags=["Collaboratori"])

@router.get("/{risorsa_id}/servizi", response_model=List[RisorsaServizioOut])
async def get_risorsa_servizi(
    risorsa_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(RisorsaServizio).where(RisorsaServizio.risorsa_id == risorsa_id)
    )
    return result.scalars().all()

@router.post("/{risorsa_id}/servizi", response_model=RisorsaServizioOut)
async def add_risorsa_servizio(
    risorsa_id: uuid.UUID,
    data: RisorsaServizioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    # Verify risorsa exists
    res = await db.execute(select(Risorsa).where(Risorsa.id == risorsa_id))
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Risorsa non trovata")
    
    servizio = RisorsaServizio(
        **data.model_dump(),
        risorsa_id=risorsa_id
    )
    db.add(servizio)
    await db.commit()
    await db.refresh(servizio)
    return servizio

@router.patch("/servizi/{servizio_id}", response_model=RisorsaServizioOut)
async def update_risorsa_servizio(
    servizio_id: uuid.UUID,
    data: RisorsaServizioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    res = await db.execute(select(RisorsaServizio).where(RisorsaServizio.id == servizio_id))
    servizio = res.scalar_one_or_none()
    if not servizio:
        raise HTTPException(status_code=404, detail="Servizio non trovato")
    
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(servizio, field, value)
    
    await db.commit()
    await db.refresh(servizio)
    return servizio

@router.delete("/servizi/{servizio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_risorsa_servizio(
    servizio_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    await db.execute(delete(RisorsaServizio).where(RisorsaServizio.id == servizio_id))
    await db.commit()
    return None
