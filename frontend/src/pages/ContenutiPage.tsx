import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Clapperboard, Filter, Plus, Search, User2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { PageTransition } from "@/components/common/PageTransition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCommesse } from "@/hooks/useCommesse";
import { useUsers } from "@/hooks/useUsers";
import { ContenutoDialog } from "@/components/contenuti/ContenutoDialog";
import {
  useCambiaStatoContenuto,
  useContenuti,
  type Contenuto,
  type ContenutoStato,
  type ContenutoTipo,
} from "@/hooks/useContenuti";

const STATI: ContenutoStato[] = [
  "BOZZA",
  "IN_REVISIONE_INTERNA",
  "MODIFICHE_RICHIESTE_INTERNE",
  "APPROVATO_INTERNAMENTE",
  "INVIATO_AL_CLIENTE",
  "MODIFICHE_RICHIESTE_CLIENTE",
  "APPROVATO_CLIENTE",
  "PUBBLICATO",
  "ARCHIVIATO",
];

const LABELS: Record<ContenutoStato, string> = {
  BOZZA: "Bozza",
  IN_REVISIONE_INTERNA: "Rev. interna",
  MODIFICHE_RICHIESTE_INTERNE: "Fix interni",
  APPROVATO_INTERNAMENTE: "OK interno",
  INVIATO_AL_CLIENTE: "Cliente",
  MODIFICHE_RICHIESTE_CLIENTE: "Fix cliente",
  APPROVATO_CLIENTE: "OK cliente",
  PUBBLICATO: "Pubblicato",
  ARCHIVIATO: "Archivio",
};

const NOTE_REQUIRED_STATES: ContenutoStato[] = [
  "MODIFICHE_RICHIESTE_INTERNE",
  "MODIFICHE_RICHIESTE_CLIENTE",
];

const TIPO_OPTIONS: Array<{ value: ContenutoTipo | "ALL"; label: string }> = [
  { value: "ALL", label: "Tutti i tipi" },
  { value: "POST_SOCIAL", label: "Post Social" },
  { value: "COPY", label: "Copy" },
  { value: "DESIGN", label: "Design" },
  { value: "VIDEO", label: "Video" },
  { value: "EMAIL", label: "Email" },
  { value: "ALTRO", label: "Altro" },
];

const CONTENT_MANAGER_ROLES = new Set(["ADMIN", "DEVELOPER", "PM"]);

