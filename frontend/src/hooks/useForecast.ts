import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface ForecastMonth {
  mese: string;
  ricavo_certo: number;
  ricavo_pipeline_crm: number;
  ricavo_totale: number;
  ricavo_storico: number;
  num_commesse: number;
  num_lead_crm: number;
  top_lead: Array<{
    id: string;
    nome: string;
    valore: number;
    probabilita: number;
    valore_pesato: number;
  }>;
  commesse_detail: Array<{
    id: string;
    cliente: string;
    valore: number;
    stato: string;
  }>;
}

export interface ForecastData {
  mesi: ForecastMonth[];
  kpi: {
    ricavi_certi: number;
    pipeline_crm: number;
    totale_previsto: number;
  };
}

export function useForecast(mesi = 3) {
  return useQuery({
    queryKey: ["analytics-forecast", mesi],
    queryFn: async () => {
      const { data } = await api.get<ForecastData>("/analytics/forecast", {
        params: { mesi },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
