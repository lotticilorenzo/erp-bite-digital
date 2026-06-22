import React from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Filter,
  Download,
  Plus,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFattureAttive, useFatturePassive, useDeleteFattura } from "@/hooks/useFatture";
import { FattureTable } from "@/components/finance/FattureTable";
import { Skeleton } from "@/components/ui/skeleton";
import { FatturaDetailDialog } from "@/components/finance/FatturaDetailDialog";
import { FatturaModal } from "@/components/finance/FatturaModal";
import { toast } from "sonner";
import { ImputazioneCostiDrawer } from "@/components/finance/ImputazioneCostiDrawer";
import { useSearchParams } from "react-router-dom";

export default function Fatture() {
  const { data: attive, isLoading: loadingA } = useFattureAttive();
  const { data: passive, isLoading: loadingP } = useFatturePassive();
  const deleteFattura = useDeleteFattura();

  const [searchParams] = useSearchParams();
  const fornitoreIdParam = searchParams.get("fornitore_id");
  const typeParam = searchParams.get("type") as "attive" | "passive" | null;

  const [selectedFattura, setSelectedFattura] = React.useState<any>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"attive" | "passive">(typeParam || "attive");
  const [imputaFattura, setImputaFattura] = React.useState<any>(null);
  const [meseFilter, setMeseFilter] = React.useState<string | null>(null);
  const [fornitoreFilter, setFornitoreFilter] = React.useState<string | null>(fornitoreIdParam);

  React.useEffect(() => {
    if (typeParam) setActiveTab(typeParam);
    if (fornitoreIdParam) setFornitoreFilter(fornitoreIdParam);
  }, [typeParam, fornitoreIdParam]);

  const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

  const applyFilters = React.useCallback((list: any[] | undefined) => {
    let filtered = list || [];
    if (meseFilter) {
      const [year, month] = meseFilter.split("-").map(Number);
      filtered = filtered.filter((f) => {
        if (!f.data_emissione) return false;
        const d = new Date(f.data_emissione);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
    }
    if (fornitoreFilter) {
      filtered = filtered.filter((f) => f.fornitore_id === fornitoreFilter);
    }
    return filtered;
  }, [meseFilter, fornitoreFilter]);

  const handleExportCsv = (tab: "attive" | "passive") => {
    const data = tab === "attive" ? attive : passive;
    if (!data?.length) { toast.error("Nessun dato da esportare"); return; }
    const headers = ["Numero","Cliente/Fornitore","Data Emissione","Data Scadenza","Imponibile","IVA","Totale","Stato"];
    const rows = data.map((f) => [
      f.numero || "",
      f.cliente?.ragione_sociale || f.fornitore?.ragione_sociale || f.fornitore_nome || "",
      f.data_emissione || "",
      f.data_scadenza || "",
      f.importo_netto || 0,
      f.importo_iva || 0,
      f.importo_totale || 0,
      f.stato_pagamento || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fatture-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV esportato con successo");
  };

  const handleAction = async (fattura: any, action: "view" | "edit" | "delete" | "imputa", type: "attive" | "passive") => {
    if (action === "imputa") {
      setImputaFattura(fattura);
      return;
    }
    switch (action) {
      case "view":
        setSelectedFattura(fattura);
        setActiveTab(type);
        setDetailOpen(true);
        break;
      case "edit":
        setSelectedFattura(fattura);
        setActiveTab(type);
        setEditOpen(true);
        break;
      case "delete":
        if (confirm(`Sei sicuro di voler eliminare la fattura ${fattura.numero}? L'operazione non può essere annullata.`)) {
          try {
            await deleteFattura.mutateAsync({ id: fattura.id, type });
            toast.success("Fattura eliminata con successo");
          } catch (e) {
            toast.error("Errore durante l'eliminazione");
          }
        }
        break;
    }
  };

  const stats = React.useMemo(() => {
    const totalA = attive?.reduce((acc, f) => acc + Number(f.importo_totale), 0) || 0;
    const unpaidA = attive?.filter(f => f.stato_pagamento.toLowerCase() === "attesa")
                           .reduce((acc, f) => acc + Number(f.importo_residuo), 0) || 0;
    const totalP = passive?.reduce((acc, f) => acc + Number(f.importo_totale), 0) || 0;

    return { totalA, unpaidA, totalP };
  }, [attive, passive]);

  if (loadingA || loadingP) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48 rounded-xl bg-muted/20" />
          <Skeleton className="h-10 w-32 rounded-xl bg-muted/20" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-3xl bg-muted/10" />)}
        </div>
        <Skeleton className="h-[400px] rounded-3xl bg-muted/5" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
            Amministrazione <span className="text-primary not-italic">&</span> Finanza
          </h1>
          <p className="text-[#475569] text-xs font-bold uppercase tracking-[0.2em] mt-1">Gestione flussi di cassa e fatturazione</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 bg-card/50 border-border text-muted-foreground hover:text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest">
                <Download className="h-4 w-4" />
                Esporta
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-card/95 backdrop-blur-xl border-border/50 rounded-xl p-1">
              <DropdownMenuItem onClick={() => handleExportCsv("attive")} className="text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                Fatture Attive (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportCsv("passive")} className="text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                Fatture Passive (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            className="h-10 bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
            onClick={() => {
              setSelectedFattura(null);
              setEditOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nuova Fattura
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card/40 border-border/50 rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500/50 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-[#475569] flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              Fatturato Attivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(stats.totalA)}
            </div>
            <p className="text-[10px] font-bold text-[#475569] uppercase mt-1">{attive?.length || 0} fatture totali</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500/50 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-[#475569] flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Da Incassare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(stats.unpaidA)}
            </div>
            <p className="text-[10px] font-bold text-[#475569] uppercase mt-1">{attive?.filter(f => f.stato_pagamento.toLowerCase() === 'attesa').length || 0} fatture in attesa</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-500/50 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-[#475569] flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              Fatture Passive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(stats.totalP)}
            </div>
            <p className="text-[10px] font-bold text-red-500 uppercase mt-1">Costi operativi correnti</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-background/50 border-border/50 rounded-3xl overflow-hidden shadow-2xl">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "attive" | "passive")} className="w-full">
          <div className="px-8 pt-6 pb-2 border-b border-border/50 bg-card/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TabsList className="bg-background/80 border border-border/50 p-1 h-11 rounded-xl">
              <TabsTrigger 
                value="attive" 
                className="rounded-lg px-6 data-[state=active]:bg-primary data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest transition-all duration-300"
              >
                Fatture Attive
              </TabsTrigger>
              <TabsTrigger 
                value="passive" 
                className="rounded-lg px-6 data-[state=active]:bg-primary data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest transition-all duration-300"
              >
                Fatture Passive
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-[#475569] hover:text-white gap-2">
                    <Filter className="h-3.5 w-3.5" />
                    {meseFilter
                      ? `${MESI[Number(meseFilter.split("-")[1]) - 1]} ${meseFilter.split("-")[0]}`
                      : "Filtra per Mese"}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-card/95 backdrop-blur-xl border-border/50 rounded-xl p-1 max-h-64 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setMeseFilter(null)} className="text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                    Tutti i mesi
                  </DropdownMenuItem>
                  {Array.from({ length: 12 }, (_, i) => {
                    const now = new Date();
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    return (
                      <DropdownMenuItem key={val} onClick={() => setMeseFilter(val)} className="text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                        {MESI[d.getMonth()]} {d.getFullYear()}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <CardContent className="p-0">
            <TabsContent value="attive" className="m-0 focus-visible:ring-0">
              <FattureTable data={applyFilters(attive)} type="attive" onAction={(f, a) => handleAction(f, a, "attive")} />
            </TabsContent>
            <TabsContent value="passive" className="m-0 focus-visible:ring-0">
              <FattureTable data={applyFilters(passive)} type="passive" onAction={(f, a) => handleAction(f, a, "passive")} />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <FatturaDetailDialog 
        fattura={selectedFattura}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        type={activeTab}
      />
      <FatturaModal
        open={editOpen}
        onOpenChange={setEditOpen}
        type={activeTab}
        fattura={selectedFattura}
      />
      {imputaFattura && (
        <ImputazioneCostiDrawer
          open={!!imputaFattura}
          onClose={() => setImputaFattura(null)}
          sourceType="fattura_passiva"
          sourceId={imputaFattura.id}
          importoTotale={Number(imputaFattura.importo_totale)}
          sourceLabel={`Fattura ${imputaFattura.numero ?? ""} — ${imputaFattura.fornitore_nome ?? ""}`}
        />
      )}
    </div>
  );
}
