from __future__ import annotations
import re
import uuid
import enum
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from app.models.models import (
    UserRole, ProjectType, ProjectStatus, CommessaStatus,
    TaskStatus, TimesheetStatus, CostoTipo, PreventivoStatus,
    ClientStartDayType, PianificazioneStatus
)

_PWD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$")


def _validate_password_strength(v: str) -> str:
    if not _PWD_RE.match(v):
        raise ValueError(
            "La password deve contenere almeno 8 caratteri, "
            "una lettera maiuscola, una minuscola e un numero."
        )
    return v


# ── BASE ──────────────────────────────────────────────────
class OrmBase(BaseModel):
    model_config = {"from_attributes": True}


ClienteAffidabilita = Literal["ALTA", "MEDIA", "BASSA"]


# ── USER ──────────────────────────────────────────────────
class UserCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    cognome: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    ruolo: UserRole
    costo_orario: Optional[Decimal] = None
    ore_settimanali: int = Field(40, ge=1, le=168)
    clickup_user_id: Optional[str] = Field(None, max_length=100)
    data_inizio: Optional[date] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class UserUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=100)
    cognome: Optional[str] = Field(None, min_length=1, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    ruolo: Optional[UserRole] = None
    costo_orario: Optional[Decimal] = None
    ore_settimanali: Optional[int] = Field(None, ge=1, le=168)
    bio: Optional[str] = Field(None, max_length=1000)
    preferences: Optional[dict] = None
    avatar_url: Optional[str] = Field(None, max_length=500)
    attivo: Optional[bool] = None
    data_fine: Optional[date] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_password_strength(v)


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
    deleted_at: Optional[datetime] = None


class UserPublicOut(OrmBase):
    """Vista ridotta per utenti non-admin: no costo_orario."""
    id: uuid.UUID
    nome: str
    cognome: str
    email: str
    ruolo: UserRole
    ore_settimanali: int
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    attivo: bool
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
    LISTA = "lista"
    DOCUMENTO = "documento"

class StudioNodeBase(BaseModel):
    nome: str
    parent_id: Optional[uuid.UUID] = None
    tipo: StudioNodeType = StudioNodeType.FOLDER
    icon: Optional[str] = None
    color: Optional[str] = None
    linked_progetto_id: Optional[uuid.UUID] = None
    linked_cliente_id: Optional[uuid.UUID] = None
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
    linked_cliente_id: Optional[uuid.UUID] = None
    linked_task_id: Optional[uuid.UUID] = None
    is_private: Optional[bool] = None
    order: Optional[int] = None

class StudioNodeOut(StudioNodeBase):
    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime
    linked_cliente_id: Optional[uuid.UUID] = None
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
    tipologia: str = "dipendente"

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
    costo_orario_effettivo: Optional[float] = None  # override or calcolato or 0 (proprieta' del model)
    created_at: datetime
    updated_at: datetime


class RisorsaPublicOut(OrmBase):
    """Vista ridotta e SICURA di una risorsa per i ruoli non-finance (es. Studio OS):
    esclude IBAN/banca/BIC, codice fiscale, P.IVA, indirizzo, costi e note."""
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    nome: str
    cognome: str
    ruolo: Optional[str] = None
    tipo_contratto: str = "DIPENDENTE"
    ore_settimanali: Decimal = Decimal("40")
    attivo: bool = True


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
    ragione_sociale: str = Field(..., min_length=1, max_length=255)
    codice_cliente: Optional[str] = Field(None, max_length=50)
    numero_progressivo: Optional[int] = None
    tipologia: Optional[str] = Field(None, max_length=100)
    referente: Optional[str] = Field(None, max_length=200)
    piva: Optional[str] = Field(None, max_length=20)
    codice_fiscale: Optional[str] = Field(None, max_length=20)
    sdi: Optional[str] = Field(None, max_length=10)
    pec: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    telefono: Optional[str] = Field(None, max_length=30)
    cellulare: Optional[str] = Field(None, max_length=30)
    sito_web: Optional[str] = Field(None, max_length=500)
    settore: Optional[str] = Field(None, max_length=100)
    categoria: Optional[str] = Field(None, max_length=100)
    indirizzo: Optional[str] = Field(None, max_length=500)
    comune: Optional[str] = Field(None, max_length=100)
    cap: Optional[str] = Field(None, max_length=10)
    provincia: Optional[str] = Field(None, max_length=5)
    paese: Optional[str] = Field("Italia", max_length=100)
    note_indirizzo: Optional[str] = Field(None, max_length=500)
    condizioni_pagamento: Optional[str] = Field(None, max_length=200)
    note: Optional[str] = Field(None, max_length=5000)
    attivo: bool = True
    affidabilita: Optional[ClienteAffidabilita] = "MEDIA"
    drive_files: Optional[list] = None
    logo_url: Optional[str] = Field(None, max_length=500)
    google_drive_url: Optional[str] = Field(None, max_length=500)
    start_day_type: ClientStartDayType = ClientStartDayType.STANDARD_1

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
    google_drive_url: Optional[str] = None
    start_day_type: Optional[ClientStartDayType] = None

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
    google_drive_url: Optional[str] = None
    start_day_type: ClientStartDayType = ClientStartDayType.STANDARD_1
    created_at: Optional[datetime]
    deleted_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── PROGETTO ──────────────────────────────────────────────

# ── SERVIZI PROGETTO ──────────────────────────────────────
class ServizioProgettoCreate(BaseModel):
    tipo: str
    nome: Optional[str] = None
    valore_fisso: Decimal = Decimal("0")
    valore_variabile: Decimal = Decimal("0")
    contenuti_previsti: Optional[int] = None
    cadenza: str = "MENSILE"
    mese_inizio: Optional[date] = None
    attivo: bool = True
    note: Optional[str] = None

class ServizioProgettoUpdate(BaseModel):
    tipo: Optional[str] = None
    nome: Optional[str] = None
    valore_fisso: Optional[Decimal] = None
    valore_variabile: Optional[Decimal] = None
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
    valore_fisso: Decimal = Decimal("0")
    valore_variabile: Decimal = Decimal("0")
    contenuti_previsti: Optional[int] = None
    cadenza: str = "MENSILE"
    mese_inizio: Optional[date] = None
    attivo: bool = True
    note: Optional[str] = None
    created_at: Optional[datetime] = None

class ProgettoTeamCreate(BaseModel):
    user_id: uuid.UUID
    ruolo_progetto: Optional[str] = None
    ore_previste: float = 0
    note: Optional[str] = None

# ── Asse SERVIZIO progetti (spec v2 §4.4/§4.6) — distinto dal modello di fatturazione `tipo`. ──
TipoServizio = Literal["social_media", "creazione_sito_web", "gestione_web", "produzione_contenuti", "stand_fieristici"]
PeriodicitaProgetto = Literal["mensile", "bimestrale", "trimestrale", "semestrale", "annuale", "spot", "una_tantum"]
IntensitaSocio = Literal["S", "M", "L"]

# Chiavi attese in dettagli_tipo per ciascun tipo_servizio (validazione NON bloccante).
DETTAGLI_TIPO_ATTESI = {
    "social_media": {"n_contenuti_previsti", "di_cui_video"},
    "produzione_contenuti": {"tipo_contenuto"},
    "stand_fieristici": {"fiera", "data_consegna", "partner"},
    "creazione_sito_web": set(),
    "gestione_web": set(),
}


def warnings_dettagli_tipo(tipo_servizio, dettagli) -> List[str]:
    """Warning (non bloccanti) per chiavi di dettagli_tipo non previste dal tipo_servizio."""
    if not tipo_servizio or not dettagli:
        return []
    attese = DETTAGLI_TIPO_ATTESI.get(tipo_servizio, set())
    return [f"Chiave '{k}' non prevista per tipo_servizio '{tipo_servizio}'." for k in dettagli if k not in attese]


class ProgettoCreate(BaseModel):
    cliente_id: Optional[uuid.UUID] = None
    nome: str
    tipo: ProjectType
    stato: ProjectStatus = ProjectStatus.ATTIVO
    importo_fisso: Decimal = Decimal("0")
    importo_variabile: Decimal = Decimal("0")
    delivery_attesa: int = 0
    tipo_servizio: Optional[TipoServizio] = None
    periodicita: Optional[PeriodicitaProgetto] = None
    referente_risorsa_id: Optional[uuid.UUID] = None
    intensita_socio: IntensitaSocio = "M"
    dettagli_tipo: dict = Field(default_factory=dict)
    note: Optional[str] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    team: Optional[List[ProgettoTeamCreate]] = None

    @model_validator(mode="after")
    def _check_dettagli_tipo(self):
        if self.tipo_servizio is None and self.dettagli_tipo:
            raise ValueError("dettagli_tipo deve essere vuoto quando tipo_servizio è null")
        return self

class ProgettoTeamOut(OrmBase):
    id: uuid.UUID
    user_id: uuid.UUID
    ruolo_progetto: Optional[str] = None
    ore_previste: float = 0
    note: Optional[str] = None
    user: Optional[UserOut] = None

class ProgettoUpdate(BaseModel):
    nome: Optional[str] = None
    cliente_id: Optional[uuid.UUID] = None
    tipo: Optional[ProjectType] = None
    stato: Optional[ProjectStatus] = None
    importo_fisso: Optional[Decimal] = None
    importo_variabile: Optional[Decimal] = None
    delivery_attesa: Optional[int] = None
    tipo_servizio: Optional[TipoServizio] = None
    periodicita: Optional[PeriodicitaProgetto] = None
    referente_risorsa_id: Optional[uuid.UUID] = None
    intensita_socio: Optional[IntensitaSocio] = None
    dettagli_tipo: Optional[dict] = None
    note: Optional[str] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    team: Optional[List[ProgettoTeamCreate]] = None

class ProgettoOut(OrmBase):
    id: uuid.UUID
    cliente_id: Optional[uuid.UUID]
    nome: str
    tipo: ProjectType
    stato: ProjectStatus
    importo_fisso: Decimal
    importo_variabile: Decimal
    delivery_attesa: int
    tipo_servizio: Optional[str] = None
    periodicita: Optional[str] = None
    referente_risorsa_id: Optional[uuid.UUID] = None
    intensita_socio: str = "M"
    dettagli_tipo: dict = Field(default_factory=dict)
    warnings_dettagli_tipo: List[str] = Field(default_factory=list)
    note: Optional[str]
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    created_at: datetime
    deleted_at: Optional[datetime] = None
    has_commessa_mese: bool = False

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
    pianificazione_id: Optional[uuid.UUID] = None

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
    pianificazione_id: Optional[uuid.UUID] = None

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
class CommessaProfitabilityOut(BaseModel):
    margine_pct: float
    ore_budget: float
    ore_consumate: float
    ore_rimanenti: float
    costo_manodopera: float
    valore_fatturabile: float
    alert_level: str # OK | WARNING | CRITICAL

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
    deleted_at: Optional[datetime] = None
    # Calcolati lato applicazione
    aggiustamenti: Optional[list] = None
    valore_fatturabile: Optional[Decimal] = None
    costi_indiretti_allocati: Optional[Decimal] = None
    coefficiente_allocazione: Optional[Decimal] = None
    margine_euro: Optional[Decimal] = None
    margine_percentuale: Optional[float] = None
    # OVH -> margine netto (additivi, spec §4.5, inv. 17)
    coefficiente_ovh_applicato: Optional[Decimal] = None
    ovh_caricato: Optional[Decimal] = None
    margine_netto: Optional[Decimal] = None
    margine_netto_pct: Optional[float] = None
    fattura_id: Optional[uuid.UUID] = None
    fattura_numero: Optional[str] = None
    fattura_data: Optional[date] = None
    fattura_importo: Optional[Decimal] = None
    fattura_stato: Optional[str] = None
    preventivo: Optional[Decimal] = None
    pianificazione_id: Optional[uuid.UUID] = None
    pianificazione: Optional['PianificazioneOut'] = None

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
    deleted_at: Optional[datetime] = None
    user: Optional[UserOut] = None


class TaskAttachmentOut(OrmBase):
    id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    filename: str
    file_path: str
    file_size: int
    content_type: Optional[str] = None
    created_at: datetime
    user: Optional[UserOut] = None

# ── TASK ──────────────────────────────────────────────────
class AssegnatarioOut(BaseModel):
    id: uuid.UUID
    nome: str

class TaskCreate(BaseModel):
    progetto_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None
    assegnatario_id: Optional[uuid.UUID] = None
    revisore_id: Optional[uuid.UUID] = None
    parent_id: Optional[uuid.UUID] = None
    titolo: str = Field(..., min_length=1, max_length=500)
    descrizione: Optional[str] = Field(None, max_length=10000)
    stato: TaskStatus = TaskStatus.DA_FARE
    data_inizio: Optional[date] = None
    data_scadenza: Optional[date] = None
    stima_minuti: Optional[int] = Field(None, ge=0, le=999999)
    priorita: Optional[str] = "media"
    tags: Optional[List[str]] = None
    assegnatari: Optional[List[uuid.UUID]] = None

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
    titolo: Optional[str] = Field(None, min_length=1, max_length=500)
    descrizione: Optional[str] = Field(None, max_length=10000)
    stato: Optional[TaskStatus] = None
    data_inizio: Optional[date] = None
    data_scadenza: Optional[date] = None
    stima_minuti: Optional[int] = Field(None, ge=0, le=999999)
    priorita: Optional[str] = Field(None, max_length=20)
    tags: Optional[List[str]] = None
    assegnatari: Optional[List[uuid.UUID]] = None

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
    deleted_at: Optional[datetime] = None
    subtasks: List[TaskOut] = []
    assegnatario: Optional[UserOut] = None
    revisore: Optional[UserOut] = None
    attachments: List[TaskAttachmentOut] = []
    tags: List[str] = []
    assegnatari: List[AssegnatarioOut] = []


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

class _EntityNested(OrmBase):
    id: uuid.UUID
    ragione_sociale: str = ''
    piva: Optional[str] = None
    email: Optional[str] = None
    pec: Optional[str] = None
    sdi: Optional[str] = None
    indirizzo: Optional[str] = None

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
    fic_raw_data: Optional[dict] = None
    cliente: Optional[_EntityNested] = None
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
    fic_raw_data: Optional[dict] = None
    fornitore_nome: Optional[str] = None
    fornitore: Optional[_EntityNested] = None
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


class AIGenerateTasksRequest(BaseModel):
    commessa_id: uuid.UUID
    prompt_extra: str = ""
    max_ore: int = Field(40, ge=1, le=400)


class AITaskSuggestionOut(BaseModel):
    titolo: str
    servizio: Optional[str] = None
    stima_minuti: int
    priorita: str = "media"
    ruolo_suggerito: Optional[str] = None
    assegnatario_id: Optional[uuid.UUID] = None
    assegnatario_nome: Optional[str] = None
    rationale: Optional[str] = None


class AIGenerateTasksContextOut(BaseModel):
    cliente_nome: str
    project_types: List[str] = []
    storico_mesi: int = 6
    budget_ore: float = 0
    template_count: int = 0
    mese_commessa: Optional[date] = None


class AIGenerateTasksResponse(BaseModel):
    context: AIGenerateTasksContextOut
    suggestions: List[AITaskSuggestionOut]
    source: str = "ai"


class AIEstimateHoursRequest(BaseModel):
    titolo_task: str
    cliente_id: uuid.UUID
    mesi_storico: int = Field(6, ge=1, le=24)


class AIEstimateHoursSimilarOut(BaseModel):
    titolo: str
    durata_avg: int
    count: int


class AIEstimateHoursResponse(BaseModel):
    stima_minuti: int
    confidenza: float
    simili: List[AIEstimateHoursSimilarOut] = []
    ragionamento: str
    source: str = "history"

# ── PREVENTIVO ────────────────────────────────────────────
TipoVocePreventivo = Literal["lavoro", "socio", "esterno", "overhead"]
ModalitaPrezzo = Literal["markup", "margine"]


class PreventivoVoceCreate(BaseModel):
    descrizione: str
    quantita: Decimal = Decimal("1")
    prezzo_unitario: Decimal = Decimal("0")
    ordine: int = 0
    # §18.2 natura riga (opzionali; riga libera resta ammessa)
    tipo: Optional[TipoVocePreventivo] = None
    servizio_id: Optional[uuid.UUID] = None
    risorsa_id: Optional[uuid.UUID] = None
    ruolo: Optional[str] = None
    ore: Optional[Decimal] = None
    tariffa: Optional[Decimal] = None
    costo: Optional[Decimal] = None
    ricarico_pct: Optional[Decimal] = None
    intensita_socio: Optional[str] = None  # S|M|L, se tipo=socio (§18.4)

class PreventivoVoceOut(OrmBase):
    id: uuid.UUID
    descrizione: str
    quantita: Decimal
    prezzo_unitario: Decimal
    totale: Decimal
    ordine: int
    tipo: Optional[str] = None
    ore: Optional[Decimal] = None
    tariffa: Optional[Decimal] = None
    costo: Optional[Decimal] = None
    ricarico_pct: Optional[Decimal] = None
    prezzo_riga: Optional[Decimal] = None
    is_stima: bool = False

class PreventivoCreate(BaseModel):
    cliente_id: uuid.UUID
    titolo: str
    numero: str
    descrizione: Optional[str] = None
    data_scadenza: Optional[date] = None
    note: Optional[str] = None
    # §18.1 modalita prezzo (opzionali)
    modalita_prezzo: Optional[ModalitaPrezzo] = None
    markup_su: Optional[str] = None
    prezzo: Optional[Decimal] = None
    margine_pct: Optional[Decimal] = None
    markup_pct: Optional[Decimal] = None
    margine_target: Optional[Decimal] = None
    valido_fino: Optional[date] = None
    voci: List[PreventivoVoceCreate]


class SimulaBudgetRequest(BaseModel):
    budget_interno: Decimal
    risorse_fisse: List[dict] = Field(default_factory=list)  # [{ore, tariffa}]
    tariffa_variabile: Decimal

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


# ── PIANIFICAZIONE ────────────────────────────────────────
class PianificazioneLavorazioneBase(BaseModel):
    tipo_lavorazione: str
    user_id: uuid.UUID
    ore_previste: Decimal = Decimal("0")
    costo_orario_snapshot: Decimal = Decimal("0")

class PianificazioneLavorazioneCreate(PianificazioneLavorazioneBase):
    pass

class PianificazioneLavorazioneOut(OrmBase, PianificazioneLavorazioneBase):
    id: uuid.UUID
    user: Optional[UserOut] = None

class PianificazioneBase(BaseModel):
    cliente_id: uuid.UUID
    budget: Decimal = Decimal("0")
    note: Optional[str] = None
    stato: PianificazioneStatus = PianificazioneStatus.PENDING

class PianificazioneCreate(PianificazioneBase):
    lavorazioni: List[PianificazioneLavorazioneCreate] = []

class PianificazioneUpdate(BaseModel):
    cliente_id: Optional[uuid.UUID] = None
    budget: Optional[Decimal] = None
    note: Optional[str] = None
    stato: Optional[PianificazioneStatus] = None
    lavorazioni: Optional[List[PianificazioneLavorazioneCreate]] = None

class PianificazioneOut(OrmBase, PianificazioneBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    commessa_id: Optional[uuid.UUID] = None
    cliente: Optional[ClienteOut] = None
    lavorazioni: List[PianificazioneLavorazioneOut] = []
    
    # Calcolati
    costo_totale: Decimal = Decimal("0")
    margine_euro: Decimal = Decimal("0")
    margine_percentuale: float = 0


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


class BudgetVarianceOut(BaseModel):
    categoria_id: uuid.UUID
    categoria_nome: str
    categoria_colore: str
    budget: Decimal
    speso: Decimal
    varianza: Decimal
    varianza_pct: float
    percentuale_utilizzo: float
    status: str
    note: Optional[str] = None


class BudgetTrendPointOut(BaseModel):
    mese: str
    budget: Decimal
    speso: Decimal
    varianza: Decimal
    varianza_pct: float
    percentuale_utilizzo: float
    status: str


class BudgetTrendSeriesOut(BaseModel):
    categoria_id: uuid.UUID
    categoria_nome: str
    categoria_colore: str
    data: List[BudgetTrendPointOut]


class BudgetTrendOut(BaseModel):
    mesi: List[str]
    series: List[BudgetTrendSeriesOut]


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
    contenuto: str = Field(..., min_length=1, max_length=10000)
    tipo: str = "testo"
    risposta_a: Optional[uuid.UUID] = None

class ChatMessaggioCreate(ChatMessaggioBase):
    canale_id: uuid.UUID
    progetto_id: Optional[uuid.UUID] = None

class ChatCanaleCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=255)
    member_ids: List[uuid.UUID] = Field(default_factory=list)
    logo_url: Optional[str] = Field(None, max_length=500)

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
class CRMStageCreate(BaseModel):
    nome: str
    colore: str = "#7c3aed"
    ordine: int = 0
    probabilita: int = 0

class CRMStageUpdate(BaseModel):
    nome: Optional[str] = None
    colore: Optional[str] = None
    ordine: Optional[int] = None
    probabilita: Optional[int] = None

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
    suggerimento_ai: Optional[str] = None

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

# ── PIANIFICAZIONE ────────────────────────────────────────
class PianificazioneLavorazioneBase(BaseModel):
    tipo_lavorazione: str
    user_id: Optional[uuid.UUID] = None
    ore_previste: Decimal = Decimal("0")
    costo_orario_snapshot: Decimal = Decimal("0")
    note: Optional[str] = None

class PianificazioneLavorazioneCreate(PianificazioneLavorazioneBase):
    pass

class PianificazioneLavorazioneOut(OrmBase, PianificazioneLavorazioneBase):
    id: uuid.UUID
    pianificazione_id: uuid.UUID
    user: Optional[UserOut] = None

class PianificazioneBase(BaseModel):
    cliente_id: uuid.UUID
    budget: Decimal = Decimal("0")
    note: Optional[str] = None
    stato: PianificazioneStatus = PianificazioneStatus.PENDING

class PianificazioneCreate(PianificazioneBase):
    lavorazioni: List[PianificazioneLavorazioneCreate] = []

class PianificazioneOut(OrmBase, PianificazioneBase):
    id: uuid.UUID
    lavorazioni: List[PianificazioneLavorazioneOut] = []
    commessa_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    costo_totale: Decimal = Decimal("0")
    margine_euro: Decimal = Decimal("0")
    margine_percentuale: float = 0

# ── Update Forward Refs ──
CommessaOut.model_rebuild()
PianificazioneOut.model_rebuild()
PianificazioneLavorazioneOut.model_rebuild()


# ── COSTI FISSI ───────────────────────────────────────────
class CostoFissoCreate(BaseModel):
    descrizione: str = Field(..., min_length=1, max_length=200)
    importo: Decimal = Field(..., gt=0)
    categoria: Optional[str] = Field(None, max_length=50)
    categoria_id: Optional[uuid.UUID] = None  # §4.8: piano dei conti governato
    centro_costo_id: Optional[uuid.UUID] = None  # §4.7: area funzionale
    periodicita: Optional[str] = Field("mensile", max_length=20)
    attivo: bool = True
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    note: Optional[str] = Field(None, max_length=1000)


class CostoFissoUpdate(BaseModel):
    descrizione: Optional[str] = Field(None, min_length=1, max_length=200)
    importo: Optional[Decimal] = Field(None, gt=0)
    categoria: Optional[str] = Field(None, max_length=50)
    categoria_id: Optional[uuid.UUID] = None
    centro_costo_id: Optional[uuid.UUID] = None
    periodicita: Optional[str] = Field(None, max_length=20)
    attivo: Optional[bool] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    note: Optional[str] = Field(None, max_length=1000)


class CostoFissoOut(OrmBase):
    id: uuid.UUID
    descrizione: str
    importo: Decimal
    categoria: Optional[str]
    periodicita: Optional[str]
    attivo: bool
    data_inizio: Optional[date]
    data_fine: Optional[date]
    note: Optional[str]
    created_at: datetime
    updated_at: datetime


# ── CONFIG MEMO CLIENTE/COLLABORATORE DEDICATO (P&L §7.6) ──
class ConfigPlMemoOut(OrmBase):
    id: int
    cliente_dedicato_id: Optional[uuid.UUID]
    collaboratore_dedicato_id: Optional[uuid.UUID]
    costo_collaboratore_mensile: Optional[Decimal]
    updated_at: datetime


class ConfigPlMemoUpdate(BaseModel):
    cliente_dedicato_id: Optional[uuid.UUID] = None
    collaboratore_dedicato_id: Optional[uuid.UUID] = None
    costo_collaboratore_mensile: Optional[Decimal] = Field(None, ge=0)


# ── COSTI VARIABILI (registro forecasting cassa — brief §2.5) ──
# Tipi via Literal: l'errore di validazione e' un literal_error con ctx serializzabile (422 pulito),
# a differenza di un field_validator che solleva ValueError (ctx non JSON-safe -> 500 col handler app).
CostoVarTipo = Literal["ORARIO", "A_PROGETTO", "UNA_TANTUM"]
CostoVarStato = Literal["PREVISTO", "SOSTENUTO"]
CostoVarRicorrenza = Literal["MENSILE"]


class CostoVariabileCreate(BaseModel):
    descrizione: str = Field(..., min_length=1, max_length=500)
    collaboratore_risorsa_id: Optional[uuid.UUID] = None
    collaboratore_nome: Optional[str] = Field(None, max_length=200)
    tipo: CostoVarTipo
    importo: Decimal = Field(..., gt=0)
    data_prevista: date
    ricorrenza: Optional[CostoVarRicorrenza] = None  # null = una tantum
    commessa_id: Optional[uuid.UUID] = None
    progetto_id: Optional[uuid.UUID] = None
    stato: CostoVarStato = "PREVISTO"
    note: Optional[str] = Field(None, max_length=1000)


class CostoVariabileUpdate(BaseModel):
    descrizione: Optional[str] = Field(None, min_length=1, max_length=500)
    collaboratore_risorsa_id: Optional[uuid.UUID] = None
    collaboratore_nome: Optional[str] = Field(None, max_length=200)
    tipo: Optional[CostoVarTipo] = None
    importo: Optional[Decimal] = Field(None, gt=0)
    data_prevista: Optional[date] = None
    ricorrenza: Optional[CostoVarRicorrenza] = None
    commessa_id: Optional[uuid.UUID] = None
    progetto_id: Optional[uuid.UUID] = None
    stato: Optional[CostoVarStato] = None
    note: Optional[str] = Field(None, max_length=1000)


class CostoVariabileOut(OrmBase):
    id: uuid.UUID
    descrizione: str
    collaboratore_risorsa_id: Optional[uuid.UUID]
    collaboratore_nome: Optional[str]
    tipo: str
    importo: Decimal
    data_prevista: date
    ricorrenza: Optional[str]
    commessa_id: Optional[uuid.UUID]
    progetto_id: Optional[uuid.UUID]
    stato: str
    note: Optional[str]
    created_at: datetime
    updated_at: datetime


# ── PARAMETRI (registro centralizzato effective-dated — spec v2 §19) ──
ParametroGruppo = Literal["fiscalita", "tesoreria", "budget", "marginalita", "soci_risorse", "chiusura", "preventivatore", "clienti"]
ParametroTipo = Literal["percentuale", "euro", "intero", "booleano", "enum", "data", "testo"]
ParametroScope = Literal["globale", "con_override_entita"]
ParametroFonte = Literal["utente", "commercialista", "direzione"]


class ParametroCreate(BaseModel):
    chiave: str = Field(..., min_length=1, max_length=100)
    gruppo: ParametroGruppo
    descrizione: Optional[str] = None
    tipo: ParametroTipo
    valore: Optional[str] = None  # serializzato; interpretato secondo `tipo`
    valido_da: date
    scope: ParametroScope = "globale"
    fonte: Optional[ParametroFonte] = None
    nota: Optional[str] = None


class ParametroUpdate(BaseModel):
    gruppo: Optional[ParametroGruppo] = None
    descrizione: Optional[str] = None
    tipo: Optional[ParametroTipo] = None
    valore: Optional[str] = None
    valido_da: Optional[date] = None
    scope: Optional[ParametroScope] = None
    fonte: Optional[ParametroFonte] = None
    nota: Optional[str] = None


class ParametroOut(OrmBase):
    id: uuid.UUID
    chiave: str
    gruppo: str
    descrizione: Optional[str]
    tipo: str
    valore: Optional[str]
    valido_da: date
    scope: str
    fonte: Optional[str]
    nota: Optional[str]
    created_at: datetime
    updated_at: datetime
    updated_by: Optional[uuid.UUID]


# ── SCADENZE (tabella unificata — spec v2 §5.2) ──
ScadenzaTipo = Literal["attiva", "passiva", "fiscale", "contributiva", "finanziaria"]
ScadenzaControparte = Literal["cliente", "fornitore", "erario", "inps", "banca", "altro"]
ScadenzaOrigine = Literal["fic", "manuale", "ricorrenza", "f24", "progetto"]


class ScadenzaCreate(BaseModel):
    tipo: ScadenzaTipo
    data_attesa: date
    importo: Decimal = Field(..., gt=0)
    importo_incassato: Decimal = Field(0, ge=0)
    controparte_tipo: Optional[ScadenzaControparte] = None
    controparte_id: Optional[uuid.UUID] = None
    progetto_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None
    categoria_id: Optional[uuid.UUID] = None
    documento_rif: Optional[str] = Field(None, max_length=200)
    origine: ScadenzaOrigine
    milestone: Optional[str] = Field(None, max_length=100)
    fattura_attiva_id: Optional[uuid.UUID] = None
    fattura_passiva_id: Optional[uuid.UUID] = None
    impatta_cassa_bite: bool = True
    note: Optional[str] = None
    # stato e importo_residuo NON accettati: derivati dal service.


class ScadenzaUpdate(BaseModel):
    tipo: Optional[ScadenzaTipo] = None
    data_attesa: Optional[date] = None
    importo: Optional[Decimal] = Field(None, gt=0)
    importo_incassato: Optional[Decimal] = Field(None, ge=0)
    controparte_tipo: Optional[ScadenzaControparte] = None
    controparte_id: Optional[uuid.UUID] = None
    progetto_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None
    categoria_id: Optional[uuid.UUID] = None
    documento_rif: Optional[str] = Field(None, max_length=200)
    origine: Optional[ScadenzaOrigine] = None
    milestone: Optional[str] = Field(None, max_length=100)
    fattura_attiva_id: Optional[uuid.UUID] = None
    fattura_passiva_id: Optional[uuid.UUID] = None
    impatta_cassa_bite: Optional[bool] = None
    note: Optional[str] = None


class ScadenzaOut(OrmBase):
    id: uuid.UUID
    tipo: str
    data_attesa: date
    importo: Decimal
    stato: str
    importo_incassato: Decimal
    importo_residuo: Decimal
    controparte_tipo: Optional[str]
    controparte_id: Optional[uuid.UUID]
    progetto_id: Optional[uuid.UUID]
    commessa_id: Optional[uuid.UUID]
    categoria_id: Optional[uuid.UUID]
    documento_rif: Optional[str]
    origine: str
    milestone: Optional[str]
    fattura_attiva_id: Optional[uuid.UUID]
    fattura_passiva_id: Optional[uuid.UUID]
    ricorrenza_id: Optional[uuid.UUID]
    impatta_cassa_bite: bool
    note: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[uuid.UUID]


# ── RICORRENZE (template che generano scadenze — spec v2 §5.3) ──
RicorrenzaPeriodicita = Literal["settimanale", "mensile", "bimestrale", "trimestrale", "semestrale", "annuale"]


class RicorrenzaCreate(BaseModel):
    descrizione: str = Field(..., min_length=1)
    tipo_scadenza: ScadenzaTipo
    importo: Decimal = Field(..., gt=0)
    periodicita: RicorrenzaPeriodicita
    giorno_riferimento: Optional[int] = Field(None, ge=1, le=31)
    data_inizio: date
    data_fine: Optional[date] = None
    categoria_id: Optional[uuid.UUID] = None
    conto_id: Optional[uuid.UUID] = None
    controparte_tipo: Optional[ScadenzaControparte] = None
    controparte_id: Optional[uuid.UUID] = None
    impatta_cassa_bite: bool = True
    attivo: bool = True
    note: Optional[str] = None


class RicorrenzaUpdate(BaseModel):
    descrizione: Optional[str] = Field(None, min_length=1)
    tipo_scadenza: Optional[ScadenzaTipo] = None
    importo: Optional[Decimal] = Field(None, gt=0)
    periodicita: Optional[RicorrenzaPeriodicita] = None
    giorno_riferimento: Optional[int] = Field(None, ge=1, le=31)
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    categoria_id: Optional[uuid.UUID] = None
    conto_id: Optional[uuid.UUID] = None
    controparte_tipo: Optional[ScadenzaControparte] = None
    controparte_id: Optional[uuid.UUID] = None
    impatta_cassa_bite: Optional[bool] = None
    attivo: Optional[bool] = None
    note: Optional[str] = None


class RicorrenzaOut(OrmBase):
    id: uuid.UUID
    descrizione: str
    tipo_scadenza: str
    importo: Decimal
    periodicita: str
    giorno_riferimento: Optional[int]
    data_inizio: date
    data_fine: Optional[date]
    prossima_data: Optional[date]
    categoria_id: Optional[uuid.UUID]
    conto_id: Optional[uuid.UUID]
    controparte_tipo: Optional[str]
    controparte_id: Optional[uuid.UUID]
    impatta_cassa_bite: bool
    attivo: bool
    note: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[uuid.UUID]


class GeneraRicorrenzeRequest(BaseModel):
    fino_a: date
    ricorrenza_id: Optional[uuid.UUID] = None


# ── ALLOCAZIONE fattura attiva -> commessa (Tabella F — spec v2 §7) ──
class AllocazioneCreate(BaseModel):
    commessa_id: uuid.UUID
    importo_allocato: Decimal = Field(..., gt=0)
    note: Optional[str] = None


# ── RATE A MILESTONE progetti (spec v2 §4.4/§4.5) ──
MilestoneRata = Literal["accordo_siglato", "approvazione_layout", "messa_online", "altro"]


class RataCreate(BaseModel):
    numero: int = Field(..., ge=1)
    percentuale: Decimal = Field(..., gt=0, le=100)
    milestone: MilestoneRata
    milestone_descrizione: Optional[str] = Field(None, max_length=200)
    note: Optional[str] = None


class RaggiungiRataRequest(BaseModel):
    data_raggiungimento: date


# ── PERIODI CONTABILI (lock competenza — spec v2 §13.6) ──
class RiapriPeriodoRequest(BaseModel):
    motivo: str = Field(..., min_length=1)


# ── COEFFICIENTE OVH (spec v2 §4.5) ──
class RefreshOvhRequest(BaseModel):
    periodo: date
    overhead: Optional[Decimal] = None  # override what-if (test/simulazione)
    base: Optional[Decimal] = None


class GeneraF24Request(BaseModel):
    periodo: date
    data_versamento: date


# ── BUDGET & FORECAST (spec v2 §13) ──
BudgetTipo = Literal["budget", "forecast"]
BudgetStato = Literal["bozza", "approvato", "archiviato"]
BudgetVoceTipo = Literal["ricavo", "costo_diretto", "costo_struttura", "altro"]


class BudgetVersioneCreate(BaseModel):
    anno: int = Field(..., ge=2000, le=2100)
    tipo: BudgetTipo
    versione: Optional[int] = Field(None, ge=1)  # auto-incrementa se assente
    periodo_riferimento: Optional[date] = None
    note: Optional[str] = None


class BudgetVersioneUpdate(BaseModel):
    stato: Optional[BudgetStato] = None
    periodo_riferimento: Optional[date] = None
    periodo_snapshot: Optional[date] = None
    note: Optional[str] = None


class BudgetRigaCreate(BaseModel):
    anno: Optional[int] = None  # default = anno della versione
    mese: int = Field(..., ge=1, le=12)
    voce_tipo: BudgetVoceTipo
    voce_ce_id: Optional[uuid.UUID] = None
    categoria_id: Optional[uuid.UUID] = None
    cliente_id: Optional[uuid.UUID] = None
    commessa_id: Optional[uuid.UUID] = None
    centro_costo_id: Optional[uuid.UUID] = None
    importo: Decimal
    note: Optional[str] = None

    @model_validator(mode="after")
    def _un_solo_asse(self):
        # §13.3: una riga vive su UN SOLO asse di dettaglio (no doppio conteggio).
        assi = [self.cliente_id, self.commessa_id, self.centro_costo_id]
        if sum(1 for a in assi if a is not None) > 1:
            raise ValueError("Una riga budget puo' avere UN SOLO asse tra cliente/commessa/centro_costo (§13.3)")
        return self


class BudgetRigheBulk(BaseModel):
    righe: List[BudgetRigaCreate] = Field(..., min_length=1)


class GeneraForecastRequest(BaseModel):
    anno: int = Field(..., ge=2000, le=2100)
    da_mese: int = Field(..., ge=1, le=12)


class BudgetRigaUpdate(BaseModel):
    importo: Optional[Decimal] = None
    voce_tipo: Optional[BudgetVoceTipo] = None
    note: Optional[str] = None


# ── PESI CONTENUTO (configurabile, driver quota Luca — brief §7.5) ──
class PesoContenutoOut(OrmBase):
    tipo: str
    peso: Decimal
    updated_at: datetime


class PesoContenutoUpdate(BaseModel):
    peso: Decimal = Field(..., gt=0)


# ── REGOLE RICONCILIAZIONE ────────────────────────────────
class RegolaRiconciliazioneCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    pattern: str = Field(..., min_length=1, max_length=200)
    tipo_match: Optional[str] = Field("contains", max_length=20)
    categoria: Optional[str] = Field(None, max_length=100)
    fornitore_id: Optional[uuid.UUID] = None
    fattura_passiva_id: Optional[uuid.UUID] = None
    auto_riconcilia: bool = False
    priorita: int = Field(0, ge=0, le=100)
    attiva: bool = True


class RegolaRiconciliazioneUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=100)
    pattern: Optional[str] = Field(None, min_length=1, max_length=200)
    tipo_match: Optional[str] = Field(None, max_length=20)
    categoria: Optional[str] = Field(None, max_length=100)
    fornitore_id: Optional[uuid.UUID] = None
    fattura_passiva_id: Optional[uuid.UUID] = None
    auto_riconcilia: Optional[bool] = None
    priorita: Optional[int] = Field(None, ge=0, le=100)
    attiva: Optional[bool] = None


