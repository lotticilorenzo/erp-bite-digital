import type { Cliente } from "./index";

export type PreventivoStatus = 'BOZZA' | 'INVIATO' | 'ACCETTATO' | 'RIFIUTATO' | 'SCADUTO';

export interface PreventivoRiga {
  id: string;
  preventivo_id: string;
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  totale: number;
  ordine: number;
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
