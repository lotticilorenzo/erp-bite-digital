import { useMemo, useState } from "react";
import { Coins, Plus, Pencil, Trash2, ArrowLeftRight, Info } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { formatEuro } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useRisorse } from "@/hooks/useRisorse";
import { useProgetti } from "@/hooks/useProgetti";
import {
  useCostiVariabili, useCreateCostoVariabile, useUpdateCostoVariabile, useDeleteCostoVariabile,
  type CostoVariabile, type CostoVariabileInput,
} from "@/hooks/useCostiVariabili";

const TIPI = [
  { value: "ORARIO", label: "Orario" },
  { value: "A_PROGETTO", label: "A progetto" },
  { value: "UNA_TANTUM", label: "Una tantum" },
] as const;

function StatoBadge({ stato }: { stato: string }) {
  return stato === "SOSTENUTO" ? (
    <Badge className="bg-muted/10 text-muted-foreground border-border/20 text-[10px] font-bold uppercase tracking-widest">Sostenuto</Badge>
  ) : (
    <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] font-bold uppercase tracking-widest">Previsto</Badge>
  );
}

export default function CostiVariabili() {
  const [stato, setStato] = useState<string>("all");
  const [dal, setDal] = useState<string>("");
  const [al, setAl] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CostoVariabile | null>(null);

  const filtri = useMemo(() => ({
    stato: stato !== "all" ? (stato as any) : undefined,
    dal: dal || undefined,
    al: al || undefined,
  }), [stato, dal, al]);

  const { data: costi = [], isLoading } = useCostiVariabili(filtri);
  const { data: risorse = [] } = useRisorse();
  const updateMut = useUpdateCostoVariabile();
  const deleteMut = useDeleteCostoVariabile();

  const risorsaNome = (id: string | null) => {
    if (!id) return null;
    const r = (risorse as any[]).find((x) => x.id === id);
    return r ? `${r.nome} ${r.cognome}` : null;
  };

  function apriNuovo() { setEditing(null); setDialogOpen(true); }
  function apriModifica(c: CostoVariabile) { setEditing(c); setDialogOpen(true); }

  function toggleStato(c: CostoVariabile) {
    updateMut.mutate({ id: c.id, data: { stato: c.stato === "PREVISTO" ? "SOSTENUTO" : "PREVISTO" } });
  }
  function elimina(c: CostoVariabile) {
    if (confirm(`Eliminare il costo variabile "${c.descrizione}"?`)) deleteMut.mutate(c.id);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Coins className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Costi Variabili</h1>
            <p className="text-sm text-muted-foreground">Registro dei costi a consumo (collaboratori, progetti).</p>
          </div>
        </div>
        <Button onClick={apriNuovo} className="gap-2"><Plus className="w-4 h-4" /> Nuovo costo</Button>
      </div>

      {/* Nota legame proiezione */}
      <div className="flex items-start gap-2 text-sm text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg px-4 py-2.5">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>I costi <b>PREVISTO</b> con data futura entrano come uscite nella proiezione cassa. I <b>SOSTENUTO</b> no.</span>
      </div>

      {/* Filtri */}
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Stato</Label>
            <Select value={stato} onValueChange={setStato}>
              <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="PREVISTO">Previsto</SelectItem>
                <SelectItem value="SOSTENUTO">Sostenuto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dal</Label>
            <Input type="date" className="h-9 w-40 text-sm" value={dal} onChange={(e) => setDal(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Al</Label>
            <Input type="date" className="h-9 w-40 text-sm" value={al} onChange={(e) => setAl(e.target.value)} />
          </div>
          {(dal || al || stato !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setStato("all"); setDal(""); setAl(""); }}>Azzera filtri</Button>
          )}
        </CardContent>
      </Card>

      {/* Tabella */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrizione</TableHead>
                <TableHead>Collaboratore</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead className="text-center">Data prevista</TableHead>
                <TableHead className="text-center">Ricorrenza</TableHead>
                <TableHead className="text-center">Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Caricamento…</TableCell></TableRow>
              ) : costi.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Nessun costo variabile.</TableCell></TableRow>
              ) : costi.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-sm">{c.descrizione}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{risorsaNome(c.collaboratore_risorsa_id) ?? c.collaboratore_nome ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{c.tipo}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold">{formatEuro(c.importo)}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{c.data_prevista ? format(new Date(c.data_prevista), "dd MMM yyyy", { locale: it }) : "—"}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{c.ricorrenza ?? "—"}</TableCell>
                  <TableCell className="text-center"><StatoBadge stato={c.stato} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleStato(c)} title="Cambia stato" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60">
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => apriModifica(c)} title="Modifica" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => elimina(c)} title="Elimina" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-muted/60">
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
        <CostoVariabileDialog
          key={editing?.id ?? "new"}
          editing={editing}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}

