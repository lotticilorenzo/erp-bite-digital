import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Cliente, ClienteAffidabilita, HealthScore } from "@/types";
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
    staleTime: 1000 * 60 * 15, // 15 min — calcolo costoso, non serve refresh frequente
    gcTime: 1000 * 60 * 30,
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
      queryClient.invalidateQueries({ queryKey: ["clienti"], exact: false });
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
      queryClient.invalidateQueries({ queryKey: ["clienti"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["clienti", data.id], exact: false });
      toast.success("Cliente aggiornato con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante l'aggiornamento del cliente");
    },
  });
}

export function useUpdateClienteAffidabilita() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, affidabilita }: { id: string; affidabilita: ClienteAffidabilita }) => {
      const { data: response } = await api.patch<Cliente>(`/clienti/${id}`, { affidabilita });
      return response;
    },
    onMutate: async ({ id, affidabilita }) => {
      await queryClient.cancelQueries({ queryKey: ["clienti"], exact: false });

      const previousQueries = queryClient.getQueriesData<Cliente[] | Cliente | null>({
        queryKey: ["clienti"],
      });

      previousQueries.forEach(([queryKey, data]) => {
        if (Array.isArray(data)) {
          queryClient.setQueryData<Cliente[]>(
            queryKey,
            data.map((cliente) =>
              cliente.id === id ? { ...cliente, affidabilita } : cliente
            )
          );
          return;
        }

        if (data && !Array.isArray(data) && data.id === id) {
          queryClient.setQueryData<Cliente>(queryKey, { ...data, affidabilita });
        }
      });

      return { previousQueries };
    },
    onError: (_error, _variables, context) => {
      context?.previousQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error("Errore durante l'aggiornamento dell'affidabilita");
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clienti"], exact: false });
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: ["clienti", variables.id], exact: false });
      }
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
      queryClient.invalidateQueries({ queryKey: ["clienti"], exact: false });
      toast.success("Cliente eliminato con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante l'eliminazione del cliente");
    },
  });
}
