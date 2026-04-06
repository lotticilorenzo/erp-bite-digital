import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Preventivo } from "@/types/preventivi";

export const usePreventivi = (filters?: { cliente_id?: string; stato?: string }) => {
  return useQuery<Preventivo[]>({
    queryKey: ["preventivi", filters],
    queryFn: async () => {
      const { data } = await api.get("/preventivi", { params: filters });
      return data;
    },
  });
};

export const usePreventivo = (id: string) => {
  return useQuery<Preventivo>({
    queryKey: ["preventivi", id],
    queryFn: async () => {
      const { data } = await api.get(`/preventivi/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const usePreventivoMutations = () => {
  const queryClient = useQueryClient();

  const createPreventivo = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post("/preventivi", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preventivi"], exact: false });
    },
  });

  const updatePreventivo = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { data } = await api.patch(`/preventivi/${id}`, payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["preventivi"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["preventivi", data.id], exact: false });
    },
  });

  const deletePreventivo = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/preventivi/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preventivi"], exact: false });
    },
  });

  const convertToCommessa = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/preventivi/${id}/converti-commessa`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preventivi"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["commesse"], exact: false });
    },
  });

  return {
    createPreventivo,
    updatePreventivo,
    deletePreventivo,
    convertToCommessa,
  };
};
