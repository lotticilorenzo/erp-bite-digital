from __future__ import annotations
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.models import (
    UserRole, ProjectType, ProjectStatus, CommessaStatus,
    TaskStatus, TimesheetStatus, CostoTipo
)


# ── BASE ──────────────────────────────────────────────────
class OrmBase(BaseModel):
    model_config = {"from_attributes": True}


# ── USER ──────────────────────────────────────────────────
class UserCreate(BaseModel):
    nome: str
    cognome: str
    email: EmailStr
    password: str
    ruolo: UserRole
    costo_orario: Optional[Decimal] = None
    data_inizio: Optional[date] = None

class UserUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    password: Optional[str] = None
    ruolo: Optional[UserRole] = None
    costo_orario: Optional[Decimal] = None
    attivo: Optional[bool] = None
    data_fine: Optional[date] = None

class UserOut(OrmBase):
    id: uuid.UUID
    nome: str
    cognome: str
    email: str
    ruolo: UserRole
    costo_orario: Optional[Decimal]
    attivo: bool
    data_inizio: Optional[date]
    created_at: datetime


# ── AUTH ──────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── CLIENTE ───────────────────────────────────────────────
class ClienteCreate(BaseModel):
    codice_cliente: Optional[str] = None
    numero_progressivo: Optional[int] = None
    paese: Optional[str] = None
    tipologia: Optional[str] = None
    indirizzo: Optional[str] = None
    comune: Optional[str] = None
    cap: Optional[str] = None
    provincia: Optional[str] = None
    codice_fiscale: Optional[str] = None
    telefono: Optional[str] = None
    referente: Optional[str] = None
    note: Optional[str] = None
    note_indirizzo: Optional[str] = None
    email: Optional[str] = None
    ragione_sociale: str
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    sdi: Optional[str] = None
    pec: Optional[str] = None
    indirizzo: Optional[str] = None
    condizioni_pagamento: Optional[str] = None

class ClienteUpdate(BaseModel):
    codice_cliente: Optional[str] = None
    numero_progressivo: Optional[int] = None
    ragione_sociale: Optional[str] = None
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    sdi: Optional[str] = None
    pec: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    referente: Optional[str] = None
    indirizzo: Optional[str] = None
    comune: Optional[str] = None
    cap: Optional[str] = None
    provincia: Optional[str] = None
    paese: Optional[str] = None
    tipologia: Optional[str] = None
    note: Optional[str] = None
    note_indirizzo: Optional[str] = None
    condizioni_pagamento: Optional[str] = None
    attivo: Optional[bool] = None

class ClienteOut(OrmBase):
    id: uuid.UUID
    codice_cliente: Optional[str] = None
    numero_progressivo: Optional[int] = None
    ragione_sociale: str = ''
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    sdi: Optional[str] = None
    pec: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    referente: Optional[str] = None
    indirizzo: Optional[str] = None
    comune: Optional[str] = None
    cap: Optional[str] = None
    provincia: Optional[str] = None
    paese: Optional[str] = None
    tipologia: Optional[str] = None
    note: Optional[str] = None
    note_indirizzo: Optional[str] = None
    condizioni_pagamento: Optional[str] = None
    fic_cliente_id: Optional[str] = None
    attivo: bool = True
    created_at: Optional[datetime] = None


# ── PROGETTO ──────────────────────────────────────────────
class ProgettoCreate(BaseModel):
    cliente_id: Optional[uuid.UUID] = None
    nome: str
    tipo: ProjectType
    importo_fisso: Decimal = Decimal("0")
    importo_variabile: Decimal = Decimal("0")
    delivery_attesa: int = 0
    clickup_list_id: Optional[str] = None
    note: Optional[str] = None

class ProgettoUpdate(BaseModel):
    nome: Optional[str] = None
    tipo: Optional[ProjectType] = None
    stato: Optional[ProjectStatus] = None
    importo_fisso: Optional[Decimal] = None
    importo_variabile: Optional[Decimal] = None
    delivery_attesa: Optional[int] = None
    clickup_list_id: Optional[str] = None
    note: Optional[str] = None

