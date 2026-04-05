import { useState, useEffect, useCallback } from "react";
import { useWiki } from "@/hooks/useWiki";
import { Button } from "@/components/ui/button";
import { 
  X, 
  Send, 
  Layout, 
  Type, 
  CheckCircle2, 
  CloudOff, 
  History
} from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface WikiArticleEditorProps {
  id?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export function WikiArticleEditor({ id, onClose, onSaved }: WikiArticleEditorProps) {
  const { categories, getArticle, createArticle, updateArticle } = useWiki();
  const { data: existingArticle } = getArticle(id || "");
  
  const [titolo, setTitolo] = useState("");
  const [contenuto, setContenuto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [pubblicato, setPubblicato] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (existingArticle) {
      setTitolo(existingArticle.titolo);
      setContenuto(existingArticle.contenuto || "");
      setCategoriaId(existingArticle.categoria_id);
      setPubblicato(existingArticle.pubblicato);
    }
  }, [existingArticle]);

  const handleSave = useCallback(async (isAuto = false) => {
    if (!titolo || !categoriaId) {
      if (!isAuto) toast.error("Titolo e categoria sono obbligatori");
      return;
    }

    setIsSaving(true);
    try {
      if (id) {
        await updateArticle.mutateAsync({ id, titolo, contenuto, categoria_id: categoriaId, pubblicato });
      } else {
        const res = await createArticle.mutateAsync({ titolo, contenuto, categoria_id: categoriaId, pubblicato });
        onSaved(res.id);
      }
      setLastSaved(new Date());
      if (!isAuto) toast.success("Articolo salvato con successo");
    } catch (error) {
      if (!isAuto) toast.error("Errore durante il salvataggio");
    } finally {
      setIsSaving(false);
    }
  }, [id, titolo, contenuto, categoriaId, pubblicato, createArticle, updateArticle, onSaved]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (titolo && categoriaId) {
        handleSave(true);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [titolo, categoriaId, handleSave]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background animate-in zoom-in-95 duration-300">
      
      {/* Header Bar */}
      <div className="h-20 border-b border-border/60 bg-card/40 flex items-center justify-between px-8 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-muted/50 rounded-2xl border border-border/50 text-muted-foreground hover:text-primary transition-colors">
            <Layout size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white leading-none">
              {id ? "Modifica Articolo" : "Nuovo Articolo Wiki"}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {isSaving ? (
                <span className="flex items-center gap-1 text-primary">
                  <CloudOff className="animate-spin" size={10} /> Salvataggio in corso...
                </span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 size={10} /> Salvato alle {lastSaved.toLocaleTimeString()}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <History size={10} /> Bozza non ancora salvata
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="rounded-xl font-bold border-border hover:bg-muted/80 h-11 px-6 text-muted-foreground hover:text-white"
          >
            <X size={18} className="mr-2" />
            Chiudi
          </Button>
          <Button 
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all h-11 px-8"
          >
            {isSaving ? (
              <span className="animate-pulse">Salvataggio...</span>
            ) : (
              <>
                <Send size={18} className="mr-2" />
                Pubblica Articolo
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Editor Side */}
        <div className="flex-1 overflow-y-auto p-12 lg:pr-6 custom-scrollbar space-y-10">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-card/30 p-8 rounded-[2rem] border border-border/40">
            <div className="space-y-3">
              <Label htmlFor="titolo" className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                Titolo dell'Articolo
              </Label>
              <div className="relative group">
                <Type size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="titolo"
                  value={titolo}
                  onChange={(e) => setTitolo(e.target.value)}
                  placeholder="Inserisci un titolo evocativo..."
                  className="bg-background/50 border-border/60 focus:ring-primary h-14 pl-12 rounded-2xl text-lg font-black text-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                Categoria Wiki
              </Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger className="bg-background/50 border-border/60 focus:ring-primary h-14 rounded-2xl text-base font-bold text-white px-6">
                  <SelectValue placeholder="Seleziona la destinazione..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border rounded-xl">
                  {categories.data?.map(cat => (
                    <SelectItem key={cat.id} value={cat.id} className="font-bold text-white py-3 cursor-pointer">
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Editor Container */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-2">
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Contenuto Markdown
                </Label>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stato di Pubblicazione:</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-black uppercase tracking-widest", pubblicato ? "text-emerald-500" : "text-amber-500")}>
                        {pubblicato ? "Pubblico" : "Bozza"}
                      </span>
                      <Switch checked={pubblicato} onCheckedChange={setPubblicato} />
                    </div>
                  </div>
                </div>
             </div>
             
             <div className="rounded-[2rem] overflow-hidden border border-border/40 bg-card/20 min-h-[600px] shadow-2xl" data-color-mode="dark">
                <MDEditor
                  value={contenuto}
                  onChange={(v) => setContenuto(v || "")}
                  height={600}
                  preview="live"
                  className="bg-transparent"
                  visibleDragbar={false}
                />
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
