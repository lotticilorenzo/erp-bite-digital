import { useState, useEffect, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Code,
  Minus,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  Clock,
  FileText,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/hooks/useDocuments";
import type { DocumentNode } from "@/types/document";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface DocumentEditorProps {
  node: DocumentNode | null;
  className?: string;
}

type SaveStatus = "idle" | "saving" | "saved";

function markdownToHtml(md: string): string {
  // 1. ESCAPE RAW HTML (Prevention of XSS)
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  return escaped
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-black mt-6 mb-2 text-foreground">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-black mt-8 mb-3 text-foreground">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-black mt-8 mb-4 text-foreground">$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-muted/50 px-1.5 py-0.5 rounded text-[0.9em] font-mono text-primary/80">$1</code>')
    // HR
    .replace(/^---$/gm, '<hr class="border-border/30 my-6" />')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Checkboxes
    .replace(/^- \[x\] (.+)$/gm, '<li class="ml-4 flex items-center gap-2"><input type="checkbox" checked disabled class="rounded" /><span class="line-through opacity-50">$1</span></li>')
    .replace(/^- \[ \] (.+)$/gm, '<li class="ml-4 flex items-center gap-2"><input type="checkbox" disabled class="rounded" /><span>$1</span></li>')
    // Paragraphs (blank lines)
    .replace(/\n\n/g, '</p><p class="mb-3">')
    // Line breaks
    .replace(/\n/g, '<br />');
}

export function DocumentEditor({ node, className }: DocumentEditorProps) {
  const { updateNode, fetchNode } = useDocuments();
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [preview, setPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  // Load node content when selection changes
  useEffect(() => {
    if (!node || node.tipo === "FOLDER") {
      setContent("");
      setLoaded(false);
      return;
    }
    setLoaded(false);
    fetchNode(node.id).then((full) => {
      const c = full.contenuto ?? "";
      setContent(c);
      lastSavedRef.current = c;
      setLoaded(true);
    });
  }, [node?.id]);

  // Auto-save with 1.5s debounce
  const save = useCallback(
    async (text: string) => {
      if (!node || node.tipo === "FOLDER") return;
      if (text === lastSavedRef.current) return;
      setSaveStatus("saving");
      try {
        await updateNode.mutateAsync({ id: node.id, data: { contenuto: text } });
        lastSavedRef.current = text;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    },
    [node, updateNode]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setContent(v);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => save(v), 1500);
  };

  // Toolbar action: wrap selection or insert at cursor
  const insertMarkdown = (before: string, after: string = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e);
    const newVal = value.slice(0, s) + before + selected + after + value.slice(e);
    setContent(newVal);
    // Restore cursor
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, e + before.length);
    }, 0);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => save(newVal), 1500);
  };

  const insertLine = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, value } = ta;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const newVal = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    setContent(newVal);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + prefix.length, s + prefix.length);
    }, 0);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => save(newVal), 1500);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b") { e.preventDefault(); insertMarkdown("**", "**"); }
      if (e.key === "i") { e.preventDefault(); insertMarkdown("*", "*"); }
      if (e.key === "s") { e.preventDefault(); save(content); }
      if (e.key === "p") { e.preventDefault(); setPreview((v) => !v); }
    }
    // Tab = 2 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      insertMarkdown("  ");
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  // Empty state
  if (!node) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full opacity-20 gap-4", className)}>
        <FileText size={64} strokeWidth={1} />
        <p className="text-sm font-black uppercase tracking-[0.3em]">Seleziona un file</p>
        <p className="text-xs font-medium tracking-widest uppercase">per iniziare a scrivere</p>
      </div>
    );
  }

  // Folder state
  if (node.tipo === "FOLDER") {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full opacity-20 gap-4", className)}>
        <Folder size={64} strokeWidth={1} />
        <p className="text-sm font-black uppercase tracking-[0.3em]">{node.nome}</p>
        <p className="text-xs font-medium tracking-widest uppercase">Seleziona un file nella cartella</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/20 bg-card/30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">{node.icona || "📄"}</span>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-foreground leading-none mb-0.5">
              {node.nome}
            </h2>
            <p className="text-[10px] text-muted-foreground/50 font-medium">
              Modificato {format(new Date(node.updated_at), "d MMM yyyy, HH:mm", { locale: it })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save status */}
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-muted-foreground/50">
                <Clock size={10} className="animate-spin" /> Salvataggio...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-emerald-400/80">
                <CheckCircle2 size={10} /> Salvato
              </span>
            )}
          </div>

          {/* Preview toggle */}
          <button
            onClick={() => setPreview((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              preview
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
            title="Ctrl+P"
          >
            {preview ? <EyeOff size={12} /> : <Eye size={12} />}
            {preview ? "Editor" : "Preview"}
          </button>

          {/* Manual save */}
          <button
            onClick={() => save(content)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/90 text-white hover:bg-primary text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20"
            title="Ctrl+S"
          >
            <Save size={12} /> Salva
          </button>
        </div>
      </div>

      {/* Formatting toolbar */}
      {!preview && (
        <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border/10 bg-muted/5 shrink-0 flex-wrap">
          {[
            { icon: <Heading1 size={14} />, title: "Titolo H1 (# )", action: () => insertLine("# ") },
            { icon: <Heading2 size={14} />, title: "Titolo H2 (## )", action: () => insertLine("## ") },
            { icon: <Bold size={14} />, title: "Grassetto (Ctrl+B)", action: () => insertMarkdown("**", "**") },
            { icon: <Italic size={14} />, title: "Corsivo (Ctrl+I)", action: () => insertMarkdown("*", "*") },
            { icon: <Code size={14} />, title: "Codice inline", action: () => insertMarkdown("`", "`") },
            { icon: <List size={14} />, title: "Lista puntata", action: () => insertLine("- ") },
            { icon: <ListOrdered size={14} />, title: "Lista numerata", action: () => insertLine("1. ") },
            { icon: <Minus size={14} />, title: "Separatore (---)", action: () => insertLine("---") },
          ].map((btn, i) => (
            <button
              key={i}
              title={btn.title}
              onClick={btn.action}
              className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.06] transition-colors"
            >
              {btn.icon}
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative">
        {!loaded ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : preview ? (
          <div
            className="h-full overflow-y-auto px-8 py-8 prose prose-invert prose-sm max-w-none custom-scrollbar text-foreground/90 leading-relaxed text-[14px]"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                content
                  ? `<p class="mb-3">${markdownToHtml(content)}</p>`
                  : '<p class="text-muted-foreground/30 italic text-sm">Nessun contenuto da visualizzare. Inizia a scrivere nell\'editor.</p>',
                { USE_PROFILES: { html: true } }
              ),
            }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Inizia a scrivere... (supporta Markdown)"
            className={cn(
              "w-full h-full resize-none bg-transparent border-0 outline-none px-8 py-6",
              "text-[14px] leading-7 font-mono text-foreground/90 placeholder:text-muted-foreground/20",
              "focus:outline-none focus:ring-0 custom-scrollbar"
            )}
            spellCheck={false}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-6 py-1.5 border-t border-border/10 bg-muted/5 shrink-0">
        <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
          <span>{wordCount} parole</span>
          <span>{charCount} caratteri</span>
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/25">
          Markdown · Enter per invio · Ctrl+S per salvare
        </div>
      </div>
    </div>
  );
}
