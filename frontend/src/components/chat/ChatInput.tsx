import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, AtSign, Paperclip, FileIcon, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (content: string, replyToId?: string) => void;
  replyTo?: ChatMessage;
  onCancelReply: () => void;
  teamMembers: { id: string; nome: string; cognome: string }[];
  onTyping?: (isTyping: boolean) => void;
  onUpload?: (file: File) => Promise<any>;
}

export function ChatInput({ onSend, replyTo, onCancelReply, teamMembers, onTyping, onUpload }: ChatInputProps) {
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Voice Recording State ─────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `vocale_${Date.now()}.webm`, { type: "audio/webm" });

        if (onUpload) {
          setIsUploading(true);
          try {
            const res = await onUpload(file);
            // Send immediately as voice message
            onSend(res.url, replyTo?.id);
            onCancelReply();
          } catch (err) {
            console.error("Voice upload failed", err);
          } finally {
            setIsUploading(false);
          }
        }

        setRecordingSeconds(0);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Live timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied", err);
      alert("Accesso al microfono negato. Controlla le autorizzazioni del browser.");
    }
  }, [onUpload, onSend, replyTo, onCancelReply]);

  const stopRecording = useCallback(() => {
    clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };
  // ──────────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      if (onUpload) {
        const res = await onUpload(file);
        setSelectedFile({
          url: res.url,
          name: res.filename,
          type: res.content_type,
          size: res.size,
        });
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = () => {
    if ((!content.trim() && !selectedFile) || isUploading) return;

    if (selectedFile) {
      onSend(selectedFile.url, replyTo?.id);
    } else {
      onSend(content, replyTo?.id);
    }

    setContent("");
    setSelectedFile(null);
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
    const newContent =
      content.substring(0, lastAtPos) +
      `@${member.nome} ${member.cognome} ` +
      content.substring(textareaRef.current?.selectionStart || content.length);
    setContent(newContent);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const lastChar = content[content.length - 1];
    if (lastChar === "@") {
      setShowMentions(true);
      setMentionFilter("");
    } else if (showMentions) {
      const lastAtPos = content.lastIndexOf("@");
      setMentionFilter(content.substring(lastAtPos + 1).toLowerCase());
    }

    if (content.length > 0) {
      onTyping?.(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
      }, 2000);
    } else {
      onTyping?.(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  }, [content, showMentions, onTyping]);

  const filteredMembers = teamMembers.filter((m) =>
    `${m.nome} ${m.cognome}`.toLowerCase().includes(mentionFilter)
  );

  const showMicButton = !content.trim() && !selectedFile && !isUploading;

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
            {filteredMembers.map((m) => (
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

      {/* Attachment Preview */}
      {selectedFile && (
        <div className="mx-4 mb-3 p-2.5 bg-muted/50 rounded-2xl border border-border/50 flex items-center justify-between group animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3 truncate">
            <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center border border-border/50 overflow-hidden shadow-sm">
              {selectedFile.type?.startsWith("image/") ? (
                <img src={selectedFile.url} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <FileIcon className="w-6 h-6 text-primary" />
              )}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold line-clamp-1">{selectedFile.name}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setSelectedFile(null)}
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {/* ── Recording UI ── */}
      {isRecording && (
        <div className="flex items-center gap-3 mb-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl animate-in slide-in-from-bottom-2">
          {/* Pulsing dot */}
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]" />

          {/* Waveform bars */}
          <div className="flex items-center gap-0.5 h-5">
            {[...Array(8)].map((_, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-red-400"
                style={{
                  height: `${30 + Math.sin(i * 1.2) * 60}%`,
                  animation: `soundWave 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                }}
              />
            ))}
          </div>

          <span className="text-sm font-black text-red-400 tabular-nums flex-1">
            {formatTime(recordingSeconds)}
          </span>

          {/* Cancel */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={cancelRecording}
          >
            <X size={16} />
          </Button>

          {/* Stop & Send */}
          <Button
            size="icon"
            className="h-9 w-9 rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 hover:scale-110 active:scale-95 transition-all"
            onClick={stopRecording}
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Square size={18} fill="white" />}
          </Button>
        </div>
      )}

      {/* ── Main Input Row ── */}
      {!isRecording && (
        <div className="flex items-end gap-3">
          <div className="flex-1 relative flex items-end bg-background/50 border border-border/60 rounded-2xl focus-within:border-primary/50 transition-all shadow-inner">
            <button
              className="p-3.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip size={20} />}
            </button>
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />

            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedFile ? "Aggiungi un commento..." : "Scrivi un messaggio..."}
              className="min-h-[50px] max-h-[150px] bg-transparent border-0 focus-visible:ring-0 rounded-2xl py-3.5 px-0 text-sm font-medium resize-none shadow-none"
            />
          </div>

          {/* Mic button (when empty) or Send button (when has text) */}
          {showMicButton ? (
            <Button
              onClick={startRecording}
              className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary shadow-sm hover:scale-110 active:scale-95 transition-all shrink-0"
              variant="ghost"
              title="Tieni premuto o clicca per registrare un vocale"
            >
              <Mic size={22} />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!content.trim() && !selectedFile}
              className="h-12 w-12 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 hover:scale-110 active:scale-95 transition-all shrink-0"
            >
              <Send size={20} className={cn("transition-transform", content.trim() && "translate-x-0.5 -translate-y-0.5")} />
            </Button>
          )}
        </div>
      )}

      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mt-2 text-center">
        Enter per inviare &bull; Shift+Enter per andare a capo
        {showMicButton && " · Microfono per vocale"}
      </p>

      {/* Keyframes for waveform */}
      <style>{`
        @keyframes soundWave {
          from { opacity: 0.4; transform: scaleY(0.4); }
          to   { opacity: 1;   transform: scaleY(1);   }
        }
      `}</style>
    </div>
  );
}
