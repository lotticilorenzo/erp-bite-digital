from __future__ import annotations
import uuid
import enum
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from app.models.models import (
    UserRole, ProjectType, ProjectStatus, CommessaStatus,
    TaskStatus, TimesheetStatus, CostoTipo, PreventivoStatus
)


# ── BASE ──────────────────────────────────────────────────
class OrmBase(BaseModel):
    model_config = {"from_attributes": True}


ClienteAffidabilita = Literal["ALTA", "MEDIA", "BASSA"]


# ── USER ──────────────────────────────────────────────────
class UserCreate(BaseModel):
    nome: str
    cognome: str
    email: EmailStr
    password: str
    ruolo: UserRole
    costo_orario: Optional[Decimal] = None
    ore_settimanali: int = 40
    clickup_user_id: Optional[str] = None
    data_inizio: Optional[date] = None

class UserUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    password: Optional[str] = None
    ruolo: Optional[UserRole] = None
    costo_orario: Optional[Decimal] = None
    ore_settimanali: Optional[int] = None
    bio: Optional[str] = None
    preferences: Optional[dict] = None
    avatar_url: Optional[str] = None
    attivo: Optional[bool] = None
    data_fine: Optional[date] = None

class UserOut(OrmBase):
    id: uuid.UUID
    nome: str
    cognome: str
    email: str
    ruolo: UserRole
    costo_orario: Optional[Decimal]
    ore_settimanali: int
    bio: Optional[str] = None
    preferences: Optional[dict] = None
    avatar_url: Optional[str] = None
    attivo: bool
    data_inizio: Optional[date]
    created_at: datetime

class RisorsaServizioBase(BaseModel):
    nome_servizio: str
    costo_orario: Optional[Decimal] = None
    costo_fisso: Optional[Decimal] = None
    attivo: bool = True

class RisorsaServizioCreate(RisorsaServizioBase):
    pass

class RisorsaServizioUpdate(BaseModel):
    nome_servizio: Optional[str] = None
    costo_orario: Optional[Decimal] = None
    costo_fisso: Optional[Decimal] = None
    attivo: Optional[bool] = None

class RisorsaServizioOut(OrmBase, RisorsaServizioBase):
    id: uuid.UUID
    created_at: datetime

class StudioNodeType(str, enum.Enum):
    FOLDER = "folder"
    PROJECT = "project"
    TASK = "task"
    DASHBOARD = "dashboard"

class StudioNodeBase(BaseModel):
    nome: str
    parent_id: Optional[uuid.UUID] = None
    tipo: StudioNodeType = StudioNodeType.FOLDER
    icon: Optional[str] = None
    color: Optional[str] = None
    linked_progetto_id: Optional[uuid.UUID] = None
    linked_task_id: Optional[uuid.UUID] = None
    is_private: bool = False
    order: int = 0

class StudioNodeCreate(StudioNodeBase):
    pass

class StudioNodeUpdate(BaseModel):
    nome: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    tipo: Optional[StudioNodeType] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    linked_progetto_id: Optional[uuid.UUID] = None
    linked_task_id: Optional[uuid.UUID] = None
    is_private: Optional[bool] = None
    order: Optional[int] = None

class StudioNodeOut(StudioNodeBase):
    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime
    children: List["StudioNodeOut"] = []

    class Config:
        from_attributes = True

class RisorsaBase(BaseModel):
    user_id: Optional[uuid.UUID] = None
    nome: str
    cognome: str
    ruolo: Optional[str] = None
    tipo_contratto: str = "DIPENDENTE"
    ore_settimanali: Decimal = Decimal("40")
    costo_orario_override: Optional[Decimal] = None
    attivo: bool = True
    email: Optional[str] = None
    telefono: Optional[str] = None
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    indirizzo: Optional[str] = None
    iban: Optional[str] = None
    banca: Optional[str] = None
    bic_swift: Optional[str] = None
    note: Optional[str] = None

class RisorsaCreate(RisorsaBase):
    pass

class RisorsaUpdate(BaseModel):
    user_id: Optional[uuid.UUID] = None
    nome: Optional[str] = None
    cognome: Optional[str] = None
    ruolo: Optional[str] = None
    tipo_contratto: Optional[str] = None
    ore_settimanali: Optional[Decimal] = None
    costo_orario_override: Optional[Decimal] = None
    attivo: Optional[bool] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    indirizzo: Optional[str] = None
    iban: Optional[str] = None
    banca: Optional[str] = None
    bic_swift: Optional[str] = None
    note: Optional[str] = None

