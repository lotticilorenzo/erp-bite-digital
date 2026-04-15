import React, { useState } from "react";
import { usePreventivi, usePreventivoMutations } from "@/hooks/usePreventivi";
import { PreventiviTable } from "@/components/preventivi/PreventiviTable";
import { PreventivoModal } from "@/components/preventivi/PreventivoModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, Search, Filter, FileText, 
  ArrowRight, Loader2, TrendingUp,
  FileCheck2, FileWarning
} from "lucide-react";
import type { Preventivo, PreventivoStatus } from "@/types/preventivi";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const PreventiviPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: preventivi, isLoading } = usePreventivi();
  const { updatePreventivo, deletePreventivo, convertToCommessa } = usePreventivoMutations();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPreventivo, setSelectedPreventivo] = useState<Preventivo | undefined>();

  const handleEdit = (p: Preventivo) => {
    setSelectedPreventivo(p);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedPreventivo(undefined);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo preventivo?")) {
      await deletePreventivo.mutateAsync(id);
      toast.success("Preventivo eliminato");
    }
  };

  const handleStatusChange = async (id: string, status: PreventivoStatus) => {
    await updatePreventivo.mutateAsync({ id, payload: { stato: status } });
    toast.success("Stato preventivo aggiornato");
  };

  const handleConvert = async (id: string) => {
    try {
      const result = await convertToCommessa.mutateAsync(id);
      toast.success(result.message);
      navigate(`/commesse/${result.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Errore durante la conversione");
    }
  };

  const filteredData = preventivi?.filter(p => 
    p.titolo.toLowerCase().includes(search.toLowerCase()) || 
    p.numero.toLowerCase().includes(search.toLowerCase()) ||
    p.cliente?.ragione_sociale.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const stats = {
    totale: preventivi?.reduce((acc, p) => acc + p.importo_totale, 0) || 0,
    accettati: preventivi?.filter(p => p.stato === 'ACCETTATO').length || 0,
    inviati: preventivi?.filter(p => p.stato === 'INVIATO').length || 0,
    bozze: preventivi?.filter(p => p.stato === 'BOZZA').length || 0,
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto p-8 space-y-8 animate-in fade-in duration-500 bg-background text-foreground">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3 italic uppercase">
            <FileText className="w-8 h-8 text-primary" />
            VENDITE: Preventivi
          </h1>
          <p className="text-muted-foreground font-medium">Gestisci le offerte commerciali e convertile in commesse operative.</p>
        </div>
        <Button 
          onClick={handleCreate} 
          className="h-10 px-6 text-sm font-black bg-primary text-white shadow-[0_0_20px_hsl(var(--primary)/0.2)] hover:bg-primary/90 hover:shadow-primary/30 rounded-xl active:scale-95 transition-all uppercase tracking-wide"
        >
          <Plus className="w-5 h-5 mr-2 stroke-[3]" /> Nuova Offerta
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex items-center gap-4 group hover:border-primary/50 transition-colors">
          <div className="bg-primary/10 p-3 rounded-xl text-primary">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Volume Preventivato</span>
            <span className="text-xl font-black text-foreground">
              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(stats.totale)}
            </span>
          </div>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-500">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Accettati</span>
            <span className="text-xl font-black text-emerald-400">{stats.accettati}</span>
          </div>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="bg-blue-500/10 p-3 rounded-xl text-blue-500">
            <ArrowRight className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">In Attesa</span>
            <span className="text-xl font-black text-blue-400">{stats.inviati}</span>
          </div>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="bg-muted p-3 rounded-xl text-muted-foreground">
            <FileWarning className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Bozze</span>
            <span className="text-xl font-black text-foreground">{stats.bozze}</span>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-3xl border border-border shadow-xl shadow-black/10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Cerca per titolo, numero o cliente..." 
              className="pl-10 h-10 rounded-xl bg-background border-border text-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-10 rounded-xl text-muted-foreground border-border hover:bg-muted">
              <Filter className="w-4 h-4 mr-2" /> Filtri Avanzati
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <span className="font-medium">Caricamento preventivi...</span>
          </div>
        ) : (
          <PreventiviTable 
            data={filteredData}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            onConvert={handleConvert}
          />
        )}
      </div>

      <PreventivoModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        preventivo={selectedPreventivo}
      />
    </div>
  );
};

export default PreventiviPage;
