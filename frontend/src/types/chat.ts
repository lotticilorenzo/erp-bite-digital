export interface ChatReaction {
  id: string;
  messaggio_id: string;
  user_id: string;
  user_nome?: string;
  emoji: string;
  created_at: string;
}

export type ChatMessageType = 'testo' | 'sistema' | 'allegato' | 'immagine' | 'audio';

export interface ChatMessage {
  id: string;
  canale_id: string;
  progetto_id?: string | null;
  autore_id: string;
  autore_nome?: string;
  contenuto: string;
  tipo: ChatMessageType;
  risposta_a?: string;
  modificato: boolean;
  created_at: string;
  updated_at: string;
  reazioni: ChatReaction[];
}

export interface ChatUserBasic {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  avatar_url?: string | null;
}

export interface ChatMember {
  id: string;
  canale_id: string;
  user_id: string;
  ruolo: string;
  user?: ChatUserBasic;
}

export interface ChatChannel {
  id: string;
  nome: string;
  tipo: string;
  progetto_id?: string | null;
  logo_url?: string | null;
  descrizione?: string | null;
  created_at?: string;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
  membri: ChatMember[];
}

export interface ChatUploadResponse {
  url: string;
  download_url?: string;
  filename: string;
  size: number;
  content_type: string;
}

export interface CreateGroupChannelInput {
  nome: string;
  logo_url?: string | null;
  member_ids: string[];
}
