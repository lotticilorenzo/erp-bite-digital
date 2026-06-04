import { useMemo, useState } from "react";
import { Plus, Trash2, Save, AlertCircle, CheckCircle2, Link2, Wand2, Check, ChevronsUpDown } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { formatEuro } from "@/lib/utils";
import { useFattureAttive, useFatturePassive } from "@/hooks/useFatture";
import {
  useRiconciliazioniMovimento, useCreateRiconciliazioni, useDeleteRiconciliazione,
  useSuggestRiconciliazione,
} from "@/hooks/useRiconciliazioni";

interface RiconciliazioneDrawerProps {
  open: boolean;
  onClose: () => void;
  movimento: any | null;
}

interface FatturaOption {
  key: string;            // "attiva:<id>" | "passiva:<id>"
  type: "attiva" | "passiva";
  id: string;
  numero: string;
  controparte: string;
  residuo: number;
}

interface RigaForm {
  fatturaKey: string;
  importo: string;
  note: string;
}

const emptyRow = (): RigaForm => ({ fatturaKey: "", importo: "", note: "" });

export function RiconciliazioneDrawer({ open, onClose, movimento }: RiconciliazioneDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      {open && movimento ? (
        <RiconciliazioneDrawerContent key={movimento.id} movimento={movimento} onClose={onClose} />
      ) : null}
    </Sheet>
  );
}

