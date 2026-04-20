import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
  BudgetCategory,
  BudgetMensile,
  BudgetConsuntivo,
  BudgetTrendResponse,
  BudgetVariance,
} from "@/types/budget";
import { format } from "date-fns";

function toMonthQueryValue(mese?: Date | string) {
  if (!mese) return format(new Date(), "yyyy-MM");
  return typeof mese === "string" ? mese : format(mese, "yyyy-MM");
}

export function useBudgetVariance(mese?: Date | string) {
  const meseStr = toMonthQueryValue(mese);

  return useQuery({
    queryKey: ["budget-variance", meseStr],
    queryFn: async () => {
      const res = await api.get<BudgetVariance[]>("/budget/variance", {
        params: { mese: meseStr },
      });
      return res.data;
    },
    enabled: !!meseStr,
  });
}

export function useBudgetTrend(mesi = 6, meseFine?: Date | string) {
  const meseFineStr = meseFine ? toMonthQueryValue(meseFine) : undefined;

  return useQuery({
    queryKey: ["budget-trend", mesi, meseFineStr],
    queryFn: async () => {
      const res = await api.get<BudgetTrendResponse>("/budget/trend", {
        params: {
          mesi,
          mese_fine: meseFineStr,
        },
      });
      return res.data;
    },
  });
}

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
      queryClient.invalidateQueries({ queryKey: ["budget-consuntivo"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budget-variance"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budget-trend"], exact: false });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nel salvataggio del budget");
    },
  });

  const copyBudget = useMutation({
    mutationFn: async (meseCorrente: string) => {
      const res = await api.post(`/budget/copia?mese_corrente=${meseCorrente}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-consuntivo"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budget-variance"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budget-trend"], exact: false });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nella copia del budget");
    },
  });

  const createCategory = useMutation({
    mutationFn: async (data: { nome: string; colore: string }) => {
      const res = await api.post<BudgetCategory>("/budget/categorie", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-categories"], exact: false });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nella creazione della categoria");
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
