import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { CRMLead, CRMStage, CRMStats, CRMActivity } from "@/types/crm";
import { toast } from "sonner";

export function useCRM() {
  const queryClient = useQueryClient();

  const stagesQuery = useQuery<CRMStage[]>({
    queryKey: ["crm", "stages"],
    queryFn: async () => {
      const res = await api.get("/crm/stadi");
      return res.data;
    },
  });

  const leadsQuery = useQuery<CRMLead[]>({
    queryKey: ["crm", "leads"],
    queryFn: async () => {
      const res = await api.get("/crm/lead");
      return res.data;
    },
  });

  const statsQuery = useQuery<CRMStats>({
    queryKey: ["crm", "stats"],
    queryFn: async () => {
      const res = await api.get("/crm/statistiche");
      return res.data;
    },
  });

  const createLead = useMutation({
    mutationFn: async (data: Partial<CRMLead>) => {
      const res = await api.post("/crm/lead", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm"], exact: false });
      toast.success("Lead creato con successo");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Errore durante la creazione del lead");
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CRMLead> }) => {
      const res = await api.patch(`/crm/lead/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm"], exact: false });
    },
  });

  const updateLeadStage = useMutation({
    mutationFn: async ({ id, stadio_id }: { id: string; stadio_id: string }) => {
      const res = await api.patch(`/crm/lead/${id}/stadio`, { stadio_id });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm"], exact: false });
      toast.success("Stadio aggiornato");
    },
  });

  const addActivity = useMutation({
    mutationFn: async ({ lead_id, data }: { lead_id: string; data: Partial<CRMActivity> }) => {
      const res = await api.post(`/crm/lead/${lead_id}/attivita`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm"], exact: false });
      toast.success("Attività salvata");
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/lead/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm"], exact: false });
      toast.success("Lead eliminato");
    },
  });

  const convertLeadToClient = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/crm/lead/${id}/converti`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["clienti"], exact: false });
      toast.success("Lead convertito in cliente!");
    },
  });

  return {
    stages: stagesQuery.data || [],
    leads: leadsQuery.data || [],
    stats: statsQuery.data,
    isLoading: stagesQuery.isLoading || leadsQuery.isLoading || statsQuery.isLoading,
    createLead,
    updateLead,
    updateLeadStage,
    addActivity,
    deleteLead,
    convertLeadToClient,
    refresh: () => queryClient.invalidateQueries({ queryKey: ["crm"], exact: false })
  };
}
