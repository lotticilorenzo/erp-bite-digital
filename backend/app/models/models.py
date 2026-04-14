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
from app.models.base import Base
import enum


# ── ENUMS ─────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    # ── RUOLI ATTIVI ──────────────────────────────────────────
    ADMIN = "ADMIN"           # Accesso totale: Finance + Operations + Gestione Utenti
    DEVELOPER = "DEVELOPER"   # Accesso totale: come ADMIN (per sviluppatori del gestionale)
    COLLABORATORE = "COLLABORATORE"  # Solo Studio OS (partner esterni / freelance)
    DIPENDENTE = "DIPENDENTE" # Solo Studio OS (team interno)
    # ── LEGACY (mantenuti per compatibilità DB) ───────────────
    PM = "PM"                 # @deprecated → usare COLLABORATORE o ADMIN
    FREELANCER = "FREELANCER" # @deprecated → usare COLLABORATORE


class ServiceType(str, enum.Enum):
    SOCIAL = "SOCIAL"
    WEB = "WEB"
    CONSULENZA = "CONSULENZA"
    SPOT = "SPOT"

class ServiceCadenza(str, enum.Enum):
    MENSILE = "MENSILE"
    SEMESTRALE = "SEMESTRALE"
    ANNUALE = "ANNUALE"
    UNA_TANTUM = "UNA_TANTUM"

class ProjectType(str, enum.Enum):
    RETAINER = "RETAINER"
    ONE_OFF = "ONE_OFF"

class ProjectStatus(str, enum.Enum):
    ATTESA = "attesa"
    SFIDA = "sfida"
    ATTIVO = "attivo"


class StudioNodeType(str, enum.Enum):
    FOLDER = "folder"
    PROJECT = "project"
    TASK = "task"
    DASHBOARD = "dashboard"

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

class PreventivoStatus(str, enum.Enum):
    BOZZA = "BOZZA"
    INVIATO = "INVIATO"
    ACCETTATO = "ACCETTATO"
    RIFIUTATO = "RIFIUTATO"
    SCADUTO = "SCADUTO"


class ClientStartDayType(str, enum.Enum):
    STANDARD_1 = "STANDARD_1"  # Inizio il 1° del mese
    CROSS_15 = "CROSS_15"      # Inizio il 15 del mese (cross-mensile)


class PianificazioneStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    CONVERTED = "CONVERTED"


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
    ore_settimanali: Mapped[int] = mapped_column(Integer, default=40)
    clickup_user_id: Mapped[Optional[str]] = mapped_column(String(50))
    bio: Mapped[Optional[str]] = mapped_column(String(200))
    preferences: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
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
    tasks_in_revisione: Mapped[List["Task"]] = relationship(foreign_keys="Task.revisore_id", back_populates="revisore")


