import { useState } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage, ChatReaction } from "@/types/chat";
import { cn } from "@/lib/utils";
import { 
  Reply, 
  Smile, 
  MoreHorizontal, 
  Trash2, 
  CornerDownRight,
  Edit3,
  FileIcon,
  Download,
  ExternalLink
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
  currentUserId?: string;
  onReply: (message: ChatMessage) => void;
  onDelete: (id: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReact: (messageId: string, emoji: string) => void;
  onEdit: (messageId: string, contenuto: string) => void;
  seenBy?: { id: string; nome: string; avatar?: string }[];
  isOnline?: boolean;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "✅"];

export function ChatMessageBubble({
  message,
  isMe,
  isFirstInGroup,
  replyTo,
  currentUserId,
  onReply,
  onDelete,
  onReact,
  onRemoveReact,
  onEdit,
  seenBy,
  isOnline
}: ChatMessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.contenuto);
  // Formatta contenuto con menzioni e file
  const renderContent = (text: string, _isMe: boolean = isMe) => {
    // Rilevamento file caricati
    if (text.startsWith("/static/uploads/")) {
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(text);
      if (isImage) {
        return (
          <div className="relative group/img overflow-hidden rounded-2xl border border-white/10 shadow-lg mt-1 max-w-full">
            <img 
              src={text} 
              alt="Immagine inviata" 
              className="max-h-[350px] w-auto object-contain cursor-zoom-in hover:scale-[1.02] transition-transform duration-500" 
              onClick={() => window.open(text, '_blank')}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
               <ExternalLink className="text-white w-6 h-6" />
            </div>
          </div>
        );
      }

      // ── Audio / Voice message ──────────────────────────────────
      const isAudio = /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(text);
      if (isAudio) {
        return (
          <div className="mt-1 min-w-[240px]">
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl",
              isMe
                ? "bg-white/10 border border-white/20"
                : "bg-background/50 border border-border/50"
            )}>
              {/* Mic icon */}
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary fill-current">
                  <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Zm6 10a6 6 0 0 1-12 0H4a8 8 0 0 0 16 0h-2Zm-6 8a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2Z" />
                </svg>
              </div>

              {/* Native audio player styled */}
              <audio
                controls
                className="flex-1 h-8 min-w-0"
                style={{ colorScheme: "dark", accentColor: "hsl(var(--primary))" }}
              >
                <source src={text} />
                Il tuo browser non supporta l'audio.
              </audio>
            </div>
          </div>
        );
      }
      // ──────────────────────────────────────────────────────────

      const filename = text.split("/").pop() || "File";
      return (
        <a 
          href={text} 
          download 
          className="flex items-center gap-4 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group/file mt-1 min-w-[200px]"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover/file:scale-110 transition-transform">
            <FileIcon className="text-primary w-5 h-5" />
          </div>
          <div className="flex-1 truncate">
            <p className="text-xs font-bold truncate pr-2">{filename}</p>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
              Download <Download size={8} />
            </p>
          </div>
        </a>
      );
    }

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
        <div className="relative">
          <Avatar className="w-10 h-10 mr-3 border-2 border-border shadow-sm ring-2 ring-primary/5">
            <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-xs">
              {message.autore_nome?.substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-3 w-3 h-3 bg-green-500 border-2 border-background rounded-full animate-pulse shadow-lg" />
          )}
        </div>
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
                  <DropdownMenuItem className="font-bold cursor-pointer" onClick={() => setIsEditing(true)}>
                    <Edit3 size={14} className="mr-2" /> Modifica
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive font-bold cursor-pointer" onClick={() => onDelete(message.id)}>
                    <Trash2 size={14} className="mr-2" /> Elimina
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className={cn(
            "px-4 py-3 rounded-3xl shadow-xl text-sm leading-relaxed max-w-full break-words relative",
            isMe 
              ? "bg-primary text-white rounded-tr-none font-medium shadow-primary/10" 
              : "bg-card/80 border border-border/50 text-white rounded-tl-none backdrop-blur-sm shadow-black/10"
          )}>
            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[200px]">
                <textarea
                  className="w-full bg-white/10 border border-white/20 rounded-xl p-2 text-xs focus:ring-1 focus:ring-white/50 focus:outline-none resize-none"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onEdit(message.id, editContent);
                      setIsEditing(false);
                    }
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                />
                <div className="flex justify-end gap-2">
                  <button className="text-[10px] uppercase font-black tracking-widest opacity-50 hover:opacity-100" onClick={() => { setIsEditing(false); setEditContent(message.contenuto); }}>Annulla</button>
                  <button className="text-[10px] uppercase font-black tracking-widest text-white hover:text-white/80" onClick={() => { onEdit(message.id, editContent); setIsEditing(false); }}>Salva</button>
                </div>
              </div>
            ) : (
              <>
                {renderContent(message.contenuto)}
                {message.updated_at && (
                  <span className="text-[9px] font-bold opacity-50 ml-2 uppercase tracking-widest">(modificato)</span>
                )}
              </>
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
              const hasReacted = !!currentUserId && reacts.some(r => r.user_id === currentUserId);
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

        {/* Seen By Avatars */}
        {seenBy && seenBy.length > 0 && (
          <div className={cn(
            "flex -space-x-1.5 mt-1 opacity-70 hover:opacity-100 transition-opacity",
            isMe ? "justify-end pr-1" : "justify-start pl-1"
          )}>
            {seenBy.map(u => (
              <div key={u.id} className="w-4 h-4 rounded-full border border-background bg-primary/20 flex items-center justify-center text-[6px] font-black text-primary overflow-hidden shadow-sm" title={`Visto da ${u.nome}`}>
                {u.avatar ? (
                  <img src={u.avatar} alt={u.nome} className="w-full h-full object-cover" />
                ) : (
                  u.nome.substring(0, 1)
                )}
              </div>
            ))}
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
