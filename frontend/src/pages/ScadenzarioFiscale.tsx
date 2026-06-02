import { useMemo, useState } from "react";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { formatEuro } from "@/lib/utils";
import { useScadenzarioFiscale, type Certezza, type ScadenzaFiscale } from "@/hooks/useScadenzarioFiscale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Mappa unica certezza -> classi badge (niente colori hardcoded sparsi).
const CERTEZZA_BADGE: Record<Certezza, string> = {
  ALTA: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  MEDIA: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  DA_ALLINEARE: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};
const CERTEZZA_LABEL: Record<Certezza, string> = { ALTA: "Alta", MEDIA: "Media", DA_ALLINEARE: "Da allineare" };

const fmtData = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
const fmtMese = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { month: "long", year: "numeric" });

function CertezzaBadge({ c }: { c: Certezza }) {
  return <Badge className={`font-black uppercase text-[9px] h-5 border ${CERTEZZA_BADGE[c]}`}>{CERTEZZA_LABEL[c]}</Badge>;
}

export default function ScadenzarioFiscale() {
  const [mesi, setMesi] = useState(6);
  const { data, isLoading } = useScadenzarioFiscale(mesi);

  // Raggruppa le scadenze per mese (chiave YYYY-MM), preservando l'ordine cronologico.
  const perMese = useMemo(() => {
    const groups: { key: string; label: string; items: ScadenzaFiscale[] }[] = [];
    for (const s of data?.scadenze ?? []) {
      const key = s.data.slice(0, 7);
      let g = groups.find((x) => x.key === key);
      if (!g) { g = { key, label: fmtMese(s.data), items: [] }; groups.push(g); }
      g.items.push(s);
    }
    return groups;
  }, [data?.scadenze]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarClock className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Scadenzario Fiscale</h1>
            <p className="text-sm text-muted-foreground">IVA trimestrale calcolata dalle fatture + calendario scadenze ricorrenti.</p>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Orizzonte</Label>
          <Select value={String(mesi)} onValueChange={(v) => setMesi(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 mesi</SelectItem>
              <SelectItem value="6">6 mesi</SelectItem>
              <SelectItem value="12">12 mesi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(data?.warning ?? []).map((w, i) => (
        <div key={i} className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {w}
        </div>
      ))}

      {isLoading || !data ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Caricamento…</CardContent></Card>
      ) : (
        <>
          {/* IVA trimestrale */}
          <Card>
            <CardHeader><CardTitle className="text-base">IVA trimestrale</CardTitle></CardHeader>
            <CardContent>
              {data.iva_trimestrale.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun trimestre nell'orizzonte selezionato.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trimestre</TableHead>
                      <TableHead className="text-right">IVA debito</TableHead>
                      <TableHead className="text-right">IVA credito</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Versamento</TableHead>
                      <TableHead>Certezza</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.iva_trimestrale.map((t) => (
                      <TableRow key={t.trimestre}>
                        <TableCell className="font-bold">{t.trimestre}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatEuro(t.iva_debito)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatEuro(t.iva_credito)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-black ${t.saldo > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          {formatEuro(t.saldo)}{t.saldo > 0 ? " (da versare)" : t.saldo < 0 ? " (credito)" : ""}
                        </TableCell>
                        <TableCell>{fmtData(t.data_versamento)}</TableCell>
                        <TableCell><CertezzaBadge c={t.certezza} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Calendario scadenze */}
          <Card>
            <CardHeader><CardTitle className="text-base">Calendario scadenze</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {perMese.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessuna scadenza nell'orizzonte selezionato.</p>
              ) : perMese.map((g) => (
                <div key={g.key}>
                  <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground capitalize mb-2">{g.label}</p>
                  <div className="divide-y divide-border/40">
                    {g.items.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.voce}</p>
                          <p className="text-[11px] text-muted-foreground">{fmtData(s.data)} · {s.fonte}{s.note ? ` · ${s.note}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {s.importo_stimato == null ? (
                            <span className="text-xs text-muted-foreground italic">da definire</span>
                          ) : (
                            <span className="text-sm font-black tabular-nums">{formatEuro(s.importo_stimato)}</span>
                          )}
                          <CertezzaBadge c={s.certezza} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
