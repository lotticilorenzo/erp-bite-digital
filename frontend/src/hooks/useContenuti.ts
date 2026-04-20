import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import api from "@/lib/api";
import { toast } from "sonner";

export type ContenutoStato =
  | "BOZZA"
  | "IN_REVISIONE_INTERNA"
  | "MODIFICHE_RICHIESTE_INTERNE"
  | "APPROVATO_INTERNAMENTE"
  | "INVIATO_AL_CLIENTE"
  | "MODIFICHE_RICHIESTE_CLIENTE"
  | "APPROVATO_CLIENTE"
  | "PUBBLICATO"
  | "ARCHIVIATO";

export type ContenutoTipo = "POST_SOCIAL" | "COPY" | "DESIGN" | "VIDEO" | "EMAIL" | "ALTRO";

export interface Contenuto {
  id: string;
  titolo: string;
  tipo: ContenutoTipo;
  stato: ContenutoStato;
  commessa_id: string | null;
  progetto_id: string | null;
  assegnatario_id: string | null;
  assegnatario_nome: string | null;
  cliente_nome: string | null;
  data_consegna_prevista: string | null;
  url_preview: string | null;
  testo: string | null;
  note_revisione: string | null;
  approvato_da: string | null;
  approvato_at: string | null;
  pubblicato_at: string | null;
  created_at: string;
  updated_at: string;
  transizioni_possibili: ContenutoStato[];
  eventi: Array<{
    id: string;
    stato_precedente: ContenutoStato | null;
    stato_nuovo: ContenutoStato;
    nota: string | null;
    autore_id: string | null;
    autore_nome: string | null;
    created_at: string;
  }>;
}

function errorDetail(error: unknown, fallback: string) {
  return (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ?? fallback;
}

export function useContenuti(params?: {
  commessa_id?: string;
  stato?: string;
  tipo?: string;
  assegnatario_id?: string;
}) {
  return useQuery({
    queryKey: ["contenuti", params],
    queryFn: async () => {
      const { data } = await api.get<Contenuto[]>("/contenuti", { params });
      return data;
    },
  });
}

export function useCreateContenuto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Contenuto>) => {
      const { data: res } = await api.post("/contenuti", data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contenuti"] });
      toast.success("Contenuto creato");
    },
    onError: (error) => toast.error(errorDetail(error, "Errore")),
  });
}

export function useUpdateContenuto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Contenuto> }) => {
      const { data: res } = await api.put(`/contenuti/${id}`, data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contenuti"] });
      toast.success("Contenuto aggiornato");
    },
    onError: (error) => toast.error(errorDetail(error, "Errore")),
  });
}

export function useCambiaStatoContenuto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stato, note_revisione }: { id: string; stato: ContenutoStato; note_revisione?: string }) => {
      const { data } = await api.put(`/contenuti/${id}/stato`, { stato, note_revisione });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contenuti"] });
      qc.invalidateQueries({ queryKey: ["notifications"], exact: false });
      toast.success("Stato aggiornato");
    },
    onError: (error) => toast.error(errorDetail(error, "Transizione non consentita")),
  });
}

export function useDeleteContenuto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/contenuti/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contenuti"] });
      toast.success("Contenuto eliminato");
    },
    onError: (error) => toast.error(errorDetail(error, "Errore")),
  });
}
