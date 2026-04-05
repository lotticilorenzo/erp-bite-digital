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
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-purple-600" />
            VENDITE: Preventivi
          </h1>
          <p className="text-slate-500 font-medium">Gestisci le offerte commerciali e convertile in commesse operative.</p>
        </div>
        <Button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-700 h-11 px-6 shadow-lg shadow-purple-200">
          <Plus className="w-5 h-5 mr-2" /> Nuova Offerta
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Volume Preventivato</span>
            <span className="text-xl font-black text-slate-800">
              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(stats.totale)}
            </span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Accettati</span>
            <span className="text-xl font-black text-emerald-700">{stats.accettati}</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
            <ArrowRight className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">In Attesa</span>
            <span className="text-xl font-black text-blue-700">{stats.inviati}</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-slate-100 p-3 rounded-xl text-slate-600">
            <FileWarning className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Bozze</span>
            <span className="text-xl font-black text-slate-700">{stats.bozze}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl shadow-slate-100/50 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Cerca per titolo, numero o cliente..." 
              className="pl-10 h-10 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-10 rounded-xl text-slate-500">
              <Filter className="w-4 h-4 mr-2" /> Filtri Avanzati
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
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
