import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { User } from "@/types";

export function useUsers(attivo: boolean = true) {
  return useQuery<User[]>({
    queryKey: ["users", attivo],
    queryFn: async () => {
      const { data } = await api.get("/users", { params: { attivo } });
      return data;
    },
  });
}
