import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User
from app.schemas.schemas import TimerSessionOut, TimesheetOut
from app.services.services import (
    start_timer, stop_timer, get_active_timer, 
    list_timer_sessions, save_timer_to_timesheet
)

router = APIRouter(prefix="/timer", tags=["Timer"])

@router.post("/start", response_model=TimerSessionOut)
async def api_start_timer(
    task_id: uuid.UUID = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await start_timer(db, task_id, current_user.id)

@router.post("/stop", response_model=TimerSessionOut)
async def api_stop_timer(
    session_id: uuid.UUID = Body(..., embed=True),
    note: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = await stop_timer(db, session_id, note)
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return session

@router.get("/active", response_model=Optional[TimerSessionOut])
async def api_get_active_timer(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await get_active_timer(db, current_user.id)

@router.get("/task/{task_id}", response_model=List[TimerSessionOut])
async def api_list_timer_sessions(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await list_timer_sessions(db, task_id)

@router.post("/save-timesheet", response_model=List[TimesheetOut])
async def api_save_timesheet(
    session_ids: List[uuid.UUID] = Body(...),
    commessa_id: Optional[uuid.UUID] = Body(None),
    note: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await save_timer_to_timesheet(db, session_ids, current_user, commessa_id, note)
