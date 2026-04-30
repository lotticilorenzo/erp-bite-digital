import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.models import (
    CommessaProgetto,
    Progetto as ProgettoModel,
    ProgettoTeam,
    User,
    UserRole,
)
from app.schemas.schemas import (
    ProgettoCreate,
    ProgettoOut,
    ProgettoUpdate,
    ProgettoWithCliente,
    ServizioProgettoCreate,
    ServizioProgettoOut,
    ServizioProgettoUpdate,
)
from app.services.services import (
    create_progetto,
    create_servizio_progetto,
    delete_servizio_progetto,
    get_progetto,
    get_progetto_with_servizi,
    get_project_stats,
    get_servizi_progetto,
    update_progetto,
    update_servizio_progetto,
)

router = APIRouter(prefix="/progetti", tags=["Progetti"])


@router.get("", response_model=List[ProgettoWithCliente])
async def get_progetti(
    cliente_id: Optional[uuid.UUID] = Query(None),
    stato: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Ricerca per nome progetto"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    current_month = date.today().replace(day=1)

    q = select(ProgettoModel).options(
        selectinload(ProgettoModel.cliente),
        selectinload(ProgettoModel.servizi),
        selectinload(ProgettoModel.team).selectinload(ProgettoTeam.user),
        selectinload(ProgettoModel.commesse_link).selectinload(CommessaProgetto.commessa),
    )
    if cliente_id:
        q = q.where(ProgettoModel.cliente_id == cliente_id)
    if stato:
        q = q.where(ProgettoModel.stato == stato)
    if search:
        q = q.where(ProgettoModel.nome.ilike(f"%{search}%"))
    q = q.order_by(ProgettoModel.nome).offset(skip).limit(limit)
    result = await db.execute(q)
    progetti = result.scalars().all()

    for p in progetti:
        p.has_commessa_mese = any(
            r.commessa and r.commessa.mese_competenza == current_month for r in p.commesse_link
        )

    return progetti


@router.get("/{progetto_id}", response_model=ProgettoWithCliente)
async def get_single_progetto(
    progetto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    p = await get_progetto(db, progetto_id)
    if not p:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    return p


@router.post("", response_model=ProgettoOut, status_code=201)
async def add_progetto(
    data: ProgettoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    p = await create_progetto(db, data)
    await db.commit()
    await db.refresh(p)
    return await get_progetto_with_servizi(db, p.id)


@router.patch("/{progetto_id}", response_model=ProgettoOut)
async def patch_progetto(
    progetto_id: uuid.UUID,
    data: ProgettoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DEVELOPER, UserRole.PM)),
):
    p = await update_progetto(db, progetto_id, data, current_user.id)
    if not p:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    return await get_progetto_with_servizi(db, p.id)


@router.delete("/{progetto_id}", status_code=204)
async def delete_progetto(
    progetto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ProgettoModel).where(ProgettoModel.id == progetto_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    await db.delete(p)
    await db.commit()


@router.get("/{progetto_id}/servizi", response_model=List[ServizioProgettoOut])
async def list_servizi_progetto_endpoint(
    progetto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = await get_servizi_progetto(db, progetto_id)
    return [ServizioProgettoOut.model_validate(i) for i in items]


@router.post("/{progetto_id}/servizi", response_model=ServizioProgettoOut, status_code=201)
async def create_servizio_progetto_endpoint(
    progetto_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    body = await request.json()
    data = ServizioProgettoCreate(**body)
    item = await create_servizio_progetto(db, progetto_id, data)
    return ServizioProgettoOut.model_validate(item)


@router.patch("/{progetto_id}/servizi/{servizio_id}", response_model=ServizioProgettoOut)
async def update_servizio_progetto_endpoint(
    progetto_id: uuid.UUID,
    servizio_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    body = await request.json()
    data = ServizioProgettoUpdate(**body)
    item = await update_servizio_progetto(db, servizio_id, data)
    return ServizioProgettoOut.model_validate(item)


@router.delete("/{progetto_id}/servizi/{servizio_id}", status_code=204)
async def delete_servizio_progetto_endpoint(
    progetto_id: uuid.UUID,
    servizio_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await delete_servizio_progetto(db, servizio_id)


@router.get("/{progetto_id}/stats", tags=["Dashboard"])
async def get_project_dashboard_stats(
    progetto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_project_stats(db, progetto_id)
