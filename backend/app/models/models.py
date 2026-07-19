import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Boolean, Date, DateTime, Numeric, Integer, Float,
    Text, ForeignKey, UniqueConstraint, CheckConstraint, Enum as SAEnum,
    JSON, func, event
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
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
    ATTESA = "ATTESA"
    SFIDA = "SFIDA"
    ATTIVO = "ATTIVO"
    CHIUSO = "CHIUSO"


class StudioNodeType(str, enum.Enum):
    FOLDER = "folder"
    PROJECT = "project"
    TASK = "task"
    DASHBOARD = "dashboard"
    LISTA = "lista"
    DOCUMENTO = "documento"

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
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
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
    google_drive_url: Mapped[Optional[str]] = mapped_column(String(500))
    affidabilita: Mapped[Optional[str]] = mapped_column(String(10), default="MEDIA", server_default="MEDIA")
    start_day_type: Mapped[ClientStartDayType] = mapped_column(SAEnum(ClientStartDayType, name="client_start_day_type"), default=ClientStartDayType.STANDARD_1, server_default="STANDARD_1")
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
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
    note: Mapped[Optional[str]] = mapped_column(Text)
    data_inizio: Mapped[Optional[date]] = mapped_column(Date)
    data_fine: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    cliente: Mapped["Cliente"] = relationship(back_populates="progetti")
    commesse_link: Mapped[List["CommessaProgetto"]] = relationship(back_populates="progetto")
    team: Mapped[List["ProgettoTeam"]] = relationship(back_populates="progetto")
    servizi: Mapped[List["ServizioProgetto"]] = relationship(back_populates="progetto", cascade="all, delete-orphan")
    messaggi_chat: Mapped[List["ChatMessaggio"]] = relationship(back_populates="progetto", cascade="all, delete-orphan")
    milestones: Mapped[List["ProgettoMilestone"]] = relationship(back_populates="progetto", cascade="all, delete-orphan")
    briefs: Mapped[List["Brief"]] = relationship(back_populates="progetto", cascade="all, delete-orphan")


class ProgettoTeam(Base):
    __tablename__ = "progetto_team"
    __table_args__ = (UniqueConstraint("progetto_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    progetto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    ruolo_progetto: Mapped[Optional[str]] = mapped_column(String(100))
    ore_previste: Mapped[float] = mapped_column(Float, default=0)
    note: Mapped[Optional[str]] = mapped_column(Text)

    progetto: Mapped["Progetto"] = relationship(back_populates="team")
    user: Mapped["User"] = relationship()

class ProgettoMilestone(Base):
    __tablename__ = "progetto_milestones"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    progetto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="CASCADE"), index=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    data_scadenza: Mapped[Optional[date]] = mapped_column(Date)
    completata: Mapped[bool] = mapped_column(Boolean, default=False)
    
    progetto: Mapped["Progetto"] = relationship(back_populates="milestones")

class Brief(Base):
    __tablename__ = "briefs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    progetto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="CASCADE"), index=True)
    titolo: Mapped[str] = mapped_column(String(200), nullable=False)
    domande_risposte: Mapped[dict] = mapped_column(JSON, default=dict)
    stato: Mapped[str] = mapped_column(String(20), default="BOZZA")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    progetto: Mapped["Progetto"] = relationship(back_populates="briefs")



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
    costi_diretti: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)  # Input manuale (costi diretti non rappresentati come imputazioni)
    costi_diretti_imputati: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, server_default="0")  # Derivato dalle fatture_passive_imputazioni (R3)
    pianificazione_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("pianificazioni.id"), nullable=True)
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
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

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
    def costi_diretti_totali(self) -> Decimal:
        """Costi diretti non-manodopera: manuali + derivati dalle imputazioni passive (R3)."""
        return (self.costi_diretti or Decimal("0")) + (self.costi_diretti_imputati or Decimal("0"))

    @property
    def margine_euro(self) -> Decimal:
        return self.valore_fatturabile_calc - self.costo_manodopera - self.costi_diretti_totali

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
    ordine: Mapped[int] = mapped_column(Integer, default=0)
    categoria: Mapped[Optional[str]] = mapped_column(String(50))
    clickup_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), server_default="{}", default=list)

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
    attachments: Mapped[List["TaskAttachment"]] = relationship("TaskAttachment", back_populates="task", cascade="all, delete-orphan")
    assegnatari_m2m: Mapped[List["TaskAssegnatario"]] = relationship("TaskAssegnatario", back_populates="task", cascade="all, delete-orphan")

    @property
    def tempo_trascorso_minuti(self) -> int:
        return sum(s.durata_minuti for s in self.timer_sessions if s.durata_minuti)

    @property
    def assegnatari(self) -> List[dict]:
        try:
            m2m = self.assegnatari_m2m
        except Exception:
            m2m = []
        result = []
        for ta in (m2m or []):
            if ta.user:
                result.append({"id": ta.user_id, "nome": f"{ta.user.nome} {ta.user.cognome}"})
        if not result and self.assegnatario:
            result.append({"id": self.assegnatario_id, "nome": f"{self.assegnatario.nome} {self.assegnatario.cognome}"})
        return result


