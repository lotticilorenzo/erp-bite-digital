import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scale, AlertTriangle, ChevronDown } from "lucide-react";
import { formatEuro } from "@/lib/utils";
import { usePLGestionale } from "@/hooks/usePLGestionale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

// Default = ultimo mese chiuso (mese corrente − 1), in formato YYYY-MM.
function lastClosedMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Riga({ label, valore, segno, subtotale, colorato }: {
  label: string; valore: number; segno?: "-"; subtotale?: boolean; colorato?: boolean;
}) {
  const color = colorato ? (valore >= 0 ? "text-emerald-400" : "text-rose-400") : "text-foreground";
  return (
    <div className={`flex justify-between items-center py-2 ${subtotale ? "border-t border-border/60 mt-1" : ""}`}>
      <span className={`${subtotale ? "font-black uppercase text-xs tracking-widest" : "text-sm text-muted-foreground"}`}>{label}</span>
      <span className={`tabular-nums ${subtotale ? "font-black text-lg" : "text-sm"} ${color}`}>
        {segno === "-" && valore !== 0 ? "− " : ""}{formatEuro(Math.abs(valore))}
      </span>
    </div>
  );
}

export default function PLGestionale() {
  const navigate = useNavigate();
  const [mese, setMese] = useState<string>(lastClosedMonth());
  const { data: pl, isLoading } = usePLGestionale(mese);
  const [openDett, setOpenDett] = useState(false);

  const meseLabel = useMemo(() => {
    if (!pl?.mese) return mese;
    return new Date(pl.mese).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  }, [pl?.mese, mese]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Scale className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">P&L Gestionale</h1>
            <p className="text-sm text-muted-foreground">Conto economico gestionale del mese (fiscale escluso).</p>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mese</Label>
          <Input type="month" className="w-44" value={mese} onChange={(e) => setMese(e.target.value)} />
        </div>
      </div>

      {(pl?.warning ?? []).map((w, i) => (
        <div key={i} className="flex items-center justify-between gap-3 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{w}</span>
          </div>
          {w.toLowerCase().includes("non presente") && (
            <Button
              variant="outline"
              size="sm"
              className="text-amber-400 hover:text-amber-300 border-amber-500/30 hover:bg-amber-500/10 font-bold uppercase text-[10px] tracking-widest h-8 px-3 rounded-lg bg-transparent"
              onClick={() => navigate("/impostazioni-finanza")}
            >
              Configura
            </Button>
          )}
        </div>
      ))}

      {isLoading || !pl ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Caricamento…</CardContent></Card>
      ) : (
        <>
          {/* Conto economico a cascata */}
          <Card>
            <CardHeader><CardTitle className="text-base capitalize">{meseLabel}</CardTitle></CardHeader>
            <CardContent className="divide-y-0">
              <Riga label="Ricavi da retainer" valore={pl.ricavi.retainer} />
              <Riga label="Ricavi one-shot" valore={pl.ricavi.one_shot} />
              {pl.ricavi.cliente_dedicato > 0 && (
                <Riga label="Ricavi cliente dedicato" valore={pl.ricavi.cliente_dedicato} />
              )}
              <Riga label="Ricavi totali" valore={pl.ricavi.totale} subtotale />
              <Riga label="Costi diretti produzione" valore={pl.costi_diretti} segno="-" />
              <Riga label="Margine lordo aggregato" valore={pl.margine_lordo_aggregato} subtotale />
              <Riga label="Costi fissi indivisibili" valore={pl.costi_fissi_indivisibili} segno="-" />
              <Riga label="Risultato operativo" valore={pl.risultato_operativo_gestionale} subtotale colorato />
            </CardContent>
          </Card>

          {/* Memo IVA — staccato, fuori dal risultato */}
          <Card className="border-dashed bg-muted/20">
            <CardContent className="pt-5">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                Memo — IVA di competenza <span className="normal-case font-medium">(fuori dal risultato operativo)</span>
              </p>
              <div className="flex flex-wrap gap-x-8 gap-y-1 mt-2 text-sm">
                <span>IVA attiva: <b className="tabular-nums">{formatEuro(pl.iva_memo.attiva)}</b></span>
                <span>IVA passiva: <b className="tabular-nums">{formatEuro(pl.iva_memo.passiva)}</b></span>
                <span>Saldo IVA: <b className="tabular-nums">{formatEuro(pl.iva_memo.saldo)}</b></span>
              </div>
            </CardContent>
          </Card>

          {/* Memo cliente dedicato — staccato, fuori dal risultato (solo se configurato) */}
          {pl.memo_cliente_dedicato && (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="pt-5">
                <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                  Memo — Cliente dedicato <span className="normal-case font-medium">(fuori dal risultato operativo)</span>
                </p>
                <div className="flex flex-wrap gap-x-8 gap-y-1 mt-2 text-sm">
                  <span>Cliente: <b>{pl.memo_cliente_dedicato.cliente ?? "—"}</b></span>
                  <span>Ricavo: <b className="tabular-nums">{formatEuro(pl.memo_cliente_dedicato.ricavo_cliente_dedicato)}</b></span>
                  <span>Collaboratore: <b>{pl.memo_cliente_dedicato.collaboratore ?? "—"}</b></span>
                  <span>Costo: <b className="tabular-nums">{pl.memo_cliente_dedicato.costo_collaboratore_dedicato != null ? formatEuro(pl.memo_cliente_dedicato.costo_collaboratore_dedicato) : "da definire"}</b></span>
                  <span>Scostamento: <b className="tabular-nums">{pl.memo_cliente_dedicato.scostamento != null ? formatEuro(pl.memo_cliente_dedicato.scostamento) : "—"}</b></span>
                </div>
                {pl.memo_cliente_dedicato.note && (
                  <p className="text-xs text-muted-foreground mt-2">{pl.memo_cliente_dedicato.note}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dettaglio costi fissi */}
          <Collapsible open={openDett} onOpenChange={setOpenDett}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
              <ChevronDown className={`w-4 h-4 transition-transform ${openDett ? "rotate-180" : ""}`} />
              Dettaglio costi fissi indivisibili ({pl.costi_fissi_dettaglio.incluse.length} voci)
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <Card>
                <CardContent className="pt-5 space-y-2">
                  {pl.costi_fissi_dettaglio.incluse.map((v, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{v.descrizione} <span className="text-[10px] uppercase">· {v.categoria} · {v.periodicita}</span></span>
                      <span className="tabular-nums font-bold">{formatEuro(v.importo_mensile)}/mese</span>
                    </div>
                  ))}
                  {pl.costi_fissi_dettaglio.escluse.length > 0 && (
                    <div className="pt-2 border-t border-border/50 space-y-1">
                      <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Escluse (già nel costo orario fully-loaded)</p>
                      {pl.costi_fissi_dettaglio.escluse.map((v, i) => (
                        <div key={i} className="flex justify-between text-xs text-muted-foreground">
                          <span>{v.descrizione} — {v.motivo_esclusione}</span>
                          <span className="tabular-nums">{formatEuro(v.importo_mensile)}/mese</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
