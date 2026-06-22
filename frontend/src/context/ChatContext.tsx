import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types';
import type {
  ChatChannel,
  ChatMessage,
  ChatReaction,
  ChatUploadResponse,
  CreateGroupChannelInput,
} from '@/types/chat';

interface ChatContextType {
  channels: ChatChannel[];
  users: User[];
  messages: ChatMessage[];
  isLoading: boolean;
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
  hasMore: boolean;
  typingUsers: string[];
  onlineUsers: Set<string>;
  channelSeenStatus: Record<string, Record<string, string>>;
  unreadCounts: Record<string, number>;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (content: string, type?: ChatMessage['tipo'], replyToId?: string) => Promise<void>;
  uploadFile: (file: File) => Promise<ChatUploadResponse>;
  startDirectChat: (userId: string) => Promise<ChatChannel | undefined>;
  createGroupChannel: (input: CreateGroupChannelInput) => Promise<ChatChannel | undefined>;
  editMessage: (id: string, content: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  setTypingStatus: (isTyping: boolean) => void;
  markAsSeen: (channelId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('channel');
  });
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [channelSeenStatus, setChannelSeenStatus] = useState<Record<string, Record<string, string>>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const ws = useRef<WebSocket | null>(null);
  const activeChannelIdRef = useRef<string | null>(activeChannelId);
  const connectWSRef = useRef<() => Promise<void>>(async () => {});
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);
  const LIMIT = 50;

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  const { data: channels = [], isLoading: isChannelsLoading } = useQuery<ChatChannel[]>({
    queryKey: ['chat-channels'],
    queryFn: async () => {
      const res = await axios.get('/chat/channels');
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (channels && channels.length > 0) {
      setUnreadCounts((prev) => {
        const next = { ...prev };
        let changed = false;
        channels.forEach((channel) => {
          const val = channel.unread_count ?? 0;
          if (next[channel.id] !== val) {
            next[channel.id] = val;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [channels]);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['chat-users'],
    queryFn: async () => {
      const res = await axios.get('/chat/users');
      return res.data;
    },
    enabled: !!user,
  });

  const { data: messages = [], isLoading: isMessagesLoading } = useQuery<ChatMessage[]>({
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
      queryClient.setQueryData<ChatMessage[]>(['chat-messages', activeChannelId], (prev) => {
        return [...res.data, ...(prev || [])];
      });
      setOffset((prev) => prev + res.data.length);
    } catch (err) {
      console.error('Load more failed', err);
    }
  }, [activeChannelId, offset, hasMore, queryClient]);

  const connectWS = useCallback(async () => {
    if (!user || isUnmountedRef.current) return;
    if (
      ws.current &&
      (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const scheduleReconnect = () => {
      if (isUnmountedRef.current) return;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        void connectWSRef.current();
      }, delay);
    };

    try {
      const ticketResponse = await axios.post('/chat/ws-ticket');
      if (isUnmountedRef.current) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/chat/ws?ticket=${encodeURIComponent(ticketResponse.data.ticket)}`;
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const currentChannelId = activeChannelIdRef.current;

        switch (data.type) {
          case 'channel_created':
            queryClient.setQueryData<ChatChannel[]>(['chat-channels'], (old) => {
              const existingChannels = old || [];
              if (existingChannels.some((channel) => channel.id === data.channel.id)) {
                return existingChannels;
              }
              return [data.channel, ...existingChannels];
            });
            break;
          case 'new_message':
            queryClient.setQueryData<ChatChannel[]>(['chat-channels'], (old) => {
              const updated = (old || []).map((channel) => channel.id === data.message.canale_id ? {
                ...channel,
                last_message: data.message.tipo !== 'testo' ? '[Allegato]' : data.message.contenuto,
                last_message_at: data.message.created_at,
              } : channel);
              return [...updated].sort((a, b) => {
                const dateA = new Date(a.last_message_at || a.created_at || 0).getTime();
                const dateB = new Date(b.last_message_at || b.created_at || 0).getTime();
                return dateB - dateA;
              });
            });

            if (data.message.canale_id === currentChannelId) {
              queryClient.setQueryData<ChatMessage[]>(['chat-messages', currentChannelId], (prev) => {
                const existing = prev || [];
                if (existing.some((message) => message.id === data.message.id)) return existing;
                return [...existing, data.message];
              });
              if (ws.current?.readyState === WebSocket.OPEN && currentChannelId) {
                ws.current.send(JSON.stringify({ type: 'message_seen', channel_id: currentChannelId }));
              }
            } else {
              setUnreadCounts((prev) => ({
                ...prev,
                [data.message.canale_id]: (prev[data.message.canale_id] || 0) + 1,
              }));
            }
            break;
          case 'message_edited': {
            const targetChannel = data.canale_id || currentChannelId;
            if (targetChannel) {
              queryClient.setQueryData<ChatMessage[]>(['chat-messages', targetChannel], (prev) =>
                (prev || []).map((message) =>
                  message.id === data.message_id
                    ? { ...message, contenuto: data.contenuto, updated_at: new Date().toISOString(), modificato: true }
                    : message
                )
              );
            }
            break;
          }
          case 'delete_message': {
            const targetChannel = data.canale_id || currentChannelId;
            if (targetChannel) {
              queryClient.setQueryData<ChatMessage[]>(['chat-messages', targetChannel], (prev) =>
                (prev || []).filter((message) => message.id !== data.message_id)
              );
            }
            break;
          }
          case 'reaction_added': {
            const targetChannel = data.canale_id || currentChannelId;
            if (targetChannel) {
              queryClient.setQueryData<ChatMessage[]>(['chat-messages', targetChannel], (prev) =>
                (prev || []).map((message) => {
                  if (message.id !== data.message_id) return message;
                  const alreadyHas = message.reazioni?.some(
                    (reaction: ChatReaction) => reaction.user_id === data.user_id && reaction.emoji === data.emoji
                  );
                  if (alreadyHas) return message;
                  return {
                    ...message,
                    reazioni: [
                      ...(message.reazioni || []),
                      {
                        id: crypto.randomUUID(),
                        messaggio_id: data.message_id,
                        emoji: data.emoji,
                        user_id: data.user_id,
                        user_nome: data.user_nome,
                        created_at: new Date().toISOString(),
                      },
                    ],
                  };
                })
              );
            }
            break;
          }
          case 'reaction_removed': {
            const targetChannel = data.canale_id || currentChannelId;
            if (targetChannel) {
              queryClient.setQueryData<ChatMessage[]>(['chat-messages', targetChannel], (prev) =>
                (prev || []).map((message) => {
                  if (message.id !== data.message_id) return message;
                  return {
                    ...message,
                    reazioni: (message.reazioni || []).filter(
                      (reaction) => !(reaction.user_id === data.user_id && reaction.emoji === data.emoji)
                    ),
                  };
                })
              );
            }
            break;
          }
          case 'user_typing':
            if (data.channel_id === currentChannelId) {
              setTypingUsers((prev) =>
                data.is_typing ? [...new Set([...prev, data.user_nome])] : prev.filter((name) => name !== data.user_nome)
              );
            }
            break;
          case 'user_presence':
            setOnlineUsers((prev) => {
              const next = new Set(prev);
              if (data.status === 'online') next.add(data.user_id);
              else next.delete(data.user_id);
              return next;
            });
            break;
          case 'message_seen':
            setChannelSeenStatus((prev) => ({
              ...prev,
              [data.channel_id]: {
                ...(prev[data.channel_id] || {}),
                [data.user_id]: data.last_seen_at,
              },
            }));
            break;
        }
      };

      socket.onclose = () => {
        if (ws.current === socket) {
          ws.current = null;
        }
        scheduleReconnect();
      };

      socket.onerror = () => socket.close();
    } catch (err) {
      console.error('WS bootstrap failed', err);
      scheduleReconnect();
    }
  }, [user, queryClient]);

  useEffect(() => {
    connectWSRef.current = connectWS;
  }, [connectWS]);

  useEffect(() => {
    isUnmountedRef.current = false;
    if (isAuthLoading || !user) return;

    void connectWS();
    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      if (ws.current) {
        const socket = ws.current;
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;

        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        ws.current = null;
      }
    };
  }, [user, isAuthLoading, connectWS]);

  const sendMessage = useCallback(async (content: string, type: ChatMessage['tipo'] = 'testo', replyToId?: string) => {
    if (!activeChannelId) return;
    const activeChannel = channels.find((channel) => channel.id === activeChannelId);
    await axios.post('/chat/messages', {
      canale_id: activeChannelId,
      progetto_id: activeChannel?.progetto_id,
      contenuto: content,
      tipo: type,
      risposta_a: replyToId,
    });
  }, [activeChannelId, channels]);

  const uploadFile = useCallback(async (file: File): Promise<ChatUploadResponse> => {
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
    setUnreadCounts((prev) => prev[channelId] === 0 ? prev : { ...prev, [channelId]: 0 });
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'message_seen', channel_id: channelId }));
    }
  }, []);

  const startDirectChat = useCallback(async (userId: string) => {
    try {
      const res = await axios.post('/chat/channels/direct', { other_user_id: userId });
      const newChannel = res.data as ChatChannel;
      queryClient.setQueryData<ChatChannel[]>(['chat-channels'], (old) => {
        const existingChannels = old || [];
        if (!existingChannels.find((channel) => channel.id === newChannel.id)) {
          return [newChannel, ...existingChannels];
        }
        return existingChannels;
      });
      setActiveChannelId(newChannel.id);
      return newChannel;
    } catch (err) {
      console.error('Failed to start DM', err);
      throw err;
    }
  }, [queryClient]);

  const createGroupChannel = useCallback(async (input: CreateGroupChannelInput) => {
    try {
      const res = await axios.post('/chat/channels/group', input);
      const newChannel = res.data as ChatChannel;
      queryClient.setQueryData<ChatChannel[]>(['chat-channels'], (old) => {
        const existingChannels = old || [];
        if (!existingChannels.find((channel) => channel.id === newChannel.id)) {
          return [newChannel, ...existingChannels];
        }
        return existingChannels;
      });
      queryClient.setQueryData<ChatMessage[]>(['chat-messages', newChannel.id], []);
      setActiveChannelId(newChannel.id);
      return newChannel;
    } catch (err) {
      console.error('Failed to create group', err);
      throw err;
    }
  }, [queryClient]);

  const value: ChatContextType = {
    channels,
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
    createGroupChannel,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    setTypingStatus,
    markAsSeen,
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
