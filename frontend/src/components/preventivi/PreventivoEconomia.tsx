import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import { formatEuro } from "@/lib/utils";
import type { ModalitaPrezzo, TipoVoce } from "@/types/preventivi";

export interface VoceEconomia {
  tipo?: TipoVoce | null;
  ore?: number | null;
  tariffa?: number | null;
  costo?: number | null;
  ricarico_pct?: number | null;
}

interface Props {
  voci: VoceEconomia[];
  modalita?: ModalitaPrezzo | null;
  markupPct?: number | null;
  markupSu?: string | null;
  marginePct?: number | null;
  prezzoDato?: number | null;
  coeffOvh?: number | null;
  margineTarget?: number | null;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Economia del preventivo (spec §18). Specchio della formula backend, calcolata in locale
 * per aggiornarsi live mentre si compila (il backend resta la fonte di verita' al salvataggio).
 * Regola §18.1: markup e margine si mostrano SEMPRE entrambi, mai uno solo.
 */
export function calcolaEconomiaLocale({
  voci, modalita, markupPct, markupSu, marginePct, prezzoDato, coeffOvh, margineTarget,
}: Props) {
  let costoLavoro = 0, costoSocio = 0, costoEsterni = 0, haOverhead = false;
  for (const v of voci) {
    const tipo = v.tipo;
    if (tipo === "lavoro") costoLavoro += (Number(v.ore) || 0) * (Number(v.tariffa) || 0);
    else if (tipo === "socio") costoSocio += Number(v.costo) || 0;
    else if (tipo === "esterno") costoEsterni += Number(v.costo) || 0;
    else if (tipo === "overhead") haOverhead = true;
  }
  const costoDiretto = costoLavoro + costoSocio + costoEsterni;

  let prezzo = 0;
  if (modalita === "margine" && prezzoDato != null && Number(prezzoDato) > 0) {
    prezzo = Number(prezzoDato);
  } else if (modalita === "margine" && marginePct != null) {
    const m = Number(marginePct) / 100;
    prezzo = m < 1 ? r2(costoDiretto / (1 - m)) : costoDiretto;
  } else if (modalita === "markup") {
    const base = markupSu === "solo_lavoro" ? costoLavoro : costoDiretto;
    prezzo = r2(base * (1 + (Number(markupPct) || 0) / 100));
  } else {
    prezzo = prezzoDato != null ? Number(prezzoDato) : costoDiretto;
  }

  const overhead = haOverhead ? r2((Number(coeffOvh) || 0) * prezzo) : 0;
  const costoTotale = costoDiretto + overhead;
  const markupEff = costoTotale > 0 ? (prezzo / costoTotale - 1) * 100 : null;
  const margineEff = prezzo > 0 ? ((prezzo - costoTotale) / prezzo) * 100 : null;
  const budgetInterno = prezzo - costoEsterni - costoSocio - overhead - (Number(margineTarget) || 0);

  return {
    costoLavoro: r2(costoLavoro), costoSocio: r2(costoSocio), costoEsterni: r2(costoEsterni),
    overhead, costoTotale: r2(costoTotale), prezzo: r2(prezzo),
    markupEff: markupEff == null ? null : r2(markupEff),
    margineEff: margineEff == null ? null : r2(margineEff),
    budgetInterno: r2(budgetInterno),
  };
}

export const PreventivoEconomia: React.FC<Props> = (props) => {
  const eco = useMemo(() => calcolaEconomiaLocale(props), [props]);
  // Simulatore frontiera ore (§18.3): solo risorse a ore, i soci sono capacita' non budget.
  const [oreFisse, setOreFisse] = useState<string>("");
  const [tarFissa, setTarFissa] = useState<string>("");
  const [tarVar, setTarVar] = useState<string>("");
  const consumato = (Number(oreFisse) || 0) * (Number(tarFissa) || 0);
  const residuo = eco.budgetInterno - consumato;
  const maxOre = Number(tarVar) > 0 ? r2(residuo / Number(tarVar)) : null;

  const Riga = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">Economia</div>

        <div className="space-y-1.5">
          <Riga label="Costo lavoro" value={formatEuro(eco.costoLavoro)} muted />
          <Riga label="Costo socio (stima)" value={formatEuro(eco.costoSocio)} muted />
          <Riga label="Costi esterni" value={formatEuro(eco.costoEsterni)} muted />
          <Riga label="Overhead" value={formatEuro(eco.overhead)} muted />
          <div className="border-t border-border/50 pt-1.5">
            <Riga label="Costo pieno" value={formatEuro(eco.costoTotale)} />
          </div>
        </div>

        <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-primary">Prezzo</span>
            <span className="text-xl font-black tabular-nums">{formatEuro(eco.prezzo)}</span>
          </div>
        </div>

        {/* §18.1: markup e margine SEMPRE entrambi, con etichette esplicite (non sono la stessa cosa) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/50 px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Markup</div>
            <div className="text-lg font-black tabular-nums">{eco.markupEff == null ? "—" : `${eco.markupEff.toFixed(2)}%`}</div>
            <div className="text-[10px] text-muted-foreground">sui costi</div>
          </div>
          <div className="rounded-lg border border-border/50 px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Margine</div>
            <div className="text-lg font-black tabular-nums">{eco.margineEff == null ? "—" : `${eco.margineEff.toFixed(2)}%`}</div>
            <div className="text-[10px] text-muted-foreground">sul prezzo</div>
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Budget interno lavoro</span>
            <span className="font-mono font-black tabular-nums">{formatEuro(eco.budgetInterno)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">prezzo − esterni − socio − overhead − margine target</p>
        </div>

        {/* Simulatore ore (§18.3) */}
        <div className="space-y-2 border-t border-border/50 pt-4">
          <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">Simulatore ore</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Ore fisse</Label>
              <Input type="number" className="h-9 text-sm" value={oreFisse} onChange={(e) => setOreFisse(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Tariffa fissa</Label>
              <Input type="number" className="h-9 text-sm" value={tarFissa} onChange={(e) => setTarFissa(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Tariffa 2ª risorsa</Label>
              <Input type="number" className="h-9 text-sm" value={tarVar} onChange={(e) => setTarVar(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm pt-1">
            <span className="text-muted-foreground">Residuo {formatEuro(residuo)} →</span>
            <span className="font-mono font-black">{maxOre == null ? "—" : `max ${maxOre} h`}</span>
          </div>
          <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            <span>La frontiera vale solo tra risorse a ore (dipendenti). I <b>soci</b> sono capacità, non budget: non entrano nel calcolo.</span>
          </div>
        </div>

        <div className="flex items-start gap-2 text-[10px] text-muted-foreground border-t border-border/50 pt-3">
          <Info className="w-3 h-3 shrink-0 mt-0.5" />
          <span>L'<b>overhead</b> comprende già la quota admin/commerciale dei soci: non aggiungerla ai costi diretti.</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PreventivoEconomia;
