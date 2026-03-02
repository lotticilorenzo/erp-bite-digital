import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Boolean, Date, DateTime, Numeric, Integer,
    Text, ForeignKey, UniqueConstraint, Enum as SAEnum,
    JSON, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base
import enum


# ── ENUMS ─────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    PM = "PM"
    DIPENDENTE = "DIPENDENTE"
    FREELANCER = "FREELANCER"

class ProjectType(str, enum.Enum):
    RETAINER = "RETAINER"
    ONE_OFF = "ONE_OFF"

class ProjectStatus(str, enum.Enum):
    ATTIVO = "ATTIVO"
    CHIUSO = "CHIUSO"

class CommessaStatus(str, enum.Enum):
    APERTA = "APERTA"
    PRONTA_CHIUSURA = "PRONTA_CHIUSURA"
    CHIUSA = "CHIUSA"
    FATTURATA = "FATTURATA"
    INCASSATA = "INCASSATA"

class TaskStatus(str, enum.Enum):
    DA_FARE = "DA_FARE"
    BOZZE_IDEE = "BOZZE_IDEE"
    DA_CORREGGERE = "DA_CORREGGERE"
    IN_REVIEW = "IN_REVIEW"
    PRONTO = "PRONTO"
    PROGRAMMATO = "PROGRAMMATO"
    PUBBLICATO = "PUBBLICATO"

class TimesheetStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVATO = "APPROVATO"
    RIFIUTATO = "RIFIUTATO"

class CostoTipo(str, enum.Enum):
    FISSO = "FISSO"
    VARIABILE = "VARIABILE"

class MovimentoStatus(str, enum.Enum):
    NON_RICONCILIATO = "NON_RICONCILIATO"
    RICONCILIATO = "RICONCILIATO"
    DA_VERIFICARE = "DA_VERIFICARE"


# ── USER ──────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100))
    cognome: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    ruolo: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"))
    costo_orario: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    data_inizio: Mapped[Optional[date]] = mapped_column(Date)
    data_fine: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Disambiguazione: Timesheet ha due FK verso users (user_id, approvato_da)
    timesheet: Mapped[List["Timesheet"]] = relationship(
        foreign_keys="Timesheet.user_id",
        back_populates="user",
    )
    timesheet_approvati: Mapped[List["Timesheet"]] = relationship(
        foreign_keys="Timesheet.approvato_da",
        back_populates="approvatore",
    )
    tasks_assegnati: Mapped[List["Task"]] = relationship(foreign_keys="Task.assegnatario_id", back_populates="assegnatario")


# ── CLIENTE ───────────────────────────────────────────────
class Cliente(Base):
    __tablename__ = "clienti"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ragione_sociale: Mapped[str] = mapped_column(String(255))
    piva: Mapped[Optional[str]] = mapped_column(String(20))
    codice_fiscale: Mapped[Optional[str]] = mapped_column(String(20))
    sdi: Mapped[Optional[str]] = mapped_column(String(10))
    pec: Mapped[Optional[str]] = mapped_column(String(255))
    indirizzo: Mapped[Optional[str]] = mapped_column(Text)
    condizioni_pagamento: Mapped[Optional[str]] = mapped_column(String(100))
    fic_cliente_id: Mapped[Optional[str]] = mapped_column(String(100))
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    progetti: Mapped[List["Progetto"]] = relationship(back_populates="cliente")
    commesse: Mapped[List["Commessa"]] = relationship(back_populates="cliente")


# ── PROGETTO ──────────────────────────────────────────────
class Progetto(Base):
    __tablename__ = "progetti"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id"))
    nome: Mapped[str] = mapped_column(String(255))
    tipo: Mapped[ProjectType] = mapped_column(SAEnum(ProjectType, name="project_type"))
    stato: Mapped[ProjectStatus] = mapped_column(SAEnum(ProjectStatus, name="project_status"), default=ProjectStatus.ATTIVO)
    importo_fisso: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    importo_variabile: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    delivery_attesa: Mapped[int] = mapped_column(Integer, default=0)
    clickup_list_id: Mapped[Optional[str]] = mapped_column(String(100))
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cliente: Mapped["Cliente"] = relationship(back_populates="progetti")
    commesse_link: Mapped[List["CommessaProgetto"]] = relationship(back_populates="progetto")
    team: Mapped[List["ProgettoTeam"]] = relationship(back_populates="progetto")


