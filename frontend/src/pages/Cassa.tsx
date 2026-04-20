import { useState } from "react";
import {
  Download,
  ArrowRightLeft,
  Calendar,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMovimentiCassa } from "@/hooks/useCassa";
import { CassaDashboard } from "@/components/finance/CassaDashboard";
import { MovimentiTable } from "@/components/finance/MovimentiTable";
import { ImputazioneCostiDrawer } from "@/components/finance/ImputazioneCostiDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

export default function Cassa() {
  const { data: movimenti, isLoading } = useMovimentiCassa();
  const [imputaMovimento, setImputaMovimento] = useState<any>(null);

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
          <Button variant="outline" className="h-10 bg-card/50 border-border text-muted-foreground hover:text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest">
            <Calendar className="h-4 w-4" />
            Ultimi 30 Giorni
          </Button>
          <Button className="h-10 bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_hsl(var(--primary)/0.2)]">
            <Download className="h-4 w-4" />
            Importa Estratto
          </Button>
        </div>
      </div>

      <CassaDashboard movimenti={movimenti || []} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Movimenti Recenti
          </h2>
          <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-white">
            Vedi Tutti
          </Button>
        </div>
        
        <MovimentiTable data={movimenti || []} onImputa={setImputaMovimento} />
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
    </div>
  );
}
