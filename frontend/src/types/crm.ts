
export interface CRMStage {
  id: string;
  nome: string;
  colore: string;
  ordine: number;
  probabilita: number;
}

export interface CRMActivity {
  id: string;
  lead_id: string;
  tipo: 'Nota' | 'Chiamata' | 'Email' | 'Meeting' | string;
  descrizione?: string;
  data_attivita: string;
  autore_id: string;
  autore_nome?: string;
  created_at: string;
}

export interface CRMLead {
  id: string;
  nome_azienda: string;
  nome_contatto?: string;
  email?: string;
  telefono?: string;
  stadio_id: string;
  valore_stimato: number;
  probabilita_chiusura: number;
  data_prossimo_followup?: string;
  assegnato_a_id?: string;
  assegnato_a_nome?: string;
  note?: string;
  fonte?: string;
  created_at: string;
  updated_at: string;
  stadio?: CRMStage;
  attivita?: CRMActivity[];
}

export interface CRMStats {
  valore_totale_pipeline: number;
  numero_lead_attivi: number;
  tasso_conversione: number;
  previsione_ricavi: number;
}
