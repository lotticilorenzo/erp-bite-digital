import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CostoFisso {
  id: string;
  descrizione: string;
  importo: number;
  categoria: string;
  periodicita: string;
  attivo: boolean;
  data_inizio?: string;
  data_fine?: string;
  note?: string;
}

export function useCostiFissi() {
  return useQuery({
    queryKey: ["costi-fissi"],
    queryFn: async () => {
      const { data } = await api.get<CostoFisso[]>("/costi-fissi");
      return data;
    },
  });
}