class ProgettoOut(OrmBase):
    id: uuid.UUID
    cliente_id: Optional[uuid.UUID]
    nome: str
    tipo: ProjectType
    stato: ProjectStatus
    importo_fisso: Decimal
    importo_variabile: Decimal
    delivery_attesa: int
    clickup_list_id: Optional[str]
    note: Optional[str]
    created_at: datetime

class ProgettoWithCliente(ProgettoOut):
    cliente: Optional[ClienteOut] = None


# ── COMMESSA ──────────────────────────────────────────────
class CommessaRigaCreate(BaseModel):
    progetto_id: uuid.UUID
    importo_fisso: Optional[Decimal] = None
    importo_variabile: Optional[Decimal] = None
    delivery_attesa: Optional[int] = None
    delivery_consuntiva: int = 0

class CommessaRigaUpdate(BaseModel):
    progetto_id: uuid.UUID
    importo_fisso: Optional[Decimal] = None
    importo_variabile: Optional[Decimal] = None
    delivery_attesa: Optional[int] = None
    delivery_consuntiva: Optional[int] = None

class CommessaRigaOut(OrmBase):
    id: uuid.UUID
    commessa_id: uuid.UUID
    progetto_id: uuid.UUID
    importo_fisso: Decimal
    importo_variabile: Decimal
    delivery_attesa: int
    delivery_consuntiva: int
    created_at: datetime

class CommessaCreate(BaseModel):
    cliente_id: uuid.UUID
    mese_competenza: date
    progetto_ids: Optional[List[uuid.UUID]] = None
    righe_progetto: Optional[List[CommessaRigaCreate]] = None
    costi_diretti: Decimal = Decimal("0")
    note: Optional[str] = None

    @field_validator("mese_competenza")
    @classmethod
    def force_first_of_month(cls, v: date) -> date:
        """Normalizza sempre al primo del mese."""
        return v.replace(day=1)

class CommessaUpdate(BaseModel):
    stato: Optional[CommessaStatus] = None
    costi_diretti: Optional[Decimal] = None
    righe_progetto: Optional[List[CommessaRigaUpdate]] = None
    note: Optional[str] = None

class CommessaOut(OrmBase):
    id: uuid.UUID
    cliente_id: uuid.UUID
    mese_competenza: date
    stato: CommessaStatus
    righe_progetto: List[CommessaRigaOut] = Field(default_factory=list)
    costo_manodopera: Decimal
    costi_diretti: Decimal
    data_chiusura: Optional[date]
    note: Optional[str]
    created_at: datetime
    # Calcolati lato applicazione
    valore_fatturabile: Optional[Decimal] = None
    costi_indiretti_allocati: Optional[Decimal] = None
    coefficiente_allocazione: Optional[Decimal] = None
    margine_euro: Optional[Decimal] = None
    margine_percentuale: Optional[float] = None

class CommessaWithCliente(CommessaOut):
    cliente: ClienteOut


# ── COEFFICIENTE ALLOCAZIONE ──────────────────────────────
class CoefficienteCreate(BaseModel):
    mese_competenza: date
    stipendi_operativi: Decimal
    overhead_produttivo: Decimal
    note: Optional[str] = None

    @field_validator("mese_competenza")
    @classmethod
    def force_first_of_month(cls, v: date) -> date:
        return v.replace(day=1)

class CoefficienteOut(OrmBase):
    id: uuid.UUID
    mese_competenza: date
    stipendi_operativi: Decimal
    overhead_produttivo: Decimal
    coefficiente: Optional[Decimal] = None
    note: Optional[str]
    created_at: datetime


# ── TIMESHEET ─────────────────────────────────────────────
class TimesheetCreate(BaseModel):
    task_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None
    data_attivita: date
    mese_competenza: date
    servizio: Optional[str] = None
    durata_minuti: int
    note: Optional[str] = None

    @field_validator("durata_minuti")
    @classmethod
    def check_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("La durata deve essere positiva")
        return v

    @field_validator("mese_competenza")
    @classmethod
    def force_first_of_month(cls, v: date) -> date:
        return v.replace(day=1)

class TimesheetApprova(BaseModel):
    ids: List[uuid.UUID]
    azione: str  # "APPROVA" o "RIFIUTA"
    note: Optional[str] = None