# ── MOVIMENTI CASSA ───────────────────────────────────────
class MovimentoCassaCreate(BaseModel):
    data_valuta: date  # data cassa fisica
    data_competenza: Optional[date] = None  # default = data_valuta (before_insert); soggetta al lock §13.6
    ripartizione_competenza_mesi: int = Field(1, ge=1)
    importo: Decimal
    descrizione: Optional[str] = None
    categoria: Optional[str] = Field(None, max_length=100)
    tipo: Optional[str] = Field(None, max_length=20)
    data_contabile: Optional[date] = None
    note: Optional[str] = Field(None, max_length=1000)


class MovimentoCassaUpdate(BaseModel):
    categoria: Optional[str] = Field(None, max_length=100)
    descrizione: Optional[str] = None
    riconciliato: Optional[bool] = None
    fattura_attiva_id: Optional[uuid.UUID] = None
    fattura_passiva_id: Optional[uuid.UUID] = None
    note: Optional[str] = Field(None, max_length=1000)
    data_competenza: Optional[date] = None  # spec §5.1: se assente resta = data_valuta
    ripartizione_competenza_mesi: Optional[int] = Field(None, ge=1)  # risconto gestionale (>=1)


class RiconciliaRequest(BaseModel):
    riconciliato: bool = True


# ── RICONCILIAZIONI (M2M + parziali, brief §2.2) ──────────
class RiconciliazioneRiga(BaseModel):
    fattura_attiva_id: Optional[uuid.UUID] = None
    fattura_passiva_id: Optional[uuid.UUID] = None
    importo: Decimal = Field(..., gt=0)
    data: Optional[date] = None  # default lato service = movimento.data_valuta (R2)
    note: Optional[str] = Field(None, max_length=1000)


