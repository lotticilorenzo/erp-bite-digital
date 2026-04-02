import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { FatturaAttiva, FatturaPassiva } from "@/types";

export function useFattureAttive() {
  return useQuery({
    queryKey: ["fatture-attive"],
    queryFn: async () => {
      const { data } = await api.get<FatturaAttiva[]>("/fatture-attive");
      return data;
    },
  });
}

export function useFatturePassive() {
  return useQuery({
    queryKey: ["fatture-passive"],
    queryFn: async () => {
      const { data } = await api.get<any[]>("/fatture-passive");
      return data;
    },
  });
}

export function useIncassaFattura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data_incasso }: { id: string; data_incasso: string }) => {
      const { data } = await api.patch(`/fatture-attive/${id}/incassa`, { data_incasso });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fatture-attive"] });
      queryClient.invalidateQueries({ queryKey: ["commesse"] });
    },
  });
}

export function useUpdateFatturaPassiva() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: response } = await api.patch(`/fatture-passive/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fatture-passive"] });
    },
  });
}