# ── CLIENTE ───────────────────────────────────────────────
class Cliente(Base):
    __tablename__ = "clienti"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ragione_sociale: Mapped[str] = mapped_column(String(255))
    codice_cliente: Mapped[Optional[str]] = mapped_column(String(10))
    numero_progressivo: Mapped[Optional[int]] = mapped_column(Integer)
    paese: Mapped[Optional[str]] = mapped_column(String(100))
    tipologia: Mapped[Optional[str]] = mapped_column(String(50))
    comune: Mapped[Optional[str]] = mapped_column(String(100))
    cap: Mapped[Optional[str]] = mapped_column(String(10))
    provincia: Mapped[Optional[str]] = mapped_column(String(5))
    telefono: Mapped[Optional[str]] = mapped_column(String(50))
    cellulare: Mapped[Optional[str]] = mapped_column(String(50))
    sito_web: Mapped[Optional[str]] = mapped_column(String(255))
    settore: Mapped[Optional[str]] = mapped_column(String(100))
    categoria: Mapped[Optional[str]] = mapped_column(String(20))
    referente: Mapped[Optional[str]] = mapped_column(String(100))
    note: Mapped[Optional[str]] = mapped_column(String(1000))
    note_indirizzo: Mapped[Optional[str]] = mapped_column(String(500))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    piva: Mapped[Optional[str]] = mapped_column(String(20))
    codice_fiscale: Mapped[Optional[str]] = mapped_column(String(20))
    sdi: Mapped[Optional[str]] = mapped_column(String(10))
    pec: Mapped[Optional[str]] = mapped_column(String(255))
    indirizzo: Mapped[Optional[str]] = mapped_column(Text)
    condizioni_pagamento: Mapped[Optional[str]] = mapped_column(String(100))
    drive_files: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    fic_cliente_id: Mapped[Optional[str]] = mapped_column(String(100))
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    affidabilita: Mapped[Optional[str]] = mapped_column(String(10), default="MEDIA", server_default="MEDIA")
    start_day_type: Mapped[ClientStartDayType] = mapped_column(SAEnum(ClientStartDayType, name="client_start_day_type"), default=ClientStartDayType.STANDARD_1, server_default="STANDARD_1")
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    progetti: Mapped[List["Progetto"]] = relationship(back_populates="cliente")
    commesse: Mapped[List["Commessa"]] = relationship(back_populates="cliente")
    preventivi: Mapped[List["Preventivo"]] = relationship(back_populates="cliente")
    pianificazioni: Mapped[List["Pianificazione"]] = relationship(back_populates="cliente")


# ── PROGETTO ──────────────────────────────────────────────
class Progetto(Base):
    __tablename__ = "progetti"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id"), nullable=True)
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
    servizi: Mapped[List["ServizioProgetto"]] = relationship(back_populates="progetto", cascade="all, delete-orphan")
    messaggi_chat: Mapped[List["ChatMessaggio"]] = relationship(back_populates="progetto", cascade="all, delete-orphan")


class ProgettoTeam(Base):
    __tablename__ = "progetto_team"
    __table_args__ = (UniqueConstraint("progetto_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    progetto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    ruolo_progetto: Mapped[Optional[str]] = mapped_column(String(100))

    progetto: Mapped["Progetto"] = relationship(back_populates="team")
    user: Mapped["User"] = relationship()



# ── SERVIZIO PROGETTO ─────────────────────────────────────
class ServizioProgetto(Base):
    __tablename__ = "servizi_progetto"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    progetto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="CASCADE"))
    tipo: Mapped[ServiceType] = mapped_column(SAEnum(ServiceType, name="servicetype"), default=ServiceType.SOCIAL)
    nome: Mapped[Optional[str]] = mapped_column(String(100))
    valore_fisso: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    valore_variabile: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    contenuti_previsti: Mapped[Optional[int]] = mapped_column(Integer)
    cadenza: Mapped[ServiceCadenza] = mapped_column(SAEnum(ServiceCadenza, name="servicecadenza"), default=ServiceCadenza.MENSILE)
    mese_inizio: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    progetto: Mapped["Progetto"] = relationship(back_populates="servizi")

