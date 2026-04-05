import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BudgetCategory, BudgetMensile, BudgetConsuntivo } from "@/types/budget";
import { format } from "date-fns";

export function useBudget(mese?: Date) {
  const queryClient = useQueryClient();
  const meseStr = mese ? format(mese, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

  const categories = useQuery({
    queryKey: ["budget-categories"],
    queryFn: async () => {
      const res = await api.get<BudgetCategory[]>("/budget/categorie");
      return res.data;
    },
  });

  const consuntivo = useQuery({
    queryKey: ["budget-consuntivo", meseStr],
    queryFn: async () => {
      const res = await api.get<BudgetConsuntivo[]>(`/budget/consuntivo?mese=${meseStr}`);
      return res.data;
    },
    enabled: !!mese,
  });

  const upsertBudget = useMutation({
    mutationFn: async (data: { categoria_id: string; mese_competenza: string; importo_budget: number; note?: string }) => {
      const res = await api.post<BudgetMensile>("/budget", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-consuntivo"] });
    },
  });

  const copyBudget = useMutation({
    mutationFn: async (meseCorrente: string) => {
      const res = await api.post(`/budget/copia?mese_corrente=${meseCorrente}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-consuntivo"] });
    },
  });

  const createCategory = useMutation({
    mutationFn: async (data: { nome: string; colore: string }) => {
      const res = await api.post<BudgetCategory>("/budget/categorie", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-categories"] });
    },
  });

  return {
    categories,
    consuntivo,
    upsertBudget,
    copyBudget,
    createCategory,
  };
}
