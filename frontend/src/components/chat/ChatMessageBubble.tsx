import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage, ChatReaction } from "@/types/chat";
import { cn } from "@/lib/utils";
import { 
  Reply, 
  Smile, 
  MoreHorizontal, 
  Trash2, 
  CornerDownRight
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  isFirstInGroup: boolean;
  replyTo?: ChatMessage;
  onReply: (message: ChatMessage) => void;
  onDelete: (id: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReact: (messageId: string, emoji: string) => void;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "✅"];

export function ChatMessageBubble({ 
  message, 
  isMe, 
  isFirstInGroup, 
  replyTo,
  onReply,
  onDelete,
  onReact,
  onRemoveReact
}: ChatMessageBubbleProps) {
  // Formatta contenuto con menzioni
  const renderContent = (text: string) => {
    const parts = text.split(/(@[^ \n\r\t]+ [^ \n\r\t]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return <span key={i} className="text-primary font-black bg-primary/10 px-1.5 py-0.5 rounded-md">{part}</span>;
      }
      return part;
    });
  };

  const reactionGroups = message.reazioni.reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || [];
    acc[r.emoji].push(r);
    return acc;
  }, {} as Record<string, ChatReaction[]>);

  return (
    <div className={cn(
      "flex w-full group transition-all",
      isMe ? "justify-end" : "justify-start",
      isFirstInGroup ? "mt-6" : "mt-1"
    )}>
      
      {!isMe && isFirstInGroup && (
        <Avatar className="w-10 h-10 mr-3 border-2 border-border shadow-sm ring-2 ring-primary/5">
          <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-xs">
            {message.autore_nome?.substring(0, 2)}
          </AvatarFallback>
        </Avatar>
      )}
      
      {!isMe && !isFirstInGroup && <div className="w-10 mr-3" />}

      <div className={cn(
        "max-w-[75%] flex flex-col gap-1.5",
        isMe ? "items-end" : "items-start"
      )}>
        
        {isFirstInGroup && (
          <div className="flex items-center gap-2 px-1 mb-0.5">
            <span className="text-xs font-black text-white uppercase tracking-wider">{message.autore_nome}</span>
            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
              {format(new Date(message.created_at), "HH:mm")}
            </span>
          </div>
        )}

        {/* Reply Preview */}
        {replyTo && (
           <div className={cn(
             "flex items-center gap-2 px-3 py-1.5 mb-[-10px] bg-muted/30 border border-border/50 rounded-t-2xl text-[11px] font-medium text-muted-foreground max-w-full overflow-hidden",
             isMe ? "mr-4 rounded-tl-2xl" : "ml-4 rounded-tr-2xl"
           )}>
              <CornerDownRight size={12} className="shrink-0" />
              <span className="truncate italic">"{replyTo.contenuto}"</span>
           </div>
        )}

        <div className="relative group/bubble flex items-center gap-2 max-w-full">
          
          {isMe && (
            <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1">
              <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary" onClick={() => onReply(message)}>
                <Reply size={14} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-white">
                    <MoreHorizontal size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border rounded-xl">
                  <DropdownMenuItem className="text-destructive font-bold cursor-pointer" onClick={() => onDelete(message.id)}>
                    <Trash2 size={14} className="mr-2" /> Elimina
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className={cn(
            "px-4 py-3 rounded-3xl shadow-xl text-sm leading-relaxed max-w-full break-words",
            isMe 
              ? "bg-primary text-white rounded-tr-none font-medium shadow-primary/10" 
              : "bg-card/80 border border-border/50 text-white rounded-tl-none backdrop-blur-sm shadow-black/10"
          )}>
            {renderContent(message.contenuto)}
            {message.modificato && (
              <span className="text-[9px] font-bold opacity-50 ml-2 uppercase tracking-widest">(modificato)</span>
            )}
          </div>

          {!isMe && (
            <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary">
                    <Smile size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="p-2 flex gap-1 bg-card border-border rounded-2xl shadow-2xl">
                  {EMOJIS.map(e => (
                    <button key={e} className="p-1.5 hover:bg-muted rounded-lg text-xl transition-all hover:scale-125" onClick={() => onReact(message.id, e)}>
                      {e}
                    </button>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary" onClick={() => onReply(message)}>
                <Reply size={14} />
              </Button>
            </div>
          )}
        </div>

        {/* Reactions Counter */}
        {message.reazioni.length > 0 && (
          <div className={cn(
            "flex flex-wrap gap-1 mt-1 px-1",
            isMe ? "justify-end" : "justify-start"
          )}>
            {Object.entries(reactionGroups).map(([emoji, reacts]) => {
              const hasReacted = reacts.some(r => r.user_id === "current_user_id"); // Placeholder
              return (
                <button
                  key={emoji}
                  onClick={() => hasReacted ? onRemoveReact(message.id, emoji) : onReact(message.id, emoji)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-black transition-all hover:scale-110",
                    hasReacted 
                      ? "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10" 
                      : "bg-muted/40 border-border/50 text-muted-foreground hover:border-primary/50"
                  )}
                >
                  <span>{emoji}</span>
                  <span>{reacts.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isMe && isFirstInGroup && (
        <Avatar className="w-10 h-10 ml-3 border-2 border-primary/20 shadow-sm ring-2 ring-primary/5">
          <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-xs">
            {message.autore_nome?.substring(0, 2)}
          </AvatarFallback>
        </Avatar>
      )}
      {isMe && !isFirstInGroup && <div className="w-10 ml-3" />}

    </div>
  );
}
