import { useState } from "react";
import {
  Plus, Trash2, Edit2, Play, Eye, ArrowUp, ArrowDown,
  ShieldCheck, Zap, ToggleLeft, ToggleRight, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  useRegoleRiconciliazione, useCreateRegola, useUpdateRegola,
  useDeleteRegola, useApplicaRegole, useDryRunRegole,
  type RegolaRiconciliazione, type DryRunPreviewItem,
} from "@/hooks/useRegoleRiconciliazione";
import { useFornitori } from "@/hooks/useFornitori";

const EMPTY_REGOLA: Omit<RegolaRiconciliazione, "id" | "contatore_match"> = {
  nome: "",
  pattern: "",
  tipo_match: "contains",
  categoria: "",
  fornitore_id: undefined,
  fattura_passiva_id: undefined,
  auto_riconcilia: false,
  priorita: 0,
  attiva: true,
};

const CATEGORIE_PREDEFINITE = [
  "HOSTING", "ADVERTISING", "FREELANCER", "SALARI", "SOFTWARE",
  "FORMAZIONE", "UTENZE", "AFFITTO", "ALTRO",
];

export default function RegoleRiconciliazione() {
  const { data: regole = [], isLoading } = useRegoleRiconciliazione();
  const { data: fornitori = [] } = useFornitori();
  const createMut = useCreateRegola();
  const updateMut = useUpdateRegola();
  const deleteMut = useDeleteRegola();
  const applicaMut = useApplicaRegole();
  const dryRunMut = useDryRunRegole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RegolaRiconciliazione | null>(null);
  const [form, setForm] = useState(EMPTY_REGOLA);
  const [dryRunSheet, setDryRunSheet] = useState(false);
  const [dryRunData, setDryRunData] = useState<DryRunPreviewItem[]>([]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_REGOLA);
    setDialogOpen(true);
  }

  function openEdit(r: RegolaRiconciliazione) {
    setEditTarget(r);
    setForm({
      nome: r.nome,
      pattern: r.pattern,
      tipo_match: r.tipo_match,
      categoria: r.categoria ?? "",
      fornitore_id: r.fornitore_id,
      fattura_passiva_id: r.fattura_passiva_id,
      auto_riconcilia: r.auto_riconcilia,
      priorita: r.priorita,
      attiva: r.attiva,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome || !form.pattern) {
      toast.error("Nome e Pattern sono obbligatori");
      return;
    }
    try {
      if (editTarget) {
        await updateMut.mutateAsync({ id: editTarget.id, ...form });
        toast.success("Regola aggiornata");
      } else {
        await createMut.mutateAsync(form as any);
        toast.success("Regola creata");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Errore durante il salvataggio");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Regola eliminata");
    } catch {
      toast.error("Errore durante l'eliminazione");
    }
  }

  async function handleApplica() {
    try {
      const res = await applicaMut.mutateAsync();
      toast.success(`${res.match_trovati} movimenti riconciliati su ${res.movimenti_processati}`);
    } catch {
      toast.error("Errore durante l'applicazione");
    }
  }

  async function handleDryRun() {
    try {
      const res = await dryRunMut.mutateAsync();
      setDryRunData(res.preview);
      setDryRunSheet(true);
      if (res.match_previsti === 0) {
        toast.info("Nessun movimento matcha le regole attive");
      }
    } catch {
      toast.error("Errore durante la simulazione");
    }
  }

  async function toggleAttiva(r: RegolaRiconciliazione) {
    await updateMut.mutateAsync({ id: r.id, attiva: !r.attiva });
    toast.success(r.attiva ? "Regola disattivata" : "Regola attivata");
  }

  const sortedRegole = [...regole].sort((a, b) => b.priorita - a.priorita);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Regole Riconciliazione
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automatizza il matching tra movimenti bancari e fatture
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDryRun} disabled={dryRunMut.isPending}>
            <Eye className="h-4 w-4 mr-1.5" />
            {dryRunMut.isPending ? "Simulando..." : "Simula"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleApplica} disabled={applicaMut.isPending}>
            <Play className="h-4 w-4 mr-1.5" />
            {applicaMut.isPending ? "Applicando..." : "Applica Tutte"}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nuova Regola
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Regole Attive", value: regole.filter(r => r.attiva).length, color: "text-emerald-400" },
          { label: "Regole Totali", value: regole.length, color: "text-foreground" },
          { label: "Match Totali", value: regole.reduce((s, r) => s + (r.contatore_match ?? 0), 0), color: "text-primary" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card/50 p-4">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{s.label}</p>
            <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-black uppercase tracking-widest w-12">#</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Nome</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Pattern</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Tipo Match</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Categoria</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Auto</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Match</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Stato</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted/40 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedRegole.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                  Nessuna regola. Crea la prima con "+ Nuova Regola".
                </TableCell>
              </TableRow>
            ) : (
              sortedRegole.map((r) => (
                <TableRow key={r.id} className={!r.attiva ? "opacity-40" : ""}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.priorita}</TableCell>
                  <TableCell className="font-bold text-sm">{r.nome}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{r.pattern}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-black">
                      {r.tipo_match}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-bold text-muted-foreground">{r.categoria || "—"}</TableCell>
                  <TableCell>
                    {r.auto_riconcilia ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-black">AUTO</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-black text-muted-foreground">SUGGERITO</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-bold">{r.contatore_match ?? 0}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleAttiva(r)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {r.attiva
                        ? <ToggleRight className="h-5 w-5 text-emerald-400" />
                        : <ToggleLeft className="h-5 w-5" />
                      }
                    </button>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(r)}>
                          <Edit2 className="h-3.5 w-3.5 mr-2" /> Modifica
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Crea/Modifica */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-black">
              {editTarget ? "Modifica Regola" : "Nuova Regola"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest">Nome *</Label>
                <Input
                  placeholder="Es: Pagamento Aruba hosting"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest">Pattern *</Label>
                <Input
                  placeholder="Es: ARUBA S.P.A."
                  value={form.pattern}
                  onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest">Tipo Match</Label>
                <Select
                  value={form.tipo_match}
                  onValueChange={v => setForm(f => ({ ...f, tipo_match: v as any }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="startswith">Starts With</SelectItem>
                    <SelectItem value="endswith">Ends With</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest">Categoria</Label>
                <Select
                  value={form.categoria || ""}
                  onValueChange={v => setForm(f => ({ ...f, categoria: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIE_PREDEFINITE.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest">Priorità</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.priorita}
                  onChange={e => setForm(f => ({ ...f, priorita: Number(e.target.value) }))}
                  placeholder="0 = bassa, 100 = alta"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest">Fornitore</Label>
                <Select
                  value={form.fornitore_id || "none"}
                  onValueChange={v => setForm(f => ({ ...f, fornitore_id: v === "none" ? undefined : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {(fornitori as any[]).map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>{f.ragione_sociale}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-bold">Auto Riconcilia</p>
                  <p className="text-xs text-muted-foreground">Applica automaticamente senza conferma</p>
                </div>
                <Switch
                  checked={form.auto_riconcilia}
                  onCheckedChange={v => setForm(f => ({ ...f, auto_riconcilia: v }))}
                />
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-bold">Regola Attiva</p>
                  <p className="text-xs text-muted-foreground">Le regole inattive vengono ignorate</p>
                </div>
                <Switch
                  checked={form.attiva}
                  onCheckedChange={v => setForm(f => ({ ...f, attiva: v }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editTarget ? "Salva Modifiche" : "Crea Regola"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet Dry-Run */}
      <Sheet open={dryRunSheet} onOpenChange={setDryRunSheet}>
        <SheetContent className="w-[560px] sm:max-w-[560px]">
          <SheetHeader>
            <SheetTitle className="font-black flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Preview — {dryRunData.length} movimenti verranno processati
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-140px)]">
            {dryRunData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nessun movimento matcha le regole attive al momento.
              </p>
            ) : (
              dryRunData.map((item, i) => (
                <div key={i} className="rounded-xl border border-border p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold truncate">{item.movimento_descrizione || "—"}</p>
                    <Badge
                      className={item.azione === "RICONCILIA_AUTO"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0 text-[10px] font-black"
                        : "shrink-0 text-[10px] font-black"
                      }
                    >
                      {item.azione === "RICONCILIA_AUTO" ? "AUTO" : "CATEGORIZZA"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono font-bold">€{item.movimento_importo?.toFixed(2)}</span>
                    <span>→ Regola: <strong className="text-foreground">{item.regola_nome}</strong></span>
                    {item.categoria_prevista && (
                      <Badge variant="outline" className="text-[10px] font-black">{item.categoria_prevista}</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