class RisorsaOut(OrmBase, RisorsaBase):
    id: uuid.UUID
    servizi: List[RisorsaServizioOut] = []
    created_at: datetime
    updated_at: datetime


# ── AUTH ──────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str # Can be email or username
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut




# ── CLIENTE ───────────────────────────────────────────────
class ClienteCreate(BaseModel):
    ragione_sociale: str
    codice_cliente: Optional[str] = None
    numero_progressivo: Optional[int] = None
    tipologia: Optional[str] = None
    referente: Optional[str] = None
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    sdi: Optional[str] = None
    pec: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    cellulare: Optional[str] = None
    sito_web: Optional[str] = None
    settore: Optional[str] = None
    categoria: Optional[str] = None
    indirizzo: Optional[str] = None
    comune: Optional[str] = None
    cap: Optional[str] = None
    provincia: Optional[str] = None
    paese: Optional[str] = "Italia"
    note_indirizzo: Optional[str] = None
    condizioni_pagamento: Optional[str] = None
    note: Optional[str] = None
    attivo: bool = True
    affidabilita: Optional[ClienteAffidabilita] = "MEDIA"
    drive_files: Optional[list] = None
    logo_url: Optional[str] = None

class ClienteUpdate(BaseModel):
    ragione_sociale: Optional[str] = None
    codice_cliente: Optional[str] = None
    numero_progressivo: Optional[int] = None
    tipologia: Optional[str] = None
    referente: Optional[str] = None
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    sdi: Optional[str] = None
    pec: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    cellulare: Optional[str] = None
    sito_web: Optional[str] = None
    settore: Optional[str] = None
    categoria: Optional[str] = None
    indirizzo: Optional[str] = None
    comune: Optional[str] = None
    cap: Optional[str] = None
    provincia: Optional[str] = None
    paese: Optional[str] = None
    note_indirizzo: Optional[str] = None
    condizioni_pagamento: Optional[str] = None
    note: Optional[str] = None
    attivo: Optional[bool] = None
    affidabilita: Optional[ClienteAffidabilita] = None
    drive_files: Optional[list] = None
    logo_url: Optional[str] = None

class ClienteOut(OrmBase):
    id: uuid.UUID
    ragione_sociale: str = ''
    codice_cliente: Optional[str] = None
    numero_progressivo: Optional[int] = None
    tipologia: Optional[str] = None
    referente: Optional[str] = None
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    sdi: Optional[str] = None
    pec: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    cellulare: Optional[str] = None
    sito_web: Optional[str] = None
    settore: Optional[str] = None
    categoria: Optional[str] = None
    indirizzo: Optional[str] = None
    comune: Optional[str] = None
    cap: Optional[str] = None
    provincia: Optional[str] = None
    paese: Optional[str] = None
    note_indirizzo: Optional[str] = None
    condizioni_pagamento: Optional[str] = None
    note: Optional[str] = None
    attivo: bool = True
    affidabilita: Optional[ClienteAffidabilita] = "MEDIA"
    fic_cliente_id: Optional[str] = None
    drive_files: Optional[list] = None
    logo_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


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

class ProgettoTeamOut(OrmBase):
    id: uuid.UUID
    user_id: uuid.UUID
    ruolo_progetto: Optional[str] = None
    user: Optional[UserOut] = None

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
    team: List[ProgettoTeamOut] = Field(default_factory=list)

class ProgettoWithCliente(ProgettoOut):
    cliente: Optional[ClienteOut] = None


class ProgettoRefOut(OrmBase):
    id: uuid.UUID
    nome: str
    tipo: Optional[ProjectType] = None


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
    progetto: Optional[ProgettoRefOut] = None

