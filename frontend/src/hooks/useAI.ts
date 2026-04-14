import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAnalytics } from "./useAnalytics";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function useAI() {
  const { data: analytics } = useAnalytics();

  return useMutation({
    mutationFn: async (message: string) => {
      // Gather context before sending
      const context = {
        kpis: analytics?.kpis || {},
        alerts: (analytics?.alerts || []).slice(0, 10), // Limit alerts for token space
        topClienti: analytics?.clientStats || [],
        recentTrends: (analytics?.revenueTrend || []).slice(-6) // Last 6 months
      };

      const { data } = await api.post("/ai/chat", {
        message,
        context
      });

      return data.response as string;
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Errore nella risposta AI");
    },
  });
}
