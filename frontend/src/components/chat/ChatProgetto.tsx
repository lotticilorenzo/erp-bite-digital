import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/hooks/useAuth";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatInput } from "./ChatInput";
import type { ChatMessage } from "@/types/chat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquareOff } from "lucide-react";

interface ChatProgettoProps {
  progettoId: string;
  teamMembers: any[];
}

export function ChatProgetto({ progettoId, teamMembers }: ChatProgettoProps) {
  const { user } = useAuth();
  const { messages, sendMessage, addReaction, removeReaction, deleteMessage } = useChat(progettoId);
  const [replyTo, setReplyTo] = useState<ChatMessage | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const team = teamMembers.map(m => ({
    id: m.user_id,
    nome: m.user?.nome || "User",
    cognome: m.user?.cognome || ""
  }));

  useEffect(() => {
    if (!messages.isLoading && isInitialLoading) {
       setIsInitialLoading(false);
    }
  }, [messages.isLoading, isInitialLoading]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages.data?.length]);

  if (isInitialLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest">Caricamento messaggi...</p>
      </div>
    );
  }

  const allMessages = messages.data || [];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-250px)] bg-background/20 rounded-3xl border border-white/5 overflow-hidden backdrop-blur-xl shadow-2xl">
      
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {allMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
            <MessageSquareOff size={64} className="mb-4" />
            <p className="text-sm font-black uppercase tracking-[0.2em]">Inizia la conversazione</p>
          </div>
        ) : (
          <div className="flex flex-col min-h-full">
            {allMessages.map((m, i) => {
              const prev = allMessages[i - 1];
              const isFirstInGroup = !prev || prev.autore_id !== m.autore_id || 
                (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 300000); // 5 min group
              
              const replyToMsg = m.risposta_a ? allMessages.find(am => am.id === m.risposta_a) : undefined;

              return (
                <ChatMessageBubble
                  key={m.id}
                  message={m}
                  isMe={m.autore_id === user?.id}
                  isFirstInGroup={isFirstInGroup}
                  replyTo={replyToMsg}
                  onReply={(msg) => setReplyTo(msg)}
                  onDelete={(id) => deleteMessage.mutate(id)}
                  onReact={(id, emoji) => addReaction.mutate({ message_id: id, emoji })}
                  onRemoveReact={(id, emoji) => removeReaction.mutate({ message_id: id, emoji })}
                />
              );
            })}
          </div>
        )}
      </ScrollArea>

      <ChatInput
        teamMembers={team}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
        onSend={(content, replyId) => {
          sendMessage.mutate({ contenuto: content, risposta_a: replyId });
        }}
      />
    </div>
  );
}
