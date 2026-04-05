import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  BookOpen, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Search,
  FileText,
  FolderOpen
} from "lucide-react";
import { useWiki } from "@/hooks/useWiki";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface WikiSidebarProps {
  onNewArticle: () => void;
}

export function WikiSidebar({ onNewArticle }: WikiSidebarProps) {
  const { categories, articles } = useWiki();
  const location = useLocation();
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");

  const toggleCat = (id: string) => {
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const articleList = articles().data || [];
  
  const filteredCategories = categories.data?.filter(cat => 
    cat.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    articleList.some(art => art.categoria_id === cat.id && art.titolo.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  return (
    <div className="w-80 border-r border-border bg-card/30 flex flex-col h-full backdrop-blur-sm">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <BookOpen className="text-primary" size={24} />
            Wiki Aziendale
          </h2>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" size={16} />
          <Input 
            placeholder="Cerca nella Wiki..." 
            className="pl-10 bg-muted/50 border-border focus:ring-primary h-11 rounded-xl font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Button 
          onClick={onNewArticle}
          className="w-full justify-start gap-2 h-12 rounded-xl font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/5"
        >
          <Plus size={18} strokeWidth={3} />
          Nuovo Articolo
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6 custom-scrollbar">
        <div className="space-y-1">
          {filteredCategories.map(cat => {
            const isExpanded = expandedCats[cat.id];
            const catArticles = articleList.filter(a => a.categoria_id === cat.id);
            
            if (searchTerm && catArticles.length === 0 && !cat.nome.toLowerCase().includes(searchTerm.toLowerCase())) return null;

            return (
              <div key={cat.id} className="space-y-1">
                <button
                  onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-white transition-all group"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <FolderOpen size={18} className={cn("transition-colors", isExpanded ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-black uppercase tracking-widest truncate flex-1 text-left">
                    {cat.nome}
                  </span>
                  <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                    {catArticles.length}
                  </span>
                </button>

                {(isExpanded || searchTerm) && (
                  <div className="ml-9 space-y-1 pr-2">
                    {catArticles
                      .filter(art => !searchTerm || art.titolo.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(art => (
                      <Link
                        key={art.id}
                        to={`/wiki?id=${art.id}`}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all group/link",
                          new URLSearchParams(location.search).get("id") === art.id
                            ? "bg-primary/10 text-primary shadow-sm"
                            : "text-muted-foreground hover:text-white hover:bg-muted/30"
                        )}
                      >
                        <FileText size={14} className="opacity-50 group-hover/link:opacity-100" />
                        <span className="truncate">{art.titolo}</span>
                      </Link>
                    ))}
                    {catArticles.length === 0 && !searchTerm && (
                      <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground/50 italic uppercase tracking-tighter">
                        Nessun articolo
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {categories.isLoading && (
            <div className="space-y-4 p-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-4 bg-muted/50 rounded-full animate-pulse" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
