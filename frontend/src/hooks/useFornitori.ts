import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Fornitore, CategoriaFornitore } from "@/types";
import { toast } from "sonner";

export function useFornitori(attivo?: boolean) {
  return useQuery({
    queryKey: ["fornitori", { attivo }],
    queryFn: async () => {
      // Use the 'full' endpoint to get stats and related data if possible
      const { data } = await api.get<Fornitore[]>("/fornitori-full", { params: { attivo } });
      return data;
    },
  });
}

export function useFornitore(id: string | undefined) {
  return useQuery({
    queryKey: ["fornitori", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<Fornitore>(`/fornitori/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCategorieFornitori() {
  return useQuery({
    queryKey: ["categorie-fornitori"],
    queryFn: async () => {
      const { data } = await api.get<CategoriaFornitore[]>("/categorie-fornitori");
      return data;
    },
  });
}

export function useCreateFornitore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Fornitore>) => {
      const { data: response } = await api.post<Fornitore>("/fornitori", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornitori"] });
      toast.success("Fornitore creato con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante la creazione del fornitore");
    },
  });
}

export function useUpdateFornitore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Fornitore> }) => {
      const { data: response } = await api.patch<Fornitore>(`/fornitori/${id}`, data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["fornitori"] });
      queryClient.invalidateQueries({ queryKey: ["fornitori", data.id] });
      toast.success("Fornitore aggiornato con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante l'aggiornamento del fornitore");
    },
  });
}

export function useDeleteFornitore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/fornitori/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornitori"] });
      toast.success("Fornitore eliminato con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore durante l'eliminazione del fornitore");
    },
  });
}
