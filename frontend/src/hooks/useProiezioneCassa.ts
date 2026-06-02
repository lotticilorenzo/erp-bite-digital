import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export type ZonaCassa = "verde" | "gialla" | "rossa";

export interface PuntoGiornaliero {
  data: string;
  saldo_base: number;
  saldo_ottimista: number;
  saldo_pessimista: number;
  zona: ZonaCassa;
}
export interface RigaSettimanale {
  settimana: number;
  settimana_inizio: string;
  entrate: number;
  uscite: number;
  saldo_netto: number;
  saldo_cumulato: number;
}
export interface RigaMensile {
  mese: number;
  saldo_iniziale: number;
  entrate: number;
  uscite: number;
  saldo_finale: number;
}
export interface ScadenzaInclusa { data: string; voce: string; importo: number }
export interface ScadenzaNonQuantificata { data: string; voce: string; certezza: string; note?: string | null }

export interface ProiezioneCassa {
  giorni: number;
  data_inizio: string;
  saldo_iniziale: number;
  soglia_operativa: number;
  prima_giornata_critica: string | null;
  vista_giornaliera: PuntoGiornaliero[];
  vista_settimanale: RigaSettimanale[];
  vista_mensile: RigaMensile[];
  scadenze_fiscali_incluse?: ScadenzaInclusa[];
  scadenze_fiscali_non_quantificate?: ScadenzaNonQuantificata[];
  warning: string[];
}
export interface SaldoCassa {
  id: string;
  data: string;
  saldo: number;
  nota: string | null;
}

export function useProiezioneCassa(giorni = 90, usciteVar = 0) {
  return useQuery<ProiezioneCassa>({
    queryKey: ["proiezione-cassa", giorni, usciteVar],
    queryFn: async () => {
      const { data } = await api.get<ProiezioneCassa>("/report/proiezione-cassa", {
        params: { giorni, uscite_variabili_mensili: usciteVar },
      });
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useSaldoCassa() {
  return useQuery<SaldoCassa | null>({
    queryKey: ["saldo-cassa"],
    queryFn: async () => {
      const { data } = await api.get<SaldoCassa | null>("/saldo-cassa");
      return data;
    },
  });
}

export function useSetSaldo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { saldo: number; data?: string; nota?: string }) => {
      const { data } = await api.post("/saldo-cassa", body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saldo-cassa"] });
      qc.invalidateQueries({ queryKey: ["proiezione-cassa"], exact: false });
    },
  });
}
