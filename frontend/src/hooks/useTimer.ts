import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { TimerSessionSO } from "@/types/studio";
import { toast } from "sonner";

export function useActiveTimer() {
  return useQuery({
    queryKey: ["timer", "active"],
    queryFn: async () => {
      const { data } = await api.get<TimerSessionSO | null>("/timer/active");
      return data;
    },
    refetchInterval: 30000, // Sincronizza ogni 30s per sicurezza
  });
}

export function useTimerSessions(taskId: string | null) {
  return useQuery({
    queryKey: ["timer", "sessions", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data } = await api.get<TimerSessionSO[]>(`/timer/task/${taskId}`);
      return data;
    },
    enabled: !!taskId,
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data } = await api.post<TimerSessionSO>("/timer/start", { task_id: taskId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timer"], exact: false });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore nell'avvio del timer");
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, note }: { sessionId: string; note?: string }) => {
      const { data } = await api.post<TimerSessionSO>("/timer/stop", { session_id: sessionId, note });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timer"], exact: false });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore nella fermata del timer");
    },
  });
}

export function useSaveTimerToTimesheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { session_ids: string[]; commessa_id?: string; note?: string }) => {
      const { data } = await api.post("/timer/save-timesheet", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timer"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["timesheets"], exact: false });
      toast.success("Sessioni salvate nel timesheet");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore nel salvataggio del timesheet");
    },
  });
}
