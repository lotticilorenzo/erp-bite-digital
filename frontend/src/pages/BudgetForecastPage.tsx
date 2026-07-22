import { useMemo, useState } from "react";
import { Target, Plus, CheckCircle2, Trash2, TrendingUp } from "lucide-react";
import { formatEuro } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useBudgetVersioni, useCreateBudgetVersione, useDeleteBudgetVersione, useApprovaBudgetVersione,
  useBudgetRighe, useSalvaBudgetRiga, useBudgetConfronto, useGeneraForecast, useForecastAccuracy,
  type BudgetVersione, type BudgetVoceTipo,
} from "@/hooks/useBudgetForecast";

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const VOCI: { value: BudgetVoceTipo; label: string }[] = [
  { value: "ricavo", label: "Ricavo" },
  { value: "costo_diretto", label: "Costo diretto" },
  { value: "costo_struttura", label: "Costo struttura" },
  { value: "altro", label: "Altro" },
];

function StatoBadge({ stato }: { stato: string }) {
  const map: Record<string, string> = {
    bozza: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    approvato: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    archiviato: "bg-muted/10 text-muted-foreground border-border/20",
  };
  return <Badge className={`${map[stato] ?? map.bozza} text-[10px] font-bold uppercase tracking-widest`}>{stato}</Badge>;
}

