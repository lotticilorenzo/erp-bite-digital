import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import User, UserRole, PianificazioneStatus
from app.schemas.schemas import PianificazioneOut, PianificazioneCreate, PianificazioneUpdate
from app.services.pianificazione_service import (
    list_pianificazioni, get_pianificazione, create_pianificazione, 
    update_pianificazione, delete_pianificazione, convert_pianificazione_to_commessa,
    calcola_metriche_pianificazione
)

router = APIRouter(tags=["Pianificazioni"])

@router.get("/pianificazioni", response_model=List[PianificazioneOut])
async def get_pianificazioni(
    cliente_id: Optional[uuid.UUID] = Query(None),
    stato: Optional[PianificazioneStatus] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    plans = await list_pianificazioni(db, cliente_id, stato)
    
    # Calculate metrics for each plan
    for p in plans:
        metrics = await calcola_metriche_pianificazione(p)
        p.costo_totale = metrics["costo_totale"]
        p.margine_euro = metrics["margine_euro"]
        p.margine_percentuale = metrics["margine_percentuale"]
    
    return plans

@router.get("/pianificazioni/{pianificazione_id}", response_model=PianificazioneOut)
async def get_single_pianificazione(
    pianificazione_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    p = await get_pianificazione(db, pianificazione_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pianificazione non trovata")
    
    metrics = await calcola_metriche_pianificazione(p)
    p.costo_totale = metrics["costo_totale"]
    p.margine_euro = metrics["margine_euro"]
    p.margine_percentuale = metrics["margine_percentuale"]
    
    return p

@router.post("/pianificazioni", response_model=PianificazioneOut, status_code=201)
async def add_pianificazione(
    data: PianificazioneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    try:
        p = await create_pianificazione(db, data, current_user.id)
        await db.commit()
        
        metrics = await calcola_metriche_pianificazione(p)
        p.costo_totale = metrics["costo_totale"]
        p.margine_euro = metrics["margine_euro"]
        p.margine_percentuale = metrics["margine_percentuale"]
        
        return p
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/pianificazioni/{pianificazione_id}", response_model=PianificazioneOut)
async def patch_pianificazione(
    pianificazione_id: uuid.UUID,
    data: PianificazioneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    try:
        p = await update_pianificazione(db, pianificazione_id, data, current_user.id)
        if not p:
            raise HTTPException(status_code=404, detail="Pianificazione non trovata")
        await db.commit()
        
        metrics = await calcola_metriche_pianificazione(p)
        p.costo_totale = metrics["costo_totale"]
        p.margine_euro = metrics["margine_euro"]
        p.margine_percentuale = metrics["margine_percentuale"]
        
        return p
    except HTTPException as e:
        raise e
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/pianificazioni/{pianificazione_id}", status_code=204)
async def remove_pianificazione(
    pianificazione_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER))
):
    try:
        success = await delete_pianificazione(db, pianificazione_id, current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Pianificazione non trovata")
        await db.commit()
    except HTTPException as e:
        raise e
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pianificazioni/{pianificazione_id}/converti-commessa")
async def converti_pianificazione(
    pianificazione_id: uuid.UUID,
    mese_competenza: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM))
):
    try:
        commessa = await convert_pianificazione_to_commessa(db, pianificazione_id, mese_competenza, current_user)
        await db.commit()
        return {"id": commessa.id, "message": "Pianificazione convertita in commessa con successo"}
    except HTTPException as e:
        raise e
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
