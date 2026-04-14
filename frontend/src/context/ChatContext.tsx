import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface ChatContextType {
  channels: any[];
  users: any[];
  messages: any[];
  isLoading: boolean;
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
  hasMore: boolean;
  typingUsers: string[];
  onlineUsers: Set<string>;
  channelSeenStatus: Record<string, string>;
  unreadCounts: Record<string, number>;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (content: string, type?: string, replyToId?: string) => Promise<void>;
  uploadFile: (file: File) => Promise<any>;
  startDirectChat: (userId: string) => Promise<any>;
  editMessage: (id: string, content: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  setTypingStatus: (isTyping: boolean) => void;
  markAsSeen: (channelId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { isLoading: isAuthLoading } = useAuth();
  const token = sessionStorage.getItem("BITE_ERP_TOKEN");
  const queryClient = useQueryClient();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('channel');
  });
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [channelSeenStatus, setChannelSeenStatus] = useState<Record<string, string>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const ws = useRef<WebSocket | null>(null);
  const activeChannelIdRef = useRef<string | null>(activeChannelId);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);
  const LIMIT = 50;

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  // Data Fetching
  const { data: channels, isLoading: isChannelsLoading } = useQuery({
    queryKey: ['chat-channels'],
    queryFn: async () => {
      const res = await axios.get('/chat/channels');
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 60000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: async () => {
      const res = await axios.get('/chat/users');
      return res.data;
    },
    enabled: !!token,
  });

  const { data: messages = [], isLoading: isMessagesLoading } = useQuery({
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

  // WebSocket
  const connectWS = useCallback(() => {
    if (!token || isUnmountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // token come query param (non nel path) per ridurre esposizione nei log proxy/CDN
    const wsUrl = `${protocol}//${window.location.host}/api/v1/chat/ws?token=${token}`;
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
          queryClient.setQueryData(['chat-channels'], (old: any) => {
            return old?.map((c: any) => c.id === data.message.canale_id ? {
              ...c,
              last_message: data.message.tipo !== 'testo' ? '[Allegato]' : data.message.contenuto,
              last_message_at: data.message.created_at
            } : c);
          });
          if (data.message.canale_id === currentChannelId) {
            queryClient.setQueryData(['chat-messages', currentChannelId], (prev: any) =>
              [...(prev || []), data.message]
            );
          } else {
            setUnreadCounts(prev => ({
              ...prev,
              [data.message.canale_id]: (prev[data.message.canale_id] || 0) + 1
            }));
          }
          break;
        }
        case 'message_edited': {
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
                const alreadyHas = m.reazioni?.some((r: any) => r.user_id === data.user_id && r.emoji === data.emoji);
                if (alreadyHas) return m;
                return {
                  ...m,
                  reazioni: [...(m.reazioni || []), { id: crypto.randomUUID(), emoji: data.emoji, user_id: data.user_id, user_nome: data.user_nome, created_at: new Date().toISOString() }]
                };
              })
            );
          }
          break;
        }
        case 'user_typing':
          if (data.channel_id === currentChannelId) {
            setTypingUsers(prev => data.is_typing ? [...new Set([...prev, data.user_nome])] : prev.filter(n => n !== data.user_nome));
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
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connectWS, delay);
    };

    socket.onerror = () => socket.close();
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

  // Actions
  const sendMessage = useCallback(async (content: string, type: string = 'testo', replyToId?: string) => {
    if (!activeChannelId) return;
    const activeChannel = channels?.find((c: any) => c.id === activeChannelId);
    await axios.post('/chat/messages', {
      canale_id: activeChannelId,
      progetto_id: activeChannel?.progetto_id,
      contenuto: content,
      tipo: type,
      risposta_a: replyToId
    });
  }, [activeChannelId, channels]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  }, []);

  const editMessage = useCallback(async (id: string, content: string) => {
    await axios.patch(`/chat/messages/${id}`, { contenuto: content });
  }, []);

  const deleteMessage = useCallback(async (id: string) => {
    await axios.delete(`/chat/messages/${id}`);
  }, []);

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    await axios.post(`/chat/messages/${messageId}/reactions`, { emoji });
  }, []);

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    await axios.delete(`/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  }, []);

  const setTypingStatus = useCallback((isTyping: boolean) => {
    if (ws.current?.readyState === WebSocket.OPEN && activeChannelId) {
      ws.current.send(JSON.stringify({ type: 'typing', channel_id: activeChannelId, is_typing: isTyping }));
    }
  }, [activeChannelId]);

  const markAsSeen = useCallback((channelId: string) => {
    setUnreadCounts(prev => prev[channelId] === 0 ? prev : { ...prev, [channelId]: 0 });
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'message_seen', channel_id: channelId }));
    }
  }, []);

  const startDirectChat = useCallback(async (userId: string) => {
    try {
      const res = await axios.post('/chat/channels/direct', { other_user_id: userId });
      const newChannel = res.data;
      queryClient.setQueryData(['chat-channels'], (old: any) => {
        if (!old?.find((c: any) => c.id === newChannel.id)) return [newChannel, ...(old || [])];
        return old;
      });
      setActiveChannelId(newChannel.id);
      return newChannel;
    } catch (err) {
      console.error("Failed to start DM", err);
    }
  }, [queryClient]);

  const value = {
    channels: channels || [],
    users,
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

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