# ── COMMESSA ──────────────────────────────────────────────
class Commessa(Base):
    __tablename__ = "commesse"
    __table_args__ = (UniqueConstraint("cliente_id", "mese_competenza"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id"))
    mese_competenza: Mapped[date] = mapped_column(Date)
    stato: Mapped[CommessaStatus] = mapped_column(SAEnum(CommessaStatus, name="commessa_status"), default=CommessaStatus.APERTA)
    costo_manodopera: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    fattura_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey('fatture_attive.id'), nullable=True)
    costi_diretti: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    pianificazione_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("pianificazioni.id"), nullable=True)
    piano_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("piano_commessa.id"), nullable=True)
    preventivo: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    data_inizio: Mapped[Optional[date]] = mapped_column(Date)
    data_fine: Mapped[Optional[date]] = mapped_column(Date)
    data_chiusura: Mapped[Optional[date]] = mapped_column(Date)
    ore_contratto: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    aggiustamenti: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    valore_fatturabile_override: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cliente: Mapped["Cliente"] = relationship(back_populates="commesse")
    pianificazione: Mapped[Optional["Pianificazione"]] = relationship(back_populates="commessa")
    righe_progetto: Mapped[List["CommessaProgetto"]] = relationship(
        back_populates="commessa",
        cascade="all, delete-orphan"
    )
    timesheet: Mapped[List["Timesheet"]] = relationship("Timesheet", back_populates="commessa")
    fattura: Mapped[Optional["FatturaAttiva"]] = relationship(foreign_keys="[Commessa.fattura_id]", back_populates="commesse")

    @property
    def valore_fatturabile_calc(self) -> Decimal:
        """Somma del fatturabile delle righe progetto + aggiustamenti."""
        totale = Decimal("0")
        for riga in self.righe_progetto:
            totale += riga.valore_fatturabile_calc
        # Aggiustamenti (extra/sconti)
        for ag in (self.aggiustamenti or []):
            totale += Decimal(str(ag.get('importo', 0)))
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
    progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id"), index=True)
    commessa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("commesse.id"), index=True)
    assegnatario_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    revisore_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=True, index=True)
    titolo: Mapped[str] = mapped_column(String(500))
    descrizione: Mapped[Optional[str]] = mapped_column(Text)
    stato: Mapped[TaskStatus] = mapped_column(SAEnum(TaskStatus, name="task_status"), default=TaskStatus.DA_FARE, index=True)
    data_inizio: Mapped[Optional[date]] = mapped_column(Date)
    data_scadenza: Mapped[Optional[date]] = mapped_column(Date)
    stima_minuti: Mapped[Optional[int]] = mapped_column(Integer)
    priorita: Mapped[Optional[str]] = mapped_column(String(10), default="media")
    clickup_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    assegnatario: Mapped[Optional["User"]] = relationship(foreign_keys=[assegnatario_id], back_populates="tasks_assegnati")
    revisore: Mapped[Optional["User"]] = relationship(foreign_keys=[revisore_id])
    timesheet: Mapped[List["Timesheet"]] = relationship("Timesheet", back_populates="task")
    subtasks: Mapped[List["Task"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan"
    )
    parent: Mapped[Optional["Task"]] = relationship(
        back_populates="subtasks",
        remote_side=[id],
    )
    timer_sessions: Mapped[List["TimerSession"]] = relationship("TimerSession", back_populates="task", cascade="all, delete-orphan")
    commenti: Mapped[List["TaskComment"]] = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan", order_by="TaskComment.created_at")

    @property
    def tempo_trascorso_minuti(self) -> int:
        return sum(s.durata_minuti for s in self.timer_sessions if s.durata_minuti)


# ── TASK COMMENTS ─────────────────────────────────────────────
class TaskComment(Base):
    __tablename__ = "task_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"))
    autore_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    contenuto: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    task: Mapped["Task"] = relationship("Task", back_populates="commenti")
    autore: Mapped["User"] = relationship("User", foreign_keys=[autore_id])

# ── STUDIO NODE (WORKSPACE HIERARCHY) ────────────────────
class StudioNode(Base):
    __tablename__ = "studio_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("studio_nodes.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    tipo: Mapped[StudioNodeType] = mapped_column(SAEnum(StudioNodeType, name="studio_node_type"), default=StudioNodeType.FOLDER)
    nome: Mapped[str] = mapped_column(String(255))
    icon: Mapped[Optional[str]] = mapped_column(String(50))
    color: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Links to actual entities
    linked_progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id"), nullable=True, index=True)
    linked_cliente_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id"), nullable=True, index=True)
    linked_task_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=True, index=True)
    
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    parent: Mapped[Optional["StudioNode"]] = relationship("StudioNode", remote_side=[id], back_populates="children")
    children: Mapped[List["StudioNode"]] = relationship("StudioNode", back_populates="parent", cascade="all, delete-orphan", order_by="StudioNode.order")
    user: Mapped[Optional["User"]] = relationship()
    progetto: Mapped[Optional["Progetto"]] = relationship()
    cliente: Mapped[Optional["Cliente"]] = relationship()
    task: Mapped[Optional["Task"]] = relationship()


