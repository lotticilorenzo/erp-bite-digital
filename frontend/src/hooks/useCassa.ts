import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export function useMovimentiCassa() {
  return useQuery({
    queryKey: ["movimenti-cassa"],
    queryFn: async () => {
      const { data } = await api.get<{ movimenti_cassa: any[] }>("/movimenti-cassa");
      return data.movimenti_cassa;
    },
  });
}

export function useUpdateMovimento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: response } = await api.patch(`/movimenti-cassa/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimenti-cassa"], exact: false });
    },
  });
}

export function useRiconciliaMovimento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, riconciliato }: { id: string; riconciliato: boolean }) => {
      const { data } = await api.post(`/movimenti-cassa/${id}/riconcilia`, { riconciliato });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimenti-cassa"], exact: false });
    },
  });
}
