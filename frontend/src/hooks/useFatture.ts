import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { FatturaAttiva } from "@/types";

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
      queryClient.invalidateQueries({ queryKey: ["fatture-attive"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["commesse"], exact: false });
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
      queryClient.invalidateQueries({ queryKey: ["fatture-passive"], exact: false });
    },
  });
}

export function useCreateFattura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, data }: { type: "attive" | "passive"; data: any }) => {
      const endpoint = type === "attive" ? "/fatture-attive" : "/fatture-passive";
      const { data: response } = await api.post(endpoint, data);
      return response;
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ queryKey: [type === "attive" ? "fatture-attive" : "fatture-passive"], exact: false });
    },
  });
}

export function useUpdateFattura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, type, data }: { id: string; type: "attive" | "passive"; data: any }) => {
      const endpoint = type === "attive" ? `/fatture-attive/${id}` : `/fatture-passive/${id}`;
      const { data: response } = await api.patch(endpoint, data);
      return response;
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ queryKey: [type === "attive" ? "fatture-attive" : "fatture-passive"], exact: false });
    },
  });
}

export function useDeleteFattura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, type }: { id: string; type: "attive" | "passive" }) => {
      const endpoint = type === "attive" ? `/fatture-attive/${id}` : `/fatture-passive/${id}`;
      await api.delete(endpoint);
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ queryKey: [type === "attive" ? "fatture-attive" : "fatture-passive"], exact: false });
    },
  });
}
