import { useState } from "react";
import {
  Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp,
  Layers, Clock, Zap, ToggleLeft, ToggleRight, Copy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useTaskTemplates, useCreateTaskTemplate, useUpdateTaskTemplate,
  useDeleteTaskTemplate, type TaskTemplate, type TaskTemplateItem
} from "@/hooks/useTaskTemplates";

const PRIORITA_OPTIONS = ["urgente", "alta", "media", "bassa"];
const RUOLO_OPTIONS = ["", "ADMIN", "PM", "COLLABORATORE", "DIPENDENTE"];
const PROGETTO_TIPO_OPTIONS = [
  { value: "", label: "Tutti" },
  { value: "RETAINER", label: "Retainer" },
  { value: "ONE_OFF", label: "One-off" },
];

const DEFAULT_TEMPLATES: Omit<TaskTemplate, "id" | "num_items" | "created_at">[] = [
  {
    nome: "Social Media Retainer",
    descrizione: "Task mensili standard per clienti social media",
    progetto_tipo: "RETAINER",
    attivo: true,
    items: [
      { titolo: "Report performance mensile", stima_minuti: 60, priorita: "alta", giorno_scadenza: 5 },
      { titolo: "Piano editoriale mese successivo", stima_minuti: 90, priorita: "alta", giorno_scadenza: 20 },
      { titolo: "Creazione contenuti", stima_minuti: 240, priorita: "media", giorno_scadenza: 15 },
      { titolo: "Call mensile cliente", stima_minuti: 60, priorita: "alta", giorno_scadenza: 10 },
      { titolo: "Analisi competitor", stima_minuti: 45, priorita: "bassa", giorno_scadenza: 25 },
    ],
  },
  {
    nome: "Google Ads",
    descrizione: "Task mensili per campagne Google Ads",
    progetto_tipo: "RETAINER",
    attivo: true,
    items: [
      { titolo: "Ottimizzazione campagne", stima_minuti: 120, priorita: "alta", giorno_scadenza: 8 },
      { titolo: "Report performance Ads", stima_minuti: 45, priorita: "alta", giorno_scadenza: 5 },
      { titolo: "Call mensile cliente", stima_minuti: 60, priorita: "media", giorno_scadenza: 12 },
      { titolo: "Analisi keywords e bid", stima_minuti: 60, priorita: "media", giorno_scadenza: 18 },
    ],
  },
  {
    nome: "SEO",
    descrizione: "Task mensili per attività SEO",
    progetto_tipo: "RETAINER",
    attivo: true,
    items: [
      { titolo: "Analisi ranking keywords", stima_minuti: 60, priorita: "alta", giorno_scadenza: 5 },
      { titolo: "Contenuti blog / articoli", stima_minuti: 180, priorita: "media", giorno_scadenza: 20 },
      { titolo: "Report link building", stima_minuti: 30, priorita: "bassa", giorno_scadenza: 25 },
      { titolo: "Call mensile cliente", stima_minuti: 60, priorita: "media", giorno_scadenza: 10 },
    ],
  },
];

function ItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: TaskTemplateItem;
  onUpdate: (updated: TaskTemplateItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_80px_70px_80px_30px] gap-2 items-center py-2 border-b border-border/20 last:border-0">
      <Input
        value={item.titolo}
        onChange={(e) => onUpdate({ ...item, titolo: e.target.value })}
        placeholder="Titolo task..."
        className="bg-muted/20 border-border/40 text-xs h-8"
      />
      <Input
        type="number"
        value={item.stima_minuti ?? ""}
        onChange={(e) => onUpdate({ ...item, stima_minuti: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="min"
        className="bg-muted/20 border-border/40 text-xs h-8"
      />
      <select
        value={item.priorita ?? "media"}
        onChange={(e) => onUpdate({ ...item, priorita: e.target.value })}
        className="h-8 rounded-md border border-border/40 bg-muted/20 text-xs px-1 text-foreground"
      >
        {PRIORITA_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <Input
        type="number"
        min={1}
        max={31}
        value={item.giorno_scadenza ?? ""}
        onChange={(e) => onUpdate({ ...item, giorno_scadenza: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="gg"
        className="bg-muted/20 border-border/40 text-xs h-8"
      />
      <button onClick={onRemove} className="text-muted-foreground hover:text-red-400 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function TemplateEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Partial<TaskTemplate>;
  onSave: (data: Omit<TaskTemplate, "id" | "num_items" | "created_at">) => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial.nome ?? "");
  const [descrizione, setDescrizione] = useState(initial.descrizione ?? "");
  const [progettoTipo, setProgettoTipo] = useState(initial.progetto_tipo ?? "");
  const [attivo, setAttivo] = useState(initial.attivo ?? true);
  const [items, setItems] = useState<TaskTemplateItem[]>(initial.items ?? []);

  const addItem = () =>
    setItems([...items, { titolo: "", priorita: "media", ordine: items.length }]);

  const updateItem = (idx: number, updated: TaskTemplateItem) =>
    setItems(items.map((it, i) => (i === idx ? updated : it)));

  const removeItem = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 p-5 bg-muted/10 rounded-2xl border border-border/40">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome template *"
          className="bg-card border-border/50 text-sm"
        />
        <select
          value={progettoTipo}
          onChange={(e) => setProgettoTipo(e.target.value)}
          className="h-10 rounded-xl border border-border/50 bg-card text-sm px-3 text-foreground"
        >
          {PROGETTO_TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAttivo(!attivo)}
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-lg border transition-colors ${
              attivo ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-border/40 text-muted-foreground bg-muted/10"
            }`}
          >
            {attivo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {attivo ? "Attivo" : "Disattivo"}
          </button>
        </div>
      </div>

      <Input
        value={descrizione}
        onChange={(e) => setDescrizione(e.target.value)}
        placeholder="Descrizione (opzionale)"
        className="bg-card border-border/50 text-sm"
      />

      {/* Items header */}
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_80px_70px_80px_30px] gap-2 pb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Titolo Task</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Minuti</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Priorità</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Giorno</span>
          <span />
        </div>
        {items.map((item, idx) => (
          <ItemRow
            key={idx}
            item={item}
            onUpdate={(updated) => updateItem(idx, updated)}
            onRemove={() => removeItem(idx)}
          />
        ))}
        <Button variant="ghost" size="sm" onClick={addItem} className="text-muted-foreground hover:text-primary text-xs gap-1.5 mt-1">
          <Plus className="w-3.5 h-3.5" /> Aggiungi task
        </Button>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
          <X className="w-3.5 h-3.5 mr-1" /> Annulla
        </Button>
        <Button
          size="sm"
          onClick={() => onSave({ nome, descrizione, progetto_tipo: progettoTipo || undefined, attivo, items })}
          disabled={!nome.trim()}
          className="bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-widest gap-1.5"
        >
          <Check className="w-3.5 h-3.5" /> Salva Template
        </Button>
      </div>
    </div>
  );
}

export default function TaskTemplatesPage() {
  const { data: templates = [], isLoading } = useTaskTemplates();
  const { mutate: create, isPending: isCreating } = useCreateTaskTemplate();
  const { mutate: update, isPending: isUpdating } = useUpdateTaskTemplate();
  const { mutate: remove } = useDeleteTaskTemplate();

  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSeedDefaults = () => {
    DEFAULT_TEMPLATES.forEach((tpl) => create(tpl));
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Task Templates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crea template riutilizzabili per generare task ricorrenti nelle commesse
          </p>
        </div>
        <div className="flex items-center gap-2">
          {templates.length === 0 && (
            <Button
              variant="outline"
              onClick={handleSeedDefaults}
              disabled={isCreating}
              className="border-border/50 text-muted-foreground hover:text-foreground text-xs font-black uppercase tracking-widest gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> Carica Default
            </Button>
          )}
          <Button
            onClick={() => { setShowNew(true); setEditingId(null); }}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-widest gap-1.5 shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
          >
            <Plus className="w-3.5 h-3.5" /> Nuovo Template
          </Button>
        </div>
      </div>

      {/* New template form */}
      {showNew && (
        <TemplateEditor
          initial={{}}
          onSave={(data) => { create(data); setShowNew(false); }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {/* Template list */}
      <div className="space-y-3">
        {isLoading && (
          <div className="text-center text-muted-foreground py-12 text-sm">Caricamento...</div>
        )}
        {!isLoading && templates.length === 0 && !showNew && (
          <Card className="bg-card border-border/40">
            <CardContent className="py-16 text-center space-y-3">
              <Layers className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Nessun template ancora.</p>
              <p className="text-xs text-muted-foreground/60">
                Clicca <strong>"Carica Default"</strong> per avere subito Social Media, Google Ads e SEO.
              </p>
            </CardContent>
          </Card>
        )}

        {templates.map((tpl) => (
          <Card key={tpl.id} className="bg-card border-border/40 overflow-hidden">
            {editingId === tpl.id ? (
              <CardContent className="p-4">
                <TemplateEditor
                  initial={tpl}
                  onSave={(data) => { update({ id: tpl.id, data }); setEditingId(null); }}
                  onCancel={() => setEditingId(null)}
                />
              </CardContent>
            ) : (
              <>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${tpl.attivo ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-foreground text-sm">{tpl.nome}</h3>
                          {tpl.progetto_tipo && (
                            <Badge variant="outline" className="text-[9px] font-black uppercase border-purple-500/20 text-purple-400 bg-purple-500/5">
                              {tpl.progetto_tipo}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[9px] font-black border-border/40 text-muted-foreground">
                            {tpl.num_items} task
                          </Badge>
                        </div>
                        {tpl.descrizione && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{tpl.descrizione}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)}
                        className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedId === tpl.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { setEditingId(tpl.id); setExpandedId(null); }}
                        className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Eliminare questo template?")) remove(tpl.id); }}
                        className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded items */}
                  {expandedId === tpl.id && tpl.items.length > 0 && (
                    <div className="mt-4 space-y-1.5 border-t border-border/30 pt-3">
                      {tpl.items.map((item, idx) => (
                        <div key={item.id ?? idx} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/10 border border-border/20">
                          <span className="text-[10px] font-black text-muted-foreground/50 w-4">{idx + 1}</span>
                          <span className="text-xs text-foreground flex-1 font-medium">{item.titolo}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.stima_minuti && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {item.stima_minuti}m
                              </div>
                            )}
                            {item.giorno_scadenza && (
                              <span className="text-[10px] text-muted-foreground">gg{item.giorno_scadenza}</span>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-black ${
                                item.priorita === "urgente" ? "border-red-500/30 text-red-400" :
                                item.priorita === "alta" ? "border-amber-500/30 text-amber-400" :
                                "border-border/40 text-muted-foreground"
                              }`}
                            >
                              {item.priorita}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        ))}
      </div>

      {/* Info box */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-black text-foreground">Come usare i Template</p>
              <p className="text-xs text-muted-foreground">
                Apri una commessa e nella sezione <strong>"Task Template"</strong> seleziona il template e clicca <strong>"Genera Task"</strong>.
                I task verranno creati automaticamente con scadenze nel mese di competenza della commessa.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
