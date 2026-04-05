import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Assenza {
  id: string;
  user_id: string;
  data_inizio: string;
  data_fine: string;
  tipo: 'FERIE' | 'MALATTIA' | 'PERMESSO' | 'ALTRO';
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
    mutationFn: async (newAssenza: Omit<Assenza, 'id' | 'created_at'>) => {
      const { data } = await api.post("/assenze/", newAssenza);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assenze"] });
    },
  });

  const deleteAssenza = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/assenze/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assenze"] });
    },
  });

  return {
    assenze,
    isLoading,
    createAssenza: createAssenza.mutateAsync,
    deleteAssenza: deleteAssenza.mutateAsync,
  };
}
