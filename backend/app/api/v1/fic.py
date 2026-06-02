import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_finance_access
from app.db.session import get_db
from app.models.models import FatturaAttiva, User
from app.schemas.schemas import (
    FatturaAttivaOut,
    FatturaAttivaUpdate,
    FatturaIncassaRequest,
    FatturaPassivaUpdate,
    FicSyncStatusOut,
)
from app.services.services import (
    get_last_fic_sync_status,
    incassa_fattura,
    list_fatture_attive,
    list_fatture_passive,
    sync_fic_data,
    update_fattura_passiva,
)

router = APIRouter(tags=["FIC"])


@router.post("/fic/sync", response_model=FicSyncStatusOut)
async def run_fic_sync(
    current_user: User = Depends(require_finance_access),
):
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        return await sync_fic_data(db, current_user.id)


@router.get("/fic/sync/status", response_model=FicSyncStatusOut)
async def fic_sync_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    status_obj = await get_last_fic_sync_status(db)
    if not status_obj:
        raise HTTPException(status_code=404, detail="Nessun sync FIC eseguito")
    return status_obj


@router.get("/fatture-attive", response_model=List[FatturaAttivaOut])
async def get_fatture_attive(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return await list_fatture_attive(db)


async def _reload_fattura_attiva(db: AsyncSession, fattura_id: uuid.UUID) -> FatturaAttiva:
    """Re-fetch fattura attiva con `cliente` eager-caricato (FatturaAttivaOut lo espone): evita il
    lazy-load fuori greenlet alla serializzazione e ricarica `updated_at` (fresco dalla SELECT)."""
    res = await db.execute(
        select(FatturaAttiva).options(selectinload(FatturaAttiva.cliente)).where(FatturaAttiva.id == fattura_id)
    )
    return res.scalar_one()


@router.patch("/fatture-attive/{fattura_id}/incassa", response_model=FatturaAttivaOut)
async def patch_incassa_fattura(
    fattura_id: uuid.UUID,
    body: FatturaIncassaRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    fattura = await incassa_fattura(db, fattura_id, body.data_incasso)
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    await db.commit()
    # re-fetch con cliente eager: FatturaAttivaOut espone `cliente` (relazione) che, non caricata,
    # andrebbe in lazy-load/MissingGreenlet alla serializzazione. Ricarica anche updated_at.
    return await _reload_fattura_attiva(db, fattura_id)


@router.patch("/fatture-attive/{fattura_id}", response_model=FatturaAttivaOut)
async def patch_fattura_attiva(
    fattura_id: uuid.UUID,
    body: FatturaAttivaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    result = await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fattura_id))
    fattura = result.scalar_one_or_none()
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(fattura, key, value)

    await db.commit()
    # re-fetch con cliente eager (il refresh espirerebbe la relazione -> lazy-load 500)
    return await _reload_fattura_attiva(db, fattura_id)


@router.delete("/fatture-attive/{fattura_id}", status_code=204)
async def delete_fattura_attiva(
    fattura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    result = await db.execute(select(FatturaAttiva).where(FatturaAttiva.id == fattura_id))
    fattura = result.scalar_one_or_none()
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")

    await db.delete(fattura)
    await db.commit()


@router.get("/fatture-passive")
async def get_fatture_passive(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    return await list_fatture_passive(db)


@router.patch("/fatture-passive/{fattura_id}")
async def patch_fattura_passiva(
    fattura_id: uuid.UUID,
    body: FatturaPassivaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    fattura = await update_fattura_passiva(db, fattura_id, body.model_dump(exclude_none=True))
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    return fattura


@router.delete("/fatture-passive/{fattura_id}", status_code=204)
async def delete_fattura_passive_endpoint(
    fattura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_finance_access),
):
    from app.models.models import FatturaPassiva

    result = await db.execute(select(FatturaPassiva).where(FatturaPassiva.id == fattura_id))
    fattura = result.scalar_one_or_none()
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")

    await db.delete(fattura)
    await db.commit()
