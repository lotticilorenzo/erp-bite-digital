import { useMemo, useState } from "react";
import { Landmark, Plus, Pencil, Trash2, CheckCircle2, Repeat } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { formatEuro } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useScadenze, useCreateScadenza, useUpdateScadenza, useDeleteScadenza, useSegnaPagataScadenza,
  useRicorrenze, useCreateRicorrenza, useUpdateRicorrenza, useDeleteRicorrenza, useGeneraRicorrenze,
  type Scadenza, type ScadenzaInput, type Ricorrenza, type RicorrenzaInput,
} from "@/hooks/useTesoreria";

const TIPI_SCADENZA = [
  { value: "attiva", label: "Attiva (incasso)" },
  { value: "passiva", label: "Passiva (pagamento)" },
  { value: "fiscale", label: "Fiscale" },
  { value: "contributiva", label: "Contributiva" },
  { value: "finanziaria", label: "Finanziaria" },
] as const;

const CONTROPARTI = [
  { value: "cliente", label: "Cliente" },
  { value: "fornitore", label: "Fornitore" },
  { value: "erario", label: "Erario" },
  { value: "inps", label: "INPS" },
  { value: "banca", label: "Banca" },
  { value: "altro", label: "Altro" },
] as const;

const PERIODICITA = [
  { value: "settimanale", label: "Settimanale" },
  { value: "mensile", label: "Mensile" },
  { value: "bimestrale", label: "Bimestrale" },
  { value: "trimestrale", label: "Trimestrale" },
  { value: "semestrale", label: "Semestrale" },
  { value: "annuale", label: "Annuale" },
] as const;

function StatoBadge({ stato }: { stato: string }) {
  const map: Record<string, string> = {
    aperta: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    parziale: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    chiusa: "bg-muted/10 text-muted-foreground border-border/20",
    scaduta: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };
  return <Badge className={`${map[stato] ?? map.aperta} text-[10px] font-bold uppercase tracking-widest`}>{stato}</Badge>;
}

export default function TesoreriaPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-black tracking-tight">Tesoreria</h1>
          <p className="text-sm text-muted-foreground">Scadenze e ricorrenze — alimentano la proiezione cassa.</p>
        </div>
      </div>
      <Tabs defaultValue="scadenze">
        <TabsList>
          <TabsTrigger value="scadenze">Scadenze</TabsTrigger>
          <TabsTrigger value="ricorrenze">Ricorrenze</TabsTrigger>
        </TabsList>
        <TabsContent value="scadenze" className="mt-4"><ScadenzeTab /></TabsContent>
        <TabsContent value="ricorrenze" className="mt-4"><RicorrenzeTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── TAB SCADENZE ────────────────────────────────────────────────
function ScadenzeTab() {
  const [tipo, setTipo] = useState("all");
  const [stato, setStato] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Scadenza | null>(null);

  const filtri = useMemo(() => ({
    tipo: tipo !== "all" ? tipo : undefined,
    stato: stato !== "all" ? stato : undefined,
  }), [tipo, stato]);

  const { data: scadenze = [], isLoading } = useScadenze(filtri);
  const deleteMut = useDeleteScadenza();
  const segnaPagataMut = useSegnaPagataScadenza();

  function apriNuovo() { setEditing(null); setDialogOpen(true); }
  function apriModifica(s: Scadenza) { setEditing(s); setDialogOpen(true); }
  function elimina(s: Scadenza) {
    if (confirm(`Eliminare la scadenza "${s.documento_rif || s.tipo}"?`)) deleteMut.mutate(s.id);
  }
  function segnaPagata(s: Scadenza) {
    if (confirm("Segnare questa scadenza come pagata/incassata per intero?")) segnaPagataMut.mutate(s);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={apriNuovo} className="gap-2"><Plus className="w-4 h-4" /> Nuova scadenza</Button>
      </div>
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-9 w-48 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                {TIPI_SCADENZA.map((t) => <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stato</Label>
            <Select value={stato} onValueChange={setStato}>
              <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="aperta">Aperta</SelectItem>
                <SelectItem value="parziale">Parziale</SelectItem>
                <SelectItem value="chiusa">Chiusa</SelectItem>
                <SelectItem value="scaduta">Scaduta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(tipo !== "all" || stato !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setTipo("all"); setStato("all"); }}>Azzera filtri</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Controparte</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead className="text-right">Residuo</TableHead>
                <TableHead className="text-center">Data attesa</TableHead>
                <TableHead className="text-center">Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Caricamento…</TableCell></TableRow>
              ) : scadenze.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Nessuna scadenza.</TableCell></TableRow>
              ) : scadenze.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{s.tipo}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.controparte_tipo ?? "—"}{s.documento_rif ? ` · ${s.documento_rif}` : ""}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold">{formatEuro(s.importo)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatEuro(s.importo_residuo)}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{format(new Date(s.data_attesa), "dd MMM yyyy", { locale: it })}</TableCell>
                  <TableCell className="text-center"><StatoBadge stato={s.stato} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(s.stato === "aperta" || s.stato === "parziale") && (
                        <button onClick={() => segnaPagata(s)} title="Segna pagata" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-emerald-500 hover:bg-muted/60">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => apriModifica(s)} title="Modifica" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => elimina(s)} title="Elimina" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-muted/60">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {dialogOpen && (
        <ScadenzaDialog key={editing?.id ?? "new"} editing={editing} onClose={() => setDialogOpen(false)} />
      )}
    </div>
  );
}

