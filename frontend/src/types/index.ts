export type UserRole = "ADMIN" | "PM" | "DIPENDENTE" | "FREELANCER";
export type ProjectType = "RETAINER" | "ONE_OFF";
export type ProjectStatus = "ATTIVO" | "CHIUSO";
export type CommessaStatus = "APERTA" | "PRONTA_CHIUSURA" | "CHIUSA" | "FATTURATA" | "INCASSATA";
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
  attivo: boolean;
  data_inizio: string | null;
  created_at: string;
}

export interface Cliente {
  id: string;
  codice_cliente?: string;
  numero_progressivo?: number;
  ragione_sociale: string;
  piva?: string;
  codice_fiscale?: string;
  sdi?: string;
  pec?: string;
  email?: string;
  telefono?: string;
  referente?: string;
  indirizzo?: string;
  comune?: string;
  cap?: string;
  provincia?: string;
  paese?: string;
  tipologia?: string;
  note?: string;
  note_indirizzo?: string;
  condizioni_pagamento?: string;
  fic_cliente_id?: string;
  attivo: boolean;
  drive_files?: any[];
  created_at?: string;
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
  valuta?: string;
  created_at: string;
}

export interface Fornitore {
  id: string;
  fic_id: string;
  ragione_sociale: string;
  piva?: string;
  email?: string;
  telefono?: string;
  attivo: boolean;
  categoria?: string;
  note?: string;
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
