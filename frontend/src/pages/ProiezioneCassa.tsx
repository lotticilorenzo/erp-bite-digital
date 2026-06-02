import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, ReferenceLine,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Wallet, AlertTriangle, TrendingUp, Save } from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/utils";
import { useProiezioneCassa, useSaldoCassa, useSetSaldo, type ZonaCassa } from "@/hooks/useProiezioneCassa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// TODO(Fase 3): IVA e scadenze fiscali nelle uscite; saldo da estratto conto/riconciliazione.

const ZONA_HEX: Record<ZonaCassa, string> = { verde: "#10b981", gialla: "#f59e0b", rossa: "#f43f5e" };
const ZONA_CHIP: Record<ZonaCassa, string> = {
  verde: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  gialla: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rossa: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};
const ZONA_LABEL: Record<ZonaCassa, string> = { verde: "Sicura", gialla: "Attenzione", rossa: "Critica" };

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
};

export default function ProiezioneCassa() {
  const { data: saldoRec } = useSaldoCassa();
  const setSaldo = useSetSaldo();
  const [usciteVar, setUsciteVar] = useState("0");
  const usciteVarNum = Number(usciteVar) || 0;
  const { data: proj, isLoading } = useProiezioneCassa(90, usciteVarNum);

  const [saldoInput, setSaldoInput] = useState("");
  const [dataInput, setDataInput] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (saldoRec) {
      setSaldoInput(String(saldoRec.saldo));
      setDataInput(saldoRec.data);
    }
  }, [saldoRec]);

  const salva = () => {
    const v = Number(saldoInput);
    if (isNaN(v)) { toast.error("Inserisci un saldo valido"); return; }
    setSaldo.mutate(
      { saldo: v, data: dataInput },
      { onSuccess: () => toast.success("Saldo salvato — proiezione aggiornata") }
    );
  };

  const giorn = proj?.vista_giornaliera ?? [];
  const saldoAt = (i: number) => (giorn.length > i ? giorn[i].saldo_base : null);
  const zonaOggi = giorn[0]?.zona;

  const chartData = useMemo(
    () => giorn.map((p) => ({
      data: p.data,
      saldo_base: p.saldo_base,
      banda: [p.saldo_pessimista, p.saldo_ottimista] as [number, number],
      zona: p.zona,
    })),
    [giorn]
  );

  const noSaldo = (proj?.warning ?? []).some((w) => w.toLowerCase().includes("saldo non impostato"));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-black tracking-tight">Proiezione Cassa — 90 giorni</h1>
          <p className="text-sm text-muted-foreground">Saldo proiettato su 3 scenari (base / ottimista / pessimista).</p>
        </div>
      </div>

      {/* Input saldo */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Saldo c/c attuale (€)</Label>
            <Input type="number" className="w-44" value={saldoInput} onChange={(e) => setSaldoInput(e.target.value)} placeholder="es. 10000" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Alla data</Label>
            <Input type="date" className="w-44" value={dataInput} onChange={(e) => setDataInput(e.target.value)} />
          </div>
          <Button onClick={salva} disabled={setSaldo.isPending}>
            <Save className="w-4 h-4 mr-1" /> Salva saldo
          </Button>
          <div className="space-y-1 ml-auto">
            <Label className="text-xs text-muted-foreground">Uscite variabili / mese (€)</Label>
            <Input type="number" className="w-44" value={usciteVar} onChange={(e) => setUsciteVar(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {noSaldo && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Saldo non impostato: la proiezione parte da € 0. Imposta il saldo c/c attuale qui sopra.
        </div>
      )}

      {/* Striscia riepilogo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Saldo oggi", v: saldoAt(0) },
          { label: "Atteso 30gg", v: saldoAt(29) },
          { label: "Atteso 60gg", v: saldoAt(59) },
          { label: "Atteso 90gg", v: saldoAt(89) },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-5">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">{c.label}</p>
              <p className="text-xl font-black tabular-nums">{c.v != null ? formatEuro(c.v) : "—"}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Zona oggi</p>
            {zonaOggi ? (
              <span className={`inline-block mt-1 text-xs font-black px-2 py-1 rounded-md border ${ZONA_CHIP[zonaOggi]}`}>
                {ZONA_LABEL[zonaOggi]}
              </span>
            ) : <p className="text-xl font-black">—</p>}
          </CardContent>
        </Card>
      </div>

      {proj?.prima_giornata_critica && (
        <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Prima giornata sotto soglia operativa ({formatEuro(proj.soglia_operativa)}): <b>{fmtDay(proj.prima_giornata_critica)}</b>
        </div>
      )}

      {/* Viste */}
      <Tabs defaultValue="curva">
        <TabsList>
          <TabsTrigger value="curva">Curva 90gg</TabsTrigger>
          <TabsTrigger value="settimanale">Settimanale</TabsTrigger>
          <TabsTrigger value="mensile">Mensile</TabsTrigger>
        </TabsList>

        {/* Vista A */}
        <TabsContent value="curva">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Saldo proiettato</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <p className="text-sm text-muted-foreground">Caricamento…</p> : (
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="data" tickFormatter={fmtDay} interval={13} fontSize={11} />
                    <YAxis tickFormatter={(v) => formatEuro(v)} width={80} fontSize={11} />
                    <Tooltip
                      formatter={(val: any, name: any) => {
                        if (name === "banda") return [`${formatEuro(val[0])} ÷ ${formatEuro(val[1])}`, "Pess. ÷ Ott."];
                        return [formatEuro(val), "Base"];
                      }}
                      labelFormatter={(l) => fmtDay(l as string)}
                    />
                    <Area dataKey="banda" stroke="none" fill="#6366f1" fillOpacity={0.12} />
                    <ReferenceLine y={proj?.soglia_operativa} stroke="#f43f5e" strokeDasharray="4 4"
                      label={{ value: `soglia ${formatEuro(proj?.soglia_operativa ?? 0)}`, position: "insideTopRight", fontSize: 10, fill: "#f43f5e" }} />
                    {proj?.prima_giornata_critica && (
                      <ReferenceLine x={proj.prima_giornata_critica} stroke="#f43f5e"
                        label={{ value: "critica", position: "insideTopLeft", fontSize: 10, fill: "#f43f5e" }} />
                    )}
                    <Line type="monotone" dataKey="saldo_base" stroke="#6366f1" strokeWidth={2}
                      dot={(props: any) => {
                        const z = props?.payload?.zona as ZonaCassa;
                        return <circle key={props.key ?? props.index} cx={props.cx} cy={props.cy} r={2.4} fill={ZONA_HEX[z] ?? "#6366f1"} />;
                      }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vista B */}
        <TabsContent value="settimanale">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Settimana</TableHead>
                    <TableHead className="text-right">Entrate</TableHead>
                    <TableHead className="text-right">Uscite</TableHead>
                    <TableHead className="text-right">Saldo netto</TableHead>
                    <TableHead className="text-right">Saldo cumulato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(proj?.vista_settimanale ?? []).map((w) => (
                    <TableRow key={w.settimana}>
                      <TableCell className="font-medium">S{w.settimana} · {fmtDay(w.settimana_inizio)}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-400">{formatEuro(w.entrate)}</TableCell>
                      <TableCell className="text-right tabular-nums text-rose-400">{formatEuro(w.uscite)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-bold ${w.saldo_netto >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatEuro(w.saldo_netto)}</TableCell>
                      <TableCell className="text-right tabular-nums font-black">{formatEuro(w.saldo_cumulato)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vista C */}
        <TabsContent value="mensile">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(proj?.vista_mensile ?? []).map((m) => (
              <Card key={m.mese}>
                <CardHeader><CardTitle className="text-sm">Mese {m.mese} (30gg)</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Saldo iniziale</span><span className="tabular-nums font-bold">{formatEuro(m.saldo_iniziale)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Entrate</span><span className="tabular-nums text-emerald-400">{formatEuro(m.entrate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Uscite</span><span className="tabular-nums text-rose-400">{formatEuro(m.uscite)}</span></div>
                  <div className="flex justify-between border-t border-border/50 pt-1.5"><span className="font-black">Saldo finale</span><span className="tabular-nums font-black">{formatEuro(m.saldo_finale)}</span></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Scadenze fiscali */}
      {proj && ((proj.scadenze_fiscali_incluse?.length ?? 0) > 0 || (proj.scadenze_fiscali_non_quantificate?.length ?? 0) > 0) && (
        <Card className="border-dashed bg-muted/20">
          <CardHeader><CardTitle className="text-base">Scadenze fiscali</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {(proj.scadenze_fiscali_incluse?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Incluse nella curva (uscite quantificate)</p>
                {proj.scadenze_fiscali_incluse!.map((s, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">{fmtDay(s.data)} · {s.voce}</span>
                    <span className="tabular-nums font-bold text-rose-400">−{formatEuro(s.importo)}</span>
                  </div>
                ))}
              </div>
            )}
            {(proj.scadenze_fiscali_non_quantificate?.length ?? 0) > 0 && (
              <div className="space-y-1 pt-2 border-t border-border/50">
                <p className="text-[10px] uppercase tracking-widest font-black text-amber-400">Non incluse — importo da definire</p>
                <p className="text-[11px] text-muted-foreground">Importi non quantificati (cedolino/commercialista): NON incidono sulla curva finché non definiti.</p>
                {proj.scadenze_fiscali_non_quantificate!.map((s, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">{fmtDay(s.data)} · {s.voce}</span>
                    <span className="text-xs text-muted-foreground italic">da definire</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