# ── TASK ASSEGNATARI M2M ──────────────────────────────────────
class TaskAssegnatario(Base):
    __tablename__ = "task_assegnatari"

    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    task: Mapped["Task"] = relationship(back_populates="assegnatari_m2m")
    user: Mapped["User"] = relationship()


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

# ── TASK ATTACHMENTS ──────────────────────────────────────────
class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(500))
    file_path: Mapped[str] = mapped_column(String(1000))
    file_size: Mapped[int] = mapped_column(Integer) # in bytes
    content_type: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task: Mapped["Task"] = relationship("Task", back_populates="attachments")
    user: Mapped["User"] = relationship("User")

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
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

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
    stato_pagamento: Mapped[str] = mapped_column(String(40), default="ATTESA")
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
    stato_pagamento: Mapped[str] = mapped_column(String(40), default="ATTESA")
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
    """Movimento di cassa con DOPPIA DATA (spec v2 §5.1, principio 3):
    - data_valuta E' la data cassa fisica (alimenta la Tesoreria): resta invariata, letta da API/FE.
    - data_competenza alimenta il Conto Economico gestionale. Backfill = data_valuta per lo storico.
    Stessa fonte per CE e cassa. `ripartizione_competenza_mesi` (>=1): se >1 il CE riconoscera'
    importo/N su N mesi (risconto gestionale) mentre la cassa resta un'unica uscita — SOLO il campo
    in questa fase, la ripartizione nei report arriva col CE gestionale."""
    __tablename__ = "movimenti_cassa"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data_valuta: Mapped[date] = mapped_column(Date, nullable=False)  # = data_cassa fisica (Tesoreria)
    data_competenza: Mapped[Optional[date]] = mapped_column(Date, index=True)  # Conto Economico (§5.1)
    ripartizione_competenza_mesi: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
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

    __table_args__ = (
        CheckConstraint("ripartizione_competenza_mesi >= 1", name="ck_movimenti_ripartizione_mesi_pos"),
    )

    @property
    def data_cassa(self) -> date:
        """Nomenclatura spec §5.1: data_valuta E' la data cassa fisica del movimento (principio 3).
        Alias di sola lettura per esporre il vocabolario della spec senza rinominare la colonna."""
        return self.data_valuta


@event.listens_for(MovimentoCassa, "before_insert")
def _default_data_competenza(mapper, connection, target):
    """Se data_competenza non e' fornita, coincide con la cassa (data_valuta) — spec §5.1.
    Copre ogni path di creazione (import bancario, seed, sync) senza toccare i chiamanti."""
    if target.data_competenza is None and target.data_valuta is not None:
        target.data_competenza = target.data_valuta


# ── RICONCILIAZIONI (ponte movimento <-> fattura, M2M + parziali — brief §2.2) ──
class Riconciliazione(Base):
    """Riga di riconciliazione bancaria: lega un movimento a UNA fattura (attiva o passiva)
    per un certo importo. Fonte unica: importo_pagato/residuo/stato/data delle fatture e
    il flag riconciliato dei movimenti sono DERIVATI dalla somma di queste righe.
    Un bonifico puo' avere piu' righe (pagamento multiplo); una fattura puo' essere coperta
    da piu' movimenti (pagamento parziale)."""
    __tablename__ = "riconciliazioni"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    movimento_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("movimenti_cassa.id", ondelete="CASCADE"), nullable=False, index=True)
    fattura_attiva_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("fatture_attive.id", ondelete="CASCADE"), index=True)
    fattura_passiva_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("fatture_passive.id", ondelete="CASCADE"), index=True)
    importo: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("importo > 0", name="ck_riconciliazioni_importo_pos"),
        CheckConstraint("num_nonnulls(fattura_attiva_id, fattura_passiva_id) = 1", name="ck_riconciliazioni_una_fattura"),
    )


