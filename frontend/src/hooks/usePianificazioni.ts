import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import type { Pianificazione, PianificazioneStatus } from "@/types";

export function usePianificazioni(params?: { cliente_id?: string; stato?: PianificazioneStatus }) {
  return useQuery({
    queryKey: ["pianificazioni", params],
    queryFn: async () => {
      const { data } = await api.get<Pianificazione[]>("/pianificazioni", { params });
      return data;
    },
  });
}

export function usePianificazione(id: string | undefined) {
  return useQuery({
    queryKey: ["pianificazione", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<Pianificazione>(`/pianificazioni/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreatePianificazione() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const { data: response } = await api.post<Pianificazione>("/pianificazioni", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pianificazioni"] });
      toast.success("Pianificazione creata con successo");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nella creazione della pianificazione");
    },
  });
}

export function useUpdatePianificazione() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: response } = await api.patch<Pianificazione>(`/pianificazioni/${id}`, data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pianificazioni"] });
      queryClient.invalidateQueries({ queryKey: ["pianificazione", data.id] });
      toast.success("Pianificazione aggiornata");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nell'aggiornamento");
    },
  });
}

export function useDeletePianificazione() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pianificazioni/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pianificazioni"] });
      toast.success("Pianificazione eliminata");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nell'eliminazione");
    },
  });
}

export function useConvertPianificazione() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, mese_competenza }: { id: string; mese_competenza: string }) => {
      const { data } = await api.post(`/pianificazioni/${id}/converti-commessa`, { mese_competenza });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pianificazioni"] });
      queryClient.invalidateQueries({ queryKey: ["commesse"] });
      toast.success("Pianificazione convertita in commessa con successo!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore durante la conversione");
    },
  });
}
