import { useEffect, useMemo, useState } from "react";
import { Bot, Info, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useGenerateTasksAI, type AITaskGenerationResponse, type AITaskSuggestion } from "@/hooks/useAITaskGeneration";

type SelectableSuggestion = AITaskSuggestion & { key: string };

interface AITaskGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commessaId: string;
  clienteNome: string;
  meseLabel: string;
  projectTypes: string[];
  budgetOre: number;
  defaultProjectId?: string;
}

function formatHours(minutes: number) {
  const hours = minutes / 60;
  return hours >= 1 ? `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h` : `${minutes}m`;
}

export function AITaskGeneratorDialog({
  open,
  onOpenChange,
  commessaId,
  clienteNome,
  meseLabel,
  projectTypes,
  budgetOre,
  defaultProjectId,
}: AITaskGeneratorDialogProps) {
  const queryClient = useQueryClient();
  const generateMutation = useGenerateTasksAI();

  const [promptExtra, setPromptExtra] = useState("");
  const [maxOre, setMaxOre] = useState(String(Math.max(Math.round(budgetOre || 40), 1)));
  const [result, setResult] = useState<AITaskGenerationResponse | null>(null);
  const [suggestions, setSuggestions] = useState<SelectableSuggestion[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    if (!open) {
      setPromptExtra("");
      setResult(null);
      setSuggestions([]);
      setSelected({});
      setIsCreating(false);
      setCreatedCount(0);
      setMaxOre(String(Math.max(Math.round(budgetOre || 40), 1)));
    }
  }, [open, budgetOre]);

  const selectedSuggestions = useMemo(
    () => suggestions.filter((item) => selected[item.key]),
    [selected, suggestions]
  );
  const totalSelectedMinutes = selectedSuggestions.reduce((sum, item) => sum + item.stima_minuti, 0);
  const totalSelectedHours = totalSelectedMinutes / 60;
  const maxOreNumber = Math.max(Number(maxOre || 0), 1);
  const budgetPct = (totalSelectedHours / maxOreNumber) * 100;
  const progressValue = suggestions.length > 0 ? (createdCount / suggestions.filter((item) => selected[item.key]).length) * 100 : 0;

  async function handleGenerate() {
    try {
      const response = await generateMutation.mutateAsync({
        commessa_id: commessaId,
        prompt_extra: promptExtra.trim(),
        max_ore: maxOreNumber,
      });

      const nextSuggestions = response.suggestions.map((item, index) => ({
        ...item,
        key: `${index}-${item.titolo}`,
      }));
      const nextSelected = Object.fromEntries(nextSuggestions.map((item) => [item.key, true]));

      setResult(response);
      setSuggestions(nextSuggestions);
      setSelected(nextSelected);
    } catch {
      // Toast già gestito dal mutation hook.
    }
  }

  async function handleCreateSelected() {
    const items = selectedSuggestions;
    if (items.length === 0) {
      toast.error("Seleziona almeno un task da creare");
      return;
    }

    setIsCreating(true);
    setCreatedCount(0);

    try {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const descrizione = [
          item.servizio ? `Servizio suggerito: ${item.servizio}` : null,
          item.rationale ? `Nota AI: ${item.rationale}` : null,
        ].filter(Boolean).join("\n\n");

        await api.post("/tasks", {
          commessa_id: commessaId,
          progetto_id: defaultProjectId || undefined,
          assegnatario_id: item.assegnatario_id || undefined,
          titolo: item.titolo,
          descrizione: descrizione || undefined,
          stima_minuti: item.stima_minuti,
          priorita: item.priorita,
        });

        setCreatedCount(index + 1);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["studio-tasks"], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["tasks"], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["commesse"], exact: false }),
      ]);

      toast.success(`${items.length} task creati con successo`);
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Errore durante la creazione dei task"));
    } finally {
      setIsCreating(false);
    }
  }

  function setAllSelected(value: boolean) {
    setSelected(Object.fromEntries(suggestions.map((item) => [item.key, value])));
  }

  const sourceLabel = result?.source === "ai" ? "AI" : result?.source === "fallback" ? "Fallback" : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-border bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-white">
            <Bot className="h-5 w-5 text-primary" />
            Genera Task con AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <ContextCard label="Cliente" value={clienteNome} />
            <ContextCard label="Mese" value={meseLabel} />
            <ContextCard label="Tipo Progetto" value={projectTypes.join(", ") || "N/D"} />
            <ContextCard label="Budget Ore" value={`${maxOreNumber}h`} />
          </div>

          {!result && !isCreating && (
            <div className="rounded-[28px] border border-border bg-background/30 p-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Istruzioni Aggiuntive
                  </Label>
                  <Textarea
                    value={promptExtra}
                    onChange={(event) => setPromptExtra(event.target.value)}
                    placeholder='Es: focus su Instagram Reels, lancio campagna estiva e più attenzione al reporting.'
                    className="min-h-[130px] resize-none bg-background/60"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Max Ore
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={maxOre}
                    onChange={(event) => setMaxOre(event.target.value)}
                    className="h-11 bg-background/60"
                  />
                  <p className="text-xs text-muted-foreground">
                    L’AI cercherà di restare vicina a questo tetto ore.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void handleGenerate()} disabled={generateMutation.isPending} className="gap-2">
                  {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {generateMutation.isPending ? "Generazione..." : "Genera Suggerimenti"}
                </Button>
              </div>
            </div>
          )}

          {result && !isCreating && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-border bg-background/30 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-black text-white">Suggerimenti pronti per la review</p>
                    <p className="text-xs text-muted-foreground">
                      {result.suggestions.length} task suggeriti
                      {sourceLabel ? ` · fonte ${sourceLabel}` : ""}
                    </p>
                  </div>
                </div>
                {sourceLabel && (
                  <Badge className={result.source === "ai" ? "bg-primary/10 text-primary border-primary/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}>
                    {sourceLabel}
                  </Badge>
                )}
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                <TooltipProvider>
                  {suggestions.map((item) => (
                    <div key={item.key} className="rounded-[24px] border border-border bg-background/25 p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selected[item.key] ?? false}
                          onCheckedChange={(checked) => {
                            setSelected((prev) => ({ ...prev, [item.key]: checked === true }));
                          }}
                          className="mt-1"
                        />

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-white">{item.titolo}</p>
                            <Badge variant="outline" className="text-[10px] uppercase font-black">{item.priorita}</Badge>
                            {item.servizio && (
                              <Badge variant="outline" className="text-[10px] uppercase font-black">
                                {item.servizio}
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Stima: <strong className="text-foreground">{formatHours(item.stima_minuti)}</strong></span>
                            <span>Ruolo: <strong className="text-foreground">{item.ruolo_suggerito || "Non definito"}</strong></span>
                            <span>Assegnatario: <strong className="text-foreground">{item.assegnatario_nome || "Da assegnare"}</strong></span>
                            {item.rationale && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" className="inline-flex items-center gap-1 text-primary">
                                    <Info className="h-3.5 w-3.5" />
                                    rationale
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm text-xs leading-relaxed">
                                  {item.rationale}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </TooltipProvider>
              </div>

              <div className="rounded-[28px] border border-border bg-card/70 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Stima Totale Selezionati
                    </p>
                    <p className={`mt-2 text-2xl font-black ${budgetPct > 100 ? "text-rose-400" : budgetPct > 85 ? "text-amber-400" : "text-emerald-400"}`}>
                      {totalSelectedHours.toFixed(1)}h / {maxOreNumber}h
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setAllSelected(false)}>
                      Deseleziona tutto
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setAllSelected(true)}>
                      Seleziona tutto
                    </Button>
                    <Button type="button" onClick={() => void handleCreateSelected()}>
                      Crea Task Selezionati
                    </Button>
                  </div>
                </div>

                <Progress value={Math.min(budgetPct, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {budgetPct > 100
                    ? "Il totale selezionato supera il budget indicato."
                    : "Il totale selezionato resta dentro il budget indicato."}
                </p>
              </div>
            </div>
          )}

          {isCreating && (
            <div className="rounded-[28px] border border-border bg-background/30 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-black text-white">Creazione task in corso</p>
                  <p className="text-xs text-muted-foreground">
                    {createdCount}/{selectedSuggestions.length} completati
                  </p>
                </div>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContextCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-border bg-background/25 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
