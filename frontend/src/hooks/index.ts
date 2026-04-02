import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { FatturaAttiva } from "@/types";

export * from "./useClienti";
export * from "./useProgetti";
export * from "./useCommesse";

export function useTimesheet(params?: { user_id?: string; mese_competenza?: string }) {
  return useQuery({
    queryKey: ["timesheet", params],
    queryFn: async () => {
      const { data } = await api.get<any[]>("/timesheet", { params });
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