function ScadenzaDialog({ editing, onClose }: { editing: Scadenza | null; onClose: () => void }) {
  const createMut = useCreateScadenza();
  const updateMut = useUpdateScadenza();

  const [tipo, setTipo] = useState<string>(editing?.tipo ?? "");
  const [dataAttesa, setDataAttesa] = useState(editing?.data_attesa ?? "");
  const [importo, setImporto] = useState(editing?.importo != null ? String(editing.importo) : "");
  const [controparteTipo, setControparteTipo] = useState<string>(editing?.controparte_tipo ?? "none");
  const [documentoRif, setDocumentoRif] = useState(editing?.documento_rif ?? "");
  const [note, setNote] = useState(editing?.note ?? "");

  const valido = !!tipo && !!dataAttesa && Number(importo) > 0;
  const pending = createMut.isPending || updateMut.isPending;

  function salva() {
    if (!valido) return;
    const done = () => onClose();
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        data: {
          tipo: tipo as any, data_attesa: dataAttesa, importo: Number(importo),
          controparte_tipo: controparteTipo === "none" ? null : (controparteTipo as any),
          documento_rif: documentoRif.trim() || null, note: note.trim() || null,
        },
      }, { onSuccess: done });
    } else {
      const payload: ScadenzaInput = {
        tipo: tipo as any, data_attesa: dataAttesa, importo: Number(importo),
        controparte_tipo: controparteTipo === "none" ? null : (controparteTipo as any),
        documento_rif: documentoRif.trim() || null, note: note.trim() || null,
        origine: "manuale",
      };
      createMut.mutate(payload, { onSuccess: done });
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Modifica scadenza" : "Nuova scadenza"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>{TIPI_SCADENZA.map((t) => <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Controparte</Label>
              <Select value={controparteTipo} onValueChange={setControparteTipo}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {CONTROPARTI.map((c) => <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data attesa *</Label>
              <Input type="date" value={dataAttesa} onChange={(e) => setDataAttesa(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Importo € *</Label>
              <Input type="number" min="0.01" step="0.01" className="font-mono" value={importo} onChange={(e) => setImporto(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rif. documento</Label>
            <Input value={documentoRif} onChange={(e) => setDocumentoRif(e.target.value)} placeholder="es. Ft 123/2026" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="opzionale" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={salva} disabled={!valido || pending}>{pending ? "Salvando…" : "Salva"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── TAB RICORRENZE ──────────────────────────────────────────────
function RicorrenzeTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ricorrenza | null>(null);
  const [generaFor, setGeneraFor] = useState<Ricorrenza | null>(null);

  const { data: ricorrenze = [], isLoading } = useRicorrenze();
  const updateMut = useUpdateRicorrenza();
  const deleteMut = useDeleteRicorrenza();

  function apriNuovo() { setEditing(null); setDialogOpen(true); }
  function apriModifica(r: Ricorrenza) { setEditing(r); setDialogOpen(true); }
  function toggleAttivo(r: Ricorrenza) { updateMut.mutate({ id: r.id, data: { attivo: !r.attivo } }); }
  function elimina(r: Ricorrenza) {
    if (confirm(`Eliminare la ricorrenza "${r.descrizione}"?`)) deleteMut.mutate(r.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={apriNuovo} className="gap-2"><Plus className="w-4 h-4" /> Nuova ricorrenza</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrizione</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead className="text-center">Periodicità</TableHead>
                <TableHead className="text-center">Prossima data</TableHead>
                <TableHead className="text-center">Attiva</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Caricamento…</TableCell></TableRow>
              ) : ricorrenze.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Nessuna ricorrenza.</TableCell></TableRow>
              ) : ricorrenze.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-sm">{r.descrizione}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{r.tipo_scadenza}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold">{formatEuro(r.importo)}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground capitalize">{r.periodicita}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{r.prossima_data ? format(new Date(r.prossima_data), "dd MMM yyyy", { locale: it }) : "—"}</TableCell>
                  <TableCell className="text-center"><Switch checked={r.attivo} onCheckedChange={() => toggleAttivo(r)} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setGeneraFor(r)} title="Genera scadenze fino a" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/60">
                        <Repeat className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => apriModifica(r)} title="Modifica" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => elimina(r)} title="Elimina" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-muted/60">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {dialogOpen && (
        <RicorrenzaDialog key={editing?.id ?? "new"} editing={editing} onClose={() => setDialogOpen(false)} />
      )}
      {generaFor && (
        <GeneraOccorrenzeDialog ricorrenza={generaFor} onClose={() => setGeneraFor(null)} />
      )}
    </div>
  );
}

function RicorrenzaDialog({ editing, onClose }: { editing: Ricorrenza | null; onClose: () => void }) {
  const createMut = useCreateRicorrenza();
  const updateMut = useUpdateRicorrenza();

  const [descrizione, setDescrizione] = useState(editing?.descrizione ?? "");
  const [tipoScadenza, setTipoScadenza] = useState<string>(editing?.tipo_scadenza ?? "");
  const [importo, setImporto] = useState(editing?.importo != null ? String(editing.importo) : "");
  const [periodicita, setPeriodicita] = useState<string>(editing?.periodicita ?? "");
  const [giornoRif, setGiornoRif] = useState(editing?.giorno_riferimento != null ? String(editing.giorno_riferimento) : "");
  const [dataInizio, setDataInizio] = useState(editing?.data_inizio ?? "");
  const [dataFine, setDataFine] = useState(editing?.data_fine ?? "");
  const [controparteTipo, setControparteTipo] = useState<string>(editing?.controparte_tipo ?? "none");

  const valido = descrizione.trim() !== "" && !!tipoScadenza && !!periodicita && !!dataInizio && Number(importo) > 0;
  const pending = createMut.isPending || updateMut.isPending;

  function salva() {
    if (!valido) return;
    const done = () => onClose();
    const base = {
      descrizione: descrizione.trim(), tipo_scadenza: tipoScadenza as any, importo: Number(importo),
      periodicita: periodicita as any, giorno_riferimento: giornoRif ? Number(giornoRif) : null,
      data_inizio: dataInizio, data_fine: dataFine || null,
      controparte_tipo: controparteTipo === "none" ? null : (controparteTipo as any),
    };
    if (editing) updateMut.mutate({ id: editing.id, data: base }, { onSuccess: done });
    else createMut.mutate(base as RicorrenzaInput, { onSuccess: done });
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Modifica ricorrenza" : "Nuova ricorrenza"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label className="text-xs">Descrizione *</Label>
            <Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. Canone hosting" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo scadenza *</Label>
              <Select value={tipoScadenza} onValueChange={setTipoScadenza}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>{TIPI_SCADENZA.map((t) => <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Importo € *</Label>
              <Input type="number" min="0.01" step="0.01" className="font-mono" value={importo} onChange={(e) => setImporto(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Periodicità *</Label>
              <Select value={periodicita} onValueChange={setPeriodicita}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>{PERIODICITA.map((p) => <SelectItem key={p.value} value={p.value} className="text-sm">{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Giorno riferimento</Label>
              <Input type="number" min="1" max="31" value={giornoRif} onChange={(e) => setGiornoRif(e.target.value)} placeholder="es. 16" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data inizio *</Label>
              <Input type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data fine</Label>
              <Input type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Controparte</Label>
            <Select value={controparteTipo} onValueChange={setControparteTipo}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna</SelectItem>
                {CONTROPARTI.map((c) => <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={salva} disabled={!valido || pending}>{pending ? "Salvando…" : "Salva"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GeneraOccorrenzeDialog({ ricorrenza, onClose }: { ricorrenza: Ricorrenza; onClose: () => void }) {
  const [finoA, setFinoA] = useState("");
  const generaMut = useGeneraRicorrenze();

  function genera() {
    if (!finoA) return;
    generaMut.mutate({ ricorrenza_id: ricorrenza.id, fino_a: finoA }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Genera scadenze — {ricorrenza.descrizione}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Genera occorrenze fino a *</Label>
            <Input type="date" value={finoA} onChange={(e) => setFinoA(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={genera} disabled={!finoA || generaMut.isPending}>{generaMut.isPending ? "Generando…" : "Genera"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
