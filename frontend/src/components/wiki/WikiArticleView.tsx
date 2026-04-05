import { useSearchParams } from "react-router-dom";
import { useWiki } from "@/hooks/useWiki";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Edit2, Eye, Calendar, User, ChevronRight, Share2, Trash2 } from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import { format } from "date-fns";
import { it } from 'date-fns/locale';
import { toast } from "sonner";

interface WikiArticleViewProps {
  onEdit: (id: string) => void;
}

export function WikiArticleView({ onEdit }: WikiArticleViewProps) {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const { getArticle, deleteArticle } = useWiki();
  const { data: article, isLoading } = getArticle(id || "");
  const { user } = useAuth();
  
  const canEdit = user?.ruolo === 'ADMIN' || user?.ruolo === 'PM';

  const handleDelete = async () => {
    if (!id || !confirm("Sei sicuro di voler eliminare questo articolo?")) return;
    try {
      await deleteArticle.mutateAsync(id);
      toast.success("Articolo eliminato");
      window.location.href = "/wiki";
    } catch (error) {
      toast.error("Errore durante l'eliminazione");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-12 space-y-8 animate-pulse">
        <div className="h-12 w-2/3 bg-muted rounded-2xl" />
        <div className="h-6 w-1/3 bg-muted rounded-lg" />
        <div className="space-y-4">
          <div className="h-4 w-full bg-muted rounded-md" />
          <div className="h-4 w-full bg-muted rounded-md" />
          <div className="h-4 w-3/4 bg-muted rounded-md" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground font-bold italic">
        Seleziona un articolo dalla barra laterale per iniziare a leggere.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-background">
      <div className="max-w-4xl mx-auto p-12 pt-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
        
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-4 mb-8">
          <span className="hover:text-primary transition-colors cursor-pointer">Wiki</span>
          <ChevronRight size={12} />
          <span className="hover:text-primary transition-colors cursor-pointer">{article.categoria?.nome}</span>
          <ChevronRight size={12} />
          <span className="text-white truncate max-w-[200px]">{article.titolo}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-5xl font-black tracking-tighter text-white leading-tight">
              {article.titolo}
            </h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="rounded-xl border-border hover:bg-muted text-muted-foreground hover:text-white">
                <Share2 size={18} />
              </Button>
              {canEdit && (
                <>
                  <Button 
                    onClick={() => onEdit(article.id)}
                    className="gap-2 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                  >
                    <Edit2 size={18} />
                    Modifica
                  </Button>
                  <Button 
                    onClick={handleDelete}
                    variant="ghost" 
                    size="icon" 
                    className="rounded-xl text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={18} />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground font-medium border-y border-border/30 py-4">
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-full border border-border/50">
              <User size={16} className="text-primary" />
              <span className="text-white font-bold">{article.autore_nome}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              Aggiornato il {format(new Date(article.ultimo_aggiornamento), "d MMMM yyyy", { locale: it })}
            </div>
            <div className="flex items-center gap-2">
              <Eye size={16} />
              {article.visualizzazioni} visualizzazioni
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-p:text-muted-foreground prose-headings:text-white prose-headings:font-black prose-a:text-primary max-w-none pt-4 bg-card/10 p-8 rounded-3xl border border-border/20 shadow-inner min-h-[400px]">
          <MDEditor.Markdown source={article.contenuto || "*Nessun contenuto*"} className="bg-transparent text-lg leading-relaxed font-medium" />
        </div>

        {/* Footer info */}
        <div className="pt-12 border-t border-border/30 text-center text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50">
          Fine dell'articolo &bull; Bite Digital Operations
        </div>
      </div>
    </div>
  );
}
