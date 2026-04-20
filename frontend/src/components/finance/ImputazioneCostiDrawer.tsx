import { useState, useEffect } from "react";
import { Plus, Trash2, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Imputazione, ImputazioneTipo } from "@/types";
import { useClienti } from "@/hooks/useClienti";
import { useProgetti } from "@/hooks/useProgetti";

interface ImputazioneCostiDrawerProps {
  open: boolean;
  onClose: () => void;
  sourceType: "fattura_passiva" | "movimento_cassa";
  sourceId: string;
  importoTotale: number;
  sourceLabel?: string;
}

const TIPI_IMPUTAZIONE: { value: ImputazioneTipo; label: string }[] = [
  { value: "PROGETTO", label: "Progetto" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "SPESA_GENERICA", label: "Spesa Generica" },
  { value: "STIPENDIO", label: "Stipendio" },
  { value: "FORNITORE", label: "Fornitore" },
  { value: "ALTRO", label: "Altro" },
];

type ImputazioneForm = {
  tipo: ImputazioneTipo;
  cliente_id: string;
  progetto_id: string;
  percentuale: string;
  note: string;
};

const emptyRow = (): ImputazioneForm => ({
  tipo: "PROGETTO", cliente_id: "", progetto_id: "", percentuale: "", note: "",
});

export function ImputazioneCostiDrawer({
  open, onClose, sourceType, sourceId, importoTotale, sourceLabel,
}: ImputazioneCostiDrawerProps) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ImputazioneForm[]>([emptyRow()]);

  const apiBase = sourceType === "fattura_passiva"
    ? `/fatture-passive/${sourceId}/imputazioni`
    : `/movimenti-cassa/${sourceId}/imputazioni`;

  const queryKey = [sourceType, sourceId, "imputazioni"];

  const { data: existing = [] } = useQuery<Imputazione[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get(apiBase);
      return Array.isArray(data) ? data : (data.imputazioni ?? []);
    },
    enabled: open && !!sourceId,
  });

  useEffect(() => {
    if (existing.length > 0) {
      setRows(existing.map(i => ({
        tipo: i.tipo,
        cliente_id: i.cliente_id ?? "",
        progetto_id: i.progetto_id ?? "",
        percentuale: String(i.percentuale),
        note: i.note ?? "",
      })));
    } else {
      setRows([emptyRow()]);
    }
  }, [existing, open]);

  const { data: clienti = [] } = useClienti();
  const { data: progetti = [] } = useProgetti();

  const saveMut = useMutation({
    mutationFn: async (imputazioni: object[]) => {
      const { data } = await api.post(apiBase, { imputazioni });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["commesse"] });
      toast.success("Imputazioni salvate");
      onClose();
    },
    onError: () => toast.error("Errore durante il salvataggio"),
  });

  const totalePct = rows.reduce((s, r) => s + (parseFloat(r.percentuale) || 0), 0);
  const isComplete = Math.abs(totalePct - 100) < 0.01;
  const isOver = totalePct > 100;

  const progettiFiltered = (clienteId: string) =>
    progetti.filter((p: any) => !clienteId || p.cliente_id === clienteId);

  function updateRow(i: number, patch: Partial<ImputazioneForm>) {
    setRows(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function addRow() { setRows(r => [...r, emptyRow()]); }
  function removeRow(i: number) { setRows(r => r.filter((_, idx) => idx !== i)); }

  function handleSave() {
    if (isOver) { toast.error("La somma delle percentuali supera 100%"); return; }
    const payload = rows
      .filter(r => r.percentuale && parseFloat(r.percentuale) > 0)
      .map(r => ({
        tipo: r.tipo,
        cliente_id: r.cliente_id || null,
        progetto_id: r.progetto_id || null,
        percentuale: parseFloat(r.percentuale),
        importo: round2(importoTotale * parseFloat(r.percentuale) / 100),
        note: r.note || null,
      }));
    saveMut.mutate(payload);
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-[560px] sm:max-w-[560px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-black">Imputa Costi</SheetTitle>
          <SheetDescription className="text-xs">
            {sourceLabel && <span className="font-bold text-foreground">{sourceLabel}</span>}
            {" — "}Importo totale: <span className="font-mono font-bold text-foreground">€{importoTotale?.toFixed(2)}</span>
          </SheetDescription>
        </SheetHeader>

        {/* Totale percentuale */}
        <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border ${
          isComplete ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          : isOver ? "bg-red-500/10 border-red-500/20 text-red-400"
          : "bg-amber-500/10 border-amber-500/20 text-amber-400"
        }`}>
          {isComplete
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />
          }
          Totale imputato: {totalePct.toFixed(1)}% — €{(importoTotale * totalePct / 100).toFixed(2)} / €{importoTotale?.toFixed(2)}
          {!isComplete && !isOver && <span className="ml-auto text-xs opacity-70">mancano {(100 - totalePct).toFixed(1)}%</span>}
        </div>

        {/* Righe */}
        <div className="flex-1 overflow-y-auto space-y-3 mt-4 pr-1">
          {rows.map((row, i) => (
            <div key={i} className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                  Imputazione {i + 1}
                </span>
                <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Tipo</Label>
                  <Select value={row.tipo} onValueChange={v => updateRow(i, { tipo: v as ImputazioneTipo })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPI_IMPUTAZIONE.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Percentuale %</Label>
                  <Input
                    type="number" min="0" max="100" step="0.1"
                    className="h-8 text-xs font-mono"
                    placeholder="es. 60"
                    value={row.percentuale}
                    onChange={e => updateRow(i, { percentuale: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Cliente</Label>
                  <Select
                    value={row.cliente_id || "none"}
                    onValueChange={v => updateRow(i, { cliente_id: v === "none" ? "" : v, progetto_id: "" })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nessuno" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Nessuno</SelectItem>
                      {(clienti as any[]).map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.ragione_sociale}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Progetto</Label>
                  <Select
                    value={row.progetto_id || "none"}
                    onValueChange={v => updateRow(i, { progetto_id: v === "none" ? "" : v })}
                    disabled={!row.cliente_id}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nessuno" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Nessuno</SelectItem>
                      {progettiFiltered(row.cliente_id).map((p: any) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {row.percentuale && parseFloat(row.percentuale) > 0 && (
                <div className="text-right text-xs font-mono text-primary font-bold">
                  = €{(importoTotale * parseFloat(row.percentuale) / 100).toFixed(2)}
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRow} className="w-full h-8 text-xs border-dashed">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Aggiungi imputazione
          </Button>
        </div>

        <div className="pt-4 border-t border-border flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Annulla</Button>
          <Button onClick={handleSave} disabled={saveMut.isPending || rows.length === 0} className="flex-1">
            <Save className="h-4 w-4 mr-1.5" />
            {saveMut.isPending ? "Salvando..." : "Salva Imputazioni"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function round2(n: number) { return Math.round(n * 100) / 100; }
