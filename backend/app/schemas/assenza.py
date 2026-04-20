from __future__ import annotations
import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel

class AssenzaBase(BaseModel):
    user_id: uuid.UUID
    data_inizio: date
    data_fine: date
    tipo: str = "FERIE"
    note: Optional[str] = None

class AssenzaCreate(AssenzaBase):
    pass

class AssenzaOut(AssenzaBase):
    id: uuid.UUID
    stato: str = "PENDING"
    approvato_da: Optional[uuid.UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
