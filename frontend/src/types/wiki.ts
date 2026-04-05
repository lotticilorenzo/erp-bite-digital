export interface WikiCategory {
  id: string;
  nome: string;
  icona?: string;
  ordine: number;
  created_at: string;
  articoli?: WikiArticle[];
}

export interface WikiArticle {
  id: string;
  categoria_id: string;
  titolo: string;
  contenuto?: string;
  autore_id: string;
  autore_nome?: string;
  ultimo_aggiornamento: string;
  pubblicato: boolean;
  visualizzazioni: number;
  created_at: string;
  categoria?: WikiCategory;
}