# ── COSTO VARIABILE (registro forecasting cassa — brief §2.5) ──
class CostoVariabile(Base):
    """Registro strutturato di costi variabili (collaboratori a consumo: Benedetta €/h,
    Francesco M. per progetto) per il FORECASTING di cassa.
    NON e' un costo di competenza: NON entra in margine/P&L (quelli usano le fatture passive
    imputate). Solo lo stato PREVISTO alimenta la proiezione cassa come uscita datata; SOSTENUTO
    ne esce (gancio anti doppio conteggio quando il costo diventa una fattura passiva reale)."""
    __tablename__ = "costi_variabili"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    descrizione: Mapped[str] = mapped_column(Text, nullable=False)
    collaboratore_risorsa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("risorse.id", ondelete="SET NULL"))
    collaboratore_nome: Mapped[Optional[str]] = mapped_column(Text)  # per chi non e' in risorse
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # ORARIO | A_PROGETTO | UNA_TANTUM
    importo: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    data_prevista: Mapped[date] = mapped_column(Date, nullable=False)
    ricorrenza: Mapped[Optional[str]] = mapped_column(String(20))  # MENSILE | null (una tantum)
    commessa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("commesse.id", ondelete="SET NULL"))
    progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="SET NULL"))
    stato: Mapped[str] = mapped_column(String(20), nullable=False, default="PREVISTO")  # PREVISTO | SOSTENUTO
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("importo > 0", name="ck_costi_variabili_importo_pos"),
        CheckConstraint("tipo IN ('ORARIO','A_PROGETTO','UNA_TANTUM')", name="ck_costi_variabili_tipo"),
        CheckConstraint("stato IN ('PREVISTO','SOSTENUTO')", name="ck_costi_variabili_stato"),
        CheckConstraint("ricorrenza IS NULL OR ricorrenza IN ('MENSILE')", name="ck_costi_variabili_ricorrenza"),
    )


class Parametro(Base):
    """Registro parametri centralizzato effective-dated (spec v2 §19).
    Fonte unica dei parametri di configurazione finanziaria. Piu' righe per `chiave`
    con `valido_da` diverse; il resolver (services.get_parametro) sceglie la riga con
    valido_da MASSIMA <= data di riferimento. Le righe storiche NON si cancellano.
    `valore` e' serializzato in TEXT: `tipo` dice come interpretarlo."""
    __tablename__ = "parametri"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chiave: Mapped[str] = mapped_column(String(100), nullable=False)
    gruppo: Mapped[str] = mapped_column(String(30), nullable=False)  # fiscalita|tesoreria|budget|marginalita|soci_risorse|chiusura|preventivatore|clienti
    descrizione: Mapped[Optional[str]] = mapped_column(Text)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # percentuale|euro|intero|booleano|enum|data|testo
    valore: Mapped[Optional[str]] = mapped_column(Text)
    valido_da: Mapped[date] = mapped_column(Date, nullable=False)
    scope: Mapped[str] = mapped_column(String(30), nullable=False, default="globale")  # globale|con_override_entita
    fonte: Mapped[Optional[str]] = mapped_column(String(30))  # utente|commercialista|direzione
    nota: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    __table_args__ = (
        UniqueConstraint("chiave", "valido_da", name="uq_parametri_chiave_valido_da"),
        CheckConstraint("gruppo IN ('fiscalita','tesoreria','budget','marginalita','soci_risorse','chiusura','preventivatore','clienti')", name="ck_parametri_gruppo"),
        CheckConstraint("tipo IN ('percentuale','euro','intero','booleano','enum','data','testo')", name="ck_parametri_tipo"),
        CheckConstraint("scope IN ('globale','con_override_entita')", name="ck_parametri_scope"),
        CheckConstraint("fonte IS NULL OR fonte IN ('utente','commercialista','direzione')", name="ck_parametri_fonte"),
    )


