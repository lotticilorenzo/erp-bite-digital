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
  Euro, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Filter,
  Download,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFattureAttive, useFatturePassive } from "@/hooks/useFatture";
import { FattureTable } from "@/components/finance/FattureTable";
import { Skeleton } from "@/components/ui/skeleton";

export default function Fatture() {
  const { data: attive, isLoading: loadingA } = useFattureAttive();
  const { data: passive, isLoading: loadingP } = useFatturePassive();

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
          <Skeleton className="h-10 w-48 rounded-xl bg-[#1e293b]/20" />
          <Skeleton className="h-10 w-32 rounded-xl bg-[#1e293b]/20" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-3xl bg-[#1e293b]/10" />)}
        </div>
        <Skeleton className="h-[400px] rounded-3xl bg-[#1e293b]/5" />
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
          <Button variant="outline" className="h-10 bg-[#0f172a]/50 border-[#1e293b] text-[#94a3b8] hover:text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest">
            <Download className="h-4 w-4" />
            Esporta
          </Button>
          <Button className="h-10 bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_rgba(124,58,237,0.3)]">
            <Plus className="h-4 w-4" />
            Nuova Fattura
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#0f172a]/40 border-[#1e293b]/50 rounded-3xl overflow-hidden relative group">
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
            <p className="text-[10px] font-bold text-emerald-500 uppercase mt-1">+12% rispetto al mese scorso</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0f172a]/40 border-[#1e293b]/50 rounded-3xl overflow-hidden relative group">
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

        <Card className="bg-[#0f172a]/40 border-[#1e293b]/50 rounded-3xl overflow-hidden relative group">
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

      <Card className="bg-[#020617]/50 border-[#1e293b]/50 rounded-3xl overflow-hidden shadow-2xl">
        <Tabs defaultValue="attive" className="w-full">
          <div className="px-8 pt-6 pb-2 border-b border-[#1e293b]/50 bg-[#0f172a]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TabsList className="bg-[#020617]/80 border border-[#1e293b]/50 p-1 h-11 rounded-xl">
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
              <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-[#475569] hover:text-white gap-2">
                <Filter className="h-3.5 w-3.5" />
                Filtra per Mese
              </Button>
            </div>
          </div>

          <CardContent className="p-0">
            <TabsContent value="attive" className="m-0 focus-visible:ring-0">
              <FattureTable data={attive || []} type="attive" />
            </TabsContent>
            <TabsContent value="passive" className="m-0 focus-visible:ring-0">
              <FattureTable data={passive || []} type="passive" />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