function RiconciliazioneDrawerContent({ movimento, onClose }: { movimento: any; onClose: () => void }) {
  const { data: esistenti = [] } = useRiconciliazioniMovimento(movimento.id);
  const { data: attive = [] } = useFattureAttive();
  const { data: passive = [] } = useFatturePassive();
  const createMut = useCreateRiconciliazioni();
  const deleteMut = useDeleteRiconciliazione();
  const suggestMut = useSuggestRiconciliazione();

  const [rows, setRows] = useState<RigaForm[]>([emptyRow()]);

  const importoMovimento = Math.abs(Number(movimento.importo) || 0);
  // residuo disponibile = importo movimento - già riconciliato (i derivati arrivano dalla lista)
  const residuoDisponibile = Number(
    movimento.residuo_movimento ?? (importoMovimento - Number(movimento.importo_riconciliato || 0))
  );

  // Opzioni fattura: attive + passive con residuo aperto (o referenziate dalle righe esistenti).
  const opzioni = useMemo<FatturaOption[]>(() => {
    const out: FatturaOption[] = [];
    for (const f of attive as any[]) {
      if (Number(f.importo_residuo) > 0.005) {
        out.push({
          key: `attiva:${f.id}`, type: "attiva", id: f.id,
          numero: f.numero || "s/n",
          controparte: f.cliente?.ragione_sociale || "Cliente",
          residuo: Number(f.importo_residuo),
        });
      }
    }
    for (const f of passive as any[]) {
      if (Number(f.importo_residuo) > 0.005) {
        out.push({
          key: `passiva:${f.id}`, type: "passiva", id: f.id,
          numero: f.numero || "s/n",
          controparte: f.fornitore?.ragione_sociale || f.fornitore_nome || "Fornitore",
          residuo: Number(f.importo_residuo),
        });
      }
    }
    return out;
  }, [attive, passive]);

  const optByKey = useMemo(() => {
    const m = new Map<string, FatturaOption>();
    opzioni.forEach((o) => m.set(o.key, o));
    return m;
  }, [opzioni]);

  const sommaNuove = rows.reduce((s, r) => s + (parseFloat(r.importo) || 0), 0);
  const residuoDopo = residuoDisponibile - sommaNuove;

  // Validazione: ogni riga <= residuo fattura, Σ nuove <= residuo movimento.
  const rigaErrors = rows.map((r) => {
    if (!r.fatturaKey || !r.importo) return null;
    const imp = parseFloat(r.importo) || 0;
    const opt = optByKey.get(r.fatturaKey);
    if (imp <= 0) return "Importo deve essere > 0";
    if (opt && imp > opt.residuo + 0.005) return `Supera il residuo fattura (${formatEuro(opt.residuo)})`;
    return null;
  });
  const sforaMovimento = sommaNuove > residuoDisponibile + 0.005;
  const righeValide = rows.filter((r) => r.fatturaKey && parseFloat(r.importo) > 0);
  const hasError = rigaErrors.some(Boolean) || sforaMovimento;
  const canSubmit = righeValide.length > 0 && !hasError && !createMut.isPending;

  function updateRow(i: number, patch: Partial<RigaForm>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((r) => [...r, emptyRow()]); }
  function removeRow(i: number) { setRows((r) => (r.length === 1 ? [emptyRow()] : r.filter((_, idx) => idx !== i))); }

  async function handleSuggest() {
    try {
      const res = await suggestMut.mutateAsync(movimento.id);
      const top = res.fatture_importo?.[0];
      if (!top) { toast.info("Nessun suggerimento per questo movimento."); return; }
      const key = `passiva:${top.id}`;
      // precompila la prima riga vuota (o ne aggiunge una)
      setRows((rs) => {
        const idx = rs.findIndex((r) => !r.fatturaKey);
        const riga: RigaForm = { fatturaKey: key, importo: String(top.importo_suggerito), note: "" };
        if (idx >= 0) return rs.map((r, i) => (i === idx ? riga : r));
        return [...rs, riga];
      });
      toast.success(`Suggerimento: ${top.numero || "fattura"} — ${formatEuro(top.importo_suggerito)}`);
    } catch {
      toast.error("Suggerimento non disponibile");
    }
  }

  function handleRiconciliaTutto() {
    // Scorciatoia 1:1: una sola riga, importo = min(residuo movimento, residuo fattura).
    const r0 = rows[0];
    const opt = r0?.fatturaKey ? optByKey.get(r0.fatturaKey) : null;
    if (!opt) { toast.info("Seleziona prima una fattura nella prima riga."); return; }
    const importo = Math.min(residuoDisponibile, opt.residuo);
    setRows([{ fatturaKey: opt.key, importo: importo.toFixed(2), note: r0.note || "" }]);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    const righe = righeValide.map((r) => {
      const opt = optByKey.get(r.fatturaKey)!;
      return {
        [opt.type === "attiva" ? "fattura_attiva_id" : "fattura_passiva_id"]: opt.id,
        importo: parseFloat(r.importo),
        note: r.note || undefined,
      };
    });
    try {
      await createMut.mutateAsync({ movimentoId: movimento.id, righe });
      toast.success("Riconciliazione salvata");
      setRows([emptyRow()]);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Errore durante la riconciliazione");
    }
  }

  async function handleDeleteEsistente(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Riga rimossa");
    } catch {
      toast.error("Errore durante la rimozione");
    }
  }

  const labelFor = (r: any) =>
    r.fattura_attiva_id
      ? (attive as any[]).find((f) => f.id === r.fattura_attiva_id)
      : (passive as any[]).find((f) => f.id === r.fattura_passiva_id);

  return (
    <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col">
      <SheetHeader>
        <SheetTitle className="font-black flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" /> Riconcilia movimento
        </SheetTitle>
        <SheetDescription className="text-xs">
          <span className="font-bold text-foreground">{movimento.descrizione || "Movimento"}</span>
          {" — "}importo <span className="font-mono font-bold text-foreground">{formatEuro(importoMovimento)}</span>
        </SheetDescription>
      </SheetHeader>

      {/* Barra residuo disponibile */}
      <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border ${
        sforaMovimento ? "bg-red-500/10 border-red-500/20 text-red-400"
        : residuoDopo <= 0.005 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        : "bg-amber-500/10 border-amber-500/20 text-amber-400"
      }`}>
        {sforaMovimento ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
        Residuo movimento: {formatEuro(residuoDopo)} / {formatEuro(residuoDisponibile)}
        {sforaMovimento && <span className="ml-auto text-xs">supera il disponibile</span>}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
        {/* Riconciliazioni esistenti */}
        {esistenti.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Già riconciliato</span>
            {esistenti.map((r) => {
              const f = labelFor(r);
              return (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card/50 px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">
                      {f?.numero || (r.fattura_attiva_id ? "Fattura attiva" : "Fattura passiva")}
                      <span className="text-muted-foreground font-medium"> — {r.fattura_attiva_id ? (f?.cliente?.ragione_sociale || "Cliente") : (f?.fornitore?.ragione_sociale || f?.fornitore_nome || "Fornitore")}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">{r.data ? format(new Date(r.data), "dd MMM yyyy", { locale: it }) : ""}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-foreground">{formatEuro(Number(r.importo))}</span>
                    <button onClick={() => handleDeleteEsistente(r.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Rimuovi riconciliazione">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Azioni rapide */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSuggest} disabled={suggestMut.isPending} className="h-8 text-xs gap-1.5">
            <Wand2 className="h-3.5 w-3.5" /> Usa suggerimento
          </Button>
          <Button variant="outline" size="sm" onClick={handleRiconciliaTutto} className="h-8 text-xs gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Riconcilia tutto su una fattura
          </Button>
        </div>

        {/* Nuove righe */}
        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nuove righe</span>
          {rows.map((row, i) => {
            const opt = row.fatturaKey ? optByKey.get(row.fatturaKey) : null;
            return (
              <div key={i} className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Riga {i + 1}</span>
                  <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Fattura</Label>
                  <FatturaCombobox
                    options={opzioni}
                    value={row.fatturaKey}
                    onChange={(key) => {
                      const o = optByKey.get(key);
                      // precompila importo col min(residuo fattura, residuo movimento ancora libero)
                      const liberoMov = residuoDisponibile - (sommaNuove - (parseFloat(row.importo) || 0));
                      const suggerito = o ? Math.max(0, Math.min(o.residuo, liberoMov)) : 0;
                      updateRow(i, { fatturaKey: key, importo: row.importo || (suggerito > 0 ? suggerito.toFixed(2) : "") });
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Importo €</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      className="h-8 text-xs font-mono"
                      value={row.importo}
                      onChange={(e) => updateRow(i, { importo: e.target.value })}
                    />
                    {opt && <span className="text-[9px] text-muted-foreground">residuo fattura {formatEuro(opt.residuo)}</span>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Note</Label>
                    <Input className="h-8 text-xs" value={row.note} onChange={(e) => updateRow(i, { note: e.target.value })} />
                  </div>
                </div>
                {rigaErrors[i] && (
                  <p className="text-[10px] text-red-400 font-bold flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {rigaErrors[i]}</p>
                )}
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addRow} className="w-full h-8 text-xs border-dashed">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Aggiungi riga
          </Button>
        </div>
      </div>

      <div className="pt-4 border-t border-border flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Chiudi</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
          <Save className="h-4 w-4 mr-1.5" />
          {createMut.isPending ? "Salvando..." : "Salva riconciliazione"}
        </Button>
      </div>
    </SheetContent>
  );
}

function FatturaCombobox({ options, value, onChange }: {
  options: FatturaOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal">
          {selected ? (
            <span className="truncate">
              <Badge variant="outline" className={`mr-1.5 px-1 py-0 text-[8px] ${selected.type === "attiva" ? "text-emerald-500 border-emerald-500/30" : "text-rose-500 border-rose-500/30"}`}>
                {selected.type === "attiva" ? "ATT" : "PAS"}
              </Badge>
              {selected.numero} — {selected.controparte}
            </span>
          ) : <span className="text-muted-foreground">Seleziona fattura...</span>}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Cerca numero o controparte..." className="text-xs" />
          <CommandList>
            <CommandEmpty>Nessuna fattura con residuo aperto.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.key}
                  value={`${o.numero} ${o.controparte} ${o.type}`}
                  onSelect={() => { onChange(o.key); setOpen(false); }}
                  className="text-xs"
                >
                  <Check className={`mr-2 h-3.5 w-3.5 ${value === o.key ? "opacity-100" : "opacity-0"}`} />
                  <Badge variant="outline" className={`mr-1.5 px-1 py-0 text-[8px] ${o.type === "attiva" ? "text-emerald-500 border-emerald-500/30" : "text-rose-500 border-rose-500/30"}`}>
                    {o.type === "attiva" ? "ATT" : "PAS"}
                  </Badge>
                  <span className="flex-1 truncate">{o.numero} — {o.controparte}</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">{formatEuro(o.residuo)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
