import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ChatMessage, ChatReaction } from "@/types/chat";

export function useChat(progetto_id: string) {
  const queryClient = useQueryClient();

  const messages = useQuery({
    queryKey: ["chat-messages", progetto_id],
    queryFn: async () => {
      const res = await api.get<ChatMessage[]>(`/chat/${progetto_id}/messaggi`);
      return res.data;
    },
    refetchInterval: 3000, // Polling ogni 3 secondi
    enabled: !!progetto_id,
  });

  const sendMessage = useMutation({
    mutationFn: async (data: { contenuto: string; tipo?: string; risposta_a?: string }) => {
      const res = await api.post<ChatMessage>(`/chat/${progetto_id}/messaggi`, {
        ...data,
        progetto_id
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", progetto_id], exact: false });
    },
  });

  const updateMessage = useMutation({
    mutationFn: async ({ id, contenuto }: { id: string; contenuto: string }) => {
      const res = await api.patch<ChatMessage>(`/chat/messaggi/${id}`, { contenuto });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", progetto_id], exact: false });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/chat/messaggi/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", progetto_id], exact: false });
    },
  });

  const addReaction = useMutation({
    mutationFn: async ({ message_id, emoji }: { message_id: string; emoji: string }) => {
      const res = await api.post<ChatReaction>(`/chat/messaggi/${message_id}/reazione`, { emoji });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", progetto_id], exact: false });
    },
  });

  const removeReaction = useMutation({
    mutationFn: async ({ message_id, emoji }: { message_id: string; emoji: string }) => {
      await api.delete(`/chat/messaggi/${message_id}/reazione?emoji=${encodeURIComponent(emoji)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", progetto_id], exact: false });
    },
  });

  return {
    messages,
    sendMessage,
    updateMessage,
    deleteMessage,
    addReaction,
    removeReaction,
  };
}
