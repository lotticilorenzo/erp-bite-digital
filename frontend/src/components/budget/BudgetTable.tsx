import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, PencilLine, Save, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBudget } from "@/hooks/useBudget";
import type { BudgetVariance, BudgetVarianceStatus } from "@/types/budget";
import { cn } from "@/lib/utils";

interface BudgetTableProps {
  mese: Date;
  data: BudgetVariance[];
  isLoading: boolean;
}

const STATUS_META: Record<BudgetVarianceStatus, { label: string; pill: string; bar: string; text: string }> = {
  ok: {
    label: "OK",
    pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    bar: "bg-emerald-500",
    text: "text-emerald-400",
  },
  warning: {
    label: "Warning",
    pill: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    bar: "bg-amber-500",
    text: "text-amber-400",
  },
  over: {
    label: "Over",
    pill: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    bar: "bg-rose-500",
    text: "text-rose-400",
  },
};

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function BudgetTable({ mese, data, isLoading }: BudgetTableProps) {
  const { upsertBudget } = useBudget(mese);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [valore, setValore] = useState("");

  const totals = useMemo(() => {
    const budget = data.reduce((acc, item) => acc + Number(item.budget || 0), 0);
    const speso = data.reduce((acc, item) => acc + Number(item.speso || 0), 0);
    const varianza = speso - budget;
    const percentualeUtilizzo = budget > 0 ? (speso / budget) * 100 : (speso > 0 ? 100 : 0);
    const varianzaPct = budget > 0 ? (varianza / budget) * 100 : (speso > 0 ? 100 : 0);
    const status: BudgetVarianceStatus = percentualeUtilizzo > 100 ? "over" : percentualeUtilizzo >= 80 ? "warning" : "ok";

    return { budget, speso, varianza, percentualeUtilizzo, varianzaPct, status };
  }, [data]);

  function startEdit(item: BudgetVariance) {
    setEditingId(item.categoria_id);
    setValore(String(item.budget ?? 0));
  }

  async function handleSave(categoriaId: string) {
    try {
      await upsertBudget.mutateAsync({
        categoria_id: categoriaId,
        mese_competenza: format(mese, "yyyy-MM-01"),
        importo_budget: parseFloat(valore || "0"),
      });
      toast.success("Budget aggiornato");
      setEditingId(null);
      setValore("");
    } catch {
      toast.error("Errore durante l'aggiornamento");
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-52 rounded-3xl border border-border bg-card/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-card/30 p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground">
          <Wallet className="h-6 w-6" />
        </div>
        <p className="text-lg font-black text-white">Nessun budget impostato per questo mese</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Crea categorie o copia il mese precedente per iniziare a monitorare la spesa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BudgetTotalCard totals={totals} />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {data.map((item) => {
          const meta = STATUS_META[item.status];
          const progress = Math.min(item.percentuale_utilizzo, 140);
          const isEditing = editingId === item.categoria_id;

          return (
            <div
              key={item.categoria_id}
              onClick={() => !isEditing && startEdit(item)}
              className={cn(
                "group rounded-[28px] border border-border bg-card/60 p-5 shadow-xl transition-all",
                "hover:border-primary/30 hover:bg-card hover:shadow-2xl cursor-pointer",
                item.status === "over" && "border-rose-500/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.categoria_colore }}
                    />
                    <h3 className="truncate text-lg font-black text-white">{item.categoria_nome}</h3>
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {euro(item.speso)} / {euro(item.budget)} ({item.percentuale_utilizzo.toFixed(0)}%)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={cn("border text-[10px] font-black uppercase tracking-widest", meta.pill)}>
                    {meta.label}
                  </Badge>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        startEdit(item);
                      }}
                      className="rounded-xl border border-border/60 p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <div className="h-3 overflow-hidden rounded-full bg-muted/50">
                  <div
                    className={cn("h-full rounded-full transition-all", meta.bar)}
                    style={{ width: `${Math.max(4, Math.min(progress, 100))}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                  <span className={meta.text}>{item.percentuale_utilizzo.toFixed(1)}% utilizzato</span>
                  <span className="text-muted-foreground">
                    {item.varianza >= 0 ? "+" : "-"}
                    {euro(Math.abs(item.varianza))}
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-border/60 bg-background/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Budget Pianificato
                    </p>
                    {isEditing ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valore}
                        onChange={(event) => setValore(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-2 h-10 max-w-[180px] bg-background font-bold"
                        autoFocus
                      />
                    ) : (
                      <p className="mt-2 text-2xl font-black text-white">{euro(item.budget)}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Varianza
                    </p>
                    <p className={cn("mt-2 text-xl font-black", item.varianza > 0 ? "text-rose-400" : "text-emerald-400")}>
                      {item.varianza > 0 ? "+" : "-"}
                      {euro(Math.abs(item.varianza))}
                    </p>
                    <p className={cn("text-xs font-bold", item.varianza > 0 ? "text-rose-300" : "text-emerald-300")}>
                      {item.varianza_pct > 0 ? "+" : ""}
                      {item.varianza_pct.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {item.note && (
                  <p className="mt-4 line-clamp-2 text-xs text-muted-foreground">
                    {item.note}
                  </p>
                )}

                {isEditing && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingId(null);
                        setValore("");
                      }}
                      className="flex-1"
                    >
                      Annulla
                    </Button>
                    <Button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSave(item.categoria_id);
                      }}
                      disabled={upsertBudget.isPending}
                      className="flex-1"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Salva
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetTotalCard({
  totals,
}: {
  totals: {
    budget: number;
    speso: number;
    varianza: number;
    percentualeUtilizzo: number;
    varianzaPct: number;
    status: BudgetVarianceStatus;
  };
}) {
  const meta = STATUS_META[totals.status];

  return (
    <div className="rounded-[32px] border border-border bg-card/70 p-6 shadow-2xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">Totale Mese</p>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <Metric label="Budget" value={euro(totals.budget)} />
            <Metric label="Speso" value={euro(totals.speso)} />
            <Metric
              label="Varianza"
              value={`${totals.varianza > 0 ? "+" : "-"}${euro(Math.abs(totals.varianza))}`}
              className={totals.varianza > 0 ? "text-rose-400" : "text-emerald-400"}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totals.status === "over" ? (
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          )}
          <Badge className={cn("border text-[10px] font-black uppercase tracking-widest", meta.pill)}>
            {meta.label}
          </Badge>
        </div>
      </div>

      <div className="mt-6">
        <div className="h-3 overflow-hidden rounded-full bg-muted/40">
          <div
            className={cn("h-full rounded-full transition-all", meta.bar)}
            style={{ width: `${Math.max(4, Math.min(totals.percentualeUtilizzo, 100))}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className={cn("font-black uppercase tracking-widest", meta.text)}>
            {totals.percentualeUtilizzo.toFixed(1)}% del budget utilizzato
          </span>
          <span className="font-bold text-muted-foreground">
            {totals.varianzaPct > 0 ? "+" : ""}
            {totals.varianzaPct.toFixed(1)}% rispetto al pianificato
          </span>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-3xl font-black text-white", className)}>{value}</p>
    </div>
  );
}
