import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";

export type CostoVarTipo = "ORARIO" | "A_PROGETTO" | "UNA_TANTUM";
export type CostoVarStato = "PREVISTO" | "SOSTENUTO";
export type CostoVarRicorrenza = "MENSILE";

export interface CostoVariabile {
  id: string;
  descrizione: string;
  collaboratore_risorsa_id: string | null;
  collaboratore_nome: string | null;
  tipo: CostoVarTipo;
  importo: number;
  data_prevista: string;
  ricorrenza: CostoVarRicorrenza | null;
  commessa_id: string | null;
  progetto_id: string | null;
  stato: CostoVarStato;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CostoVariabileInput {
  descrizione: string;
  collaboratore_risorsa_id?: string | null;
  collaboratore_nome?: string | null;
  tipo: CostoVarTipo;
  importo: number;
  data_prevista: string;
  ricorrenza?: CostoVarRicorrenza | null;
  progetto_id?: string | null;
  stato?: CostoVarStato;
  note?: string | null;
}

export interface CostiVariabiliFiltri {
  stato?: CostoVarStato;
  dal?: string;
  al?: string;
}

export function useCostiVariabili(filtri: CostiVariabiliFiltri = {}) {
  return useQuery<CostoVariabile[]>({
    queryKey: ["costi-variabili", filtri],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filtri.stato) params.stato = filtri.stato;
      if (filtri.dal) params.dal = filtri.dal;
      if (filtri.al) params.al = filtri.al;
      const { data } = await api.get<{ costi_variabili: CostoVariabile[] }>("/costi-variabili", { params });
      return data.costi_variabili;
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["costi-variabili"], exact: false });
  // I costi PREVISTO alimentano la proiezione cassa -> invalida anche quella.
  qc.invalidateQueries({ queryKey: ["proiezione-cassa"], exact: false });
}

export function useCreateCostoVariabile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CostoVariabileInput) => {
      const { data } = await api.post("/costi-variabili", payload);
      return data;
    },
    onSuccess: () => { invalidate(qc); toast.success("Costo variabile creato"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || "Errore creazione"),
  });
}

export function useUpdateCostoVariabile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CostoVariabileInput> }) => {
      const { data: res } = await api.patch(`/costi-variabili/${id}`, data);
      return res;
    },
    onSuccess: () => { invalidate(qc); toast.success("Costo variabile aggiornato"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || "Errore aggiornamento"),
  });
}

export function useDeleteCostoVariabile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/costi-variabili/${id}`); },
    onSuccess: () => { invalidate(qc); toast.success("Costo variabile eliminato"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Errore eliminazione"),
  });
}
