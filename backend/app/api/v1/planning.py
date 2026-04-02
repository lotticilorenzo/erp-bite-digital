from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User, Risorsa, Task
from app.schemas.schemas import RisorsaOut

router = APIRouter(tags=["Planning"])

@router.get("/risorse", response_model=List[RisorsaOut])
async def get_risorse(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ritorna la lista dei membri del team (risorse) con la loro capacità.
    """
    result = await db.execute(select(Risorsa).where(Risorsa.attivo == True))
    risorse = result.scalars().all()
    return risorse

@router.get("/planning/tasks", response_model=List[dict])
async def get_planning_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ritorna i task rilevanti per la pianificazione (quelli con data_scadenza o non assegnati).
    """
    # Per semplicità ritorniamo i task aperti o recenti
    result = await db.execute(
        select(Task).where(Task.assegnatario_id != None)
    )
    tasks = result.scalars().all()
    
    # Trasformiamo in dict per includere info progetto/colore nel frontend
    return [
        {
            "id": str(t.id),
            "titolo": t.titolo,
            "assegnatario_id": str(t.assegnatario_id) if t.assegnatario_id else None,
            "data_scadenza": t.data_scadenza.isoformat() if t.data_scadenza else None,
            "stima_minuti": t.stima_minuti,
            "progetto_id": str(t.progetto_id) if t.progetto_id else None,
            "stato": t.stato
        }
        for t in tasks
    ]

@router.post("/planning/assign")
async def assign_task(
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    due_date: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Assegna un task a una risorsa in una data specifica.
    """
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task non trovato")
        
    task.assegnatario_id = user_id
    from datetime import datetime
    task.data_scadenza = datetime.strptime(due_date, "%Y-%m-%d").date()
    
    await db.commit()
    return {"status": "success"}
