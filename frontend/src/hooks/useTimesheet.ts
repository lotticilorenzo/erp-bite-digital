import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Timesheet } from "@/types";
import { toast } from "sonner";

export interface TimesheetFilters {
  mese?: string;
  stato?: string;
  commessa_id?: string;
  user_id?: string;
}

export function useTimesheets(filters: TimesheetFilters = {}) {
  return useQuery({
    queryKey: ["timesheets", filters],
    queryFn: async () => {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== "" && v !== "ALL" && v !== null && v !== undefined)
      );
      const { data } = await api.get<Timesheet[]>("/timesheet", { params: cleanFilters });
      return data;
    },
  });
}

export function useCreateTimesheetManual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<Timesheet>("/timesheet/manuale", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"], exact: false });
      toast.success("Ore registrate con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore nella registrazione ore");
    },
  });
}

export function useUpdateTimesheetManual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { data } = await api.patch<Timesheet>(`/timesheet/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"], exact: false });
      toast.success("Ore modificate con successo");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Errore nella modifica ore");
    },
  });
}

export function useDeleteTimesheetManual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/timesheet/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"], exact: false });
      toast.success("Timesheet eliminato con successo");
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.detail || "Errore nell'eliminazione del timesheet";
      toast.error(msg);
    },
  });
}

export function useBulkApproveTimesheets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, azione, note }: { ids: string[]; azione: string; note?: string }) => {
      const { data } = await api.post("/timesheet/approva", { ids, azione, note });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"], exact: false });
      const msg = variables.azione === "APPROVA" ? "Timesheet approvati" : "Timesheet rifiutati/inviati";
      toast.success(msg);
    },
    onError: () => {
      toast.error("Errore nell'approvazione bulk");
    },
  });
}

export function useBulkDeleteTimesheets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await api.delete("/timesheet/bulk", { data: { ids } });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"], exact: false });
      toast.success("Timesheet eliminati con successo");
    },
    onError: () => {
      toast.error("Errore nell'eliminazione bulk");
    },
  });
}

export function useBulkUpdateMeseTimesheets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, mese_competenza }: { ids: string[]; mese_competenza: string }) => {
      const { data } = await api.patch("/timesheet/bulk-mese", { ids, mese_competenza });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"], exact: false });
      toast.success("Mese di competenza aggiornato");
    },
    onError: () => {
      toast.error("Errore nell'aggiornamento mese bulk");
    },
  });
}

export function useClickUpTasks() {
  return useQuery({
    queryKey: ["clickup-tasks"],
    queryFn: async () => {
      const { data } = await api.get("/clickup/tasks");
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minuti
  });
}
