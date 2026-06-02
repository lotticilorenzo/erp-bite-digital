import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Risorsa {
  id: string;
  user_id?: string;
  nome: string;
  cognome: string;
  ruolo: string;
  tipo_contratto: string;
  costo_orario_effettivo: number;
  attivo: boolean;
  email?: string;
  telefono?: string;
  piva?: string;
  codice_fiscale?: string;
  indirizzo?: string;
  iban?: string;
  banca?: string;
  bic_swift?: string;
  note?: string;
}

export function useRisorse(includiInattivi = false) {
  return useQuery<Risorsa[]>({
    queryKey: ["risorse", includiInattivi],
    queryFn: async () => {
      const { data } = await api.get("/risorse", {
        params: includiInattivi ? { includi_inattivi: true } : undefined,
      });
      return data;
    },
  });
}
