import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Cliente, Progetto, Commessa, Timesheet, FatturaAttiva } from "@/types";

export function useClienti(attivo?: boolean) {
  return useQuery({
    queryKey: ["clienti", { attivo }],
    queryFn: async () => {
      const { data } = await api.get<Cliente[]>("/clienti", { params: { attivo } });
      return data;
    },
  });
}

export function useProgetti(clienteId?: string) {
  return useQuery({
    queryKey: ["progetti", { clienteId }],
    queryFn: async () => {
      const { data } = await api.get<Progetto[]>("/progetti", { params: { cliente_id: clienteId } });
      return data;
    },
  });
}

export function useCommesse(params?: { mese?: string; stato?: string; cliente_id?: string }) {
  return useQuery({
    queryKey: ["commesse", params],
    queryFn: async () => {
      const { data } = await api.get<Commessa[]>("/commesse", { params });
      return data;
    },
  });
}

export function useTimesheet(params?: { user_id?: string; mese_competenza?: string }) {
  return useQuery({
    queryKey: ["timesheet", params],
    queryFn: async () => {
      const { data } = await api.get<Timesheet[]>("/timesheet", { params });
      return data;
    },
  });
}

export function useFatture() {
  return useQuery({
    queryKey: ["fatture-attive"],
    queryFn: async () => {
      const { data } = await api.get<FatturaAttiva[]>("/fatture-attive");
      return data;
    },
  });
}