class ProgettoTeam(Base):
    __tablename__ = "progetto_team"
    __table_args__ = (UniqueConstraint("progetto_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    progetto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    ruolo_progetto: Mapped[Optional[str]] = mapped_column(String(100))

    progetto: Mapped["Progetto"] = relationship(back_populates="team")
    user: Mapped["User"] = relationship()


# ── COMMESSA ──────────────────────────────────────────────
class Commessa(Base):
    __tablename__ = "commesse"
    __table_args__ = (UniqueConstraint("cliente_id", "mese_competenza"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id"))
    mese_competenza: Mapped[date] = mapped_column(Date)
    stato: Mapped[CommessaStatus] = mapped_column(SAEnum(CommessaStatus, name="commessa_status"), default=CommessaStatus.APERTA)
    costo_manodopera: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    costi_diretti: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    data_chiusura: Mapped[Optional[date]] = mapped_column(Date)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cliente: Mapped["Cliente"] = relationship(back_populates="commesse")
    righe_progetto: Mapped[List["CommessaProgetto"]] = relationship(
        back_populates="commessa",
        cascade="all, delete-orphan",
    )
    timesheet: Mapped[List["Timesheet"]] = relationship(back_populates="commessa")

    @property
    def valore_fatturabile_calc(self) -> Decimal:
        """Somma del fatturabile delle righe progetto della commessa."""
        totale = Decimal("0")
        for riga in self.righe_progetto:
            totale += riga.valore_fatturabile_calc
        return totale

    @property
    def margine_euro(self) -> Decimal:
        return self.valore_fatturabile_calc - self.costo_manodopera - self.costi_diretti

    @property
    def margine_percentuale(self) -> Optional[float]:
        v = self.valore_fatturabile_calc
        if v and v > 0:
            return round(float(self.margine_euro / v * 100), 1)
        return None

    @property
    def is_locked(self) -> bool:
        """Commesse chiuse non modificabili da PM/DIPENDENTE."""
        return self.stato in (CommessaStatus.CHIUSA, CommessaStatus.FATTURATA, CommessaStatus.INCASSATA)


# ── COMMESSA PROGETTO ─────────────────────────────────────
class CommessaProgetto(Base):
    __tablename__ = "commessa_progetti"
    __table_args__ = (UniqueConstraint("commessa_id", "progetto_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    commessa_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("commesse.id", ondelete="CASCADE"),
    )
    progetto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id"))
    importo_fisso: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    importo_variabile: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    delivery_attesa: Mapped[int] = mapped_column(Integer, default=0)
    delivery_consuntiva: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    commessa: Mapped["Commessa"] = relationship(back_populates="righe_progetto")
    progetto: Mapped["Progetto"] = relationship(back_populates="commesse_link")

    @property
    def valore_fatturabile_calc(self) -> Decimal:
        if self.delivery_attesa and self.delivery_attesa > 0:
            return self.importo_fisso + (self.importo_variabile / self.delivery_attesa) * self.delivery_consuntiva
        return self.importo_fisso


# ── COEFFICIENTE ALLOCAZIONE ──────────────────────────────
class CoefficienteAllocazione(Base):
    __tablename__ = "coefficienti_allocazione"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mese_competenza: Mapped[date] = mapped_column(Date, unique=True)
    stipendi_operativi: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    overhead_produttivo: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def coefficiente(self) -> Optional[Decimal]:
        if self.overhead_produttivo and self.overhead_produttivo > 0:
            return self.stipendi_operativi / self.overhead_produttivo
        return None


# ── TASK ──────────────────────────────────────────────────
class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clickup_task_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id"))
    commessa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("commesse.id"))
    assegnatario_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    revisore_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    titolo: Mapped[str] = mapped_column(String(500))
    descrizione: Mapped[Optional[str]] = mapped_column(Text)
    stato: Mapped[TaskStatus] = mapped_column(SAEnum(TaskStatus, name="task_status"), default=TaskStatus.DA_FARE)
    data_scadenza: Mapped[Optional[date]] = mapped_column(Date)
    stima_minuti: Mapped[Optional[int]] = mapped_column(Integer)
    clickup_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    assegnatario: Mapped[Optional["User"]] = relationship(foreign_keys=[assegnatario_id], back_populates="tasks_assegnati")
    timesheet: Mapped[List["Timesheet"]] = relationship(back_populates="task")


# ── TIMESHEET ─────────────────────────────────────────────
class Timesheet(Base):
    __tablename__ = "timesheet"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id"))
    commessa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("commesse.id"))
    data_attivita: Mapped[date] = mapped_column(Date)
    mese_competenza: Mapped[date] = mapped_column(Date)
    servizio: Mapped[Optional[str]] = mapped_column(String(255))
    durata_minuti: Mapped[int] = mapped_column(Integer)
    # Snapshot del costo orario al momento dell'approvazione: evita ricalcoli retroattivi.
    costo_orario_snapshot: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    costo_lavoro: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    stato: Mapped[TimesheetStatus] = mapped_column(SAEnum(TimesheetStatus, name="timesheet_status"), default=TimesheetStatus.PENDING)
    approvato_da: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    approvato_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(foreign_keys=[user_id], back_populates="timesheet")
    approvatore: Mapped[Optional["User"]] = relationship(
        foreign_keys=[approvato_da],
        back_populates="timesheet_approvati",
    )
    task: Mapped[Optional["Task"]] = relationship(back_populates="timesheet")
    commessa: Mapped[Optional["Commessa"]] = relationship(back_populates="timesheet")


# ── COSTO ─────────────────────────────────────────────────
class Costo(Base):
    __tablename__ = "costi"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo: Mapped[CostoTipo] = mapped_column(SAEnum(CostoTipo, name="costo_tipo"))
    descrizione: Mapped[str] = mapped_column(String(255))
    importo: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    mese_competenza: Mapped[date] = mapped_column(Date)
    categoria: Mapped[Optional[str]] = mapped_column(String(100))
    progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id"))
    commessa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("commesse.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ── FATTURA ───────────────────────────────────────────────
class Fattura(Base):
    __tablename__ = "fatture"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fic_fattura_id: Mapped[str] = mapped_column(String(100), unique=True)
    cliente_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id"))
    numero: Mapped[Optional[str]] = mapped_column(String(50))
    data_emissione: Mapped[Optional[date]] = mapped_column(Date)
    data_scadenza: Mapped[Optional[date]] = mapped_column(Date)
    importo_totale: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    importo_incassato: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    data_incasso: Mapped[Optional[date]] = mapped_column(Date)
    stato_fic: Mapped[Optional[str]] = mapped_column(String(50))
    fic_raw_data: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    righe: Mapped[List["FatturaRiga"]] = relationship(back_populates="fattura", cascade="all, delete-orphan")


class FatturaRiga(Base):
    __tablename__ = "fattura_righe"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fattura_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fatture.id", ondelete="CASCADE"))
    commessa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("commesse.id"))
    descrizione: Mapped[Optional[str]] = mapped_column(String(500))
    importo: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    fattura: Mapped["Fattura"] = relationship(back_populates="righe")


# ── FORNITORE (SYNC FIC) ──────────────────────────────────
class Fornitore(Base):
    __tablename__ = "fornitori"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fic_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    ragione_sociale: Mapped[str] = mapped_column(String(255))
    piva: Mapped[Optional[str]] = mapped_column(String(20))
    codice_fiscale: Mapped[Optional[str]] = mapped_column(String(20))
    pec: Mapped[Optional[str]] = mapped_column(String(255))
    indirizzo: Mapped[Optional[str]] = mapped_column(Text)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    telefono: Mapped[Optional[str]] = mapped_column(String(50))
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    fic_raw_data: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    fatture_passive: Mapped[List["FatturaPassiva"]] = relationship(back_populates="fornitore")


# ── FATTURA ATTIVA (SYNC FIC) ─────────────────────────────
class FatturaAttiva(Base):
    __tablename__ = "fatture_attive"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fic_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    cliente_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id"))
    fic_cliente_id: Mapped[Optional[str]] = mapped_column(String(100))
    numero: Mapped[Optional[str]] = mapped_column(String(50))
    data_emissione: Mapped[Optional[date]] = mapped_column(Date)
    data_scadenza: Mapped[Optional[date]] = mapped_column(Date)
    importo_totale: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    importo_pagato: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    importo_residuo: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    stato_pagamento: Mapped[str] = mapped_column(String(20), default="ATTESA")
    data_ultimo_incasso: Mapped[Optional[date]] = mapped_column(Date)
    valuta: Mapped[Optional[str]] = mapped_column(String(10))
    payments_raw: Mapped[Optional[dict]] = mapped_column(JSON)
    fic_raw_data: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cliente: Mapped[Optional["Cliente"]] = relationship()


# ── FATTURA PASSIVA (SYNC FIC) ────────────────────────────
class FatturaPassiva(Base):
    __tablename__ = "fatture_passive"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fic_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    fornitore_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("fornitori.id"))
    fic_fornitore_id: Mapped[Optional[str]] = mapped_column(String(100))
    numero: Mapped[Optional[str]] = mapped_column(String(50))
    data_emissione: Mapped[Optional[date]] = mapped_column(Date)
    data_scadenza: Mapped[Optional[date]] = mapped_column(Date)
    importo_totale: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    importo_pagato: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    importo_residuo: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    stato_pagamento: Mapped[str] = mapped_column(String(20), default="ATTESA")
    data_ultimo_pagamento: Mapped[Optional[date]] = mapped_column(Date)
    valuta: Mapped[Optional[str]] = mapped_column(String(10))
    categoria: Mapped[Optional[str]] = mapped_column(String(100))
    payments_raw: Mapped[Optional[dict]] = mapped_column(JSON)
    fic_raw_data: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    fornitore: Mapped[Optional["Fornitore"]] = relationship(back_populates="fatture_passive")

    @property
    def fornitore_nome(self) -> Optional[str]:
        if self.fornitore:
            return self.fornitore.ragione_sociale
        return None


# ── FIC SYNC RUN ───────────────────────────────────────────
class FicSyncRun(Base):
    __tablename__ = "fic_sync_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="RUNNING")
    imported_clienti: Mapped[int] = mapped_column(Integer, default=0)
    imported_fornitori: Mapped[int] = mapped_column(Integer, default=0)
    imported_fatture_attive: Mapped[int] = mapped_column(Integer, default=0)
    imported_fatture_passive: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[Optional[dict]] = mapped_column(JSON)
    triggered_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── AUDIT LOG ─────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    tabella: Mapped[str] = mapped_column(String(100))
    record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    azione: Mapped[str] = mapped_column(String(50))
    dati_prima: Mapped[Optional[dict]] = mapped_column(JSON)
    dati_dopo: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
