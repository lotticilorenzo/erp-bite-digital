import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Fornitore, CategoriaFornitore } from "@/types";
import { 
  Phone, Mail, Tag, Filter, MoreHorizontal,
  Building, FileText, Plus, Search, Edit2, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Fornitori() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFornitore, setSelectedFornitore] = useState<Partial<Fornitore> | null>(null);

  // Queries
  const { data: fornitori = [], isLoading } = useQuery<Fornitore[]>({
    queryKey: ["fornitori"],
    queryFn: async () => {
      const { data } = await api.get("/fornitori-full");
      return data;
    },
  });

  const { data: categorie = [] } = useQuery<CategoriaFornitore[]>({
    queryKey: ["categorie-fornitori"],
    queryFn: async () => {
      const { data } = await api.get("/categorie-fornitori");
      return data;
    },
  });

  // Mutations
  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<Fornitore>) => {
      if (data.id) {
        return api.patch(`/fornitori/${data.id}`, data);
      }
      return api.post("/fornitori", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornitori"] });
      setIsModalOpen(false);
      toast.success(selectedFornitore?.id ? "Fornitore aggiornato" : "Fornitore creato");
    },
    onError: () => {
      toast.error("Errore durante il salvataggio");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/fornitori/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornitori"] });
      toast.success("Fornitore eliminato");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Errore durante l'eliminazione");
    }
  });

  const filteredFornitori = fornitori.filter(f => 
    f.ragione_sociale.toLowerCase().includes(search.toLowerCase()) ||
    f.piva?.includes(search) ||
    f.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFornitore) {
      upsertMutation.mutate(selectedFornitore);
    }
  };

  const openEdit = (f: Fornitore) => {
    setSelectedFornitore(f);
    setIsModalOpen(true);
  };

  const openCreate = () => {
    setSelectedFornitore({ ragione_sociale: "", attivo: true });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Fornitori
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestisci l'elenco dei fornitori e le loro categorie.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/categorie-fornitori")}>
            <Tag className="w-4 h-4 mr-2" />
            Gestione Categorie
          </Button>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 shadow-lg shadow-[0_0_20px_hsl(var(--primary)/0.2)]">
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Fornitore
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cerca fornitore, P.IVA o email..." 
            className="pl-9 bg-background/50 border-white/10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      <div className="rounded-xl border border-white/5 bg-card/30 overflow-hidden backdrop-blur-md">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow>
              <TableHead>Nome Fornitore</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Contatti</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="text-right">Spesa Totale</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <div className="h-12 w-full animate-pulse bg-white/5 rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredFornitori.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Nessun fornitore trovato.
                </TableCell>
              </TableRow>
            ) : (
              filteredFornitori.map((f) => (
                <TableRow key={f.id} className="group hover:bg-white/5 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{f.ragione_sociale}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{f.piva || "P.IVA non inserita"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {f.categoria_rel ? (
                      <Badge 
                        variant="outline" 
                        className="font-normal border-opacity-50"
                        style={{ 
                          backgroundColor: `${f.categoria_rel.colore}15`, 
                          borderColor: `${f.categoria_rel.colore}50`,
                          color: f.categoria_rel.colore
                        }}
                      >
                        {f.categoria_rel.nome}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">{f.categoria || "-"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {f.email && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Mail className="w-3 h-3 mr-1.5 opacity-50" />
                          {f.email}
                        </div>
                      )}
                      {f.telefono && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Phone className="w-3 h-3 mr-1.5 opacity-50" />
                          {f.telefono}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {f.attivo ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-normal">
                        Attivo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20 font-normal">
                        Inattivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-sm">€{(f.spesa_totale || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-muted-foreground">{f.num_fatture} fatture</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openEdit(f)}>
                          <Edit2 className="w-4 h-4 mr-2" /> Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/finanza/fatture?fornitore=${f.id}`)}>
                          <FileText className="w-4 h-4 mr-2" /> Vedi Fatture
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (confirm("Eliminare definitivamente questo fornitore?")) {
                              deleteMutation.mutate(f.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal CRUD */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-white/10 bg-card backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>
              {selectedFornitore?.id ? "Modifica Fornitore" : "Nuovo Fornitore"}
            </DialogTitle>
            <DialogDescription>
              Inserisci i dati principali del fornitore.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Ragione Sociale <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    value={selectedFornitore?.ragione_sociale || ""}
                    onChange={(e) => setSelectedFornitore(prev => ({ ...prev!, ragione_sociale: e.target.value }))}
                    className="pl-10"
                    placeholder="Nome azienda o professionista"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>P.IVA / CF</Label>
                  <Input 
                    value={selectedFornitore?.piva || ""}
                    onChange={(e) => setSelectedFornitore(prev => ({ ...prev!, piva: e.target.value }))}
                    placeholder="IT01234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select 
                    value={selectedFornitore?.categoria_id || "none"}
                    onValueChange={(val) => setSelectedFornitore(prev => ({ ...prev!, categoria_id: val === "none" ? undefined : val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Senza categoria</SelectItem>
                      {categorie.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: c.colore }} />
                            {c.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      type="email"
                      value={selectedFornitore?.email || ""}
                      onChange={(e) => setSelectedFornitore(prev => ({ ...prev!, email: e.target.value }))}
                      className="pl-10"
                      placeholder="info@fornitore.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Telefono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      value={selectedFornitore?.telefono || ""}
                      onChange={(e) => setSelectedFornitore(prev => ({ ...prev!, telefono: e.target.value }))}
                      className="pl-10"
                      placeholder="+39 012 345678"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Note</Label>
                <Input 
                  value={selectedFornitore?.note || ""}
                  onChange={(e) => setSelectedFornitore(prev => ({ ...prev!, note: e.target.value }))}
                  placeholder="Eventuali note interne..."
                />
              </div>
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Salvataggio..." : (selectedFornitore?.id ? "Salva Modifiche" : "Crea Fornitore")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
