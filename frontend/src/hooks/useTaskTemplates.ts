import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";

export interface TaskTemplateItem {
  id?: string;
  titolo: string;
  descrizione?: string;
  servizio?: string;
  stima_minuti?: number;
  priorita?: string;
  giorno_scadenza?: number;
  assegnatario_ruolo?: string;
  ordine?: number;
}

export interface TaskTemplate {
  id: string;
  nome: string;
  descrizione?: string;
  progetto_tipo?: string;
  attivo: boolean;
  num_items: number;
  items: TaskTemplateItem[];
  created_at: string;
}

export function useTaskTemplates() {
  return useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => {
      const { data } = await api.get<TaskTemplate[]>("/task-templates");
      return data;
    },
  });
}

export function useCreateTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<TaskTemplate, "id" | "num_items" | "created_at">) => {
      const { data: res } = await api.post("/task-templates", data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success("Template creato");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Errore"),
  });
}

export function useUpdateTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskTemplate> }) => {
      const { data: res } = await api.put(`/task-templates/${id}`, data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success("Template aggiornato");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Errore"),
  });
}

export function useDeleteTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/task-templates/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success("Template eliminato");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Errore"),
  });
}

export function useGeneraTaskDaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, commessaId }: { templateId: string; commessaId: string }) => {
      const { data } = await api.post(`/task-templates/${templateId}/genera`, null, {
        params: { commessa_id: commessaId },
      });
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`${data.generati} task generati da "${data.template}"`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Errore generazione"),
  });
}
