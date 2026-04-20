import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Trash2, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";

interface Comment {
  id: string;
  contenuto: string;
  created_at: string;
  autore?: { id: string; nome: string; cognome: string };
}

interface TaskCommentSectionProps {
  taskId: string;
}

function avatarInitials(nome?: string, cognome?: string) {
  return `${nome?.charAt(0) ?? "?"}${cognome?.charAt(0) ?? ""}`.toUpperCase();
}

function renderContent(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-primary font-bold">{part}</span>
    ) : (
      part
    )
  );
}

export function TaskCommentSection({ taskId }: TaskCommentSectionProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const res = await api.get(`/studio/tasks/${taskId}/comments`);
      return res.data;
    },
    enabled: !!taskId,
    refetchInterval: 30000,
  });

  const addMutation = useMutation({
    mutationFn: async (contenuto: string) => {
      const res = await api.post(`/studio/tasks/${taskId}/comments`, { contenuto });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
      setText("");
      setMentionQuery(null);
    },
    onError: () => toast.error("Errore invio commento"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`/studio/tasks/${taskId}/comments/${commentId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  });

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (text.trim()) addMutation.mutate(text.trim());
    }
    if (e.key === "Escape") setMentionQuery(null);
  }, [text, addMutation]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1 && !before.slice(atIdx + 1).includes(" ")) {
      setMentionQuery(before.slice(atIdx + 1));
      setMentionStart(atIdx);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (nome: string, cognome: string) => {
    const slug = `@${nome}_${cognome}`.replace(/\s+/g, "_");
    const before = text.slice(0, mentionStart);
    const after = text.slice(textareaRef.current?.selectionStart ?? mentionStart + (mentionQuery?.length ?? 0) + 1);
    setText(before + slug + " " + after);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const filteredUsers = mentionQuery !== null
    ? (users as any[]).filter((u: any) =>
        `${u.nome} ${u.cognome}`.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-black uppercase tracking-widest">
          Commenti {comments.length > 0 && <span className="text-muted-foreground">({comments.length})</span>}
        </h3>
      </div>

      {/* Comment list */}
      <div className="space-y-3">
        {isLoading && <p className="text-xs text-muted-foreground italic">Caricamento…</p>}
        {!isLoading && comments.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nessun commento — sii il primo!</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3 group">
            <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary shrink-0 mt-0.5">
              {avatarInitials(c.autore?.nome, c.autore?.cognome)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-black text-foreground">
                  {c.autore ? `${c.autore.nome} ${c.autore.cognome}` : "Utente"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {format(parseISO(c.created_at), "dd MMM HH:mm", { locale: it })}
                </span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed mt-0.5">
                {renderContent(c.contenuto)}
              </p>
            </div>
            {(user?.id === c.autore?.id || user?.ruolo === "ADMIN") && (
              <button
                onClick={() => deleteMutation.mutate(c.id)}
                className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive transition-all shrink-0 mt-0.5"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        {mentionQuery !== null && filteredUsers.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 z-50 w-48 bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden">
            {filteredUsers.map((u: any) => (
              <button
                key={u.id}
                onMouseDown={(e) => { e.preventDefault(); insertMention(u.nome, u.cognome); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-primary/10 transition-colors text-left"
              >
                <AtSign className="h-3 w-3 text-primary shrink-0" />
                <span className="font-bold">{u.nome} {u.cognome}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un commento… (Ctrl+Enter per inviare, @ per menzione)"
            className="text-xs min-h-[60px] max-h-[120px] resize-none flex-1 bg-muted/20"
          />
          <Button
            size="sm"
            onClick={() => text.trim() && addMutation.mutate(text.trim())}
            disabled={!text.trim() || addMutation.isPending}
            className="h-9 w-9 p-0 shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