export default function ContenutiPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedContenuto, setSelectedContenuto] = useState<Contenuto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const canManageContent = CONTENT_MANAGER_ROLES.has(user?.ruolo ?? "");

  const commessaFilter = searchParams.get("commessa_id") || "";
  const tipoFilter = searchParams.get("tipo") || "ALL";
  const assegnatarioFilter = searchParams.get("assegnatario_id") || "ALL";
  const statoFilter = searchParams.get("stato") || "ALL";

  const { data: contenuti = [], isLoading } = useContenuti({
    commessa_id: commessaFilter || undefined,
    tipo: tipoFilter !== "ALL" ? tipoFilter : undefined,
    assegnatario_id: assegnatarioFilter !== "ALL" ? assegnatarioFilter : undefined,
    stato: statoFilter !== "ALL" ? statoFilter : undefined,
  });
  const { data: commesse = [] } = useCommesse(undefined, canManageContent);
  const { data: users = [] } = useUsers(true, canManageContent);
  const changeState = useCambiaStatoContenuto();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contenuti;
    return contenuti.filter((item) =>
      [item.titolo, item.cliente_nome || "", item.assegnatario_nome || "", item.tipo].join(" ").toLowerCase().includes(q)
    );
  }, [contenuti, search]);

  const stats = useMemo(() => ({
    total: filtered.length,
    inReview: filtered.filter((item) => ["IN_REVISIONE_INTERNA", "INVIATO_AL_CLIENTE"].includes(item.stato)).length,
    blocked: filtered.filter((item) => ["MODIFICHE_RICHIESTE_INTERNE", "MODIFICHE_RICHIESTE_CLIENTE"].includes(item.stato)).length,
    published: filtered.filter((item) => item.stato === "PUBBLICATO").length,
  }), [filtered]);

  const visibleStates = statoFilter === "ALL" ? STATI : [statoFilter as ContenutoStato];
  const activeContenuto = filtered.find((item) => item.id === activeId) || null;

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "ALL") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    if (!event.over || event.active.id === event.over.id) return;
    const contenuto = filtered.find((item) => item.id === event.active.id);
    const targetState = event.over.id as ContenutoStato;
    if (!contenuto || contenuto.stato === targetState) return;
    if (!contenuto.transizioni_possibili.includes(targetState)) {
      toast.error("Transizione non consentita per questo contenuto");
      return;
    }
    if (NOTE_REQUIRED_STATES.includes(targetState) && !contenuto.note_revisione?.trim()) {
      setSelectedContenuto(contenuto);
      setDialogOpen(true);
      toast.error("Per richiedere modifiche devi prima inserire una nota revisione");
      return;
    }
    await changeState.mutateAsync({
      id: contenuto.id,
      stato: targetState,
      note_revisione: contenuto.note_revisione || undefined,
    });
  };

  return (
    <PageTransition>
      <div className="p-8 space-y-8 h-full">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-start gap-5">
            <div className="h-16 w-16 rounded-[28px] bg-primary/10 border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/10">
              <Clapperboard className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic">
                Content <span className="text-primary not-italic">Pipeline</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Bozza, revisione interna, approvazione cliente e pubblicazione in un'unica board.
              </p>
            </div>
          </div>

          <Button onClick={() => { setSelectedContenuto(null); setDialogOpen(true); }} className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest">
            <Plus className="mr-2 h-4 w-4" />
            Nuovo contenuto
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label="Totali" value={stats.total} />
          <StatCard label="In revisione" value={stats.inReview} tone="text-amber-300" />
          <StatCard label="Bloccati" value={stats.blocked} tone="text-rose-300" />
          <StatCard label="Pubblicati" value={stats.published} tone="text-fuchsia-300" />
        </div>

        <Card className="bg-card border-border/50">
          <CardContent className="p-4 md:p-5">
            <div className={`grid gap-3 md:grid-cols-2 ${canManageContent ? "xl:grid-cols-5" : "xl:grid-cols-2"}`}>
              <div className="relative xl:col-span-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca titolo, cliente o assegnatario..." className="pl-9 bg-muted/20 border-border/50" />
              </div>

              {canManageContent && (
                <select value={commessaFilter || "ALL"} onChange={(e) => updateFilter("commessa_id", e.target.value)} className="flex h-10 rounded-md border border-border/50 bg-muted/20 px-3 text-sm">
                  <option value="ALL">Tutte le commesse</option>
                  {commesse.map((commessa) => <option key={commessa.id} value={commessa.id}>{commessa.cliente?.ragione_sociale || "Cliente"} - {commessa.mese_competenza}</option>)}
                </select>
              )}

              <select value={tipoFilter} onChange={(e) => updateFilter("tipo", e.target.value)} className="flex h-10 rounded-md border border-border/50 bg-muted/20 px-3 text-sm">
                {TIPO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>

              {canManageContent && (
                <select value={assegnatarioFilter} onChange={(e) => updateFilter("assegnatario_id", e.target.value)} className="flex h-10 rounded-md border border-border/50 bg-muted/20 px-3 text-sm">
                  <option value="ALL">Tutti gli owner</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.nome} {user.cognome}</option>)}
                </select>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Stato board
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={statoFilter === "ALL"} label="Tutti" onClick={() => updateFilter("stato", "ALL")} />
                {STATI.map((state) => <FilterChip key={state} active={statoFilter === state} label={LABELS[state]} onClick={() => updateFilter("stato", state)} />)}
              </div>
            </div>
          </CardContent>
        </Card>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-5">
              {visibleStates.map((state) => (
                <BoardColumn key={state} state={state} items={filtered.filter((item) => item.stato === state)} onOpen={(item) => { setSelectedContenuto(item); setDialogOpen(true); }} isLoading={isLoading} />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeContenuto ? (
              <div className="w-[320px]">
                <ContenutoCard contenuto={activeContenuto} onOpen={() => undefined} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <ContenutoDialog open={dialogOpen} onOpenChange={setDialogOpen} contenuto={selectedContenuto} defaultCommessaId={commessaFilter || undefined} />
      </div>
    </PageTransition>
  );
}

function StatCard({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-widest transition-colors ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground"}`}>
      {label}
    </button>
  );
}

function BoardColumn({ state, items, onOpen, isLoading }: { state: ContenutoStato; items: Contenuto[]; onOpen: (item: Contenuto) => void; isLoading: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: state });
  return (
    <div ref={setNodeRef} className={`w-[320px] shrink-0 rounded-[28px] border transition-colors ${isOver ? "border-primary/40 bg-primary/5" : "border-border/50 bg-card/70"}`}>
      <div className="border-b border-border/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline" className="font-black uppercase tracking-widest">{LABELS[state]}</Badge>
          <span className="text-xs font-black text-muted-foreground">{items.length}</span>
        </div>
      </div>
      <div className="space-y-3 p-3 min-h-[420px]">
        {isLoading && [...Array(3)].map((_, idx) => <div key={idx} className="h-28 rounded-3xl bg-muted/30 animate-pulse" />)}
        {!isLoading && items.map((item) => <ContenutoCard key={item.id} contenuto={item} onOpen={onOpen} />)}
        {!isLoading && items.length === 0 && <div className="rounded-3xl border border-dashed border-border/50 p-5 text-center text-sm text-muted-foreground">Nessun contenuto in questa colonna.</div>}
      </div>
    </div>
  );
}

function ContenutoCard({ contenuto, onOpen, isOverlay = false }: { contenuto: Contenuto; onOpen: (item: Contenuto) => void; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: contenuto.id });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging && !isOverlay ? 0.35 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={() => { if (transform) return; onOpen(contenuto); }} className="rounded-[24px] border border-border/50 bg-background/70 p-4 shadow-lg cursor-pointer hover:border-primary/30 hover:bg-background transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-foreground leading-tight">{contenuto.titolo}</p>
          <p className="mt-1 text-xs text-muted-foreground truncate">{contenuto.cliente_nome || "Contenuto interno"}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px] font-black uppercase">{LABELS[contenuto.stato]}</Badge>
      </div>

      <div className="mt-4 space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <User2 className="h-3.5 w-3.5" />
          <span className="truncate">{contenuto.assegnatario_nome || "Non assegnato"}</span>
        </div>
        {contenuto.data_consegna_prevista && (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{format(parseISO(contenuto.data_consegna_prevista), "dd MMM yyyy", { locale: it })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
