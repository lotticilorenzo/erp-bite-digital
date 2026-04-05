export interface ChatReaction {
  id: string;
  messaggio_id: string;
  user_id: string;
  user_nome?: string;
  emoji: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  progetto_id: string;
  autore_id: string;
  autore_nome?: string;
  contenuto: string;
  tipo: 'testo' | 'sistema';
  risposta_a?: string;
  modificato: boolean;
  created_at: string;
  updated_at: string;
  reazioni: ChatReaction[];
}
