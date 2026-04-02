import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { TaskSO } from "@/types/studio";

export interface ClickUpTasksResponse {
  clienti: {
    cliente_nome: string;
    folder_id: string;
    tasks: any[];
  }[];
  totale_task: number;
}

export function useTasks() {
  return useQuery({
    queryKey: ["clickup-tasks"],
    queryFn: async () => {
      try {
        const { data } = await api.get<ClickUpTasksResponse>("/clickup/tasks");
        
        // Flatten all tasks and map them to our TaskSO type
        const allTasks: TaskSO[] = [];
        data.clienti.forEach(c => {
          c.tasks.forEach(t => {
            allTasks.push({
              id: t.id,
              title: t.name,
              desc: "", 
              state_id: t.status,
              assignees: [],
              start_date: null,
              due_date: null,
              estimated_hours: 0,
              subtasks: [],
              clickup_id: t.id,
              folder_id: t.folder_id,
              list_id: t.list_id
            });
          });
        });
        
        return { 
          tasks: allTasks, 
          grouped: data.clienti,
          total: data.totale_task,
          error: null
        };
      } catch (err: any) {
        console.error("ClickUp Fetch Error:", err);
        return {
          tasks: [],
          grouped: [],
          total: 0,
          error: err.response?.data?.detail || "Errore caricamento ClickUp"
        };
      }
    },
    refetchInterval: 60000,
  });
}
