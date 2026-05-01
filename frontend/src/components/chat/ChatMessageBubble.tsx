import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage, ChatReaction } from "@/types/chat";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import {
  Reply,
  Smile,
  MoreHorizontal,
  Trash2,
  CornerDownRight,
  Edit3,
  FileIcon,
  Download,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  isOnline,
}: ChatMessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.contenuto);
  const [resolvedAttachmentUrl, setResolvedAttachmentUrl] = useState<string | null>(null);

  const attachmentPath = message.contenuto;
  const isProtectedUpload = attachmentPath.startsWith("/api/v1/uploads/");
  const isLegacyUpload = attachmentPath.startsWith("/static/uploads/");
  const isManagedUpload = isProtectedUpload || isLegacyUpload;

  useEffect(() => {
    setEditContent(message.contenuto);
  }, [message.contenuto]);

  useEffect(() => {
    if (isLegacyUpload) {
      setResolvedAttachmentUrl(attachmentPath);
      return;
    }
    if (!isProtectedUpload) {
      setResolvedAttachmentUrl(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    void api
      .get(attachmentPath, { responseType: "blob" })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setResolvedAttachmentUrl(objectUrl);
      })
      .catch(() => {
        if (active) {
          setResolvedAttachmentUrl(null);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachmentPath, isLegacyUpload, isProtectedUpload]);

  const downloadProtectedAttachment = async () => {
    const response = await api.get(attachmentPath, { responseType: "blob" });
    const objectUrl = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = attachmentPath.split("/").pop() || "file";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  };

  const renderContent = (text: string) => {
    if (isManagedUpload) {
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(text);
      if (isImage) {
        if (!resolvedAttachmentUrl) {
          return (
            <div className="mt-1 rounded-2xl border border-white/10 px-4 py-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Caricamento allegato...
            </div>
          );
        }

        return (
          <div className="relative group/img mt-1 max-w-full overflow-hidden rounded-2xl border border-white/10 shadow-lg">
            <img
              src={resolvedAttachmentUrl}
              alt="Immagine inviata"
              className="max-h-[350px] w-auto cursor-zoom-in object-contain transition-transform duration-500 hover:scale-[1.02]"
              onClick={() => window.open(resolvedAttachmentUrl, "_blank")}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/img:opacity-100">
              <ExternalLink className="h-6 w-6 text-white" />
            </div>
          </div>
        );
      }

      const isAudio = /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(text);
      if (isAudio) {
        if (!resolvedAttachmentUrl) {
          return (
            <div className="mt-1 rounded-2xl border border-white/10 px-4 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Preparazione audio...
            </div>
          );
        }

        return (
          <div className="mt-1 min-w-[240px]">
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3",
                isMe ? "border border-white/20 bg-white/10" : "border border-border/50 bg-background/50"
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-primary">
                  <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Zm6 10a6 6 0 0 1-12 0H4a8 8 0 0 0 16 0h-2Zm-6 8a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2Z" />
                </svg>
              </div>
              <audio
                controls
                className="h-8 min-w-0 flex-1"
                style={{ colorScheme: "dark", accentColor: "hsl(var(--primary))" }}
              >
                <source src={resolvedAttachmentUrl} />
                Il tuo browser non supporta l'audio.
              </audio>
            </div>
          </div>
        );
      }

      const filename = text.split("/").pop() || "File";
      return (
        <button
          type="button"
          onClick={() => {
            if (isProtectedUpload) {
              void downloadProtectedAttachment();
              return;
            }
            window.open(text, "_blank");
          }}
          className="mt-1 flex min-w-[200px] items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:bg-white/10"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 transition-transform group-hover/file:scale-110">
            <FileIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 truncate">
            <p className="truncate pr-2 text-xs font-bold">{filename}</p>
            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Download <Download size={8} />
            </p>
          </div>
        </button>
      );
    }

    const parts = text.split(/(@\S+ \S+)/g);
    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        return (
          <span
            key={index}
            className={cn(
              "rounded-md px-1.5 py-0.5 font-black",
              isMe
                ? "bg-white/20 text-white"
                : "bg-primary/15 text-primary"
            )}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const reactionGroups = message.reazioni.reduce((acc, reaction) => {
    acc[reaction.emoji] = acc[reaction.emoji] || [];
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, ChatReaction[]>);

  return (
    <div
      className={cn(
        "group flex w-full transition-all",
        isMe ? "justify-end" : "justify-start",
        isFirstInGroup ? "mt-6" : "mt-1"
      )}
    >
      {!isMe && isFirstInGroup && (
        <div className="relative">
          <Avatar className="mr-3 h-10 w-10 border-2 border-border shadow-sm ring-2 ring-primary/5">
            <AvatarFallback className="bg-primary/10 text-xs font-black uppercase text-primary">
              {message.autore_nome?.substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-3 h-3 w-3 rounded-full border-2 border-background bg-green-500 shadow-lg animate-pulse" />
          )}
        </div>
      )}

      {!isMe && !isFirstInGroup && <div className="mr-3 w-10" />}

      <div className={cn("flex max-w-[75%] flex-col gap-1.5", isMe ? "items-end" : "items-start")}>
        {isFirstInGroup && (
          <div className="mb-0.5 flex items-center gap-2 px-1">
            <span className="text-xs font-black uppercase tracking-wider text-white">{message.autore_nome}</span>
            <span className="text-[10px] font-bold uppercase text-muted-foreground/60">
              {format(new Date(message.created_at), "HH:mm")}
            </span>
          </div>
        )}

        {replyTo && (
          <div
            className={cn(
              "mb-[-10px] flex max-w-full items-center gap-2 overflow-hidden rounded-t-2xl border border-border/50 bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground",
              isMe ? "mr-4 rounded-tl-2xl" : "ml-4 rounded-tr-2xl"
            )}
          >
            <CornerDownRight size={12} className="shrink-0" />
            <span className="truncate italic">"{replyTo.contenuto}"</span>
          </div>
        )}

        <div className="group/bubble relative flex max-w-full items-center gap-2">
          {isMe && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/bubble:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                onClick={() => onReply(message)}
              >
                <Reply size={14} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted hover:text-white"
                  >
                    <MoreHorizontal size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="rounded-xl border-border bg-card">
                  <DropdownMenuItem className="cursor-pointer font-bold" onClick={() => setIsEditing(true)}>
                    <Edit3 size={14} className="mr-2" /> Modifica
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer font-bold text-destructive"
                    onClick={() => onDelete(message.id)}
                  >
                    <Trash2 size={14} className="mr-2" /> Elimina
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div
            className={cn(
              "relative max-w-full break-words rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-xl",
              isMe
                ? "rounded-tr-none bg-primary font-medium text-white shadow-primary/10"
                : "rounded-tl-none border border-border/50 bg-card/80 text-white shadow-black/10 backdrop-blur-sm"
            )}
          >
            {isEditing ? (
              <div className="flex min-w-[200px] flex-col gap-2">
                <textarea
                  className="w-full resize-none rounded-xl border border-white/20 bg-white/10 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-white/50"
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      onEdit(message.id, editContent);
                      setIsEditing(false);
                    }
                    if (event.key === "Escape") {
                      setIsEditing(false);
                    }
                  }}
                />
                <div className="flex justify-end gap-2">
                  <button
                    className="text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100"
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(message.contenuto);
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    className="text-[10px] font-black uppercase tracking-widest text-white hover:text-white/80"
                    onClick={() => {
                      onEdit(message.id, editContent);
                      setIsEditing(false);
                    }}
                  >
                    Salva
                  </button>
                </div>
              </div>
            ) : (
              <>
                {renderContent(message.contenuto)}
                {message.modificato && (
                  <span className="ml-2 text-[9px] font-bold uppercase tracking-widest opacity-50">(modificato)</span>
                )}
              </>
            )}
          </div>

          {!isMe && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/bubble:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  >
                    <Smile size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="flex gap-1 rounded-2xl border-border bg-card p-2 shadow-2xl">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      className="rounded-lg p-1.5 text-xl transition-all hover:scale-125 hover:bg-muted"
                      onClick={() => onReact(message.id, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                onClick={() => onReply(message)}
              >
                <Reply size={14} />
              </Button>
            </div>
          )}
        </div>

        {message.reazioni.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1 px-1", isMe ? "justify-end" : "justify-start")}>
            {Object.entries(reactionGroups).map(([emoji, reactions]) => {
              const hasReacted = !!currentUserId && reactions.some((reaction) => reaction.user_id === currentUserId);
              return (
                <button
                  key={emoji}
                  onClick={() => (hasReacted ? onRemoveReact(message.id, emoji) : onReact(message.id, emoji))}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-black transition-all hover:scale-110",
                    hasReacted
                      ? "border-primary bg-primary/20 text-primary shadow-lg shadow-primary/10"
                      : "border-border/50 bg-muted/40 text-muted-foreground hover:border-primary/50"
                  )}
                >
                  <span>{emoji}</span>
                  <span>{reactions.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {seenBy && seenBy.length > 0 && (
          <div
            className={cn(
              "mt-1 flex -space-x-1.5 opacity-70 transition-opacity hover:opacity-100",
              isMe ? "justify-end pr-1" : "justify-start pl-1"
            )}
          >
            {seenBy.map((viewer) => (
              <div
                key={viewer.id}
                className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full border border-background bg-primary/20 text-[6px] font-black text-primary shadow-sm"
                title={`Visto da ${viewer.nome}`}
              >
                {viewer.avatar ? (
                  <img src={viewer.avatar} alt={viewer.nome} className="h-full w-full object-cover" />
                ) : (
                  viewer.nome.substring(0, 1)
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isMe && isFirstInGroup && (
        <Avatar className="ml-3 h-10 w-10 border-2 border-primary/20 shadow-sm ring-2 ring-primary/5">
          <AvatarFallback className="bg-primary/10 text-xs font-black uppercase text-primary">
            {message.autore_nome?.substring(0, 2)}
          </AvatarFallback>
        </Avatar>
      )}
      {isMe && !isFirstInGroup && <div className="ml-3 w-10" />}
    </div>
  );
}
