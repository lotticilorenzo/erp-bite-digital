import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'URGENTE' | 'AVVISO' | 'FATTURA' | 'APPROVAZIONE';
  link?: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await api.get("/notifications/");
      return data;
    },
    refetchInterval: 60000, // 60s — notifiche non richiedono polling aggressivo
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"], exact: false });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      await api.post("/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"], exact: false });
    },
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const hasUrgent = notifications.some(n => !n.is_read && n.type === 'URGENTE');

  // Mapped version for components that expect camelCase
  const mappedNodes = notifications.map(n => ({
    ...n,
    description: n.message,
    timestamp: n.created_at,
    isRead: n.is_read
  }));

  return {
    notifications,
    unreadCount,
    hasUrgent,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    isLoading,
    allNodes: mappedNodes,
    unreadNodes: mappedNodes.filter(n => !n.isRead),
    importantNodes: mappedNodes.filter(n => n.type === 'URGENTE' || n.type === 'AVVISO' || n.type === 'FATTURA')
  };
}
