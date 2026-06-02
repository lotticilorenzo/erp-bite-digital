import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export type Certezza = "ALTA" | "MEDIA" | "DA_ALLINEARE";

export interface IvaTrimestre {
  trimestre: string;
  iva_debito: number;
  iva_credito: number;
  saldo: number;
  data_versamento: string;
  certezza: Certezza;
  note: string;
}
export interface ScadenzaFiscale {
  data: string;
  voce: string;
  importo_stimato: number | null;
  certezza: Certezza;
  fonte: string;
  note: string;
}
export interface ScadenzarioFiscale {
  orizzonte: { da: string; a: string };
  iva_trimestrale: IvaTrimestre[];
  scadenze: ScadenzaFiscale[];
  warning: string[];
}

export function useScadenzarioFiscale(mesi = 6) {
  return useQuery<ScadenzarioFiscale>({
    queryKey: ["scadenzario-fiscale", mesi],
    queryFn: async () => {
      const { data } = await api.get<ScadenzarioFiscale>("/report/scadenzario-fiscale", {
        params: { mesi },
      });
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}