class Scadenza(Base):
    """Tabella scadenze unificata (spec v2 §5.2): attive/passive/fiscali/contributive/finanziarie.
    FONTE UNICA futura per proiezione cassa e scadenzario; in questa fase e' SOLO struttura+CRUD,
    NON popolata dalle fatture e NON collegata ai calcoli (anti doppio conteggio).
    `importo_residuo` e `stato` sono derivati dal service (residuo = importo - incassato)."""
    __tablename__ = "scadenze"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # attiva|passiva|fiscale|contributiva|finanziaria
    data_attesa: Mapped[date] = mapped_column(Date, nullable=False)
    importo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    stato: Mapped[str] = mapped_column(String(20), nullable=False, default="aperta")  # aperta|parziale|chiusa|scaduta
    importo_incassato: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    importo_residuo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    controparte_tipo: Mapped[Optional[str]] = mapped_column(String(20))  # cliente|fornitore|erario|inps|banca|altro
    controparte_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))  # polimorfico, no FK
    progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id", ondelete="SET NULL"))
    commessa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("commesse.id", ondelete="SET NULL"))
    categoria_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))  # nessuna tabella categorie generica
    documento_rif: Mapped[Optional[str]] = mapped_column(String(200))
    origine: Mapped[str] = mapped_column(String(20), nullable=False)  # fic|manuale|ricorrenza|f24|progetto
    milestone: Mapped[Optional[str]] = mapped_column(String(100))
    fattura_attiva_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("fatture_attive.id", ondelete="SET NULL"))
    fattura_passiva_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("fatture_passive.id", ondelete="SET NULL"))
    ricorrenza_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("ricorrenze.id", ondelete="SET NULL"))  # occorrenza generata (spec §5.3)
    impatta_cassa_bite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)  # spec §10.0
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    __table_args__ = (
        CheckConstraint("importo > 0", name="ck_scadenze_importo_pos"),
        CheckConstraint("tipo IN ('attiva','passiva','fiscale','contributiva','finanziaria')", name="ck_scadenze_tipo"),
        CheckConstraint("stato IN ('aperta','parziale','chiusa','scaduta')", name="ck_scadenze_stato"),
        CheckConstraint("controparte_tipo IS NULL OR controparte_tipo IN ('cliente','fornitore','erario','inps','banca','altro')", name="ck_scadenze_controparte_tipo"),
        CheckConstraint("origine IN ('fic','manuale','ricorrenza','f24','progetto')", name="ck_scadenze_origine"),
    )


class Ricorrenza(Base):
    """Template ricorrente (spec v2 §5.3): genera occorrenze in `scadenze` via il motore
    services.genera_occorrenze. NON e' letta da alcun calcolo; non tocca costi_variabili.
    Idempotenza: UNIQUE(ricorrenza_id, data_attesa) sulle scadenze generate."""
    __tablename__ = "ricorrenze"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    descrizione: Mapped[str] = mapped_column(Text, nullable=False)
    tipo_scadenza: Mapped[str] = mapped_column(String(20), nullable=False)  # tipo delle scadenze generate
    importo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    periodicita: Mapped[str] = mapped_column(String(20), nullable=False)  # settimanale|mensile|bimestrale|trimestrale|semestrale|annuale
    giorno_riferimento: Mapped[Optional[int]] = mapped_column(Integer)  # null = giorno di data_inizio
    data_inizio: Mapped[date] = mapped_column(Date, nullable=False)
    data_fine: Mapped[Optional[date]] = mapped_column(Date)  # null = indeterminata
    prossima_data: Mapped[Optional[date]] = mapped_column(Date)  # aggiornata dal generatore
    categoria_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    conto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    controparte_tipo: Mapped[Optional[str]] = mapped_column(String(20))
    controparte_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    impatta_cassa_bite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    attivo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    __table_args__ = (
        CheckConstraint("importo > 0", name="ck_ricorrenze_importo_pos"),
        CheckConstraint("tipo_scadenza IN ('attiva','passiva','fiscale','contributiva','finanziaria')", name="ck_ricorrenze_tipo"),
        CheckConstraint("periodicita IN ('settimanale','mensile','bimestrale','trimestrale','semestrale','annuale')", name="ck_ricorrenze_periodicita"),
        CheckConstraint("giorno_riferimento IS NULL OR giorno_riferimento BETWEEN 1 AND 31", name="ck_ricorrenze_giorno"),
        CheckConstraint("controparte_tipo IS NULL OR controparte_tipo IN ('cliente','fornitore','erario','inps','banca','altro')", name="ck_ricorrenze_controparte_tipo"),
    )


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


# ── SALDO CASSA (manuale, per proiezione cassa — Fase 2 Layer 3) ──
class SaldoCassa(Base):
    __tablename__ = "saldi_cassa"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    saldo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    nota: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── CONFIG MEMO CLIENTE/COLLABORATORE DEDICATO (P&L §7.6) ──
