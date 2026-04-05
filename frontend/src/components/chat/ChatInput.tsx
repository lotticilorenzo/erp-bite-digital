import { useState, useRef, useEffect } from "react";
import { Send, X, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (content: string, replyToId?: string) => void;
  replyTo?: ChatMessage;
  onCancelReply: () => void;
  teamMembers: { id: string; nome: string; cognome: string }[];
}

export function ChatInput({ onSend, replyTo, onCancelReply, teamMembers }: ChatInputProps) {
  const [content, setContent] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!content.trim()) return;
    onSend(content, replyTo?.id);
    setContent("");
    onCancelReply();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertMention = (member: { nome: string; cognome: string }) => {
    const lastAtPos = content.lastIndexOf("@");
    const newContent = content.substring(0, lastAtPos) + `@${member.nome} ${member.cognome} ` + content.substring(textareaRef.current?.selectionStart || content.length);
    setContent(newContent);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    const lastChar = content[content.length - 1];
    if (lastChar === "@") {
      setShowMentions(true);
      setMentionFilter("");
    } else if (showMentions) {
      const lastAtPos = content.lastIndexOf("@");
      setMentionFilter(content.substring(lastAtPos + 1).toLowerCase());
    }
  }, [content, showMentions]);

  const filteredMembers = teamMembers.filter(m => 
    `${m.nome} ${m.cognome}`.toLowerCase().includes(mentionFilter)
  );

  return (
    <div className="p-4 bg-card/50 border-t border-border/50 backdrop-blur-md relative">
      
      {/* Reply Preview */}
      {replyTo && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 mb-3 bg-primary/5 border border-primary/20 rounded-xl animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex-1 truncate">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Rispondendo a {replyTo.autore_nome}</p>
            <p className="text-xs text-muted-foreground truncate italic">"{replyTo.contenuto}"</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/10 text-primary" onClick={onCancelReply}>
            <X size={12} />
          </Button>
        </div>
      )}

      {/* Mention Auto-complete */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-[calc(100%+8px)] left-4 w-64 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
          <div className="p-3 border-b border-border bg-muted/30 flex items-center gap-2">
             <AtSign size={14} className="text-primary" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Menziona qualcuno...</span>
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {filteredMembers.map(m => (
              <button
                key={m.id}
                onClick={() => insertMention(m)}
                className="w-full text-left px-4 py-2.5 hover:bg-primary/10 hover:text-primary transition-all text-sm font-bold flex items-center gap-3 border-b border-border/30 last:border-0"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] shrink-0">
                   {m.nome[0]}{m.cognome[0]}
                </div>
                <span>{m.nome} {m.cognome}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-3 translate-y-0">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un messaggio..."
            className="min-h-[50px] max-h-[150px] bg-background/50 border-border/60 focus:ring-primary rounded-2xl py-3 px-4 text-sm font-medium resize-none shadow-inner"
          />
        </div>
        <Button 
          onClick={handleSend}
          disabled={!content.trim()}
          className="h-12 w-12 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 hover:scale-110 active:scale-95 transition-all shrink-0"
        >
          <Send size={20} className={cn("transition-transform", content.trim() && "translate-x-0.5 -translate-y-0.5")} />
        </Button>
      </div>
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mt-2 text-center">
        Enter per inviare &bull; Shift+Enter per andare a capo
      </p>
    </div>
  );
}