class CommessaCreate(BaseModel):
    cliente_id: uuid.UUID
    mese_competenza: date
    progetto_ids: Optional[List[uuid.UUID]] = None
    righe_progetto: Optional[List[CommessaRigaCreate]] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    costi_diretti: Decimal = Decimal("0")
    ore_contratto: Decimal = Decimal("0")
    note: Optional[str] = None

    @field_validator("costi_diretti", "ore_contratto")
    @classmethod
    def check_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Il valore non può essere negativo")
        return v

    @field_validator("mese_competenza")
    @classmethod
    def force_first_of_month(cls, v: date) -> date:
        """Normalizza sempre al primo del mese."""
        return v.replace(day=1)

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.data_inizio and self.data_fine and self.data_fine < self.data_inizio:
            raise ValueError("data_fine deve essere successiva a data_inizio")
        return self

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
    ore_contratto: Optional[Decimal] = None
    righe_progetto: Optional[List[CommessaRigaUpdate]] = None
    aggiustamenti: Optional[List[dict]] = None
    note: Optional[str] = None
    fattura_id: Optional[uuid.UUID] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.data_inizio and self.data_fine and self.data_fine < self.data_inizio:
            raise ValueError("data_fine deve essere successiva a data_inizio")
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
    ore_contratto: Decimal
    ore_reali: Decimal = Decimal("0")
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
        if v > 1440:
            raise ValueError("La durata non può superare 24 ore (1440 minuti)")
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
    task_display_name: Optional[str] = None
    clickup_task_id: Optional[str] = None
    created_at: datetime
    user: Optional[UserOut] = None


# ── TASK ──────────────────────────────────────────────────
class TaskCreate(BaseModel):
    progetto_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None
    assegnatario_id: Optional[uuid.UUID] = None
    revisore_id: Optional[uuid.UUID] = None
    parent_id: Optional[uuid.UUID] = None
    titolo: str
    descrizione: Optional[str] = None
    stato: TaskStatus = TaskStatus.DA_FARE
    data_inizio: Optional[date] = None
    data_scadenza: Optional[date] = None
    stima_minuti: Optional[int] = None

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.data_inizio and self.data_scadenza and self.data_scadenza < self.data_inizio:
            raise ValueError("data_scadenza deve essere successiva a data_inizio")
        return self

class TaskUpdate(BaseModel):
    progetto_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None
    assegnatario_id: Optional[uuid.UUID] = None
    revisore_id: Optional[uuid.UUID] = None
    parent_id: Optional[uuid.UUID] = None
    titolo: Optional[str] = None
    descrizione: Optional[str] = None
    stato: Optional[TaskStatus] = None
    data_inizio: Optional[date] = None
    data_scadenza: Optional[date] = None
    stima_minuti: Optional[int] = None
    priorita: Optional[str] = None

class TaskOut(OrmBase):
    id: uuid.UUID
    clickup_task_id: Optional[str] = None
    progetto_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None
    assegnatario_id: Optional[uuid.UUID] = None
    revisore_id: Optional[uuid.UUID] = None
    parent_id: Optional[uuid.UUID] = None
    titolo: str
    descrizione: Optional[str] = None
    stato: TaskStatus
    data_inizio: Optional[date] = None
    data_scadenza: Optional[date] = None
    stima_minuti: Optional[int] = None
    priorita: Optional[str] = "media"
    tempo_trascorso_minuti: int = 0
    clickup_synced_at: Optional[datetime] = None
    created_at: datetime
    subtasks: List[TaskOut] = []
    assegnatario: Optional[UserOut] = None
    revisore: Optional[UserOut] = None


# ── TIMER SESSION ─────────────────────────────────────────
class TimerSessionBase(BaseModel):
    task_id: uuid.UUID
    note: Optional[str] = None

class TimerSessionCreate(TimerSessionBase):
    user_id: uuid.UUID
    started_at: datetime

class TimerSessionUpdate(BaseModel):
    stopped_at: Optional[datetime] = None
    durata_minuti: Optional[int] = None
    salvato_timesheet: Optional[bool] = None
    note: Optional[str] = None

class TimerSessionOut(OrmBase):
    id: uuid.UUID
    task_id: uuid.UUID
    task_title: Optional[str] = None
    user_id: uuid.UUID
    started_at: datetime
    stopped_at: Optional[datetime] = None
    durata_minuti: Optional[int] = None
    salvato_timesheet: bool
    note: Optional[str]
    created_at: datetime


