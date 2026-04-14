export type UserRole = "ADMIN" | "PM" | "DIPENDENTE" | "FREELANCER";
export type ProjectType = "RETAINER" | "ONE_OFF";
export type ProjectStatus = "ATTIVO" | "CHIUSO";
export type CommessaStatus = "APERTA" | "PRONTA_CHIUSURA" | "CHIUSA" | "FATTURATA" | "INCASSATA";
export type ClienteAffidabilita = "ALTA" | "MEDIA" | "BASSA";
export type TaskStatus = "DA_FARE" | "BOZZE_IDEE" | "DA_CORREGGERE" | "IN_REVIEW" | "PRONTO" | "PROGRAMMATO" | "PUBBLICATO";
export type TimesheetStatus = "PENDING" | "APPROVATO" | "RIFIUTATO";
export type CostoTipo = "FISSO" | "VARIABILE";
export type MovimentoStatus = "NON_RICONCILIATO" | "RICONCILIATO" | "DA_VERIFICARE";

export interface User {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: UserRole;
  costo_orario: number | null;
  ore_settimanali?: number;
  bio: string | null;
  preferences: Record<string, any> | null;
  avatar_url?: string | null;
  attivo: boolean;
  telefono?: string;
  piva?: string;
  iban?: string;
  indirizzo?: string;
  codice_fiscale?: string;
  data_inizio: string | null;
  created_at: string;
}

export interface Cliente {
  id: string;
  codice_cliente?: string;
  numero_progressivo?: number;
  ragione_sociale: string;
  tipologia?: string;
  referente?: string;
  piva?: string;
  codice_fiscale?: string;
  sdi?: string;
  pec?: string;
  email?: string;
  telefono?: string;
  cellulare?: string;
  sito_web?: string;
  settore?: string;
  categoria?: string;
  indirizzo?: string;
  comune?: string;
  cap?: string;
  provincia?: string;
  paese?: string;
  note_indirizzo?: string;
  condizioni_pagamento?: string;
  note?: string;
  fic_cliente_id?: string;
  attivo: boolean;
  logo_url?: string | null;
  drive_files?: any[];
  affidabilita?: ClienteAffidabilita | null;
  created_at?: string;
  updated_at?: string;
  health_score?: number; // Computed score
}

export interface ProgettoTeam {
  id: string;
  user_id: string;
  ruolo_progetto?: string;
  user?: User;
}

export interface Progetto {
  id: string;
  cliente_id: string;
  nome: string;
  tipo: ProjectType;
  stato: ProjectStatus;
  importo_fisso: number;
  importo_variabile: number;
  delivery_attesa: number;
  clickup_list_id?: string;
  note?: string;
  created_at: string;
  cliente?: Cliente;
  team?: ProgettoTeam[];
}

export interface ProgettoRef {
  id: string;
  nome: string;
  tipo?: ProjectType;
}

export interface CommessaRiga {
  id: string;
  commessa_id: string;
  progetto_id: string;
  importo_fisso: number;
  importo_variabile: number;
  delivery_attesa: number;
  delivery_consuntiva: number;
  created_at: string;
  progetto?: ProgettoRef;
}

export interface Commessa {
  id: string;
  cliente_id: string;
  mese_competenza: string; // ISO date YYYY-MM-DD
  stato: CommessaStatus;
  righe_progetto: CommessaRiga[];
  costo_manodopera: number;
  costi_diretti: number;
  data_inizio?: string;
  data_fine?: string;
  data_chiusura?: string;
  ore_contratto: number;
  ore_reali: number;
  note?: string;
  created_at: string;
  // Computed fields
  aggiustamenti?: any[];
  valore_fatturabile?: number;
  costi_indiretti_allocati?: number;
  coefficiente_allocazione?: number;
  margine_euro?: number;
  margine_percentuale?: number;
  fattura_id?: string;
  fattura_numero?: string;
  fattura_data?: string;
  fattura_importo?: number;
  fattura_stato?: string;
  cliente?: Cliente;
}

export interface Timesheet {
  id: string;
  user_id: string;
  task_id?: string;
  commessa_id?: string;
  data_attivita: string;
  mese_competenza: string;
  servizio?: string;
  durata_minuti: number;
  costo_orario_snapshot?: number;
  costo_lavoro?: number;
  stato: TimesheetStatus;
  approvato_da?: string;
  approvato_at?: string;
  note?: string;
  created_at: string;
  user?: User;
  commessa?: Commessa;
  // ClickUp integration fields
  clickup_task_id?: string;
  clickup_parent_task_id?: string;
  task_display_name?: string;
}

export interface FatturaAttiva {
  id: string;
  fic_id: string;
  cliente_id?: string;
  numero?: string;
  data_emissione?: string;
  data_scadenza?: string;
  importo_totale: number;
  importo_netto?: number;
  importo_iva?: number;
  importo_pagato: number;
  importo_residuo: number;
  stato_pagamento: string;
  data_incasso?: string;
  valuta?: string;
  created_at: string;
}

export interface FatturaPassiva {
  id: string;
  fic_id: string;
  fornitore_id?: string;
  numero?: string;
  data_emissione?: string;
  data_scadenza?: string;
  importo_totale: number;
  importo_netto?: number;
  importo_iva?: number;
  importo_pagato: number;
  importo_residuo: number;
  stato_pagamento: string;
  valuta?: string;
  created_at: string;
  fornitore_nome?: string;
}

export interface CategoriaFornitore {
  id: string;
  nome: string;
  colore?: string;
  created_at: string;
}

export interface Fornitore {
  id: string;
  fic_id?: string;
  ragione_sociale: string;
  piva?: string;
  codice_fiscale?: string;
  pec?: string;
  indirizzo?: string;
  email?: string;
  telefono?: string;
  attivo: boolean;
  categoria_id?: string;
  categoria?: string;
  competenze?: string[];
  tariffa?: number;
  tariffa_tipo?: string;
  note?: string;
  created_at: string;
  updated_at: string;
  categoria_rel?: CategoriaFornitore;
  // Stats fields (from list_fornitori_full)
  num_fatture?: number;
  spesa_totale?: number;
  ultima_fattura?: string | null;
}

export interface MovimentoFinanziario {
  id: string;
  data_movimento: string;
  descrizione?: string;
  importo: number;
  fattura_id?: string;
  stato: MovimentoStatus;
  fonte?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type NotificationType = 'URGENTE' | 'AVVISO' | 'FATTURA' | 'APPROVAZIONE' | 'INFO';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  link: string;
  isRead: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface HealthScore {
  score: number;
  factors: {
    margine: number;
    pagamenti: number;
    revisioni: number;
    longevita: number;
  };
  details: {
    avg_margin_pct: number;
    invoices_paid: string;
    avg_scope_creep: string;
    days_with_us: number;
  };
}
