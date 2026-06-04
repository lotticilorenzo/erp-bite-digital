import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Riconciliazione {
  id: string;
  movimento_id: string;
  fattura_attiva_id: string | null;
  fattura_passiva_id: string | null;
  importo: number;
  data: string;
  note: string | null;
  created_at: string;
}

export interface SuggestFattura {
  id: string;
  numero: string | null;
  importo: number;
  importo_residuo: number;
  importo_suggerito: number;
  fornitore: string;
  data_emissione: string | null;
  match_esatto: boolean;
}

export interface SuggestResult {
  regola: Record<string, unknown> | null;
  movimento_residuo: number;
  fatture_importo: SuggestFattura[];
}

export interface RiconciliazioneRigaInput {
  fattura_attiva_id?: string;
  fattura_passiva_id?: string;
  importo: number;
  data?: string;
  note?: string;
}

function invalidateReconciliation(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["movimenti-cassa"], exact: false });
  qc.invalidateQueries({ queryKey: ["fatture-attive"], exact: false });
  qc.invalidateQueries({ queryKey: ["fatture-passive"], exact: false });
  qc.invalidateQueries({ queryKey: ["riconciliazioni"], exact: false });
}

export function useRiconciliazioniMovimento(movimentoId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["riconciliazioni", "movimento", movimentoId],
    queryFn: async () => {
      const { data } = await api.get<{ riconciliazioni: Riconciliazione[] }>(
        `/movimenti-cassa/${movimentoId}/riconciliazioni`
      );
      return data.riconciliazioni;
    },
    enabled: enabled && !!movimentoId,
  });
}

export function useRiconciliazioniFattura(fatturaId: string | null, type: "attive" | "passive", enabled = true) {
  return useQuery({
    queryKey: ["riconciliazioni", "fattura", type, fatturaId],
    queryFn: async () => {
      const { data } = await api.get<{ riconciliazioni: Riconciliazione[] }>(
        `/fatture-${type}/${fatturaId}/riconciliazioni`
      );
      return data.riconciliazioni;
    },
    enabled: enabled && !!fatturaId,
  });
}

export function useSuggestRiconciliazione() {
  return useMutation({
    mutationFn: async (movimentoId: string) => {
      const { data } = await api.get<SuggestResult>(`/movimenti-cassa/${movimentoId}/suggest`);
      return data;
    },
  });
}

export function useCreateRiconciliazioni() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ movimentoId, righe }: { movimentoId: string; righe: RiconciliazioneRigaInput[] }) => {
      const { data } = await api.post(`/movimenti-cassa/${movimentoId}/riconciliazioni`, { righe });
      return data;
    },
    onSuccess: () => invalidateReconciliation(qc),
  });
}

export function useDeleteRiconciliazione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ricId: string) => {
      const { data } = await api.delete(`/riconciliazioni/${ricId}`);
      return data;
    },
    onSuccess: () => invalidateReconciliation(qc),
  });
}
