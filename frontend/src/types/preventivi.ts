import type { Cliente } from "./index";

export type PreventivoStatus = 'BOZZA' | 'INVIATO' | 'ACCETTATO' | 'RIFIUTATO' | 'SCADUTO';

export type TipoVoce = 'lavoro' | 'socio' | 'esterno' | 'overhead';
export type ModalitaPrezzo = 'markup' | 'margine';

export interface PreventivoRiga {
  id: string;
  preventivo_id: string;
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  totale: number;
  ordine: number;
  // §18.2 natura riga
  tipo?: TipoVoce | null;
  risorsa_id?: string | null;
  ruolo?: string | null;
  ore?: number | null;
  tariffa?: number | null;
  costo?: number | null;
  ricarico_pct?: number | null;
  prezzo_riga?: number | null;
  is_stima?: boolean;
}

/** Payload di GET /preventivi/{id}/calcolo (§18) */
export interface EconomiaPreventivo {
  costo_lavoro: number;
  costo_socio: number;
  costo_esterni: number;
  overhead: number;
  coefficiente_ovh: number;
  costo_totale: number;
  prezzo: number;
  markup_effettivo_pct: number | null;
  margine_effettivo_pct: number | null;
  budget_interno_lavoro: number;
  righe?: { tipo: string; costo: number; is_stima: boolean; prezzo_riga: number }[];
  note_socio?: string;
  note_overhead?: string;
  stato_commerciale?: string | null;
}

export interface Preventivo {
  id: string;
  cliente_id: string;
  numero: string;
  titolo: string;
  descrizione?: string;
  stato: PreventivoStatus;
  data_creazione: string;
  data_scadenza?: string;
  data_accettazione?: string;
  importo_totale: number;
  // §18.1 modalita prezzo
  modalita_prezzo?: ModalitaPrezzo | null;
  markup_su?: string | null;
  prezzo?: number | null;
  margine_pct?: number | null;
  markup_pct?: number | null;
  margine_target?: number | null;
  valido_fino?: string | null;
  note?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  voci: PreventivoRiga[];
  cliente?: Cliente;
}

export interface PreventivoCreate {
  cliente_id: string;
  titolo: string;
  numero: string;
  descrizione?: string;
  data_scadenza?: string;
  note?: string;
  voci_raw: {
    descrizione: string;
    quantita: number;
    prezzo_unitario: number;
    ordine: number;
  }[];
}