# ── TIMER SESSION ─────────────────────────────────────────
class TimerSession(Base):
    __tablename__ = "timer_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    stopped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    durata_minuti: Mapped[Optional[int]] = mapped_column(Integer)
    salvato_timesheet: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task: Mapped["Task"] = relationship("Task", back_populates="timer_sessions")
    user: Mapped["User"] = relationship()


# ── TIMESHEET ─────────────────────────────────────────────
class Timesheet(Base):
    __tablename__ = "timesheet"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id"), index=True)
    commessa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("commesse.id"), index=True)
    data_attivita: Mapped[date] = mapped_column(Date, index=True)
    mese_competenza: Mapped[date] = mapped_column(Date, index=True)
    servizio: Mapped[Optional[str]] = mapped_column(String(255))
    durata_minuti: Mapped[int] = mapped_column(Integer)
    # Snapshot del costo orario al momento dell'approvazione: evita ricalcoli retroattivi.
    costo_orario_snapshot: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    costo_lavoro: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    stato: Mapped[TimesheetStatus] = mapped_column(SAEnum(TimesheetStatus, name="timesheet_status"), default=TimesheetStatus.PENDING)
    approvato_da: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    approvato_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    note: Mapped[Optional[str]] = mapped_column(Text)
    clickup_task_id: Mapped[Optional[str]] = mapped_column(String(50))
    clickup_parent_task_id: Mapped[Optional[str]] = mapped_column(String(50))
    task_display_name: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="timesheet")
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

    progetto: Mapped[Optional["Progetto"]] = relationship()
    commessa: Mapped[Optional["Commessa"]] = relationship()


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
    ricorrente: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    periodicita: Mapped[Optional[str]] = mapped_column(String(20))
    commessa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("commesse.id"))
    note: Mapped[Optional[str]] = mapped_column(Text)
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


# ── CATEGORIA FORNITORE ──────────────────────────────────
class CategoriaFornitore(Base):
    __tablename__ = "categorie_fornitori"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    colore: Mapped[Optional[str]] = mapped_column(String(20)) # Es: hex code
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    fornitori: Mapped[List["Fornitore"]] = relationship(back_populates="categoria_rel")


# ── FORNITORE (SYNC FIC) ──────────────────────────────────
class Fornitore(Base):
    __tablename__ = "fornitori"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fic_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True) # Reso opzionale per inserimento manuale
    ragione_sociale: Mapped[str] = mapped_column(String(255))
    codice_cliente: Mapped[Optional[str]] = mapped_column(String(10))
    piva: Mapped[Optional[str]] = mapped_column(String(20))
    codice_fiscale: Mapped[Optional[str]] = mapped_column(String(20))
    pec: Mapped[Optional[str]] = mapped_column(String(255))
    indirizzo: Mapped[Optional[str]] = mapped_column(Text)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    telefono: Mapped[Optional[str]] = mapped_column(String(50))
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    categoria_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("categorie_fornitori.id"), nullable=True)
    categoria: Mapped[Optional[str]] = mapped_column(String(50)) # Campo legacy/denormalizzato per compatibilità FIC
    competenze: Mapped[Optional[list]] = mapped_column(JSON)
    tariffa: Mapped[Optional[Decimal]] = mapped_column(Numeric(12,2))
    tariffa_tipo: Mapped[Optional[str]] = mapped_column(String(20))
    note: Mapped[Optional[str]] = mapped_column(Text)
    fic_raw_data: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    categoria_rel: Mapped[Optional["CategoriaFornitore"]] = relationship(back_populates="fornitori")
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
    importo_netto: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    importo_iva: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    importo_pagato: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    importo_residuo: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    stato_pagamento: Mapped[str] = mapped_column(String(20), default="ATTESA")
    data_ultimo_incasso: Mapped[Optional[date]] = mapped_column(Date)
    valuta: Mapped[Optional[str]] = mapped_column(String(10))
    payments_raw: Mapped[Optional[dict]] = mapped_column(JSON)
    fic_raw_data: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    commesse: Mapped[List["Commessa"]] = relationship(foreign_keys="[Commessa.fattura_id]", back_populates="fattura")

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
    importo_netto: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    importo_iva: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
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
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    tabella: Mapped[str] = mapped_column(String(100), index=True)
    record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    azione: Mapped[str] = mapped_column(String(50))
    dati_prima: Mapped[Optional[dict]] = mapped_column(JSON)
    dati_dopo: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


