import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Calculator, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useRisorse } from "@/hooks/useRisorse";
import { formatEuro } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// TODO: integrazione coi Preventivi (fuori scope Prompt 5).

interface Voce {
  key: string;
  risorsa_id: string;
  ore: string;
}

interface BreakdownRow {
  risorsa_id: string;
  nome: string | null;
  ore: number;
  costo_orario_diretto: number;
  overhead_orario: number;
  quota_overhead: number;
  costo: number;
}

interface PricingFloorResult {
  costo_manodopera: number;
  overhead_totale: number;
  tasso_overhead: number;
  costo_diretto_stimato: number;
  margine_target: number;
  pricing_floor: number;
  breakdown_per_risorsa: BreakdownRow[];
  warning: string[];
}

let _k = 0;
const newVoce = (): Voce => ({ key: `v${_k++}`, risorsa_id: "", ore: "" });

export default function PricingFloor() {
  const { data: risorse = [] } = useRisorse();
  const [voci, setVoci] = useState<Voce[]>([newVoce()]);
  const [costiDirettiExtra, setCostiDirettiExtra] = useState("0");
  const [quotaLuca, setQuotaLuca] = useState("0");
  const [marginePct, setMarginePct] = useState("30");
  const [result, setResult] = useState<PricingFloorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const margineNum = Number(marginePct);
  const margineValido = !isNaN(margineNum) && margineNum >= 0 && margineNum < 100;

  // Payload stabile per il debounce
  const payload = useMemo(
    () => ({
      voci_manodopera: voci
        .filter((v) => v.risorsa_id && Number(v.ore) > 0)
        .map((v) => ({ risorsa_id: v.risorsa_id, ore: Number(v.ore) })),
      costi_diretti_extra: Number(costiDirettiExtra) || 0,
      quota_luca_stimata: Number(quotaLuca) || 0,
      margine_target: margineNum / 100,
    }),
    [voci, costiDirettiExtra, quotaLuca, margineNum]
  );

  // Calcolo in tempo reale (debounced) — la fonte di verità è l'endpoint backend.
  useEffect(() => {
    if (!margineValido) {
      setError("Il margine target deve essere tra 0% e 99%.");
      setResult(null);
      return;
    }
    setError(null);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/pricing-floor/calcola", payload);
        setResult(data);
      } catch (e: any) {
        setError(e?.response?.data?.detail || "Errore nel calcolo.");
        setResult(null);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [payload, margineValido]);

  const updateVoce = (key: string, patch: Partial<Voce>) =>
    setVoci((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-black tracking-tight">Pricing Floor</h1>
          <p className="text-sm text-muted-foreground">
            Prezzo minimo accettabile per rispettare il margine target su un progetto in offerta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Stima costi del progetto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest font-black text-muted-foreground">
                Manodopera (ore per risorsa)
              </Label>
              {voci.map((v) => (
                <div key={v.key} className="flex gap-2 items-center">
                  <Select value={v.risorsa_id} onValueChange={(val) => updateVoce(v.key, { risorsa_id: val })}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleziona risorsa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {risorse.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome} {r.cognome} — {formatEuro(r.costo_orario_effettivo)}/h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="ore"
                    className="w-24"
                    value={v.ore}
                    onChange={(e) => updateVoce(v.key, { ore: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setVoci((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== v.key) : prev))}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setVoci((prev) => [...prev, newVoce()])}>
                <Plus className="w-4 h-4 mr-1" /> Aggiungi risorsa
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/50">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Costi diretti extra (€)</Label>
                <Input type="number" min="0" value={costiDirettiExtra} onChange={(e) => setCostiDirettiExtra(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Produzione esterna, freelancer one-shot…</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Quota Luca stimata (€)</Label>
                <Input type="number" min="0" value={quotaLuca} onChange={(e) => setQuotaLuca(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Opzionale, stima manuale.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Margine target (%)</Label>
                <Input type="number" min="0" max="99" value={marginePct} onChange={(e) => setMarginePct(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Default 30%. Deve essere &lt; 100%.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risultato */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Prezzo minimo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p className="text-sm text-rose-500 font-medium">{error}</p>
            ) : result ? (
              <>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Pricing Floor</p>
                  <p className="text-3xl font-black text-primary tabular-nums">{formatEuro(result.pricing_floor)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Sotto questa cifra eroderesti il margine del {Math.round(result.margine_target * 100)}%.
                  </p>
                </div>
                <div className="space-y-1 pt-2 border-t border-border/50 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Costo manodopera</span>
                    <span className="font-black tabular-nums">{formatEuro(result.costo_manodopera)}</span>
                  </div>
                  {result.overhead_totale > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">di cui overhead struttura ({formatEuro(result.tasso_overhead)}/h)</span>
                      <span className="font-medium tabular-nums text-muted-foreground">{formatEuro(result.overhead_totale)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Costo diretto stimato</span>
                    <span className="font-black tabular-nums">{formatEuro(result.costo_diretto_stimato)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Inserisci ore e costi per calcolare.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown + warning */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Breakdown manodopera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.breakdown_per_risorsa.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna voce di manodopera.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {result.breakdown_per_risorsa.map((b, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span>
                      {b.nome ?? "—"}
                      {b.quota_overhead > 0 && (
                        <span className="text-[11px] text-muted-foreground ml-1.5">
                          (+{formatEuro(b.overhead_orario)}/h overhead)
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {b.ore}h × {formatEuro(b.costo_orario_diretto)}/h ={" "}
                      <span className="font-black text-foreground">{formatEuro(b.costo)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {result.warning.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-border/50">
                {result.warning.map((w, i) => (
                  <p key={i} className="text-xs text-amber-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {w}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
