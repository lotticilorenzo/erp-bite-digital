import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import type { Commessa, CommessaStatus } from "@/types";

export function useCommesse(params?: { mese?: string; stato?: CommessaStatus; cliente_id?: string }) {
  return useQuery({
    queryKey: ["commesse", params],
    queryFn: async () => {
      const { data } = await api.get<Commessa[]>("/commesse", { params });
      return data;
    },
  });
}

export function useCommessa(id: string | undefined) {
  return useQuery({
    queryKey: ["commessa", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<Commessa>(`/commesse/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateCommessa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const { data: response } = await api.post<Commessa>("/commesse", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commesse"], exact: false });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nella creazione della commessa");
    },
  });
}

export function useUpdateCommessa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: response } = await api.patch<Commessa>(`/commesse/${id}`, data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["commesse"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["commessa", data.id], exact: false });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nell'aggiornamento della commessa");
    },
  });
}

export function useDeleteCommessa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/commesse/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commesse"], exact: false });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nell'eliminazione della commessa");
    },
  });
}

export function useCollegaFattura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commessaId, fatturaId }: { commessaId: string; fatturaId: string }) => {
      const { data } = await api.patch<Commessa>(`/commesse/${commessaId}`, { fattura_id: fatturaId });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["commesse"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["commessa", data.id], exact: false });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nel collegamento fattura");
    },
  });
}
