import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Cliente, HealthScore } from "@/types";
import { toast } from "sonner";

// ... existing hooks

export function useClientHealthScore(id: string | undefined) {
  return useQuery({
    queryKey: ["clienti", id, "health"],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<HealthScore>(`/clienti/${id}/health-score`);
      return data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minuti
  });
}

export function useClienti(attivo?: boolean) {
  return useQuery({
    queryKey: ["clienti", { attivo }],
    queryFn: async () => {
      const { data } = await api.get<Cliente[]>("/clienti", { params: { attivo } });
      return data;
    },
  });
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: ["clienti", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<Cliente>(`/clienti/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Cliente>) => {
      const { data: response } = await api.post<Cliente>("/clienti", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clienti"] });
      toast.success("Cliente creato con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante la creazione del cliente");
    },
  });
}

export function useUpdateCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Cliente> }) => {
      const { data: response } = await api.patch<Cliente>(`/clienti/${id}`, data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clienti"] });
      queryClient.invalidateQueries({ queryKey: ["clienti", data.id] });
      toast.success("Cliente aggiornato con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante l'aggiornamento del cliente");
    },
  });
}

export function useDeleteCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clienti/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clienti"] });
      toast.success("Cliente eliminato con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante l'eliminazione del cliente");
    },
  });
}