class RiconciliazioniCreate(BaseModel):
    righe: List[RiconciliazioneRiga] = Field(..., min_length=1)


# ── IMPUTAZIONI ───────────────────────────────────────────
class ImputazioneItem(BaseModel):
    cliente_id: Optional[uuid.UUID] = None
    progetto_id: Optional[uuid.UUID] = None
    tipo: str = Field("PROGETTO", max_length=20)
    percentuale: Decimal = Field(Decimal("100"), ge=0, le=100)
    importo: Decimal = Field(Decimal("0"), ge=0)
    note: Optional[str] = Field(None, max_length=500)


class ImputazioniRequest(BaseModel):
    imputazioni: List[ImputazioneItem] = []


# ── PIANO COMMESSA ────────────────────────────────────────
class PianoRiga(BaseModel):
    risorsa_id: Optional[uuid.UUID] = None
    lavorazione: str = Field("", max_length=255)
    ore_pianificate: Decimal = Field(Decimal("0"), ge=0)
    note: Optional[str] = Field(None, max_length=500)


class PianoCreate(BaseModel):
    cliente_id: uuid.UUID
    preventivo: Decimal = Field(Decimal("0"), ge=0)
    margine_target_pct: Decimal = Field(Decimal("40"), ge=0, le=100)
    budget_produttivo: Optional[Decimal] = None
    ore_budget: Optional[Decimal] = None
    costo_orario_snapshot: Optional[Decimal] = None
    mese_competenza: Optional[date] = None
    note: Optional[str] = Field(None, max_length=1000)
    righe: List[PianoRiga] = []

    @field_validator("mese_competenza")
    @classmethod
    def force_first_of_month(cls, v: Optional[date]) -> Optional[date]:
        if v is not None:
            return v.replace(day=1)
        return v