export default function BudgetForecastPage() {
  const [selezionata, setSelezionata] = useState<BudgetVersione | null>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Target className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-black tracking-tight">Budget & Forecast</h1>
          <p className="text-sm text-muted-foreground">Versioni, righe mese×voce, confronto vs actual, accuracy (spec v2 §13).</p>
        </div>
      </div>
      <Tabs defaultValue="versioni">
        <TabsList>
          <TabsTrigger value="versioni">Versioni</TabsTrigger>
          <TabsTrigger value="confronto" disabled={!selezionata}>Confronto</TabsTrigger>
          <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
        </TabsList>
        <TabsContent value="versioni" className="mt-4">
          <VersioniTab selezionata={selezionata} onSeleziona={setSelezionata} />
        </TabsContent>
        <TabsContent value="confronto" className="mt-4">
          {selezionata && <ConfrontoTab versione={selezionata} />}
        </TabsContent>
        <TabsContent value="accuracy" className="mt-4"><AccuracyTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── TAB VERSIONI ────────────────────────────────────────────────
function VersioniTab({ selezionata, onSeleziona }: { selezionata: BudgetVersione | null; onSeleziona: (v: BudgetVersione) => void }) {
  const [anno, setAnno] = useState<string>(String(new Date().getFullYear()));
  const [nuovoOpen, setNuovoOpen] = useState(false);
  const [generaOpen, setGeneraOpen] = useState(false);

  const filtri = useMemo(() => ({ anno: anno ? Number(anno) : undefined }), [anno]);
  const { data: versioni = [], isLoading } = useBudgetVersioni(filtri);
  const deleteMut = useDeleteBudgetVersione();
  const approvaMut = useApprovaBudgetVersione();

  function elimina(v: BudgetVersione) {
    if (confirm(`Eliminare la versione ${v.tipo} v${v.versione} (${v.anno})?`)) deleteMut.mutate(v.id);
  }
  function approva(v: BudgetVersione) {
    if (confirm(`Approvare la versione ${v.tipo} v${v.versione}? Diventa immutabile.`)) approvaMut.mutate(v.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Anno</Label>
          <Input type="number" className="h-9 w-32 text-sm" value={anno} onChange={(e) => setAnno(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGeneraOpen(true)} className="gap-2"><TrendingUp className="w-4 h-4" /> Genera forecast</Button>
          <Button onClick={() => setNuovoOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Nuova versione</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anno</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Versione</TableHead>
                <TableHead className="text-center">Stato</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Caricamento…</TableCell></TableRow>
              ) : versioni.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Nessuna versione.</TableCell></TableRow>
              ) : versioni.map((v) => (
                <TableRow key={v.id} className={selezionata?.id === v.id ? "bg-primary/5" : ""}>
                  <TableCell className="text-sm">{v.anno}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{v.tipo}</Badge></TableCell>
                  <TableCell className="text-center text-sm font-mono">v{v.versione}</TableCell>
                  <TableCell className="text-center"><StatoBadge stato={v.stato} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{v.note ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => onSeleziona(v)}>Apri righe</Button>
                      {v.stato === "bozza" && (
                        <button onClick={() => approva(v)} title="Approva" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-emerald-500 hover:bg-muted/60">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {v.stato === "bozza" && (
                        <button onClick={() => elimina(v)} title="Elimina" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-muted/60">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selezionata && <RigheEditor versione={selezionata} />}

      {nuovoOpen && <NuovaVersioneDialog defaultAnno={Number(anno) || new Date().getFullYear()} onClose={() => setNuovoOpen(false)} />}
      {generaOpen && <GeneraForecastDialog defaultAnno={Number(anno) || new Date().getFullYear()} onClose={() => setGeneraOpen(false)} />}
    </div>
  );
}

function NuovaVersioneDialog({ defaultAnno, onClose }: { defaultAnno: number; onClose: () => void }) {
  const [anno, setAnno] = useState(String(defaultAnno));
  const [tipo, setTipo] = useState<string>("budget");
  const [note, setNote] = useState("");
  const createMut = useCreateBudgetVersione();

  function salva() {
    createMut.mutate({ anno: Number(anno), tipo: tipo as any, note: note.trim() || null }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nuova versione budget</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Anno *</Label>
              <Input type="number" value={anno} onChange={(e) => setAnno(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="forecast">Forecast</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="opzionale" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={salva} disabled={!anno || createMut.isPending}>{createMut.isPending ? "Creando…" : "Crea"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GeneraForecastDialog({ defaultAnno, onClose }: { defaultAnno: number; onClose: () => void }) {
  const [anno, setAnno] = useState(String(defaultAnno));
  const [daMese, setDaMese] = useState(String(new Date().getMonth() + 1));
  const generaMut = useGeneraForecast();

  function genera() {
    generaMut.mutate({ anno: Number(anno), da_mese: Number(daMese) }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Genera forecast rolling</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Mesi precedenti = Actual; da qui in poi = previsione dal budget approvato (o ultimo forecast).</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Anno *</Label>
              <Input type="number" value={anno} onChange={(e) => setAnno(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Da mese *</Label>
              <Select value={daMese} onValueChange={setDaMese}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{MESI.map((m, i) => <SelectItem key={i} value={String(i + 1)} className="text-sm">{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={genera} disabled={generaMut.isPending}>{generaMut.isPending ? "Generando…" : "Genera"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── EDITOR RIGHE (griglia mese × voce_tipo) ──────────────────────
function RigheEditor({ versione }: { versione: BudgetVersione }) {
  const { data: righe = [], isLoading } = useBudgetRighe(versione.id);
  const salvaMut = useSalvaBudgetRiga();
  const editabile = versione.stato === "bozza";

  const grid = useMemo(() => {
    const m = new Map<string, { importo: number; id: string }>();
    for (const r of righe) m.set(`${r.mese}-${r.voce_tipo}`, { importo: r.importo, id: r.id });
    return m;
  }, [righe]);

  function onChangeCella(mese: number, voce: BudgetVoceTipo, valore: string) {
    const importo = Number(valore);
    if (Number.isNaN(importo)) return;
    const cur = grid.get(`${mese}-${voce}`);
    salvaMut.mutate({ versioneId: versione.id, mese, voceTipo: voce, importo, existingId: cur?.id });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
            Righe — {versione.tipo} v{versione.versione} ({versione.anno})
          </h3>
          {!editabile && <Badge variant="outline" className="text-[10px] uppercase">Sola lettura — {versione.stato}</Badge>}
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Caricamento…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voce</TableHead>
                  {MESI.map((m) => <TableHead key={m} className="text-center text-xs">{m}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {VOCI.map((v) => (
                  <TableRow key={v.value}>
                    <TableCell className="text-sm font-medium whitespace-nowrap">{v.label}</TableCell>
                    {MESI.map((_, i) => {
                      const mese = i + 1;
                      const cella = grid.get(`${mese}-${v.value}`);
                      return (
                        <TableCell key={mese} className="p-1">
                          <Input
                            type="number" step="0.01"
                            defaultValue={cella?.importo ?? ""}
                            onBlur={(e) => onChangeCella(mese, v.value, e.target.value)}
                            disabled={!editabile}
                            className="h-8 w-24 text-xs font-mono text-right"
                            placeholder="0"
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── TAB CONFRONTO ───────────────────────────────────────────────
function ConfrontoTab({ versione }: { versione: BudgetVersione }) {
  const [mese, setMese] = useState<string>("");
  const [ytd, setYtd] = useState(false);
  const { data, isLoading } = useBudgetConfronto(versione.id, { mese: mese ? Number(mese) : undefined, ytd });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-end gap-3">
          <div className="text-sm text-muted-foreground">Versione: <b className="text-foreground">{versione.tipo} v{versione.versione} ({versione.anno})</b></div>
          <div className="space-y-1">
            <Label className="text-xs">Mese</Label>
            <Select value={mese} onValueChange={setMese}>
              <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="Anno intero" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Anno intero</SelectItem>
                {MESI.map((m, i) => <SelectItem key={i} value={String(i + 1)} className="text-sm">{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <Switch checked={ytd} onCheckedChange={setYtd} disabled={!mese || mese === "_all"} />
            <Label className="text-xs">YTD (cumulato da gennaio)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voce</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Scostamento</TableHead>
                <TableHead className="text-center">%</TableHead>
                <TableHead className="text-center">Esito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Caricamento…</TableCell></TableRow>
              ) : !data || data.voci.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Nessun dato.</TableCell></TableRow>
              ) : data.voci.map((v) => (
                <TableRow key={v.voce_tipo}>
                  <TableCell className="text-sm capitalize">{v.voce_tipo.replace("_", " ")}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{v.budget != null ? formatEuro(v.budget) : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{v.actual != null ? formatEuro(v.actual) : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{v.scostamento != null ? formatEuro(v.scostamento) : "—"}</TableCell>
                  <TableCell className="text-center text-xs">{v.scostamento_pct != null ? `${v.scostamento_pct}%` : "—"}</TableCell>
                  <TableCell className="text-center">
                    {v.favorevole == null ? <span className="text-xs text-muted-foreground">—</span> :
                      <Badge className={v.favorevole ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]" : "bg-rose-500/10 text-rose-500 border-rose-500/20 text-[10px]"}>
                        {v.favorevole ? "Favorevole" : "Sfavorevole"}
                      </Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── TAB ACCURACY ────────────────────────────────────────────────
function AccuracyTab() {
  const [anno, setAnno] = useState(String(new Date().getFullYear()));
  const [mese, setMese] = useState(String(new Date().getMonth() + 1));
  const { data, isLoading } = useForecastAccuracy(Number(anno), Number(mese));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Anno</Label>
            <Input type="number" className="h-9 w-32 text-sm" value={anno} onChange={(e) => setAnno(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mese target</Label>
            <Select value={mese} onValueChange={setMese}>
              <SelectTrigger className="h-9 w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{MESI.map((m, i) => <SelectItem key={i} value={String(i + 1)} className="text-sm">{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Caricamento…</p>
      ) : !data || data.snapshot.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {data?.note?.[0] ?? "Nessuno snapshot disponibile per questo target."}
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Previsto da</TableHead>
                  <TableHead className="text-center">Orizzonte</TableHead>
                  <TableHead>Voce</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Errore</TableHead>
                  <TableHead className="text-center">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.snapshot.flatMap((s) => s.voci.map((v) => (
                  <TableRow key={`${s.previsto_da}-${v.voce_tipo}`}>
                    <TableCell className="text-xs text-muted-foreground">{s.previsto_da} (v{s.versione})</TableCell>
                    <TableCell className="text-center text-xs">{s.orizzonte_mesi} mesi</TableCell>
                    <TableCell className="text-sm capitalize">{v.voce_tipo.replace("_", " ")}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{v.previsto != null ? formatEuro(v.previsto) : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{v.actual != null ? formatEuro(v.actual) : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{v.errore != null ? formatEuro(v.errore) : "—"}</TableCell>
                    <TableCell className="text-center text-xs">{v.errore_pct != null ? `${v.errore_pct}%` : "—"}</TableCell>
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
