import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Progetto } from "@/types";

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

export function useCreateProgetto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Progetto>) => {
      const { data: response } = await api.post<Progetto>("/progetti", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progetti"], exact: false });
    },
  });
}

export function useUpdateProgetto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Progetto> }) => {
      const { data: response } = await api.patch<Progetto>(`/progetti/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["progetti"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["progetti", variables.id], exact: false });
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
  });
}
