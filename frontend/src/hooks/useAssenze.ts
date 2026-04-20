import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export interface Assenza {
  id: string;
  user_id: string;
  data_inizio: string;
  data_fine: string;
  tipo: 'FERIE' | 'MALATTIA' | 'PERMESSO' | 'ALTRO';
  stato: 'PENDING' | 'APPROVATA' | 'RIFIUTATA';
  approvato_da?: string;
  note?: string;
  created_at: string;
}

export function useAssenze(params?: { user_id?: string; start_date?: string; end_date?: string }) {
  const queryClient = useQueryClient();

  const { data: assenze = [], isLoading } = useQuery<Assenza[]>({
    queryKey: ["assenze", params],
    queryFn: async () => {
      const { data } = await api.get("/assenze/", { params });
      return data;
    },
  });

  const createAssenza = useMutation({
    mutationFn: async (newAssenza: Omit<Assenza, 'id' | 'created_at' | 'stato' | 'approvato_da'>) => {
      const { data } = await api.post("/assenze/", newAssenza);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assenze"], exact: false });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nel salvataggio dell'assenza");
    },
  });

  const deleteAssenza = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/assenze/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assenze"], exact: false });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nell'eliminazione dell'assenza");
    },
  });

  return {
    assenze,
    isLoading,
    createAssenza: createAssenza.mutateAsync,
    deleteAssenza: deleteAssenza.mutateAsync,
  };
}

export function useMyAssenze() {
  return useQuery<Assenza[]>({
    queryKey: ["assenze-me"],
    queryFn: async () => {
      const { data } = await api.get("/assenze/me");
      return data;
    },
  });
}

export function useTeamAssenze(params?: { start_date?: string; end_date?: string; stato?: string }) {
  return useQuery<Assenza[]>({
    queryKey: ["assenze-team", params],
    queryFn: async () => {
      const { data } = await api.get("/assenze/team", { params });
      return data;
    },
  });
}

export function useTeamAvailability(start_date: string, end_date: string) {
  return useQuery<{ availability: Record<string, { user_id: string; tipo: string }[]> }>({
    queryKey: ["assenze-availability", start_date, end_date],
    queryFn: async () => {
      const { data } = await api.get("/assenze/availability", { params: { start_date, end_date } });
      return data;
    },
    enabled: !!start_date && !!end_date,
  });
}

export function useApprovaAssenza() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/assenze/${id}/approva`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assenze"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["assenze-team"], exact: false });
      toast.success("Assenza approvata");
    },
    onError: () => toast.error("Errore durante l'approvazione"),
  });
}

export function useRifiutaAssenza() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/assenze/${id}/rifiuta`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assenze"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["assenze-team"], exact: false });
      toast.success("Assenza rifiutata");
    },
    onError: () => toast.error("Errore durante il rifiuto"),
  });
}