# ── MOVIMENTI CASSA ───────────────────────────────────────
class MovimentoCassa(Base):
    __tablename__ = "movimenti_cassa"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data_valuta: Mapped[date] = mapped_column(Date, nullable=False)
    data_contabile: Mapped[Optional[date]] = mapped_column(Date)
    descrizione: Mapped[Optional[str]] = mapped_column(Text)
    categoria: Mapped[Optional[str]] = mapped_column(String(100))
    importo: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tipo: Mapped[Optional[str]] = mapped_column(String(20))
    fattura_attiva_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("fatture_attive.id", ondelete="SET NULL"))
    fattura_passiva_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("fatture_passive.id", ondelete="SET NULL"))
    riconciliato: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ── COSTI FISSI ───────────────────────────────────────────
class CostoFisso(Base):
    __tablename__ = "costi_fissi"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    descrizione: Mapped[str] = mapped_column(String(200), nullable=False)
    importo: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    categoria: Mapped[Optional[str]] = mapped_column(String(50), default='ALTRO')
    periodicita: Mapped[Optional[str]] = mapped_column(String(20), default='mensile')
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    data_inizio: Mapped[Optional[date]] = mapped_column(Date)
    data_fine: Mapped[Optional[date]] = mapped_column(Date)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ── REGOLE RICONCILIAZIONE ────────────────────────────────
class RegolaRiconciliazione(Base):
    __tablename__ = "regole_riconciliazione"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    pattern: Mapped[str] = mapped_column(String(200), nullable=False)
    tipo_match: Mapped[Optional[str]] = mapped_column(String(20), default='contains')
    categoria: Mapped[Optional[str]] = mapped_column(String(100))
    fornitore_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey('fornitori.id', ondelete='SET NULL'), nullable=True)
    fattura_passiva_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey('fatture_passive.id', ondelete='SET NULL'), nullable=True)
    auto_riconcilia: Mapped[bool] = mapped_column(Boolean, default=False)
    priorita: Mapped[int] = mapped_column(Integer, default=0)
    attiva: Mapped[bool] = mapped_column(Boolean, default=True)
    contatore_match: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── IMPUTAZIONI FATTURE PASSIVE ───────────────────────────
class FatturaPassivaImputazione(Base):
    __tablename__ = "fatture_passive_imputazioni"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fattura_passiva_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fatture_passive.id", ondelete="CASCADE"), nullable=False)
    cliente_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id", ondelete="SET NULL"))
    progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="SET NULL"))
    tipo: Mapped[str] = mapped_column(String(20), default="PROGETTO")
    percentuale: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=100)
    importo: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── IMPUTAZIONI MOVIMENTI CASSA ───────────────────────────
class MovimentoCassaImputazione(Base):
    __tablename__ = "movimenti_cassa_imputazioni"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    movimento_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("movimenti_cassa.id", ondelete="CASCADE"), nullable=False)
    cliente_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id", ondelete="SET NULL"))
    progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="SET NULL"))
    tipo: Mapped[str] = mapped_column(String(20), default="PROGETTO")
    percentuale: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=100)
    importo: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    ereditata_da_fattura: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── RISORSA (HR) ──────────────────────────────────────────
