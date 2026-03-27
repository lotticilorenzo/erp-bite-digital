from __future__ import annotations
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
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
    clickup_user_id: Optional[str] = None
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
    drive_files: Optional[list] = None

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
    drive_files: Optional[list] = None

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
    drive_files: Optional[list] = None
    created_at: Optional[datetime] = None


# ── PROGETTO ──────────────────────────────────────────────

# ── SERVIZI PROGETTO ──────────────────────────────────────
class ServizioProgettoCreate(BaseModel):
    tipo: str
    nome: Optional[str] = None
    valore_fisso: float = 0
    valore_variabile: float = 0
    contenuti_previsti: Optional[int] = None
    cadenza: str = "MENSILE"
    mese_inizio: Optional[date] = None
    attivo: bool = True
    note: Optional[str] = None

class ServizioProgettoUpdate(BaseModel):
    tipo: Optional[str] = None
    nome: Optional[str] = None
    valore_fisso: Optional[float] = None
    valore_variabile: Optional[float] = None
    contenuti_previsti: Optional[int] = None
    cadenza: Optional[str] = None
    mese_inizio: Optional[date] = None
    attivo: Optional[bool] = None
    note: Optional[str] = None

class ServizioProgettoOut(OrmBase):
    id: uuid.UUID
    progetto_id: uuid.UUID
    tipo: str
    nome: Optional[str] = None
    valore_fisso: float = 0
    valore_variabile: float = 0
    contenuti_previsti: Optional[int] = None
    cadenza: str = "MENSILE"
    mese_inizio: Optional[date] = None
    attivo: bool = True
    note: Optional[str] = None
    created_at: Optional[datetime] = None

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
    cliente_id: Optional[uuid.UUID] = None
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

    servizi: List[ServizioProgettoOut] = Field(default_factory=list)

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
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    costi_diretti: Decimal = Decimal("0")
    note: Optional[str] = None

    @field_validator("mese_competenza")
    @classmethod
    def force_first_of_month(cls, v: date) -> date:
        """Normalizza sempre al primo del mese."""
        return v.replace(day=1)

    @model_validator(mode="after")
    def derive_mese_from_data_fine(self):
        """Se data_fine presente, mese_competenza = primo del mese di data_fine."""
        if self.data_fine:
            self.mese_competenza = self.data_fine.replace(day=1)
        return self

class CommessaUpdate(BaseModel):
    stato: Optional[CommessaStatus] = None
    mese_competenza: Optional[date] = None
    costi_diretti: Optional[Decimal] = None
    righe_progetto: Optional[List[CommessaRigaUpdate]] = None
    aggiustamenti: Optional[List[dict]] = None
    note: Optional[str] = None
    fattura_id: Optional[uuid.UUID] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None

    @model_validator(mode="after")
    def derive_mese_from_data_fine(self):
        """Se data_fine presente, mese_competenza = primo del mese di data_fine."""
        if self.data_fine:
            self.mese_competenza = self.data_fine.replace(day=1)
        return self

    @model_validator(mode="after")
    def derive_mese_from_data_fine(self):
        """Se data_fine presente, mese_competenza = primo del mese di data_fine."""
        if self.data_fine and self.mese_competenza is None:
            self.mese_competenza = self.data_fine.replace(day=1)
        elif self.data_fine:
            self.mese_competenza = self.data_fine.replace(day=1)
        return self

class CommessaOut(OrmBase):
    id: uuid.UUID
    cliente_id: uuid.UUID
    mese_competenza: date
    stato: CommessaStatus
    righe_progetto: List[CommessaRigaOut] = Field(default_factory=list)
    costo_manodopera: Decimal
    costi_diretti: Decimal
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    data_chiusura: Optional[date]
    note: Optional[str]
    created_at: datetime
    # Calcolati lato applicazione
    aggiustamenti: Optional[list] = None
    valore_fatturabile: Optional[Decimal] = None
    costi_indiretti_allocati: Optional[Decimal] = None
    coefficiente_allocazione: Optional[Decimal] = None
    margine_euro: Optional[Decimal] = None
    margine_percentuale: Optional[float] = None
    fattura_id: Optional[uuid.UUID] = None
    fattura_numero: Optional[str] = None
    fattura_data: Optional[date] = None
    fattura_importo: Optional[Decimal] = None
    fattura_stato: Optional[str] = None
    piano_id: Optional[uuid.UUID] = None
    preventivo: Optional[Decimal] = None

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
    azione: str  # "APPROVA", "RIFIUTA", "PENDING"
    note: Optional[str] = None

class TimesheetBulkDelete(BaseModel):
    ids: List[uuid.UUID]

class TimesheetBulkMese(BaseModel):
    ids: List[uuid.UUID]
    mese_competenza: date  # formato YYYY-MM-01

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
    importo_netto: Optional[Decimal] = None
    importo_iva: Optional[Decimal] = None
    importo_pagato: Decimal
    importo_residuo: Decimal
    stato_pagamento: str
    data_ultimo_incasso: Optional[date]
    valuta: Optional[str]
    created_at: datetime
    updated_at: datetime

class FornitoreUpdate(BaseModel):
    categoria: Optional[str] = None
    competenze: Optional[list] = None
    tariffa: Optional[Decimal] = None
    tariffa_tipo: Optional[str] = None
    note: Optional[str] = None

class FornitoreOut(OrmBase):
    id: uuid.UUID
    fic_id: str
    ragione_sociale: str
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    pec: Optional[str] = None
    indirizzo: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    attivo: bool
    categoria: Optional[str] = None
    competenze: Optional[list] = None
    tariffa: Optional[Decimal] = None
    tariffa_tipo: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class FatturaPassivaUpdate(BaseModel):
    ricorrente: Optional[bool] = None
    periodicita: Optional[str] = None
    commessa_id: Optional[uuid.UUID] = None
    categoria: Optional[str] = None
    note: Optional[str] = None

class FatturaPassivaOut(OrmBase):
    id: uuid.UUID
    fic_id: str
    fornitore_id: Optional[uuid.UUID]
    fornitore_nome: Optional[str] = None
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
    categoria: Optional[str] = None
    ricorrente: Optional[bool] = None
    periodicita: Optional[str] = None
    commessa_id: Optional[uuid.UUID] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class FatturaPassivaUpdate(BaseModel):
    fornitore_id: Optional[uuid.UUID] = None
    numero: Optional[str] = None
    data_emissione: Optional[date] = None
    data_scadenza: Optional[date] = None
    importo_totale: Optional[Decimal] = None
    importo_pagato: Optional[Decimal] = None
    importo_residuo: Optional[Decimal] = None
    stato_pagamento: Optional[str] = None
    valuta: Optional[str] = None
    categoria: Optional[str] = None


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
