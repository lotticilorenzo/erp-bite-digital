export interface DocumentNode {
  id: string;
  nome: string;
  tipo: 'FOLDER' | 'FILE';
  icona?: string | null;
  colore?: string | null;
  contenuto?: string | null;
  parent_id?: string | null;
  ordine: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  children: DocumentNode[];
}

export interface DocumentNodeCreate {
  nome: string;
  tipo: 'FOLDER' | 'FILE';
  parent_id?: string | null;
  icona?: string;
  colore?: string;
}

export interface DocumentNodeUpdate {
  nome?: string;
  contenuto?: string;
  parent_id?: string | null;
  ordine?: number;
  icona?: string | null;
  colore?: string | null;
}
