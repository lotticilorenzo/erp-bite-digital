import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/api';
import { useAuth } from './useAuth';

export function useChat() {
  const { isLoading: isAuthLoading } = useAuth();
  const token = localStorage.getItem("BITE_ERP_TOKEN");
  const queryClient = useQueryClient();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('channel');
  });
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [channelSeenStatus, setChannelSeenStatus] = useState<Record<string, string>>({});
  // Per-channel unread counts: incremented on new WS message when channel is not active
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const ws = useRef<WebSocket | null>(null);
  // Ref so WS onmessage always reads the latest activeChannelId without reconnecting
  const activeChannelIdRef = useRef<string | null>(activeChannelId);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);
  const LIMIT = 50;

  // Keep ref in sync with state
  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  // ═══════════════════════════════════════════════════════
  // DATA FETCHING (Channels & Messages)
  // ═══════════════════════════════════════════════════════

  const { data: channels, isLoading: isChannelsLoading } = useQuery({
    queryKey: ['chat-channels'],
    queryFn: async () => {
      const res = await axios.get('/chat/channels');
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ['chat-users'],
    queryFn: async () => {
      const res = await axios.get('/chat/users');
      return res.data;
    },
    enabled: !!token,
  });

  const { data: messages, isLoading: isMessagesLoading } = useQuery({
    queryKey: ['chat-messages', activeChannelId],
    queryFn: async () => {
      if (!activeChannelId) return [];
      const res = await axios.get(`/chat/channels/${activeChannelId}/messages?limit=${LIMIT}&offset=0`);
      if (res.data.length < LIMIT) setHasMore(false);
      else setHasMore(true);
      setOffset(res.data.length);
      return res.data;
    },
    enabled: !!activeChannelId,
    staleTime: Infinity,
  });

  const loadMoreMessages = useCallback(async () => {
    if (!activeChannelId || !hasMore) return;
    try {
      const res = await axios.get(`/chat/channels/${activeChannelId}/messages?limit=${LIMIT}&offset=${offset}`);
      if (res.data.length < LIMIT) setHasMore(false);
      queryClient.setQueryData(['chat-messages', activeChannelId], (prev: any) => {
        return [...res.data, ...(prev || [])];
      });
      setOffset(prev => prev + res.data.length);
    } catch (err) {
      console.error("Load more failed", err);
    }
  }, [activeChannelId, offset, hasMore, queryClient]);

  // ═══════════════════════════════════════════════════════
  // WEBSOCKET — persistent connection, auto-reconnect
  // ═══════════════════════════════════════════════════════

  const connectWS = useCallback(() => {
    if (!token || isUnmountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/chat/ws/${token}`;
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const currentChannelId = activeChannelIdRef.current;

      switch (data.type) {

        case 'new_message': {
          // Update channel list preview
          queryClient.setQueryData(['chat-channels'], (old: any) => {
            return old?.map((c: any) => c.id === data.message.canale_id ? {
              ...c,
              last_message: data.message.tipo !== 'testo' ? '[Allegato]' : data.message.contenuto,
              last_message_at: data.message.created_at
            } : c);
          });
          // Append to active channel messages
          if (data.message.canale_id === currentChannelId) {
            queryClient.setQueryData(['chat-messages', currentChannelId], (prev: any) =>
              [...(prev || []), data.message]
            );
          } else {
            // Increment unread count for non-active channel
            setUnreadCounts(prev => ({
              ...prev,
              [data.message.canale_id]: (prev[data.message.canale_id] || 0) + 1
            }));
          }
          break;
        }

        case 'message_edited': {
          // Apply to whichever channel cached this message (use canale_id from broadcast)
          const targetChannel = data.canale_id || currentChannelId;
          if (targetChannel) {
            queryClient.setQueryData(['chat-messages', targetChannel], (prev: any) =>
              prev?.map((m: any) =>
                m.id === data.message_id
                  ? { ...m, contenuto: data.contenuto, updated_at: new Date().toISOString(), modificato: true }
                  : m
              )
            );
          }
          break;
        }

        case 'delete_message': {
          const targetChannel = data.canale_id || currentChannelId;
          if (targetChannel) {
            queryClient.setQueryData(['chat-messages', targetChannel], (prev: any) =>
              prev?.filter((m: any) => m.id !== data.message_id)
            );
          }
          break;
        }

        case 'reaction_added': {
          const targetChannel = data.canale_id || currentChannelId;
          if (targetChannel) {
            queryClient.setQueryData(['chat-messages', targetChannel], (prev: any) =>
              prev?.map((m: any) => {
                if (m.id !== data.message_id) return m;
                // Avoid duplicates
                const alreadyHas = m.reazioni?.some(
                  (r: any) => r.user_id === data.user_id && r.emoji === data.emoji
                );
                if (alreadyHas) return m;
                return {
                  ...m,
                  reazioni: [
                    ...(m.reazioni || []),
                    {
                      id: crypto.randomUUID(),
                      emoji: data.emoji,
                      user_id: data.user_id,
                      user_nome: data.user_nome,
                      created_at: new Date().toISOString()
                    }
                  ]
                };
              })
            );
          }
          break;
        }

        case 'reaction_removed': {
          const targetChannel = data.canale_id || currentChannelId;
          if (targetChannel) {
            queryClient.setQueryData(['chat-messages', targetChannel], (prev: any) =>
              prev?.map((m: any) => {
                if (m.id !== data.message_id) return m;
                return {
                  ...m,
                  reazioni: (m.reazioni || []).filter(
                    (r: any) => !(r.user_id === data.user_id && r.emoji === data.emoji)
                  )
                };
              })
            );
          }
          break;
        }

        case 'user_typing':
          if (data.channel_id === currentChannelId) {
            setTypingUsers(prev =>
              data.is_typing
                ? [...new Set([...prev, data.user_nome])]
                : prev.filter(n => n !== data.user_nome)
            );
          }
          break;

        case 'user_presence':
          setOnlineUsers(prev => {
            const next = new Set(prev);
            if (data.status === 'online') next.add(data.user_id);
            else next.delete(data.user_id);
            return next;
          });
          break;

        case 'message_seen':
          setChannelSeenStatus(prev => ({ ...prev, [data.user_id]: data.last_seen_at }));
          break;
      }
    };

    socket.onclose = () => {
      if (isUnmountedRef.current) return;
      // Exponential backoff: 1s, 2s, 4s, ... capped at 30s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connectWS, delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [token, queryClient]);

  useEffect(() => {
    isUnmountedRef.current = false;
    if (!token) return;
    connectWS();
    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      ws.current?.close();
    };
  }, [token, connectWS]);

  // ═══════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════

  const sendMessage = async (content: string, type: string = 'testo', replyToId?: string) => {
    if (!activeChannelId) return;
    const activeChannel = channels?.find((c: any) => c.id === activeChannelId);
    await axios.post('/chat/messages', {
      canale_id: activeChannelId,
      progetto_id: activeChannel?.progetto_id,
      contenuto: content,
      tipo: type,
      risposta_a: replyToId
    });
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  };

  const editMessage = async (id: string, content: string) => {
    await axios.patch(`/chat/messages/${id}`, { contenuto: content });
  };

  const deleteMessage = async (id: string) => {
    await axios.delete(`/chat/messages/${id}`);
  };

  const addReaction = async (messageId: string, emoji: string) => {
    await axios.post(`/chat/messages/${messageId}/reactions`, { emoji });
  };

  const removeReaction = async (messageId: string, emoji: string) => {
    await axios.delete(`/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  };

  const setTypingStatus = (isTyping: boolean) => {
    if (ws.current?.readyState === WebSocket.OPEN && activeChannelId) {
      ws.current.send(JSON.stringify({
        type: 'typing',
        channel_id: activeChannelId,
        is_typing: isTyping
      }));
    }
  };

  const markAsSeen = (channelId: string) => {
    // Reset unread count for this channel
    setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'message_seen',
        channel_id: channelId
      }));
    }
  };

  const startDirectChat = async (userId: string) => {
    try {
      const res = await axios.post('/chat/channels/direct', { other_user_id: userId });
      const newChannel = res.data;
      queryClient.setQueryData(['chat-channels'], (old: any) => {
        if (!old?.find((c: any) => c.id === newChannel.id)) {
          return [newChannel, ...(old || [])];
        }
        return old;
      });
      setActiveChannelId(newChannel.id);
      return newChannel;
    } catch (err) {
      console.error("Failed to start DM", err);
    }
  };

  return {
    channels,
    users: users || [],
    messages,
    isLoading: isAuthLoading || isChannelsLoading || isMessagesLoading,
    activeChannelId,
    setActiveChannelId,
    hasMore,
    typingUsers,
    onlineUsers,
    channelSeenStatus,
    unreadCounts,
    loadMoreMessages,
    sendMessage,
    uploadFile,
    startDirectChat,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    setTypingStatus,
    markAsSeen
  };
}
