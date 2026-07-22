import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";

export type BudgetTipo = "budget" | "forecast";
export type BudgetStato = "bozza" | "approvato" | "archiviato";
export type BudgetVoceTipo = "ricavo" | "costo_diretto" | "costo_struttura" | "altro";

export interface BudgetVersione {
  id: string;
  anno: number;
  tipo: BudgetTipo;
  versione: number;
  stato: BudgetStato;
  periodo_riferimento: string | null;
  periodo_snapshot: string | null;
  note: string | null;
}

export interface BudgetRiga {
  id: string;
  versione_id: string;
  anno: number;
  mese: number;
  voce_tipo: BudgetVoceTipo;
  importo: number;
  origine: string | null;
  note: string | null;
}

function err(e: any, fallback: string) {
  return e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || fallback;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["budget-versioni"], exact: false });
  qc.invalidateQueries({ queryKey: ["budget-righe"], exact: false });
  qc.invalidateQueries({ queryKey: ["budget-confronto"], exact: false });
  qc.invalidateQueries({ queryKey: ["budget-accuracy"], exact: false });
}

export function useBudgetVersioni(filtri: { anno?: number; tipo?: string; stato?: string } = {}) {
  return useQuery<BudgetVersione[]>({
    queryKey: ["budget-versioni", filtri],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filtri.anno) params.anno = String(filtri.anno);
      if (filtri.tipo) params.tipo = filtri.tipo;
      if (filtri.stato) params.stato = filtri.stato;
      const { data } = await api.get<{ versioni: BudgetVersione[] }>("/budget/versioni", { params });
      return data.versioni;
    },
  });
}

export function useCreateBudgetVersione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { anno: number; tipo: BudgetTipo; note?: string | null }) =>
      (await api.post("/budget/versioni", payload)).data,
    onSuccess: () => { invalidate(qc); toast.success("Versione creata"); },
    onError: (e: any) => toast.error(err(e, "Errore creazione versione")),
  });
}

export function useDeleteBudgetVersione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/budget/versioni/${id}`); },
    onSuccess: () => { invalidate(qc); toast.success("Versione eliminata"); },
    onError: (e: any) => toast.error(err(e, "Errore eliminazione")),
  });
}

export function useApprovaBudgetVersione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/budget/versioni/${id}/approva`)).data,
    onSuccess: () => { invalidate(qc); toast.success("Versione approvata (congelata)"); },
    onError: (e: any) => toast.error(err(e, "Errore approvazione")),
  });
}

export function useBudgetRighe(versioneId?: string) {
  return useQuery<BudgetRiga[]>({
    queryKey: ["budget-righe", versioneId],
    queryFn: async () => {
      const { data } = await api.get<{ righe: BudgetRiga[] }>(`/budget/versioni/${versioneId}/righe`);
      return data.righe;
    },
    enabled: !!versioneId,
  });
}

export function useSalvaBudgetRiga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ versioneId, mese, voceTipo, importo, existingId }:
      { versioneId: string; mese: number; voceTipo: BudgetVoceTipo; importo: number; existingId?: string }) => {
      if (existingId) return (await api.patch(`/budget/righe/${existingId}`, { importo })).data;
      return (await api.post(`/budget/versioni/${versioneId}/righe`, {
        righe: [{ mese, voce_tipo: voceTipo, importo }],
      })).data;
    },
    onSuccess: () => invalidate(qc),
    onError: (e: any) => toast.error(err(e, "Errore salvataggio riga")),
  });
}

export function useBudgetConfronto(versioneId?: string, opts: { mese?: number; ytd?: boolean } = {}) {
  return useQuery({
    queryKey: ["budget-confronto", versioneId, opts],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.mese) params.mese = String(opts.mese);
      if (opts.ytd) params.ytd = "true";
      const { data } = await api.get(`/budget/versioni/${versioneId}/confronto`, { params });
      return data as {
        perimetro: string;
        voci: { voce_tipo: BudgetVoceTipo; budget: number | null; actual: number | null; scostamento: number | null; scostamento_pct: number | null; favorevole: boolean | null }[];
      };
    },
    enabled: !!versioneId,
  });
}

export function useGeneraForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { anno: number; da_mese: number }) =>
      (await api.post("/budget/forecast/genera", payload)).data,
    onSuccess: (data: any) => { invalidate(qc); toast.success(`Forecast v${data?.versione ?? ""} generato (${data?.righe_create ?? 0} righe)`); },
    onError: (e: any) => toast.error(err(e, "Errore generazione forecast")),
  });
}

export function useForecastAccuracy(anno?: number, mese?: number) {
  return useQuery({
    queryKey: ["budget-accuracy", anno, mese],
    queryFn: async () => {
      const { data } = await api.get("/budget/forecast/accuracy", { params: { anno, mese } });
      return data as {
        snapshot: { previsto_da: string; versione: number; orizzonte_mesi: number; voci: { voce_tipo: string; previsto: number | null; actual: number | null; errore: number | null; errore_pct: number | null }[] }[];
        aggregato_per_orizzonte_su_ricavo: { orizzonte_mesi: number; errore_assoluto_medio_pct: number; n: number }[];
        note: string[];
      };
    },
    enabled: !!anno && !!mese,
  });
}
