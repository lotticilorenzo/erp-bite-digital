import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AuthResponse, User } from "@/types";

export function useAuth() {
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data } = await api.post<AuthResponse>("/auth/login", credentials);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data.user);
    },
  });

  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const { data } = await api.get<User>("/auth/me");
        return data;
      } catch (e) {
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minuti — evita dati utente stale dopo refresh
  });

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {}
    queryClient.setQueryData(["user"], null);
    window.location.href = "/login";
  };

  return {
    user,
    isLoading,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    error: loginMutation.error,
    logout,
  };
}
