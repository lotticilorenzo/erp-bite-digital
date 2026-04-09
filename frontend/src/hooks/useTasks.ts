import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { TaskSO } from "@/types/studio";

export function useTasks(filters?: { 
  progetto_id?: string; 
  commessa_id?: string; 
  assegnatario_id?: string; 
  parent_only?: boolean;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: ["studio-tasks", filters],
    queryFn: async () => {
      // Add parent_only=true by default if not specified to clean up the main list
      const actualFilters = { 
        parent_only: true, // Default to true unless explicitly false
        ...filters 
      };
      
      const { data } = await api.get<any[]>("/tasks", { params: actualFilters });
      
      const mapTask = (t: any): TaskSO => ({
        id: t.id,
        title: t.titolo,
        desc: t.descrizione || "",
        state_id: t.stato,
        assignees: t.assegnatario_id ? [t.assegnatario_id] : [],
        data_inizio: t.data_inizio,
        due_date: t.data_scadenza,
        estimated_hours: t.stima_minuti ? t.stima_minuti / 60 : 0,
        subtasks: (t.subtasks || []).map((st: any) => ({
          id: st.id,
          title: st.titolo,
          stateId: st.stato,
          subtasks: [] 
        })),
        progetto_id: t.progetto_id,
        progetto: t.progetto,
        commessa_id: t.commessa_id,
        parent_id: t.parent_id,
        stima_minuti: t.stima_minuti,
        tempo_trascorso_minuti: t.tempo_trascorso_minuti || 0,
        assegnatario_id: t.assegnatario_id
      });

      return data.map(mapTask);
    },
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ["studio-task", id],
    queryFn: async () => {
      if (!id || id === "new") return null;
      const { data } = await api.get<any>(`/tasks/${id}`);
      return {
        id: data.id,
        title: data.titolo,
        desc: data.descrizione || "",
        state_id: data.stato,
        assignees: data.assegnatario_id ? [data.assegnatario_id] : [],
        data_inizio: data.data_inizio,
        due_date: data.data_scadenza,
        estimated_hours: data.stima_minuti ? data.stima_minuti / 60 : 0,
        subtasks: (data.subtasks || []),
        progetto_id: data.progetto_id,
        commessa_id: data.commessa_id,
        parent_id: data.parent_id,
        stima_minuti: data.stima_minuti,
        tempo_trascorso_minuti: data.tempo_trascorso_minuti || 0
      } as TaskSO;
    },
    enabled: !!id && id !== "new",
  });
}

export function useTaskMutations() {
  const queryClient = useQueryClient();

  const createTask = useMutation({
    mutationFn: (data: any) => api.post("/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-tasks"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["tasks"], exact: false });
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-tasks"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["tasks"], exact: false });
    },
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-tasks"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["tasks"], exact: false });
    },
  });

  return { createTask, updateTask, deleteTask };
}
