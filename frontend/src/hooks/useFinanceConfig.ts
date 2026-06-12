import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";

// ── PESI CONTENUTO (driver quota Luca §7.5) ──
export interface PesoContenuto {
  tipo: string;
  peso: number;
  updated_at: string;
}

export function usePesiContenuto() {
  return useQuery<PesoContenuto[]>({
    queryKey: ["pesi-contenuto"],
    queryFn: async () => {
      const { data } = await api.get<{ pesi_contenuto: PesoContenuto[] }>("/pesi-contenuto");
      return data.pesi_contenuto;
    },
  });
}

export function useUpdatePeso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tipo, peso }: { tipo: string; peso: number }) => {
      const { data } = await api.patch(`/pesi-contenuto/${tipo}`, { peso });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pesi-contenuto"] });
      qc.invalidateQueries({ queryKey: ["pl-gestionale"], exact: false });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Errore salvataggio peso"),
  });
}

// ── CONFIG MEMO CLIENTE DEDICATO (P&L §7.6) ──
export interface ConfigPlMemo {
  id: number;
  cliente_dedicato_id: string | null;
  collaboratore_dedicato_id: string | null;
  costo_collaboratore_mensile: number | null;
  updated_at: string | null;
}

export interface ConfigPlMemoUpdate {
  cliente_dedicato_id?: string | null;
  collaboratore_dedicato_id?: string | null;
  costo_collaboratore_mensile?: number | null;
}

export function useConfigPlMemo() {
  return useQuery<ConfigPlMemo>({
    queryKey: ["config-pl-memo"],
    queryFn: async () => {
      const { data } = await api.get<ConfigPlMemo>("/config-pl-memo");
      return data;
    },
  });
}

export function useUpdateConfigPlMemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ConfigPlMemoUpdate) => {
      const { data } = await api.patch("/config-pl-memo", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config-pl-memo"] });
      qc.invalidateQueries({ queryKey: ["pl-gestionale"], exact: false });
      toast.success("Configurazione salvata");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Errore salvataggio configurazione"),
  });
}
