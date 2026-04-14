import { useEffect, useState } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatConversation } from "./ChatConversation";
import { useChat } from "@/hooks/useChat";
import { useSearchParams } from "react-router-dom";
import { useStudio } from "@/hooks/useStudio";
import { Loader2 } from "lucide-react";

export function ChatHub() {
  const {
    channels,
    users,
    activeChannelId,
    setActiveChannelId,
    isLoading,
    onlineUsers,
    unreadCounts,
    startDirectChat,
    markAsSeen
  } = useChat();
  const { setView } = useStudio();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState<'all' | 'projects' | 'team'>('all');
  
  // Set global view to 'chat' for breadcrumbs
  useEffect(() => {
    setView("chat");
  }, [setView]);

  // Sync URL with global active channel state
  useEffect(() => {
    const channelFromUrl = searchParams.get("channel");
    
    // Priority 1: URL has a channel -> update global state
    if (channelFromUrl && channelFromUrl !== activeChannelId) {
      setActiveChannelId(channelFromUrl);
    } 
    // Priority 2: Global state has a channel but URL doesn't -> update URL
    else if (!channelFromUrl && activeChannelId) {
      setSearchParams({ channel: activeChannelId }, { replace: true });
    }
    // Priority 3: Neither has a channel -> default to General
    else if (!channelFromUrl && !activeChannelId && channels && channels.length > 0) {
      const general = channels.find((c: any) => c.tipo === 'GENERAL') || channels[0];
      setActiveChannelId(general.id);
      setSearchParams({ channel: general.id }, { replace: true });
    }
  }, [channels, activeChannelId, setActiveChannelId, searchParams, setSearchParams]);

  const handleSelectChannel = (id: string) => {
    setActiveChannelId(id);
    setSearchParams({ channel: id });
    markAsSeen(id);
  };

  const handleStartDirectChat = async (userId: string) => {
    const channel = await startDirectChat(userId);
    if (channel) {
      setSearchParams({ channel: channel.id });
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background/20 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 animate-pulse italic">Sincronizzazione Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background/50 backdrop-blur-xl border-t border-border/20 shadow-inner relative">
      {/* Chat List Sidebar (LEFT - WhatsApp Style) */}
      <ChatSidebar
        channels={channels || []}
        users={users || []}
        activeChannelId={activeChannelId}
        onSelectChannel={handleSelectChannel}
        onStartDirectChat={handleStartDirectChat}
        onlineUsers={onlineUsers}
        unreadCounts={unreadCounts}
        category={category}
        onCategoryChange={setCategory}
        className="w-80 shrink-0 border-r border-border/10"
      />

      {/* Main Conversation Area (RIGHT) */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <ChatConversation 
          channelId={activeChannelId} 
          className="h-full"
        />
      </div>
    </div>
  );
}

export default ChatHub;
