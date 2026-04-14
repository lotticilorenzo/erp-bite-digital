import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Risorsa {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  tipo_contratto: string;
  costo_orario_effettivo: number;
  attivo: boolean;
}

export function useRisorse() {
  return useQuery<Risorsa[]>({
    queryKey: ["risorse"],
    queryFn: async () => {
      const { data } = await api.get("/risorse");
      return data;
    },
  });
}