class ConfigPlMemo(Base):
    """Config singleton (id=1) per il memo §7.6: cliente dedicato (Italfer), collaboratore dedicato
    (Paolo G.) e costo mensile del collaboratore (NULL = da cedolino, esterno). Inerte se tutto NULL."""
    __tablename__ = "config_pl_memo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    cliente_dedicato_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("clienti.id", ondelete="SET NULL"))
    collaboratore_dedicato_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("risorse.id", ondelete="SET NULL"))
    costo_collaboratore_mensile: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("id = 1", name="ck_config_pl_memo_singleton"),
    )


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
    costo_orario_lordo: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))  # Input grezzo (non fully-loaded); la verità per il costing è costo_orario_calcolato
    costo_orario_override: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    costo_orario_calcolato: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    quota_proforma_mensile: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))  # Quota Luca pro-forma/mese (Prompt 4): destinataria=questa risorsa
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

    @property
    def costo_orario_effettivo(self) -> Decimal:
        """Costo orario effettivo: override se presente, altrimenti calcolato, altrimenti 0.
        Esposto da RisorsaOut e consumato dal FE (PricingFloor, CollaboratorCostCalculator)."""
        return self.costo_orario_override or self.costo_orario_calcolato or Decimal("0")


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
    stato: Mapped[str] = mapped_column(String(20), default="PENDING") # PENDING, APPROVATA, RIFIUTATA
    approvato_da: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    approvatore: Mapped[Optional["User"]] = relationship(foreign_keys=[approvato_da])

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
    last_read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
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


# ── TASK TEMPLATES ────────────────────────────────────────────
class TaskTemplate(Base):
    """Template riutilizzabile per generare task ricorrenti su una commessa."""
    __tablename__ = "task_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    descrizione: Mapped[Optional[str]] = mapped_column(Text)
    progetto_tipo: Mapped[Optional[str]] = mapped_column(String(20))  # RETAINER | ONE_OFF | None
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items: Mapped[List["TaskTemplateItem"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="TaskTemplateItem.ordine"
    )
    created_by_user: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by])


class TaskTemplateItem(Base):
    """Singolo task all'interno di un template."""
    __tablename__ = "task_template_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("task_templates.id", ondelete="CASCADE"), index=True)
    titolo: Mapped[str] = mapped_column(String(500), nullable=False)
    descrizione: Mapped[Optional[str]] = mapped_column(Text)
    servizio: Mapped[Optional[str]] = mapped_column(String(50))
    stima_minuti: Mapped[Optional[int]] = mapped_column(Integer)
    priorita: Mapped[str] = mapped_column(String(10), default="media")
    giorno_scadenza: Mapped[Optional[int]] = mapped_column(Integer)  # 1-31
    assegnatario_ruolo: Mapped[Optional[str]] = mapped_column(String(30))  # ADMIN | PM | COLLABORATORE
    ordine: Mapped[int] = mapped_column(Integer, default=0)

    template: Mapped["TaskTemplate"] = relationship(back_populates="items")


# ── PROGETTO TEMPLATES ───────────────────────────────────────
class ProgettoTemplate(Base):
    __tablename__ = "progetto_templates"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(String(50)) # es. "Social", "SEO"
    descrizione: Mapped[Optional[str]] = mapped_column(Text)
    icona: Mapped[Optional[str]] = mapped_column(String(50))
    colore: Mapped[Optional[str]] = mapped_column(String(20))
    attivo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tasks: Mapped[List["ProgettoTemplateTask"]] = relationship(back_populates="template", cascade="all, delete-orphan")
    milestones: Mapped[List["ProgettoTemplateMilestone"]] = relationship(back_populates="template", cascade="all, delete-orphan")

class ProgettoTemplateTask(Base):
    __tablename__ = "progetto_template_tasks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("progetto_templates.id", ondelete="CASCADE"), index=True)
    titolo: Mapped[str] = mapped_column(String(200), nullable=False)
    descrizione: Mapped[Optional[str]] = mapped_column(Text)
    ordine: Mapped[int] = mapped_column(Integer, default=0)
    stima_ore: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    categoria: Mapped[Optional[str]] = mapped_column(String(50))

    template: Mapped["ProgettoTemplate"] = relationship(back_populates="tasks")

