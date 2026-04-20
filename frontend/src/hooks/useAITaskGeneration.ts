import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { getErrorMessage } from "@/lib/api";

export interface AITaskSuggestion {
  titolo: string;
  servizio?: string | null;
  stima_minuti: number;
  priorita: string;
  ruolo_suggerito?: string | null;
  assegnatario_id?: string | null;
  assegnatario_nome?: string | null;
  rationale?: string | null;
}

export interface AITaskGenerationContext {
  cliente_nome: string;
  project_types: string[];
  storico_mesi: number;
  budget_ore: number;
  template_count: number;
  mese_commessa?: string | null;
}

export interface AITaskGenerationResponse {
  context: AITaskGenerationContext;
  suggestions: AITaskSuggestion[];
  source: "ai" | "fallback";
}

export function useGenerateTasksAI() {
  return useMutation({
    mutationFn: async (payload: {
      commessa_id: string;
      prompt_extra?: string;
      max_ore?: number;
    }) => {
      const { data } = await api.post<AITaskGenerationResponse>("/ai/generate-tasks", payload);
      return data;
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Errore durante la generazione AI dei task"));
    },
  });
}
