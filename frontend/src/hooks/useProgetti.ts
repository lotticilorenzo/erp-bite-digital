import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import type { Progetto } from "@/types";

export type ProgettoPayload = Partial<Omit<Progetto, "team">> & {
  team?: Array<{
    id?: string;
    user_id: string;
    ruolo_progetto?: string;
    ore_previste?: number;
    note?: string;
  }>;
};

export function useProgetti(clienteId?: string, stato?: string) {
  return useQuery({
    queryKey: ["progetti", { clienteId, stato }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clienteId) params.append("cliente_id", clienteId);
      if (stato) params.append("stato", stato);
      
      const { data } = await api.get<Progetto[]>(`/progetti?${params.toString()}`);
      return data;
    },
  });
}

export function useProgetto(id?: string) {
  return useQuery({
    queryKey: ["progetti", id],
    queryFn: async () => {
      const { data } = await api.get<Progetto>(`/progetti/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

const formatError = (err: any, defaultMsg: string) => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(", ");
  }
  return defaultMsg;
};

export function useCreateProgetto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProgettoPayload) => {
      const { data: response } = await api.post<Progetto>("/progetti", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progetti"], exact: false });
    },
    onError: (err: any) => {
      toast.error(formatError(err, "Errore nella creazione del progetto"));
    },
  });
}

export function useUpdateProgetto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProgettoPayload }) => {
      const { data: response } = await api.patch<Progetto>(`/progetti/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["progetti"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["progetti", variables.id], exact: false });
    },
    onError: (err: any) => {
      toast.error(formatError(err, "Errore nell'aggiornamento del progetto"));
    },
  });
}

export function useDeleteProgetto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/progetti/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progetti"], exact: false });
    },
    onError: (err: any) => {
      toast.error(formatError(err, "Errore nell'eliminazione del progetto"));
    },
  });
}