class Risorsa(Base):
    __tablename__ = "risorse"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    cognome: Mapped[str] = mapped_column(String(100), nullable=False)
    ruolo: Mapped[Optional[str]] = mapped_column(String(150))
    tipo_contratto: Mapped[str] = mapped_column(String(30), default="DIPENDENTE")
    data_inizio: Mapped[Optional[date]] = mapped_column(Date)
    data_fine: Mapped[Optional[date]] = mapped_column(Date)
    ore_settimanali: Mapped[Decimal] = mapped_column(Numeric(4, 1), default=40)
    ral: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    compenso_fisso_mensile: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    compenso_obiettivo: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    contributi_percentuale: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=30)
    tfr_percentuale: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("6.91"))
    costo_orario_override: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    costo_orario_calcolato: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    giorni_ferie: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 1), default=Decimal('26'))
    giorni_malattia: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 1), default=Decimal('3'))
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Informazioni professionali e di contatto
    email: Mapped[Optional[str]] = mapped_column(String(255))
    telefono: Mapped[Optional[str]] = mapped_column(String(50))
    piva: Mapped[Optional[str]] = mapped_column(String(20))
    codice_fiscale: Mapped[Optional[str]] = mapped_column(String(20))
    indirizzo: Mapped[Optional[str]] = mapped_column(Text)
    
    # Informazioni bancarie
    iban: Mapped[Optional[str]] = mapped_column(String(50))
    banca: Mapped[Optional[str]] = mapped_column(String(100))
    bic_swift: Mapped[Optional[str]] = mapped_column(String(20))

    servizi: Mapped[List["RisorsaServizio"]] = relationship(back_populates="risorsa", cascade="all, delete-orphan")


class RisorsaServizio(Base):
    __tablename__ = "risorse_servizi"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    risorsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("risorse.id", ondelete="CASCADE"))
    nome_servizio: Mapped[str] = mapped_column(String(100), nullable=False)
    costo_orario: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    costo_fisso: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    risorsa: Mapped["Risorsa"] = relationship(back_populates="servizi")




# ── NOTIFICATION ──────────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="INFO") # INFO, SUCCESS, WARNING, ERROR
    link: Mapped[Optional[str]] = mapped_column(String(255))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user: Mapped["User"] = relationship()


# ── ASSENZA ───────────────────────────────────────────────
class Assenza(Base):
    __tablename__ = "assenze"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    data_inizio: Mapped[date] = mapped_column(Date, nullable=False)
    data_fine: Mapped[date] = mapped_column(Date, nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), default="FERIE") # FERIE, MALATTIA, PERMESSO
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()

# ── PREVENTIVO ────────────────────────────────────────────
class Preventivo(Base):
    __tablename__ = "preventivi"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id"))
    numero: Mapped[str] = mapped_column(String(50))
    titolo: Mapped[str] = mapped_column(String(255))
    descrizione: Mapped[Optional[str]] = mapped_column(Text)
    stato: Mapped[PreventivoStatus] = mapped_column(SAEnum(PreventivoStatus, name="preventivo_status"), default=PreventivoStatus.BOZZA)
    data_creazione: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    data_scadenza: Mapped[Optional[date]] = mapped_column(Date)
    data_accettazione: Mapped[Optional[date]] = mapped_column(Date)
    importo_totale: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cliente: Mapped["Cliente"] = relationship(back_populates="preventivi")
    voci: Mapped[List["PreventivoVoce"]] = relationship(back_populates="preventivo", cascade="all, delete-orphan")
    autore: Mapped["User"] = relationship()


class PreventivoVoce(Base):
    __tablename__ = "preventivo_voci"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    preventivo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("preventivi.id", ondelete="CASCADE"))
    descrizione: Mapped[str] = mapped_column(String(500))
    quantita: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=1)
    prezzo_unitario: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    totale: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    ordine: Mapped[int] = mapped_column(Integer, default=0)

    preventivo: Mapped["Preventivo"] = relationship(back_populates="voci")