class ProgettoTemplateMilestone(Base):
    __tablename__ = "progetto_template_milestones"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("progetto_templates.id", ondelete="CASCADE"), index=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    giorni_dalla_creazione: Mapped[int] = mapped_column(Integer, default=0)

    template: Mapped["ProgettoTemplate"] = relationship(back_populates="milestones")


# ── CONTENUTI (Pipeline Approvazione) ────────────────────────
class ContenutoStatus(str, enum.Enum):
    BOZZA = "BOZZA"
    IN_REVISIONE_INTERNA = "IN_REVISIONE_INTERNA"
    MODIFICHE_RICHIESTE_INTERNE = "MODIFICHE_RICHIESTE_INTERNE"
    APPROVATO_INTERNAMENTE = "APPROVATO_INTERNAMENTE"
    INVIATO_AL_CLIENTE = "INVIATO_AL_CLIENTE"
    MODIFICHE_RICHIESTE_CLIENTE = "MODIFICHE_RICHIESTE_CLIENTE"
    APPROVATO_CLIENTE = "APPROVATO_CLIENTE"
    PUBBLICATO = "PUBBLICATO"
    ARCHIVIATO = "ARCHIVIATO"


class ContenutoTipo(str, enum.Enum):
    POST_SOCIAL = "POST_SOCIAL"
    COPY = "COPY"
    DESIGN = "DESIGN"
    VIDEO = "VIDEO"
    EMAIL = "EMAIL"
    ALTRO = "ALTRO"


class Contenuto(Base):
    __tablename__ = "contenuti"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    titolo: Mapped[str] = mapped_column(String(500), nullable=False)
    tipo: Mapped[ContenutoTipo] = mapped_column(SAEnum(ContenutoTipo, name="contenuto_tipo"), default=ContenutoTipo.POST_SOCIAL)
    stato: Mapped[ContenutoStatus] = mapped_column(SAEnum(ContenutoStatus, name="contenuto_status"), default=ContenutoStatus.BOZZA, index=True)
    commessa_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("commesse.id"), nullable=True, index=True)
    progetto_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("progetti.id"), nullable=True, index=True)
    assegnatario_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    data_consegna_prevista: Mapped[Optional[date]] = mapped_column(Date)
    url_preview: Mapped[Optional[str]] = mapped_column(String(1000))
    testo: Mapped[Optional[str]] = mapped_column(Text)
    note_revisione: Mapped[Optional[str]] = mapped_column(Text)
    approvato_da: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approvato_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    pubblicato_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    assegnatario: Mapped[Optional["User"]] = relationship(foreign_keys=[assegnatario_id])
    approvatore: Mapped[Optional["User"]] = relationship(foreign_keys=[approvato_da])
    commessa: Mapped[Optional["Commessa"]] = relationship(foreign_keys=[commessa_id])
    progetto: Mapped[Optional["Progetto"]] = relationship(foreign_keys=[progetto_id])
    eventi: Mapped[List["ContenutoEvento"]] = relationship(
        back_populates="contenuto",
        cascade="all, delete-orphan",
        order_by="ContenutoEvento.created_at",
    )


# ── PESO CONTENUTO (configurabile, driver quota Luca — brief §7.5) ──
class PesoContenuto(Base):
    """Peso per tipo di contenuto (valore enum ContenutoTipo) usato nel driver quota Luca:
    la ripartizione pesa SUM(peso) invece di COUNT(*). Configurabile via /pesi-contenuto."""
    __tablename__ = "pesi_contenuto"

    tipo: Mapped[str] = mapped_column(String(30), primary_key=True)  # valore dell'enum ContenutoTipo
    peso: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("peso > 0", name="ck_pesi_contenuto_peso_pos"),
    )


class ContenutoEvento(Base):
    __tablename__ = "contenuto_eventi"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contenuto_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contenuti.id", ondelete="CASCADE"),
        index=True,
    )
    autore_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    stato_precedente: Mapped[Optional[ContenutoStatus]] = mapped_column(
        SAEnum(ContenutoStatus, name="contenuto_status"),
        nullable=True,
    )
    stato_nuovo: Mapped[ContenutoStatus] = mapped_column(
        SAEnum(ContenutoStatus, name="contenuto_status"),
        nullable=False,
    )
    nota: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    contenuto: Mapped["Contenuto"] = relationship(back_populates="eventi")
    autore: Mapped[Optional["User"]] = relationship()