class PianoUpdate(BaseModel):
    preventivo: Optional[Decimal] = Field(None, ge=0)
    margine_target_pct: Optional[Decimal] = Field(None, ge=0, le=100)
    budget_produttivo: Optional[Decimal] = None
    ore_budget: Optional[Decimal] = None
    costo_orario_snapshot: Optional[Decimal] = None
    mese_competenza: Optional[date] = None
    note: Optional[str] = Field(None, max_length=1000)
    righe: List[PianoRiga] = []

    @field_validator("mese_competenza")
    @classmethod
    def force_first_of_month(cls, v: Optional[date]) -> Optional[date]:
        if v is not None:
            return v.replace(day=1)
        return v


class CollegaCommessaRequest(BaseModel):
    commessa_id: Optional[uuid.UUID] = None


# ── RISORSA HR ────────────────────────────────────────────
class RisorsaCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    cognome: str = Field(..., min_length=1, max_length=100)
    ruolo: Optional[str] = Field(None, max_length=150)
    tipo_contratto: str = Field("DIPENDENTE", max_length=30)
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    ore_settimanali: Decimal = Field(Decimal("40"), ge=0, le=168)
    ral: Optional[Decimal] = None
    compenso_fisso_mensile: Optional[Decimal] = None
    compenso_obiettivo: Optional[Decimal] = None
    contributi_percentuale: Decimal = Field(Decimal("30"), ge=0, le=100)
    tfr_percentuale: Decimal = Field(Decimal("6.91"), ge=0, le=100)
    costo_orario_override: Optional[Decimal] = None
    giorni_ferie: Optional[Decimal] = Field(None, ge=0)
    giorni_malattia: Optional[Decimal] = Field(None, ge=0)
    email: Optional[str] = Field(None, max_length=255)
    telefono: Optional[str] = Field(None, max_length=50)
    piva: Optional[str] = Field(None, max_length=20)
    codice_fiscale: Optional[str] = Field(None, max_length=20)
    indirizzo: Optional[str] = None
    iban: Optional[str] = Field(None, max_length=50)
    banca: Optional[str] = Field(None, max_length=100)
    bic_swift: Optional[str] = Field(None, max_length=20)
    note: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    attivo: bool = True
    quota_proforma_mensile: Optional[Decimal] = None  # Quota Luca pro-forma/mese (Prompt 4)
    tipologia: str = Field("dipendente", pattern="^(socio|dipendente|collaboratore)$")  # §4.6
    quota_pct: Optional[Decimal] = Field(None, ge=0, le=100)  # §10.4: quota societaria per IRPEF


class RisorsaUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=100)
    cognome: Optional[str] = Field(None, min_length=1, max_length=100)
    ruolo: Optional[str] = Field(None, max_length=150)
    tipo_contratto: Optional[str] = Field(None, max_length=30)
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    ore_settimanali: Optional[Decimal] = Field(None, ge=0, le=168)
    ral: Optional[Decimal] = None
    compenso_fisso_mensile: Optional[Decimal] = None
    compenso_obiettivo: Optional[Decimal] = None
    contributi_percentuale: Optional[Decimal] = Field(None, ge=0, le=100)
    tfr_percentuale: Optional[Decimal] = Field(None, ge=0, le=100)
    costo_orario_override: Optional[Decimal] = None
    giorni_ferie: Optional[Decimal] = Field(None, ge=0)
    giorni_malattia: Optional[Decimal] = Field(None, ge=0)
    email: Optional[str] = Field(None, max_length=255)
    telefono: Optional[str] = Field(None, max_length=50)
    piva: Optional[str] = Field(None, max_length=20)
    codice_fiscale: Optional[str] = Field(None, max_length=20)
    indirizzo: Optional[str] = None
    iban: Optional[str] = Field(None, max_length=50)
    banca: Optional[str] = Field(None, max_length=100)
    bic_swift: Optional[str] = Field(None, max_length=20)
    note: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    attivo: Optional[bool] = None
    quota_proforma_mensile: Optional[Decimal] = None  # Quota Luca pro-forma/mese (Prompt 4)
    costo_orario_calcolato: Optional[Decimal] = None
    tipologia: Optional[str] = Field(None, pattern="^(socio|dipendente|collaboratore)$")  # §4.6
    quota_pct: Optional[Decimal] = Field(None, ge=0, le=100)  # §10.4


