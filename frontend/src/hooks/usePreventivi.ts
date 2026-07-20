import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Preventivo, EconomiaPreventivo } from "@/types/preventivi";

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

/** Economia del preventivo (§18): costi per natura, prezzo, markup+margine, budget interno. */
export const useCalcoloPreventivo = (id?: string) => {
  return useQuery<EconomiaPreventivo>({
    queryKey: ["preventivi", id, "calcolo"],
    queryFn: async () => {
      const { data } = await api.get(`/preventivi/${id}/calcolo`);
      return data;
    },
    enabled: !!id,
  });
};

/** Catalogo servizi (§18.6) per precompilare le righe. */
export const useServiziCatalogo = () => {
  return useQuery<any[]>({
    queryKey: ["servizi-catalogo"],
    queryFn: async () => {
      const { data } = await api.get("/servizi-catalogo");
      return data.servizi ?? [];
    },
  });
};

/** Simulatore frontiera ore (§18.3) — solo risorse a ore, i soci sono capacita'. */
export const useSimulaBudget = () => {
  return useMutation({
    mutationFn: async (payload: { budget_interno: number; risorse_fisse: { ore: number; tariffa: number }[]; tariffa_variabile: number }) => {
      const { data } = await api.post("/preventivi/simula-budget", payload);
      return data;
    },
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
