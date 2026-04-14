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
      sessionStorage.setItem("BITE_ERP_TOKEN", data.access_token);
      queryClient.setQueryData(["user"], data.user);
    },
  });

  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const token = sessionStorage.getItem("BITE_ERP_TOKEN");
      if (!token) return null;
      const { data } = await api.get<User>("/auth/me");
      return data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minuti — evita dati utente stale dopo refresh
  });

  const logout = () => {
    sessionStorage.removeItem("BITE_ERP_TOKEN");
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