# ── PRICING FLOOR (Prompt 5, stateless) ───────────────────
class PricingFloorVoce(BaseModel):
    risorsa_id: uuid.UUID
    ore: Decimal = Field(..., ge=0)


class PricingFloorRequest(BaseModel):
    voci_manodopera: List[PricingFloorVoce] = []
    costi_diretti_extra: Decimal = Field(Decimal("0"), ge=0)
    quota_luca_stimata: Decimal = Field(Decimal("0"), ge=0)
    margine_target: Decimal = Field(Decimal("0.30"))  # validato nell'endpoint: 0 <= target < 1
    mese: Optional[date] = None  # mese per il tasso overhead struttura (§3.3); default = mese corrente


# ── SALDO CASSA (Fase 2, Layer 3) ─────────────────────────
class SaldoCassaCreate(BaseModel):
    data: Optional[date] = None  # default = oggi nell'endpoint
    saldo: Decimal
    nota: Optional[str] = Field(None, max_length=500)


# ── PROGETTO TEMPLATE ─────────────────────────────────────
class ProgettoTemplateTaskOut(BaseModel):
    id: uuid.UUID
    titolo: str
    descrizione: Optional[str] = None
    ordine: int
    stima_ore: Decimal
    categoria: Optional[str] = None
    class Config: from_attributes = True