class TimesheetOut(OrmBase):
    id: uuid.UUID
    user_id: uuid.UUID
    task_id: Optional[uuid.UUID]
    commessa_id: Optional[uuid.UUID]
    data_attivita: date
    mese_competenza: date
    servizio: Optional[str]
    durata_minuti: int
    costo_orario_snapshot: Optional[Decimal]
    costo_lavoro: Optional[Decimal] = None
    stato: TimesheetStatus
    approvato_da: Optional[uuid.UUID]
    approvato_at: Optional[datetime]
    note: Optional[str]
    created_at: datetime
    user: Optional[UserOut] = None


# ── TASK ──────────────────────────────────────────────────
class TaskOut(OrmBase):
    id: uuid.UUID
    clickup_task_id: Optional[str]
    progetto_id: Optional[uuid.UUID]
    commessa_id: Optional[uuid.UUID]
    assegnatario_id: Optional[uuid.UUID]
    titolo: str
    stato: TaskStatus
    data_scadenza: Optional[date]
    stima_minuti: Optional[int]
    clickup_synced_at: Optional[datetime]


# ── COSTO ─────────────────────────────────────────────────
class CostoCreate(BaseModel):
    tipo: CostoTipo
    descrizione: str
    importo: Decimal
    mese_competenza: date
    categoria: Optional[str] = None
    progetto_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None

    @field_validator("mese_competenza")
    @classmethod
    def force_first_of_month(cls, v: date) -> date:
        return v.replace(day=1)

class CostoOut(OrmBase):
    id: uuid.UUID
    tipo: CostoTipo
    descrizione: str
    importo: Decimal
    mese_competenza: date
    categoria: Optional[str]
    progetto_id: Optional[uuid.UUID]
    commessa_id: Optional[uuid.UUID]
    created_at: datetime


# ── FIC SYNC / FINANZA ────────────────────────────────────
class FornitoreOut(OrmBase):
    id: uuid.UUID
    fic_id: str
    ragione_sociale: str
    piva: Optional[str]
    codice_fiscale: Optional[str]
    pec: Optional[str]
    indirizzo: Optional[str]
    email: Optional[str]
    telefono: Optional[str]
    attivo: bool
    created_at: datetime
    updated_at: datetime

class FatturaAttivaOut(OrmBase):
    id: uuid.UUID
    fic_id: str
    cliente_id: Optional[uuid.UUID]
    fic_cliente_id: Optional[str]
    numero: Optional[str]
    data_emissione: Optional[date]
    data_scadenza: Optional[date]
    importo_totale: Decimal
    importo_pagato: Decimal
    importo_residuo: Decimal
    stato_pagamento: str
    data_ultimo_incasso: Optional[date]
    valuta: Optional[str]
    created_at: datetime
    updated_at: datetime

class FatturaPassivaOut(OrmBase):
    id: uuid.UUID
    fic_id: str
    fornitore_id: Optional[uuid.UUID]
    fic_fornitore_id: Optional[str]
    numero: Optional[str]
    data_emissione: Optional[date]
    data_scadenza: Optional[date]
    importo_totale: Decimal
    importo_pagato: Decimal
    importo_residuo: Decimal
    stato_pagamento: str
    data_ultimo_pagamento: Optional[date]
    valuta: Optional[str]
    categoria: Optional[str]
    created_at: datetime
    updated_at: datetime

class FicSyncStatusOut(OrmBase):
    id: uuid.UUID
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    imported_clienti: int
    imported_fornitori: int
    imported_fatture_attive: int
    imported_fatture_passive: int
    error_count: int
    errors: Optional[dict]
    triggered_by: Optional[uuid.UUID]
    created_at: datetime


# ── REPORT ────────────────────────────────────────────────
class MarginalitaCliente(BaseModel):
    cliente_id: uuid.UUID
    ragione_sociale: str
    fatturato: Decimal
    costo_manodopera: Decimal
    costi_diretti: Decimal
    costi_indiretti_allocati: Decimal = Decimal("0")
    margine_euro: Decimal
    margine_percentuale: Optional[float]
    num_commesse: int

class DashboardKpi(BaseModel):
    mese_competenza: date
    fatturato_competenza: Decimal
    fatturato_da_emettere: Decimal
    crediti_scaduti: Decimal
    margine_medio_percentuale: Optional[float]
    commesse_pronte_chiusura: int
    timesheet_pending: int

class FatturaIncassaRequest(BaseModel):
    data_incasso: date
