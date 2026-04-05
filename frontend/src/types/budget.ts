export interface BudgetCategory {
  id: string;
  nome: string;
  colore: string;
  created_at: string;
}

export interface BudgetMensile {
  id: string;
  categoria_id: string;
  mese_competenza: string;
  importo_budget: number;
  note?: string;
  categoria?: BudgetCategory;
}

export interface BudgetConsuntivo {
  categoria_id: string;
  categoria_nome: string;
  categoria_colore: string;
  importo_budget: number;
  importo_speso: number;
  rimanente: number;
  percentuale: number;
  note?: string;
}