class ProgettoTemplateMilestoneOut(BaseModel):
    id: uuid.UUID
    nome: str
    giorni_dalla_creazione: int
    class Config: from_attributes = True

class ProgettoTemplateOut(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: Optional[str] = None
    descrizione: Optional[str] = None
    icona: Optional[str] = None
    colore: Optional[str] = None
    attivo: bool
    created_at: datetime
    tasks: List[ProgettoTemplateTaskOut]
    milestones: List[ProgettoTemplateMilestoneOut]
    class Config: from_attributes = True



# ── RIPARTIZIONE SOCIO (spec v2 §4.6, invariante 16) ──
class RipartizioneSocioUpsert(BaseModel):
    amministrativa_pct: Decimal = Field(..., ge=0, le=100)
    commerciale_pct: Decimal = Field(..., ge=0, le=100)
    progettuale_pct: Decimal = Field(..., ge=0, le=100)

    @model_validator(mode="after")
    def _somma_100(self):
        tot = self.amministrativa_pct + self.commerciale_pct + self.progettuale_pct
        if tot != 100:
            raise ValueError(f"amministrativa+commerciale+progettuale deve sommare 100 (attuale: {tot})")
        return self


class RipartizioneSocioOut(OrmBase):
    id: uuid.UUID
    risorsa_id: uuid.UUID
    amministrativa_pct: Decimal
    commerciale_pct: Decimal
    progettuale_pct: Decimal


class RisorsaProgettoPeriodoUpsert(BaseModel):
    progetto_id: uuid.UUID
    periodo: date
    attivo: bool = True
    override_pct: Optional[Decimal] = Field(None, ge=0, le=100)


class RisorsaProgettoPeriodoOut(OrmBase):
    id: uuid.UUID
    risorsa_id: uuid.UUID
    progetto_id: uuid.UUID
    periodo: date
    attivo: bool
    override_pct: Optional[Decimal] = None


# ── CENTRI DI COSTO (spec v2 §4.7) ──
class CentroCostoCreate(BaseModel):
    codice: str = Field(..., min_length=1, max_length=20)
    nome: str = Field(..., min_length=1, max_length=200)
    tipo: str = Field("struttura", pattern="^(produttivo|struttura)$")
    responsabile_risorsa_id: Optional[uuid.UUID] = None
    attivo: bool = True


class CentroCostoUpdate(BaseModel):
    codice: Optional[str] = Field(None, min_length=1, max_length=20)
    nome: Optional[str] = Field(None, min_length=1, max_length=200)
    tipo: Optional[str] = Field(None, pattern="^(produttivo|struttura)$")
    responsabile_risorsa_id: Optional[uuid.UUID] = None
    attivo: Optional[bool] = None


class CentroCostoOut(OrmBase):
    id: uuid.UUID
    codice: str
    nome: str
    tipo: str
    responsabile_risorsa_id: Optional[uuid.UUID] = None
    attivo: bool


# ── FINANZIAMENTI (spec v2 §4.9) ──
class FinanziamentoCreate(BaseModel):
    ente: str = Field(..., min_length=1, max_length=200)
    tipo: str = Field("prestito", pattern="^(fido|mutuo|leasing|prestito)$")
    importo_erogato: Decimal = Field(..., gt=0)
    data_erogazione: Optional[date] = None
    tasso_pct: Optional[Decimal] = Field(None, ge=0)
    durata_mesi: Optional[int] = Field(None, ge=1)
    rata_mensile: Optional[Decimal] = Field(None, gt=0)
    data_inizio_rate: Optional[date] = None
    debito_residuo: Optional[Decimal] = Field(None, ge=0)
    note: Optional[str] = None


class FinanziamentoUpdate(BaseModel):
    ente: Optional[str] = Field(None, min_length=1, max_length=200)
    tipo: Optional[str] = Field(None, pattern="^(fido|mutuo|leasing|prestito)$")
    debito_residuo: Optional[Decimal] = Field(None, ge=0)
    rata_mensile: Optional[Decimal] = Field(None, gt=0)
    attivo: Optional[bool] = None
    note: Optional[str] = None


# ── FORECAST ASSUNZIONI (spec v2 §13.2) ──
class ForecastAssunzioneUpsert(BaseModel):
    tipo_servizio: Optional[str] = Field(None, max_length=30)  # None = default globale
    fattore_stabilita: Decimal = Field(..., gt=0, le=1)
    churn_atteso_pct: Decimal = Field(Decimal("0"), ge=0, lt=100)
    nota: Optional[str] = None
