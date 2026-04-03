import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { CategoriaFornitore } from "@/types";
import { 
  Plus, Edit2, Trash2, Tag, 
  ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function SupplierCategoryManager() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Partial<CategoriaFornitore> | null>(null);

  // Queries
  const { data: categorie = [], isLoading } = useQuery<CategoriaFornitore[]>({
    queryKey: ["categorie-fornitori"],
    queryFn: async () => {
      const { data } = await api.get("/categorie-fornitori");
      return data;
    },
  });

  // Mutations
  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<CategoriaFornitore>) => {
      if (data.id) {
        return api.patch(`/categorie-fornitori/${data.id}`, data);
      }
      return api.post("/categorie-fornitori", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorie-fornitori"] });
      setIsModalOpen(false);
      toast.success("Categoria salvata");
    },
    onError: () => {
      toast.error("Errore durante il salvataggio");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/categorie-fornitori/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorie-fornitori"] });
      toast.success("Categoria eliminata");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Errore durante l'eliminazione");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCat) {
      upsertMutation.mutate(selectedCat);
    }
  };

  const openEdit = (c: CategoriaFornitore) => {
    setSelectedCat(c);
    setIsModalOpen(true);
  };

  const openCreate = () => {
    setSelectedCat({ nome: "", colore: "#3b82f6" });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/fornitori")}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestione Categorie Fornitori</h1>
          <p className="text-muted-foreground text-sm">Personalizza le etichette per organizzare i tuoi fornitori.</p>
        </div>
      </div>

      <div className="bg-card/30 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-primary">
            <Tag className="w-5 h-5" />
            <span className="font-semibold">{categorie.length} Categorie Configurate</span>
          </div>
          <Button onClick={openCreate} className="bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30">
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi Categoria
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
            ))
          ) : categorie.map((cat) => (
            <div 
              key={cat.id} 
              className="group relative flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-primary/30 transition-all hover:bg-white/10"
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: `${cat.colore}20`, border: `1px solid ${cat.colore}40` }}
                >
                  <Tag className="w-5 h-5" style={{ color: cat.colore }} />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-lg text-white/90">{cat.nome}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.colore }} />
                    <span className="text-[10px] text-muted-foreground font-mono tracking-tighter uppercase">{cat.colore}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/20 hover:text-primary" onClick={() => openEdit(cat)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Eliminare la categoria "${cat.nome}"? I fornitori associati resteranno senza categoria.`)) {
                      deleteMutation.mutate(cat.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {categorie.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-white/5 rounded-xl">
            Nessuna categoria personalizzata. Aggiungine una per iniziare.
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[400px] bg-[#0f172a] border-white/10">
          <DialogHeader>
            <DialogTitle>{selectedCat?.id ? "Modifica Categoria" : "Nuova Categoria"}</DialogTitle>
            <DialogDescription>Definisci il nome e il colore identificativo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Categoria</Label>
                <Input 
                  value={selectedCat?.nome || ""} 
                  onChange={e => setSelectedCat(prev => ({ ...prev!, nome: e.target.value }))}
                  placeholder="Es: Software, Marketing, Utilities..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Colore</Label>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl shadow-inner border border-white/10"
                    style={{ backgroundColor: selectedCat?.colore }}
                  />
                  <Input 
                    type="color" 
                    className="h-12 flex-1 cursor-pointer bg-transparent border-white/10"
                    value={selectedCat?.colore || "#3b82f6"}
                    onChange={e => setSelectedCat(prev => ({ ...prev!, colore: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Salvataggio..." : "Salva Categoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