# ── PIANIFICAZIONE ────────────────────────────────────────
class Pianificazione(Base):
    __tablename__ = "pianificazioni"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id"))
    budget: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    stato: Mapped[PianificazioneStatus] = mapped_column(SAEnum(PianificazioneStatus, name="pianificazione_status"), default=PianificazioneStatus.PENDING)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cliente: Mapped["Cliente"] = relationship(back_populates="pianificazioni")
    commessa: Mapped[Optional["Commessa"]] = relationship(back_populates="pianificazione")
    lavorazioni: Mapped[List["PianificazioneLavorazione"]] = relationship(back_populates="pianificazione", cascade="all, delete-orphan")


class PianificazioneLavorazione(Base):
    __tablename__ = "pianificazione_lavorazioni"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pianificazione_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pianificazioni.id", ondelete="CASCADE"))
    tipo_lavorazione: Mapped[str] = mapped_column(String(255))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    ore_previste: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    costo_orario_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    pianificazione: Mapped["Pianificazione"] = relationship(back_populates="lavorazioni")
    user: Mapped["User"] = relationship()


# ── BUDGET ────────────────────────────────────────────────
class BudgetCategory(Base):
    __tablename__ = "budget_categorie"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    colore: Mapped[Optional[str]] = mapped_column(String(20), default='#7c3aed')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    budgets: Mapped[List["BudgetMensile"]] = relationship(back_populates="categoria")


class BudgetMensile(Base):
    __tablename__ = "budget_mensile"
    __table_args__ = (UniqueConstraint("categoria_id", "mese_competenza"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    categoria_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("budget_categorie.id", ondelete="CASCADE"))
    mese_competenza: Mapped[date] = mapped_column(Date, nullable=False)
    importo_budget: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    categoria: Mapped["BudgetCategory"] = relationship(back_populates="budgets")


# ── WIKI ──────────────────────────────────────────────────
class WikiCategoria(Base):
    __tablename__ = "wiki_categorie"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    icona: Mapped[Optional[str]] = mapped_column(String(50))
    ordine: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    articoli: Mapped[List["WikiArticolo"]] = relationship(back_populates="categoria", cascade="all, delete-orphan")


class WikiArticolo(Base):
    __tablename__ = "wiki_articoli"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    categoria_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("wiki_categorie.id", ondelete="CASCADE"))
    titolo: Mapped[str] = mapped_column(String(255), nullable=False)
    contenuto: Mapped[Optional[str]] = mapped_column(Text)
    autore_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    ultimo_aggiornamento: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    pubblicato: Mapped[bool] = mapped_column(Boolean, default=True)
    visualizzazioni: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    categoria: Mapped["WikiCategoria"] = relationship(back_populates="articoli")
    autore: Mapped["User"] = relationship()


# ── CHAT ──────────────────────────────────────────────────
class ChatCanale(Base):
    __tablename__ = "chat_canali"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255))
    tipo: Mapped[str] = mapped_column(String(50), default='GROUP') # GENERAL, PROJECT, GROUP
    progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="SET NULL"), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    membri: Mapped[List["ChatMembro"]] = relationship(back_populates="canale", cascade="all, delete-orphan")
    messaggi: Mapped[List["ChatMessaggio"]] = relationship(back_populates="canale", cascade="all, delete-orphan")
    progetto: Mapped[Optional["Progetto"]] = relationship()

