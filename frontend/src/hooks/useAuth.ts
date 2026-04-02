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
      localStorage.setItem("BITE_ERP_TOKEN", data.access_token);
      queryClient.setQueryData(["user"], data.user);
    },
  });

  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const token = localStorage.getItem("BITE_ERP_TOKEN");
      if (!token) return null;
      const { data } = await api.get<User>("/auth/me");
      return data;
    },
    retry: false,
    staleTime: Infinity,
  });

  const logout = () => {
    localStorage.removeItem("BITE_ERP_TOKEN");
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
