from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
from decimal import Decimal

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User, Risorsa, Task, RisorsaServizio
from app.schemas.schemas import RisorsaOut

router = APIRouter(tags=["Planning"])

@router.get("/planning/tasks", response_model=List[dict])
async def get_planning_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ritorna i task rilevanti per la pianificazione (quelli con data_scadenza o non assegnati).
    """
    # Ritorna task non assegnati (backlog) O assegnati
    result = await db.execute(
        select(Task).where(
            (Task.assegnatario_id == None) | (Task.stato != 'PUBBLICATO')
        )
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

@router.get("/planning/estimate-cost")
async def estimate_task_cost(
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    servizio_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Stima il costo di un task se assegnato a un determinato utente/servizio.
    """
    task_res = await db.execute(select(Task).where(Task.id == task_id))
    task = task_res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task non trovato")
    
    # Get Risorsa linked to user_id
    risorsa_res = await db.execute(select(Risorsa).where(Risorsa.user_id == user_id))
    risorsa = risorsa_res.scalar_one_or_none()
    if not risorsa:
        # If no Risorsa, use User's costo_orario if available
        user_res = await db.execute(select(User).where(User.id == user_id))
        user = user_res.scalar_one_or_none()
        costo_orario = user.costo_orario if user else Decimal("0")
    else:
        # If servizio_id provided, use that rate
        if servizio_id:
            serv_res = await db.execute(
                select(RisorsaServizio).where(
                    RisorsaServizio.id == servizio_id, 
                    RisorsaServizio.risorsa_id == risorsa.id
                )
            )
            servizio = serv_res.scalar_one_or_none()
            if servizio:
                if servizio.costo_fisso:
                    return {"estimated_cost": float(servizio.costo_fisso), "type": "FISSO"}
                costo_orario = servizio.costo_orario or risorsa.costo_orario_calcolato or risorsa.costo_orario_override or Decimal("0")
            else:
                costo_orario = risorsa.costo_orario_calcolato or risorsa.costo_orario_override or Decimal("0")
        else:
            costo_orario = risorsa.costo_orario_calcolato or risorsa.costo_orario_override or Decimal("0")

    minuti = task.stima_minuti or 0
    estimated_cost = (Decimal(str(minuti)) / Decimal("60")) * (costo_orario or Decimal("0"))
    
    return {
        "estimated_cost": float(estimated_cost),
        "costo_orario_used": float(costo_orario or 0),
        "minuti": minuti,
        "type": "ORARIO"
    }

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
