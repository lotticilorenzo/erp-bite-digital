import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface TimeEstimate {
  stima_minuti: number;
  confidenza: "ALTA" | "MEDIA" | "BASSA" | "NESSUNA";
  sessioni_analizzate: number;
  media_minuti: number;
  min_minuti: number;
  max_minuti: number;
}

export interface UserCapacity {
  ore_disponibili_oggi: number;
  ore_gia_assegnate: number;
  ore_rimanenti: number;
  percentuale_carico: number;
  puo_accettare_task: boolean;
}

export function useTimeEstimate(userId: string | null, taskType: string) {
  return useQuery<TimeEstimate>({
    queryKey: ["time-estimate", userId, taskType],
    queryFn: async () => {
      if (!userId || !taskType || taskType.length < 3) return {
        stima_minuti: 0,
        confidenza: "NESSUNA",
        sessioni_analizzate: 0,
        media_minuti: 0,
        min_minuti: 0,
        max_minuti: 0
      };
      const { data } = await api.get(`/tasks/time-estimate`, {
        params: { user_id: userId, task_type: taskType }
      });
      return data;
    },
    enabled: !!userId && taskType.length >= 3,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUserCapacity(userId: string | null) {
  return useQuery<UserCapacity>({
    queryKey: ["user-capacity", userId],
    queryFn: async () => {
      if (!userId) return null as any;
      const { data } = await api.get(`/users/${userId}/capacity-today`);
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60,
  });
}