class ChatMembro(Base):
    __tablename__ = "chat_membri"
    __table_args__ = (UniqueConstraint("canale_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canale_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_canali.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    ruolo: Mapped[str] = mapped_column(String(50), default='MEMBER') # ADMIN, MEMBER
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    canale: Mapped["ChatCanale"] = relationship(back_populates="membri")
    user: Mapped["User"] = relationship()

class ChatMessaggio(Base):
    __tablename__ = "chat_messaggi"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canale_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_canali.id", ondelete="CASCADE"), nullable=True, index=True)
    progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="CASCADE"), nullable=True, index=True)
    autore_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    contenuto: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), default='testo')
    risposta_a: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_messaggi.id", ondelete="SET NULL"), index=True)
    modificato: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    progetto: Mapped[Optional["Progetto"]] = relationship(back_populates="messaggi_chat")
    canale: Mapped[Optional["ChatCanale"]] = relationship(back_populates="messaggi")
    autore: Mapped["User"] = relationship()
    reazioni: Mapped[List["ChatReazione"]] = relationship(back_populates="messaggio", cascade="all, delete-orphan")


class ChatReazione(Base):
    __tablename__ = "chat_reazioni"
    __table_args__ = (UniqueConstraint("messaggio_id", "user_id", "emoji"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    messaggio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_messaggi.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    emoji: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    messaggio: Mapped["ChatMessaggio"] = relationship(back_populates="reazioni")
    user: Mapped["User"] = relationship()


# ── DOCUMENTI ─────────────────────────────────────────────

class DocumentNode(Base):
    __tablename__ = "document_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), default='FILE')  # FOLDER | FILE
    icona: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    colore: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contenuto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_nodes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    ordine: Mapped[int] = mapped_column(Integer, default=0)
    is_private: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    parent: Mapped[Optional["DocumentNode"]] = relationship(
        "DocumentNode", remote_side="DocumentNode.id", back_populates="children"
    )
    children: Mapped[List["DocumentNode"]] = relationship(
        "DocumentNode", back_populates="parent", cascade="all, delete-orphan",
        order_by="DocumentNode.ordine, DocumentNode.nome"
    )
    autore: Mapped["User"] = relationship(foreign_keys=[created_by])


# ── CRM ───────────────────────────────────────────────────

class CRMStage(Base):
    __tablename__ = "crm_stadi"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100))
    colore: Mapped[Optional[str]] = mapped_column(String(20), default="#7c3aed")
    ordine: Mapped[int] = mapped_column(Integer, default=0)
    probabilita: Mapped[int] = mapped_column(Integer, default=0) # 0-100

    leads: Mapped[List["CRMLead"]] = relationship(back_populates="stadio")


class CRMLead(Base):
    __tablename__ = "crm_lead"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome_azienda: Mapped[str] = mapped_column(String(255), index=True)
    nome_contatto: Mapped[Optional[str]] = mapped_column(String(255))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    telefono: Mapped[Optional[str]] = mapped_column(String(50))
    sito_web: Mapped[Optional[str]] = mapped_column(String(255))
    settore: Mapped[Optional[str]] = mapped_column(String(100))
    dimensione_azienda: Mapped[Optional[str]] = mapped_column(String(50))
    stadio_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_stadi.id"), index=True)
    valore_stimato: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    probabilita_chiusura: Mapped[int] = mapped_column(Integer, default=0)
    lead_score: Mapped[int] = mapped_column(Integer, default=0)
    data_prossimo_followup: Mapped[Optional[date]] = mapped_column(Date, index=True)
    assegnato_a_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    note: Mapped[Optional[str]] = mapped_column(Text)
    fonte: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    stadio: Mapped[Optional["CRMStage"]] = relationship(back_populates="leads")
    assegnato_a: Mapped[Optional["User"]] = relationship()
    attivita: Mapped[List["CRMActivity"]] = relationship(back_populates="lead", cascade="all, delete-orphan")


class CRMActivity(Base):
    __tablename__ = "crm_attivita"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_lead.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(50)) # Nota, Chiamata, Email, Meeting
    descrizione: Mapped[Optional[str]] = mapped_column(Text)
    activity_metadata: Mapped[Optional[dict]] = mapped_column(JSON)
    data_attivita: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    autore_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    lead: Mapped["CRMLead"] = relationship(back_populates="attivita")
    autore: Mapped["User"] = relationship()
