import { 
  FileText, 
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
  LayoutGrid
} from "lucide-react";
import { useWiki } from "@/hooks/useWiki";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

export function WikiHome() {
  const { categories, articles } = useWiki();
  
  const allArticles = articles().data || [];
  const recentArticles = [...allArticles]
    .sort((a, b) => new Date(b.ultimo_aggiornamento).getTime() - new Date(a.ultimo_aggiornamento).getTime())
    .slice(0, 5);
  
  const popularArticles = [...allArticles]
    .sort((a, b) => b.visualizzazioni - a.visualizzazioni)
    .slice(0, 5);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-background">
      <div className="max-w-5xl mx-auto p-12 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Hero Section */}
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest mb-4">
            <Sparkles size={14} />
            Knowledge Base Interna
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-white">
            Benvenuto nella Wiki di <span className="text-primary italic">Bite Digital</span>
          </h1>
          <p className="text-muted-foreground text-xl max-w-2xl mx-auto font-medium">
            Tutto il sapere aziendale in un unico posto. Procedure, guide e policy per lavorare al meglio.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.data?.map(cat => (
            <Card key={cat.id} className="bg-card/50 border-border hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer group rounded-3xl overflow-hidden shadow-xl hover:scale-[1.02]">
              <CardHeader className="p-6">
                <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                   <LayoutGrid size={24} />
                </div>
                <CardTitle className="text-xl font-black text-white group-hover:text-primary transition-colors">{cat.nome}</CardTitle>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  {allArticles.filter(a => a.categoria_id === cat.id).length} Articoli
                </p>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Recent Articles */}
          <div className="space-y-6">
            <h3 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <Clock className="text-primary" />
              Ultimi Aggiornamenti
            </h3>
            <div className="space-y-4">
              {recentArticles.map(art => (
                <Link 
                  key={art.id} 
                  to={`/wiki?id=${art.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-card/40 border border-border hover:bg-muted/50 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-primary transition-colors">{art.titolo}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {formatDistanceToNow(new Date(art.ultimo_aggiornamento), { addSuffix: true, locale: it })}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
              {recentArticles.length === 0 && (
                <div className="p-8 text-center text-muted-foreground font-bold italic bg-muted/20 rounded-2xl border border-border/50">
                   Nessun articolo recente
                </div>
              )}
            </div>
          </div>

          {/* Popular Articles */}
          <div className="space-y-6">
            <h3 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <TrendingUp className="text-primary" />
              Articoli Più Letti
            </h3>
            <div className="space-y-4">
              {popularArticles.map(art => (
                <Link 
                  key={art.id} 
                  to={`/wiki?id=${art.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-card/40 border border-border hover:bg-muted/50 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-primary transition-colors">{art.titolo}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {art.visualizzazioni} visualizzazioni
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
              {popularArticles.length === 0 && (
                <div className="p-8 text-center text-muted-foreground font-bold italic bg-muted/20 rounded-2xl border border-border/50">
                   Nessun articolo popolare
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