# ── COSTO ─────────────────────────────────────────────────
class CostoCreate(BaseModel):
    tipo: CostoTipo
    descrizione: str
    importo: Decimal
    mese_competenza: date
    categoria: Optional[str] = None
    progetto_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None

    @field_validator("importo")
    @classmethod
    def check_positive_importo(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("L'importo deve essere positivo")
        return v

    @field_validator("mese_competenza")
    @classmethod
    def force_first_of_month(cls, v: date) -> date:
        return v.replace(day=1)

class CostoUpdate(BaseModel):
    tipo: Optional[CostoTipo] = None
    descrizione: Optional[str] = None
    importo: Optional[Decimal] = None
    mese_competenza: Optional[date] = None
    categoria: Optional[str] = None
    progetto_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None

    @field_validator("importo")
    @classmethod
    def check_positive_importo(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("L'importo deve essere positivo")
        return v

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


# ── CATEGORIA FORNITORE ──────────────────────────────────
class CategoriaFornitoreBase(BaseModel):
    nome: str
    colore: Optional[str] = None

class CategoriaFornitoreCreate(CategoriaFornitoreBase):
    pass

class CategoriaFornitoreUpdate(BaseModel):
    nome: Optional[str] = None
    colore: Optional[str] = None

class CategoriaFornitoreOut(OrmBase, CategoriaFornitoreBase):
    id: uuid.UUID
    created_at: datetime


# ── FIC SYNC / FINANZA ────────────────────────────────────
class FornitoreCreate(BaseModel):
    ragione_sociale: str
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    pec: Optional[str] = None
    indirizzo: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    categoria_id: Optional[uuid.UUID] = None
    note: Optional[str] = None

class FornitoreUpdate(BaseModel):
    ragione_sociale: Optional[str] = None
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    pec: Optional[str] = None
    indirizzo: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    attivo: Optional[bool] = None
    categoria_id: Optional[uuid.UUID] = None
    categoria: Optional[str] = None # Legacy/Sync
    competenze: Optional[list] = None
    tariffa: Optional[Decimal] = None
    tariffa_tipo: Optional[str] = None
    note: Optional[str] = None

class FornitoreOut(OrmBase):
    id: uuid.UUID
    fic_id: Optional[str] = None
    ragione_sociale: str
    piva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    pec: Optional[str] = None
    indirizzo: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    attivo: bool
    categoria_id: Optional[uuid.UUID] = None
    categoria: Optional[str] = None
    competenze: Optional[list] = None
    tariffa: Optional[Decimal] = None
    tariffa_tipo: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    categoria_rel: Optional[CategoriaFornitoreOut] = None

class FornitoreWithStats(FornitoreOut):
    num_fatture: int = 0
    spesa_totale: float = 0
    ultima_fattura: Optional[str] = None

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

class FatturaAttivaUpdate(BaseModel):
    cliente_id: Optional[uuid.UUID] = None
    numero: Optional[str] = None
    data_emissione: Optional[date] = None
    data_scadenza: Optional[date] = None
    importo_totale: Optional[Decimal] = None
    importo_pagato: Optional[Decimal] = None
    importo_residuo: Optional[Decimal] = None
    stato_pagamento: Optional[str] = None
    valuta: Optional[str] = None
    data_ultimo_incasso: Optional[date] = None

class FatturaPassivaOut(OrmBase):
    id: uuid.UUID
    fic_id: str
    fornitore_id: Optional[uuid.UUID]
    fic_fornitore_id: Optional[str]
    numero: Optional[str]
    data_emissione: Optional[date]
    data_scadenza: Optional[date]
    importo_totale: Decimal
    importo_netto: Decimal = Decimal("0")
    importo_iva: Decimal = Decimal("0")
    importo_pagato: Decimal
    importo_residuo: Decimal
    stato_pagamento: str
    data_ultimo_pagamento: Optional[date]
    valuta: Optional[str]
    categoria: Optional[str] = None
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

# ── AI ASSISTANT ──────────────────────────────────────────
class AIChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None

class AIChatResponse(BaseModel):
    response: str

# ── PREVENTIVO ────────────────────────────────────────────
class PreventivoVoceCreate(BaseModel):
    descrizione: str
    quantita: Decimal = Decimal("1")
    prezzo_unitario: Decimal = Decimal("0")
    ordine: int = 0

class PreventivoVoceOut(OrmBase):
    id: uuid.UUID
    descrizione: str
    quantita: Decimal
    prezzo_unitario: Decimal
    totale: Decimal
    ordine: int

class PreventivoCreate(BaseModel):
    cliente_id: uuid.UUID
    titolo: str
    numero: str
    descrizione: Optional[str] = None
    data_scadenza: Optional[date] = None
    note: Optional[str] = None
    voci: List[PreventivoVoceCreate]

class PreventivoUpdate(BaseModel):
    titolo: Optional[str] = None
    numero: Optional[str] = None
    descrizione: Optional[str] = None
    stato: Optional[PreventivoStatus] = None
    data_scadenza: Optional[date] = None
    data_accettazione: Optional[date] = None
    note: Optional[str] = None
    voci: Optional[List[PreventivoVoceCreate]] = None

class PreventivoOut(OrmBase):
    id: uuid.UUID
    cliente_id: uuid.UUID
    numero: str
    titolo: str
    descrizione: Optional[str] = None
    stato: PreventivoStatus
    data_creazione: date
    data_scadenza: Optional[date] = None
    data_accettazione: Optional[date] = None
    importo_totale: Decimal
    note: Optional[str] = None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    voci: List[PreventivoVoceOut]
    cliente: Optional[ClienteOut] = None


# ── BUDGET SCHEMAS ────────────────────────────────────────
class BudgetCategoryBase(BaseModel):
    nome: str
    colore: Optional[str] = "#7c3aed"

class BudgetCategoryCreate(BudgetCategoryBase):
    pass

class BudgetCategoryOut(BudgetCategoryBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True

class BudgetMensileBase(BaseModel):
    categoria_id: uuid.UUID
    mese_competenza: date
    importo_budget: Decimal
    note: Optional[str] = None

class BudgetMensileCreate(BudgetMensileBase):
    pass

class BudgetMensileUpdate(BaseModel):
    importo_budget: Optional[Decimal] = None
    note: Optional[str] = None

class BudgetMensileOut(BudgetMensileBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    categoria: Optional[BudgetCategoryOut] = None

    class Config:
        from_attributes = True

class BudgetConsuntivoOut(BaseModel):
    categoria_id: uuid.UUID
    categoria_nome: str
    categoria_colore: str
    importo_budget: Decimal
    importo_speso: Decimal
    rimanente: Decimal
    percentuale: float
    note: Optional[str] = None


# ── WIKI SCHEMAS ──────────────────────────────────────────
class WikiCategoriaBase(BaseModel):
    nome: str
    icona: Optional[str] = None
    ordine: Optional[int] = 0

class WikiCategoriaCreate(WikiCategoriaBase):
    pass

class WikiCategoriaOut(WikiCategoriaBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True

class WikiArticoloBase(BaseModel):
    categoria_id: uuid.UUID
    titolo: str
    contenuto: Optional[str] = None
    pubblicato: Optional[bool] = True

class WikiArticoloCreate(WikiArticoloBase):
    pass

class WikiArticoloUpdate(BaseModel):
    categoria_id: Optional[uuid.UUID] = None
    titolo: Optional[str] = None
    contenuto: Optional[str] = None
    pubblicato: Optional[bool] = None

class WikiArticoloOut(WikiArticoloBase):
    id: uuid.UUID
    autore_id: uuid.UUID
    ultimo_aggiornamento: datetime
    visualizzazioni: int
    created_at: datetime
    categoria: Optional[WikiCategoriaOut] = None
    autore_nome: Optional[str] = None

    class Config:
        from_attributes = True


# ── CHAT SCHEMAS ──────────────────────────────────────────
class ChatReazioneBase(BaseModel):
    emoji: str

class ChatReazioneCreate(ChatReazioneBase):
    messaggio_id: uuid.UUID

class ChatReazioneRead(ChatReazioneBase):
    id: uuid.UUID
    user_id: uuid.UUID
    user_nome: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ChatMessaggioBase(BaseModel):
    contenuto: str
    tipo: str = "testo"
    risposta_a: Optional[uuid.UUID] = None

class ChatMessaggioCreate(ChatMessaggioBase):
    canale_id: uuid.UUID
    progetto_id: Optional[uuid.UUID] = None

class ChatCanaleOut(OrmBase):
    id: uuid.UUID
    nome: str
    tipo: str
    progetto_id: Optional[uuid.UUID] = None
    logo_url: Optional[str] = None
    descrizione: Optional[str] = None
    created_at: datetime
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    membri: List['ChatMembroOut'] = []

class ChatUserBasic(OrmBase):
    id: uuid.UUID
    nome: str
    cognome: str
    ruolo: str
    avatar_url: Optional[str] = None

class ChatMembroOut(OrmBase):
    id: uuid.UUID
    canale_id: uuid.UUID
    user_id: uuid.UUID
    ruolo: str
    user: Optional[ChatUserBasic] = None

# Resolve forward reference
ChatCanaleOut.model_rebuild()

class ChatMessaggioUpdate(BaseModel):
    contenuto: Optional[str] = None
    modificato: bool = True

class ChatMessaggioRead(ChatMessaggioBase):
    id: uuid.UUID
    canale_id: uuid.UUID
    progetto_id: Optional[uuid.UUID] = None
    autore_id: uuid.UUID
    autore_nome: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    modificato: bool
    reazioni: List[ChatReazioneRead] = []

    class Config:
        from_attributes = True


# ── CRM SCHEMAS ──────────────────────────────────────────

class CRMStageOut(BaseModel):
    id: uuid.UUID
    nome: str
    colore: str
    ordine: int
    probabilita: int

    class Config:
        from_attributes = True

class CRMActivityBase(BaseModel):
    tipo: str # Nota, Chiamata, Email, Meeting
    descrizione: Optional[str] = None
    activity_metadata: Optional[dict] = None
    data_attivita: datetime = Field(default_factory=datetime.now)

class CRMActivityCreate(CRMActivityBase):
    pass

class CRMActivityOut(CRMActivityBase):
    id: uuid.UUID
    lead_id: uuid.UUID
    autore_id: uuid.UUID
    autore_nome: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CRMLeadBase(BaseModel):
    nome_azienda: str
    nome_contatto: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    sito_web: Optional[str] = None
    settore: Optional[str] = None
    dimensione_azienda: Optional[str] = None
    valore_stimato: Decimal = Decimal("0")
    probabilita_chiusura: int = 0
    lead_score: int = 0
    data_prossimo_followup: Optional[date] = None
    assegnato_a_id: Optional[uuid.UUID] = None
    note: Optional[str] = None
    fonte: Optional[str] = None

class CRMLeadCreate(CRMLeadBase):
    stadio_id: uuid.UUID

class CRMLeadUpdate(BaseModel):
    nome_azienda: Optional[str] = None
    nome_contatto: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    sito_web: Optional[str] = None
    settore: Optional[str] = None
    dimensione_azienda: Optional[str] = None
    stadio_id: Optional[uuid.UUID] = None
    valore_stimato: Optional[Decimal] = None
    probabilita_chiusura: Optional[int] = None
    lead_score: Optional[int] = None
    data_prossimo_followup: Optional[date] = None
    assegnato_a_id: Optional[uuid.UUID] = None
    note: Optional[str] = None
    fonte: Optional[str] = None

class CRMLeadOut(CRMLeadBase):
    id: uuid.UUID
    stadio_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    assegnato_a_nome: Optional[str] = None
    stadio: Optional[CRMStageOut] = None
    attivita: List[CRMActivityOut] = []

    class Config:
        from_attributes = True

class CRMStatsOut(BaseModel):
    valore_totale_pipeline: Decimal
    numero_lead_attivi: int
    tasso_conversione: float
    previsione_ricavi: Decimal


# ── DOCUMENT SCHEMAS ──────────────────────────────────────

class DocumentNodeCreate(BaseModel):
    nome: str
    tipo: str = "FILE"  # FOLDER | FILE
    parent_id: Optional[uuid.UUID] = None
    icona: Optional[str] = None
    colore: Optional[str] = None

class DocumentNodeUpdate(BaseModel):
    nome: Optional[str] = None
    contenuto: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    ordine: Optional[int] = None
    icona: Optional[str] = None
    colore: Optional[str] = None

class DocumentNodeOut(OrmBase):
    id: uuid.UUID
    nome: str
    tipo: str
    icona: Optional[str] = None
    colore: Optional[str] = None
    contenuto: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    ordine: int = 0
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    children: List['DocumentNodeOut'] = []

DocumentNodeOut.model_rebuild()

