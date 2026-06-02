import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface VoceCostoFisso {
  descrizione: string;
  categoria: string | null;
  periodicita: string | null;
  importo_mensile: number;
  motivo_esclusione?: string;
}
export interface PLGestionale {
  mese: string;
  ricavi: { retainer_oneshot: number; italfer: number; totale: number };
  costi_diretti: number;
  margine_lordo_aggregato: number;
  costi_fissi_indivisibili: number;
  costi_fissi_dettaglio: { incluse: VoceCostoFisso[]; escluse: VoceCostoFisso[] };
  risultato_operativo_gestionale: number;
  iva_memo: { attiva: number; passiva: number; saldo: number };
  warning: string[];
}

/** mese in formato YYYY-MM (l'endpoint vuole YYYY-MM-01). */
export function usePLGestionale(mese: string) {
  return useQuery<PLGestionale>({
    queryKey: ["pl-gestionale", mese],
    queryFn: async () => {
      const { data } = await api.get<PLGestionale>("/report/pl-gestionale", {
        params: { mese: `${mese}-01` },
      });
      return data;
    },
    enabled: !!mese,
    staleTime: 2 * 60 * 1000,
  });
}
