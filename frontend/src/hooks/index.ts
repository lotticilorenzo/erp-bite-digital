import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { FatturaAttiva } from "@/types";

export * from "./useAuth";
export * from "./useClienti";
export * from "./useProgetti";
export * from "./useCommesse";
export * from "./useTimesheet";

export function useFatture() {
  return useQuery({
    queryKey: ["fatture-attive"],
    queryFn: async () => {
      const { data } = await api.get<FatturaAttiva[]>("/fatture-attive");
      return data;
    },
  });
}