function CostoVariabileDialog({ editing, onClose }: { editing: CostoVariabile | null; onClose: () => void }) {
  const { data: risorse = [] } = useRisorse();
  const { data: progetti = [] } = useProgetti();
  const createMut = useCreateCostoVariabile();
  const updateMut = useUpdateCostoVariabile();

  const [descrizione, setDescrizione] = useState(editing?.descrizione ?? "");
  const [risorsaId, setRisorsaId] = useState<string>(editing?.collaboratore_risorsa_id ?? "none");
  const [collabNome, setCollabNome] = useState(editing?.collaboratore_nome ?? "");
  const [tipo, setTipo] = useState<string>(editing?.tipo ?? "");
  const [importo, setImporto] = useState(editing?.importo != null ? String(editing.importo) : "");
  const [dataPrevista, setDataPrevista] = useState(editing?.data_prevista ?? "");
  const [ricorrenza, setRicorrenza] = useState<string>(editing?.ricorrenza ?? "none");
  const [progettoId, setProgettoId] = useState<string>(editing?.progetto_id ?? "none");
  const [stato, setStato] = useState<string>(editing?.stato ?? "PREVISTO");
  const [note, setNote] = useState(editing?.note ?? "");

  const valido = descrizione.trim() !== "" && !!tipo && !!dataPrevista && Number(importo) > 0;
  const pending = createMut.isPending || updateMut.isPending;

  function salva() {
    if (!valido) return;
    const payload: CostoVariabileInput = {
      descrizione: descrizione.trim(),
      collaboratore_risorsa_id: risorsaId === "none" ? null : risorsaId,
      collaboratore_nome: collabNome.trim() || null,
      tipo: tipo as any,
      importo: Number(importo),
      data_prevista: dataPrevista,
      ricorrenza: ricorrenza === "none" ? null : (ricorrenza as any),
      progetto_id: progettoId === "none" ? null : progettoId,
      stato: stato as any,
      note: note.trim() || null,
    };
    const done = () => onClose();
    if (editing) updateMut.mutate({ id: editing.id, data: payload }, { onSuccess: done });
    else createMut.mutate(payload, { onSuccess: done });
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifica costo variabile" : "Nuovo costo variabile"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label className="text-xs">Descrizione *</Label>
            <Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. Benedetta — editing video" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Collaboratore (risorsa)</Label>
              <Select value={risorsaId} onValueChange={setRisorsaId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {(risorse as any[]).map((r) => <SelectItem key={r.id} value={r.id} className="text-sm">{r.nome} {r.cognome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">…oppure nome libero</Label>
              <Input value={collabNome} onChange={(e) => setCollabNome(e.target.value)} placeholder="se non in risorse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>{TIPI.map((t) => <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Importo € *</Label>
              <Input type="number" min="0.01" step="0.01" className="font-mono" value={importo} onChange={(e) => setImporto(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data prevista *</Label>
              <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ricorrenza</Label>
              <Select value={ricorrenza} onValueChange={setRicorrenza}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna (una tantum)</SelectItem>
                  <SelectItem value="MENSILE">Mensile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Progetto (opzionale)</Label>
              <Select value={progettoId} onValueChange={setProgettoId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nessuno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuno</SelectItem>
                  {(progetti as any[]).map((p) => <SelectItem key={p.id} value={p.id} className="text-sm">{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stato</Label>
              <Select value={stato} onValueChange={setStato}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREVISTO">Previsto</SelectItem>
                  <SelectItem value="SOSTENUTO">Sostenuto</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
