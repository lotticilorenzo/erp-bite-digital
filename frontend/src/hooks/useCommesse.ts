import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import api from "@/lib/api";
import { toast } from "sonner";
import type { Commessa, CommessaStatus } from "@/types";

type CommessaPayload = Record<string, unknown>;

function errorDetail(error: unknown, fallback: string) {
  return (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ?? fallback;
}

export function useCommesse(
  params?: { mese?: string; stato?: CommessaStatus; cliente_id?: string },
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["commesse", params],
    queryFn: async () => {
      const { data } = await api.get<Commessa[]>("/commesse", { params });
      return data;
    },
    enabled,
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
    mutationFn: async (data: CommessaPayload) => {
      const { data: response } = await api.post<Commessa>("/commesse", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commesse"], exact: false });
    },
    onError: (error) => {
      toast.error(errorDetail(error, "Errore nella creazione della commessa"));
    },
  });
}

export function useUpdateCommessa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CommessaPayload }) => {
      const { data: response } = await api.patch<Commessa>(`/commesse/${id}`, data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["commesse"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["commessa", data.id], exact: false });
    },
    onError: (error) => {
      toast.error(errorDetail(error, "Errore nell'aggiornamento della commessa"));
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
    onError: (error) => {
      toast.error(errorDetail(error, "Errore nell'eliminazione della commessa"));
    },
  });
}

export interface ProfitabilityData {
  commessa_id: string;
  ore_budget: number;
  ore_consumate: number;
  perc_ore_consumate: number | null;
  valore_fatturabile: number;
  costo_manodopera: number;
  costi_diretti: number;
  margine_euro: number;
  margine_percentuale: number | null;
  alert_level: "OK" | "WARNING" | "CRITICAL" | "NO_DATA";
}

export function useProfitability(id: string | undefined) {
  return useQuery({
    queryKey: ["commessa-profitability", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<ProfitabilityData>(`/commesse/${id}/profitability`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 30000,
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
    onError: (error) => {
      toast.error(errorDetail(error, "Errore nel collegamento fattura"));
    },
  });
}
