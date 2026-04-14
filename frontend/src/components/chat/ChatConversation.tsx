import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/hooks/useAuth";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatInput } from "./ChatInput";
import { ChatGroupInfoPanel } from "./ChatGroupInfoPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquareOff, History, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@/types/chat";

interface ChatConversationProps {
  channelId: string | null;
  className?: string;
}

export function ChatConversation({ channelId, className }: ChatConversationProps) {
  const { user } = useAuth();
  const {
    channels,
    messages,
    sendMessage,
    typingUsers,
    onlineUsers,
    addReaction,
    removeReaction,
    deleteMessage,
    editMessage,
    uploadFile,
    isLoading,
    hasMore,
    loadMoreMessages,
    setTypingStatus,
    markAsSeen,
    setActiveChannelId
  } = useChat();

  const [replyTo, setReplyTo] = useState<ChatMessage | undefined>();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Sync active channel
  useEffect(() => {
    if (channelId) {
      setActiveChannelId(channelId);
      markAsSeen(channelId);
    }
  }, [channelId, setActiveChannelId, markAsSeen]);
  
  const allMessages: ChatMessage[] = messages || [];
  const activeChannel = channels?.find((c: any) => c.id === channelId);

  useEffect(() => {
    if (!isLoading && isInitialLoading) {
       setIsInitialLoading(false);
    }
  }, [isLoading, isInitialLoading]);

  // Handle auto-scroll
  useEffect(() => {
    if (scrollRef.current && !isLoading) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 200;
        if (isNearBottom || allMessages.length <= 50) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }
  }, [allMessages.length, isLoading]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop === 0 && hasMore && !isLoading) {
      const oldScrollHeight = target.scrollHeight;
      loadMoreMessages().then(() => {
        setTimeout(() => {
          const newScrollHeight = target.scrollHeight;
          target.scrollTop = newScrollHeight - oldScrollHeight;
        }, 0);
      });
    }
  };

  if (!channelId) {
    return (
      <div className={cn("flex-1 flex flex-col items-center justify-center opacity-30 select-none", className)}>
        <MessageSquareOff size={80} strokeWidth={1} className="mb-6" />
        <h2 className="text-xl font-black uppercase tracking-[0.3em]">Seleziona una chat</h2>
        <p className="text-xs font-medium tracking-widest mt-2 uppercase">Per iniziare a collaborare</p>
      </div>
    );
  }

  if (isInitialLoading && !activeChannel) {
    return (
      <div className={cn("flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground", className)}>
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Inizializzazione...</p>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 flex flex-col min-w-0 bg-background/5 relative overflow-hidden", className)}>
      
      {/* Conversation Header */}
      <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between bg-card/50 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black shadow-inner">
              {activeChannel?.nome?.[0] || "#"}
           </div>
           <div>
              <h3 className="text-sm font-black uppercase tracking-widest leading-none mb-1">{activeChannel?.nome || "Caricamento..."}</h3>
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                 <span className="text-[10px] font-bold text-muted-foreground uppercase">{onlineUsers.size} membri online</span>
              </div>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <Button
             variant="outline"
             size="icon"
             className={cn(
               "h-9 w-9 rounded-xl border-border/40 hover:bg-muted transition-all",
               isInfoOpen && "bg-primary/10 border-primary/40 text-primary"
             )}
             onClick={() => setIsInfoOpen((v) => !v)}
             title="Info gruppo"
           >
              <Info size={18} />
           </Button>
        </div>
      </div>
    
    <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={channelId}
          initial={{ opacity: 0, scale: 0.995 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.005 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="flex-1 flex flex-col overflow-hidden relative"
        >
          <ScrollArea 
            ref={scrollRef} 
            className="flex-1 p-0"
            onScrollCapture={handleScroll}
          >
            <div className="max-w-4xl mx-auto w-full px-4 pt-10 pb-6 relative min-h-full">
              {/* Subtle Loading Overlay when switching */}
              {isLoading && allMessages.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/50 backdrop-blur-[2px] z-20 animate-in fade-in duration-300">
                   <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
                   <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Sincronizzazione...</p>
                </div>
              )}

              {hasMore && (
                <div className="flex justify-center mb-8">
                   <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary hover:bg-primary/5 rounded-full px-6" onClick={loadMoreMessages}>
                      <History size={12} className="mr-2" /> Carica cronologia precedente
                   </Button>
                </div>
              )}
              
              {!isInitialLoading && allMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center opacity-20 py-32">
                  <MessageSquareOff size={64} className="mb-4" />
                  <p className="text-xs font-black uppercase tracking-[0.3em]">Nessun messaggio in questa chat</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {allMessages.map((m: any, i: number) => {
                    const prev = allMessages[i - 1];
                    const isFirstInGroup = !prev || prev.autore_id !== m.autore_id || 
                      (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 300000); // 5 min group
                    
                    const replyToMsg = m.risposta_a ? allMessages.find((am: any) => am.id === m.risposta_a) : undefined;
                    
                    const seenBy: { id: string; nome: string; avatar?: string }[] = [];
                    
                    return (
                      <ChatMessageBubble
                        key={m.id}
                        message={m}
                        isMe={m.autore_id === user?.id}
                        isFirstInGroup={isFirstInGroup}
                        replyTo={replyToMsg}
                        currentUserId={user?.id}
                        isOnline={onlineUsers.has(m.autore_id)}
                        seenBy={seenBy}
                        onReply={(msg) => setReplyTo(msg)}
                        onDelete={(id) => deleteMessage(id)}
                        onEdit={(id, content) => editMessage(id, content)}
                        onReact={(id, emoji) => addReaction(id, emoji)}
                        onRemoveReact={(id, emoji) => removeReaction(id, emoji)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </motion.div>
      </AnimatePresence>

      {/* Typing Indicator & Footer */}
      <div className="z-10 bg-gradient-to-t from-background via-background/95 to-transparent pt-4">
        {typingUsers.length > 0 && (
          <div className="px-6 py-2 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-primary/70 italic">
              {typingUsers.join(", ")} {typingUsers.length > 1 ? "stanno scrivendo..." : "sta scrivendo..."}
            </span>
          </div>
        )}

        <ChatInput
          teamMembers={[]} // In Chat V2 gestiamo le menzioni in modo diverso o lasciamo vuoto se non serve
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(undefined)}
          onTyping={(isTyping) => setTypingStatus(isTyping)}
          onUpload={(file) => uploadFile(file)}
          onSend={(content, replyId) => {
            sendMessage(content, 'testo', replyId);
            setReplyTo(undefined);
          }}
        />
      </div>

      {/* Group Info Slide-in Panel */}
      {activeChannel && (
        <ChatGroupInfoPanel
          channel={activeChannel as any}
          isOpen={isInfoOpen}
          onClose={() => setIsInfoOpen(false)}
        />
      )}
    </div>
  );
}
