import { useState, useMemo, useRef } from "react";
import {
  Download,
  ArrowRightLeft,
  Calendar,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMovimentiCassa } from "@/hooks/useCassa";
import { CassaDashboard } from "@/components/finance/CassaDashboard";
import { MovimentiTable } from "@/components/finance/MovimentiTable";
import { ImputazioneCostiDrawer } from "@/components/finance/ImputazioneCostiDrawer";
import { RiconciliazioneDrawer } from "@/components/finance/RiconciliazioneDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Cassa() {
  const { data: movimenti, isLoading } = useMovimentiCassa();
  const [imputaMovimento, setImputaMovimento] = useState<any>(null);
  const [riconciliaMovimento, setRiconciliaMovimento] = useState<any>(null);
  const [giorniFilter, setGiorniFilter] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const filteredMovimenti = useMemo(() => {
    let list = movimenti || [];
    if (giorniFilter) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - giorniFilter);
      list = list.filter((m: any) => m.data_valuta && new Date(m.data_valuta) >= cutoff);
    }
    return list;
  }, [movimenti, giorniFilter]);

  const displayedMovimenti = useMemo(
    () => (showAll ? filteredMovimenti : filteredMovimenti.slice(0, 20)),
    [filteredMovimenti, showAll]
  );

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".ofx") && !file.name.endsWith(".qif")) {
      toast.error("Formato non supportato. Usa CSV, OFX o QIF.");
      return;
    }
    toast.info(`Importazione di "${file.name}" — funzionalità in arrivo. Contatta il team tecnico.`);
    if (importRef.current) importRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-48 rounded-xl bg-muted/20" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-3xl bg-muted/10" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-[400px] rounded-3xl bg-muted/5" />
          <Skeleton className="h-[400px] rounded-3xl bg-muted/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
            Cassa <span className="text-primary not-italic">&</span> Liquidità
          </h1>
          <p className="text-[#475569] text-xs font-bold uppercase tracking-[0.2em] mt-1">Gestione flussi bancari e riconciliazioni</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/cassa/regole">
            <Button variant="outline" className="h-10 bg-card/50 border-border text-muted-foreground hover:text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest">
              <ShieldCheck className="h-4 w-4" />
              Regole Matching
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={`h-10 bg-card/50 border-border rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest ${giorniFilter ? "text-primary border-primary/40" : "text-muted-foreground hover:text-white"}`}>
                <Calendar className="h-4 w-4" />
                {giorniFilter ? `Ultimi ${giorniFilter} Giorni` : "Periodo"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-card/95 backdrop-blur-xl border-border/50 rounded-xl p-1">
              <DropdownMenuItem onClick={() => setGiorniFilter(null)} className={`text-xs font-bold uppercase tracking-widest cursor-pointer ${!giorniFilter ? "text-primary" : ""}`}>Tutti</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGiorniFilter(30)} className={`text-xs font-bold uppercase tracking-widest cursor-pointer ${giorniFilter === 30 ? "text-primary" : ""}`}>Ultimi 30 giorni</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGiorniFilter(60)} className={`text-xs font-bold uppercase tracking-widest cursor-pointer ${giorniFilter === 60 ? "text-primary" : ""}`}>Ultimi 60 giorni</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGiorniFilter(90)} className={`text-xs font-bold uppercase tracking-widest cursor-pointer ${giorniFilter === 90 ? "text-primary" : ""}`}>Ultimi 90 giorni</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => importRef.current?.click()}
            className="h-10 bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
          >
            <Download className="h-4 w-4" />
            Importa Estratto
          </Button>
          <input ref={importRef} type="file" accept=".csv,.ofx,.qif" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      <CassaDashboard movimenti={filteredMovimenti} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Movimenti{giorniFilter ? ` — Ultimi ${giorniFilter}gg` : " Recenti"}
          </h2>
          <Button
            variant="ghost"
            onClick={() => setShowAll((v) => !v)}
            className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-white"
          >
            {showAll ? "Riduci" : `Vedi Tutti (${filteredMovimenti.length})`}
          </Button>
        </div>

        <MovimentiTable
          data={displayedMovimenti}
          onImputa={setImputaMovimento}
          onRiconcilia={setRiconciliaMovimento}
        />
      </div>

      {imputaMovimento && (
        <ImputazioneCostiDrawer
          open={!!imputaMovimento}
          onClose={() => setImputaMovimento(null)}
          sourceType="movimento_cassa"
          sourceId={imputaMovimento.id}
          importoTotale={Math.abs(Number(imputaMovimento.importo))}
          sourceLabel={imputaMovimento.descrizione}
        />
      )}

      <RiconciliazioneDrawer
        open={!!riconciliaMovimento}
        onClose={() => setRiconciliaMovimento(null)}
        movimento={riconciliaMovimento}
      />
    </div>
  );
}
