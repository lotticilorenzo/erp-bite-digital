import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Check, ChevronsUpDown, Save, Eraser } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { useClienti } from "@/hooks/useClienti";
import { useRisorse } from "@/hooks/useRisorse";
import {
  usePesiContenuto, useUpdatePeso, useConfigPlMemo, useUpdateConfigPlMemo,
} from "@/hooks/useFinanceConfig";

export default function ImpostazioniFinanza() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <SlidersHorizontal className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-black tracking-tight">Impostazioni Finanza</h1>
          <p className="text-sm text-muted-foreground">Configurazioni che alimentano i report finance.</p>
        </div>
      </div>
      <SezionePesiContenuto />
      <SezioneMemoClienteDedicato />
    </div>
  );
}

// ── SEZIONE A — Pesi Contenuto (§7.5) ──
function SezionePesiContenuto() {
  const { data: pesi, isLoading } = usePesiContenuto();
  const updatePeso = useUpdatePeso();
  const [local, setLocal] = useState<Record<string, string>>({});

  useEffect(() => {
    if (pesi) setLocal(Object.fromEntries(pesi.map((p) => [p.tipo, String(p.peso)])));
  }, [pesi]);

  const changed = useMemo(() => {
    if (!pesi) return [] as { tipo: string; peso: number }[];
    return pesi
      .filter((p) => local[p.tipo] !== undefined && Number(local[p.tipo]) !== p.peso)
      .map((p) => ({ tipo: p.tipo, peso: Number(local[p.tipo]) }));
  }, [pesi, local]);

  const hasInvalid = Object.values(local).some((v) => v === "" || Number(v) <= 0 || isNaN(Number(v)));

  async function salva() {
    for (const c of changed) {
      await updatePeso.mutateAsync(c);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pesi per tipo contenuto</CardTitle>
        <p className="text-sm text-muted-foreground">
          I pesi determinano come la quota Luca è ripartita tra i clienti in base ai contenuti prodotti.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || !pesi ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : (
          <>
            <div className="divide-y divide-border/50">
              {pesi.map((p) => {
                const val = local[p.tipo] ?? String(p.peso);
                const invalid = val === "" || Number(val) <= 0 || isNaN(Number(val));
                return (
                  <div key={p.tipo} className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium">{p.tipo}</span>
                    <div className="flex flex-col items-end">
                      <Input
                        type="number" min="0.01" step="0.5"
                        className={`h-8 w-24 text-sm font-mono text-right ${invalid ? "border-rose-500" : ""}`}
                        value={val}
                        onChange={(e) => setLocal((s) => ({ ...s, [p.tipo]: e.target.value }))}
                      />
                      {invalid && <span className="text-[10px] text-rose-500">peso deve essere &gt; 0</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={salva}
                disabled={hasInvalid || changed.length === 0 || updatePeso.isPending}
              >
                <Save className="w-4 h-4 mr-1.5" />
                {updatePeso.isPending ? "Salvando…" : `Salva pesi${changed.length ? ` (${changed.length})` : ""}`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── SEZIONE B — Memo Cliente Dedicato (§7.6) ──
function SezioneMemoClienteDedicato() {
  const { data: cfg } = useConfigPlMemo();
  const { data: clienti = [] } = useClienti();
  const { data: risorse = [] } = useRisorse();
  const updateCfg = useUpdateConfigPlMemo();

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [collabId, setCollabId] = useState<string | null>(null);
  const [costo, setCosto] = useState<string>("");
  const [openCli, setOpenCli] = useState(false);

  useEffect(() => {
    if (cfg) {
      setClienteId(cfg.cliente_dedicato_id);
      setCollabId(cfg.collaboratore_dedicato_id);
      setCosto(cfg.costo_collaboratore_mensile != null ? String(cfg.costo_collaboratore_mensile) : "");
    }
  }, [cfg]);

  const clienteSel = (clienti as any[]).find((c) => c.id === clienteId);

  async function salva() {
    await updateCfg.mutateAsync({
      cliente_dedicato_id: clienteId,
      collaboratore_dedicato_id: collabId,
      costo_collaboratore_mensile: costo.trim() === "" ? null : Number(costo),
    });
  }

  async function azzera() {
    await updateCfg.mutateAsync({
      cliente_dedicato_id: null,
      collaboratore_dedicato_id: null,
      costo_collaboratore_mensile: null,
    });
    setClienteId(null);
    setCollabId(null);
    setCosto("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Memo cliente dedicato (P&L)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Evidenzia nel P&L lo scostamento tra il ricavo di questo cliente e il costo del collaboratore.
          Lasciare vuoto per disattivare.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Cliente dedicato — combobox ricercabile */}
          <div className="space-y-1">
            <Label className="text-xs">Cliente dedicato</Label>
            <Popover open={openCli} onOpenChange={setOpenCli}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full h-9 justify-between text-sm font-normal">
                  <span className="truncate">{clienteSel ? clienteSel.ragione_sociale : <span className="text-muted-foreground">Nessuno</span>}</span>
                  <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca cliente…" className="text-xs" />
                  <CommandList>
                    <CommandEmpty>Nessun cliente.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="__nessuno__" onSelect={() => { setClienteId(null); setOpenCli(false); }} className="text-xs">
                        <Check className={`mr-2 h-3.5 w-3.5 ${clienteId === null ? "opacity-100" : "opacity-0"}`} />
                        Nessuno (disattiva)
                      </CommandItem>
                      {(clienti as any[]).map((c) => (
                        <CommandItem key={c.id} value={c.ragione_sociale} onSelect={() => { setClienteId(c.id); setOpenCli(false); }} className="text-xs">
                          <Check className={`mr-2 h-3.5 w-3.5 ${clienteId === c.id ? "opacity-100" : "opacity-0"}`} />
                          {c.ragione_sociale}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Collaboratore dedicato — select */}
          <div className="space-y-1">
            <Label className="text-xs">Collaboratore dedicato</Label>
            <Select value={collabId ?? "none"} onValueChange={(v) => setCollabId(v === "none" ? null : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nessuno" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm">Nessuno</SelectItem>
                {(risorse as any[]).map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-sm">{r.nome} {r.cognome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Costo mensile collaboratore — opzionale */}
          <div className="space-y-1">
            <Label className="text-xs">Costo mensile (€)</Label>
            <Input
              type="number" min="0" step="0.01"
              className="h-9 text-sm font-mono"
              placeholder="da definire"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
            />
            <span className="text-[10px] text-muted-foreground">Vuoto = da cedolino (esterno)</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={azzera} disabled={updateCfg.isPending}>
            <Eraser className="w-4 h-4 mr-1.5" /> Azzera
          </Button>
          <Button size="sm" onClick={salva} disabled={updateCfg.isPending}>
            <Save className="w-4 h-4 mr-1.5" /> {updateCfg.isPending ? "Salvando…" : "Salva"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
