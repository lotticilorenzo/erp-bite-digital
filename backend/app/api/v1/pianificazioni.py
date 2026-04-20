import uuid
from datetime import date
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_roles
from app.db.session import get_db
from app.models.models import PianificazioneStatus, User, UserRole
from app.schemas.schemas import PianificazioneCreate, PianificazioneOut, PianificazioneUpdate
from app.services.pianificazione_service import (
    approve_pianificazione,
    calcola_metriche_pianificazione,
    convert_pianificazione_to_commessa,
    create_pianificazione,
    delete_pianificazione,
    get_pianificazione,
    get_pianificazione_delta,
    list_pianificazioni,
    update_pianificazione,
)

router = APIRouter(tags=["Pianificazioni"])


async def _hydrate_pianificazione(pianificazione):
    metrics = await calcola_metriche_pianificazione(pianificazione)
    pianificazione.costo_totale = metrics["costo_totale"]
    pianificazione.margine_euro = metrics["margine_euro"]
    pianificazione.margine_percentuale = metrics["margine_percentuale"]
    pianificazione.commessa_id = pianificazione.commessa.id if getattr(pianificazione, "commessa", None) else None
    return pianificazione


@router.get("/pianificazioni", response_model=List[PianificazioneOut])
async def get_pianificazioni(
    cliente_id: Optional[uuid.UUID] = Query(None),
    stato: Optional[PianificazioneStatus] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    plans = await list_pianificazioni(db, cliente_id, stato)
    return [await _hydrate_pianificazione(plan) for plan in plans]


@router.get("/pianificazioni/{pianificazione_id}", response_model=PianificazioneOut)
async def get_single_pianificazione(
    pianificazione_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    p = await get_pianificazione(db, pianificazione_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pianificazione non trovata")
    return await _hydrate_pianificazione(p)


@router.post("/pianificazioni", response_model=PianificazioneOut, status_code=201)
async def add_pianificazione(
    data: PianificazioneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    try:
        p = await create_pianificazione(db, data, current_user.id)
        await db.commit()
        return await _hydrate_pianificazione(p)
    except HTTPException as exc:
        await db.rollback()
        raise exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/pianificazioni/{pianificazione_id}", response_model=PianificazioneOut)
async def patch_pianificazione(
    pianificazione_id: uuid.UUID,
    data: PianificazioneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    try:
        p = await update_pianificazione(db, pianificazione_id, data, current_user.id)
        if not p:
            raise HTTPException(status_code=404, detail="Pianificazione non trovata")
        await db.commit()
        return await _hydrate_pianificazione(p)
    except HTTPException as exc:
        await db.rollback()
        raise exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/pianificazioni/{pianificazione_id}/approva", response_model=PianificazioneOut)
async def approve_pianificazione_endpoint(
    pianificazione_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    try:
        p = await approve_pianificazione(db, pianificazione_id, current_user)
        await db.commit()
        return await _hydrate_pianificazione(p)
    except HTTPException as exc:
        await db.rollback()
        raise exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/pianificazioni/{pianificazione_id}/converti")
async def converti_pianificazione(
    pianificazione_id: uuid.UUID,
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    raw_mese = payload.get("mese_competenza")
    if not raw_mese:
        raise HTTPException(status_code=422, detail="Campo mese_competenza obbligatorio")

    try:
        mese_competenza = date.fromisoformat(str(raw_mese))
    except ValueError:
        raise HTTPException(status_code=422, detail="mese_competenza non valido")

    try:
        commessa = await convert_pianificazione_to_commessa(db, pianificazione_id, mese_competenza, current_user)
        await db.commit()
        return {"id": commessa.id, "message": "Pianificazione convertita in commessa con successo"}
    except HTTPException as exc:
        await db.rollback()
        raise exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/pianificazioni/{pianificazione_id}/delta")
async def get_pianificazione_delta_endpoint(
    pianificazione_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    return await get_pianificazione_delta(db, pianificazione_id)


@router.delete("/pianificazioni/{pianificazione_id}", status_code=204)
async def remove_pianificazione(
    pianificazione_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER)),
):
    try:
        success = await delete_pianificazione(db, pianificazione_id, current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Pianificazione non trovata")
        await db.commit()
    except HTTPException as exc:
        await db.rollback()
        raise exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
