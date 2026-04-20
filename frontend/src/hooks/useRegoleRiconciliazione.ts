import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface RegolaRiconciliazione {
  id: string;
  nome: string;
  pattern: string;
  tipo_match: "contains" | "startswith" | "endswith" | "regex";
  categoria?: string;
  fornitore_id?: string;
  fattura_passiva_id?: string;
  auto_riconcilia: boolean;
  priorita: number;
  attiva: boolean;
  contatore_match?: number;
}

export interface DryRunPreviewItem {
  movimento_id: string;
  movimento_descrizione: string;
  movimento_importo: number;
  movimento_data?: string;
  regola_id: string;
  regola_nome: string;
  regola_pattern: string;
  azione: "RICONCILIA_AUTO" | "CATEGORIZZA";
  categoria_prevista?: string;
}

export function useRegoleRiconciliazione() {
  return useQuery({
    queryKey: ["regole-riconciliazione"],
    queryFn: async () => {
      const { data } = await api.get<{ regole: RegolaRiconciliazione[] }>("/regole-riconciliazione");
      return data.regole;
    },
  });
}

export function useCreateRegola() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<RegolaRiconciliazione, "id" | "contatore_match">) => {
      const { data } = await api.post("/regole-riconciliazione", payload);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["regole-riconciliazione"] }),
  });
}

export function useUpdateRegola() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<RegolaRiconciliazione> & { id: string }) => {
      const { data } = await api.patch(`/regole-riconciliazione/${id}`, payload);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["regole-riconciliazione"] }),
  });
}

export function useDeleteRegola() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/regole-riconciliazione/${id}`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["regole-riconciliazione"] }),
  });
}

export function useApplicaRegole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/regole-riconciliazione/applica");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regole-riconciliazione"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-cassa"] });
    },
  });
}

export function useDryRunRegole() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{
        movimenti_non_riconciliati: number;
        match_previsti: number;
        preview: DryRunPreviewItem[];
      }>("/regole-riconciliazione/dry-run");
      return data;
    },
  });
}
