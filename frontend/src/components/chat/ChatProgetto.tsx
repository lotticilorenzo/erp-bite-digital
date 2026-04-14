import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/hooks/useAuth";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatInput } from "./ChatInput";
import type { ChatMessage } from "@/types/chat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquareOff, Search, X, MessageSquare, History, ArrowUpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ChatProgettoProps {
  progettoId: string;
  teamMembers?: any[];
}

export function ChatProgetto({ progettoId, teamMembers = [] }: ChatProgettoProps) {
  const { user } = useAuth();
  const { 
    messages, 
    sendMessage, 
    typingUsers, 
    onlineUsers, 
    addReaction,
    removeReaction,
    deleteMessage,
    editMessage,
    uploadFile,
    channelSeenStatus,
    isLoading,
    hasMore,
    loadMoreMessages,
    setTypingStatus, 
    markAsSeen,
    setActiveChannelId 
  } = useChat();

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    setActiveChannelId(progettoId);
    markAsSeen(progettoId);
  }, [progettoId, setActiveChannelId, markAsSeen]);
  
  const allMessages: ChatMessage[] = messages || [];
  const [replyTo, setReplyTo] = useState<ChatMessage | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const team = teamMembers.map(m => ({
    id: m.user_id,
    nome: m.user?.nome || "User",
    cognome: m.user?.cognome || ""
  }));

  useEffect(() => {
    if (!isLoading && isInitialLoading) {
       setIsInitialLoading(false);
    }
  }, [isLoading, isInitialLoading]);

  // Auto-scroll to bottom only on first load or when sending message
  useEffect(() => {
    if (scrollRef.current && !isLoading) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // Se siamo gia vicino al fondo o è il primo caricamento
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
      // Memorizziamo l'altezza prima del caricamento per mantenere la posizione
      const oldScrollHeight = target.scrollHeight;
      loadMoreMessages().then(() => {
        setTimeout(() => {
          const newScrollHeight = target.scrollHeight;
          target.scrollTop = newScrollHeight - oldScrollHeight;
        }, 0);
      });
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.get(`/chat/search?q=${searchTerm}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest">Caricamento messaggi...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-background/20 rounded-3xl border border-white/5 backdrop-blur-xl shadow-2xl relative">
      
      <div className="flex-1 flex flex-col h-[calc(100vh-250px)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <MessageSquare size={20} />
             </div>
             <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Team Chat</h3>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">{allMessages.length} messaggi &bull; {onlineUsers.size} online</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <Button 
                variant="ghost" 
                size="icon" 
                className={cn("rounded-xl transition-all", showSearch ? "bg-primary text-white" : "hover:bg-white/5")}
                onClick={() => setShowSearch(!showSearch)}
             >
                <Search size={18} />
             </Button>
          </div>
        </div>
      
        <ScrollArea 
          ref={scrollRef} 
          className="flex-1 p-4"
          onScrollCapture={handleScroll}
        >
          {hasMore && (
            <div className="flex justify-center py-4">
               <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10" onClick={loadMoreMessages}>
                  <History size={12} className="mr-2" /> Carica messaggi precedenti
               </Button>
            </div>
          )}
        {allMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
            <MessageSquareOff size={64} className="mb-4" />
            <p className="text-sm font-black uppercase tracking-[0.2em]">Inizia la conversazione</p>
          </div>
        ) : (
          <div className="flex flex-col min-h-full">
            {allMessages.map((m: any, i: number) => {
              const prev = allMessages[i - 1];
              const isFirstInGroup = !prev || prev.autore_id !== m.autore_id || 
                (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 300000); // 5 min group
              
              const replyToMsg = m.risposta_a ? allMessages.find((am: any) => am.id === m.risposta_a) : undefined;

              // Calcola chi ha visto questo messaggio come ultimo
              const seenBy = teamMembers.filter(member => {
                if (member.user_id === user?.id) return false; // Non mostrare se stesso
                const lastSeenAt = channelSeenStatus[member.user_id];
                if (!lastSeenAt) return false;
                
                const msgTime = new Date(m.created_at).getTime();
                const seenTime = new Date(lastSeenAt).getTime();
                
                // Mostra avatar solo se questo è l'ultimo messaggio visto (o uno dei più recenti)
                const nextMsg = allMessages[i + 1];
                const nextMsgTime = nextMsg ? new Date(nextMsg.created_at).getTime() : Infinity;
                
                return seenTime >= msgTime && seenTime < nextMsgTime;
              }).map(member => ({
                id: member.user_id,
                nome: member.user?.nome || "User",
                avatar: member.user?.avatar_url
              }));

              return (
                <ChatMessageBubble
                  key={m.id}
                  message={m}
                  isMe={m.autore_id === user?.id}
                  isFirstInGroup={isFirstInGroup}
                  replyTo={replyToMsg}
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
      </ScrollArea>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-6 py-2 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">
            {typingUsers.join(", ")} {typingUsers.length > 1 ? "stanno scrivendo..." : "sta scrivendo..."}
          </span>
        </div>
      )}

        <ChatInput
          teamMembers={team}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(undefined)}
          onTyping={(isTyping) => setTypingStatus(isTyping)}
          onUpload={(file) => uploadFile(file)}
          onSend={(content, replyId) => {
            sendMessage(content, 'testo', replyId);
          }}
        />
      </div>

      {/* Search Sidebar */}
      {showSearch && (
        <div className="w-80 border-l border-white/5 bg-black/20 backdrop-blur-2xl flex flex-col animate-in slide-in-from-right duration-300">
           <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Ricerca</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setShowSearch(false)}>
                 <X size={14} />
              </Button>
           </div>
           <form onSubmit={handleSearch} className="p-4">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                 <Input 
                   value={searchTerm} 
                   onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder="Cerca nei messaggi..." 
                   className="pl-10 bg-white/5 border-white/10 rounded-xl"
                 />
              </div>
           </form>
           
           <ScrollArea className="flex-1 px-4">
              {isSearching ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                   <Loader2 className="w-6 h-6 animate-spin" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Ricerca in corso...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="flex flex-col gap-4 pb-10">
                   {searchResults.map(msg => (
                     <div key={msg.id} className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/50 transition-all cursor-pointer group">
                        <div className="flex items-center justify-between mb-1">
                           <span className="text-[10px] font-black text-primary uppercase">{msg.autore_nome}</span>
                           <span className="text-[8px] text-muted-foreground">{format(new Date(msg.created_at), "dd MMM HH:mm")}</span>
                        </div>
                        <p className="text-xs text-white/80 line-clamp-3 leading-relaxed">{msg.contenuto}</p>
                     </div>
                   ))}
                </div>
              ) : searchTerm ? (
                <div className="py-20 text-center opacity-20">
                   <Search size={48} className="mx-auto mb-4" />
                   <p className="text-xs font-black uppercase tracking-widest">Nessun risultato</p>
                </div>
              ) : (
                <div className="py-20 text-center opacity-20">
                   <History size={48} className="mx-auto mb-4" />
                   <p className="text-xs font-black uppercase tracking-widest">Digita per cercare</p>
                </div>
              )}
           </ScrollArea>
        </div>
      )}
    </div>
  );
}

export default ChatProgetto;
