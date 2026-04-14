import React, { useState, useMemo, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  Clock,
  Play,
  StopCircle,
  CheckCircle2,
  Clock3,
  ArrowUpDown,
  Filter,
  X,
  Flag,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStudio } from "@/hooks/useStudio";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import { useUsers } from "@/hooks/useUsers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TaskSO, SubtaskSO } from "@/types/studio";
import { DEFAULT_STATES, PRIORITIES } from "@/types/studio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format, isBefore, isToday, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  alta:    { bg: "bg-red-500/15",    text: "text-red-400",    label: "Alta" },
  media:   { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Media" },
  bassa:   { bg: "bg-slate-500/15",  text: "text-slate-400",  label: "Bassa" },
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Deterministic color per user initials
function avatarColor(id: string): string {
  const colors = [
    "bg-violet-500/20 text-violet-300",
    "bg-blue-500/20 text-blue-300",
    "bg-emerald-500/20 text-emerald-300",
    "bg-pink-500/20 text-pink-300",
    "bg-amber-500/20 text-amber-300",
    "bg-cyan-500/20 text-cyan-300",
  ];
  const idx = id.charCodeAt(0) % colors.length;
  return colors[idx];
}

type SortKey = "title" | "due_date" | "stato" | "assegnatario";
type SortDir = "asc" | "desc";

export function StudioListView() {
  const { nav, openNewTask } = useStudio();
  const { data } = useTasks();
  const { data: utenti = [] } = useUsers();
  const { createTask } = useTaskMutations();
  const [quickAddActive, setQuickAddActive] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const quickAddRef = useRef<HTMLInputElement>(null);

  const handleQuickAdd = async () => {
    const title = quickAddTitle.trim();
    if (!title) { setQuickAddActive(false); return; }
    try {
      await createTask.mutateAsync({
        titolo: title,
        progetto_id: nav.selectedListId || undefined,
        stato: "DA_FARE",
      });
      setQuickAddTitle("");
      // keep input open for rapid entry
      quickAddRef.current?.focus();
    } catch {
      toast.error("Errore nella creazione della task");
    }
  };

  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);

  const getUserInitials = (id?: string | null) => {
    if (!id) return null;
    const u = (utenti as any[]).find((u) => u.id === id);
    return u ? `${u.nome[0]}${u.cognome[0]}`.toUpperCase() : null;
  };

  const getUserName = (id?: string | null) => {
    if (!id) return null;
    const u = (utenti as any[]).find((u) => u.id === id);
    return u ? `${u.nome} ${u.cognome}` : null;
  };

  const tasks = useMemo(() => {
    if (!data) return [];
    let filtered = [...data];

    if (nav.selectedListId) {
      filtered = filtered.filter((t) => t.progetto_id === nav.selectedListId);
    } else if (nav.selectedFolderId) {
      filtered = filtered.filter((t) => t.commessa_id === nav.selectedFolderId);
    }

    if (filterAssignee) filtered = filtered.filter((t) => t.assegnatario_id === filterAssignee);
    if (filterStatus)   filtered = filtered.filter((t) => t.state_id === filterStatus);
    if (filterPriority) filtered = filtered.filter((t) => (t.priorita || "media") === filterPriority);

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title")       cmp = a.title.localeCompare(b.title);
      if (sortKey === "due_date")    cmp = (a.due_date || "").localeCompare(b.due_date || "");
      if (sortKey === "stato")       cmp = a.state_id.localeCompare(b.state_id);
      if (sortKey === "assegnatario") {
        cmp = (getUserName(a.assegnatario_id) || "").localeCompare(getUserName(b.assegnatario_id) || "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [data, nav.selectedFolderId, nav.selectedListId, filterAssignee, filterStatus, filterPriority, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const activeFilters = [filterAssignee, filterStatus, filterPriority].filter(Boolean).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background/50">
      {/* Filter bar */}
      {(activeFilters > 0 || true) && (
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border/20 bg-card/20 shrink-0 flex-wrap">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 flex items-center gap-1.5 mr-1">
            <Filter className="h-3 w-3" /> Filtri
          </span>

          {/* Assignee filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all",
                  filterAssignee
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border/30 text-muted-foreground/60 hover:border-border/60"
                )}
              >
                {filterAssignee ? getUserName(filterAssignee) : "Assegnatario"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-card border-border rounded-xl shadow-2xl w-48">
              <DropdownMenuItem
                className="text-[11px] font-bold cursor-pointer"
                onClick={() => setFilterAssignee(null)}
              >
                Tutti
              </DropdownMenuItem>
              {(utenti as any[]).map((u) => (
                <DropdownMenuItem
                  key={u.id}
                  className="text-[11px] font-bold cursor-pointer"
                  onClick={() => setFilterAssignee(u.id)}
                >
                  {u.nome} {u.cognome}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all",
                  filterStatus
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border/30 text-muted-foreground/60 hover:border-border/60"
                )}
              >
                {filterStatus
                  ? DEFAULT_STATES.find((s) => s.id === filterStatus)?.name || filterStatus
                  : "Stato"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-card border-border rounded-xl shadow-2xl w-44">
              <DropdownMenuItem
                className="text-[11px] font-bold cursor-pointer"
                onClick={() => setFilterStatus(null)}
              >
                Tutti
              </DropdownMenuItem>
              {DEFAULT_STATES.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  className="text-[11px] font-bold cursor-pointer"
                  onClick={() => setFilterStatus(s.id)}
                >
                  <div className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: s.color }} />
                  {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all",
                  filterPriority
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border/30 text-muted-foreground/60 hover:border-border/60"
                )}
              >
                <Flag className="h-3 w-3 mr-1" />
                {filterPriority ? PRIORITIES.find(p => p.id === filterPriority)?.label : "Priorità"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-card border-border rounded-xl shadow-2xl w-36">
              <DropdownMenuItem className="text-[11px] font-bold cursor-pointer" onClick={() => setFilterPriority(null)}>Tutte</DropdownMenuItem>
              {PRIORITIES.map((p) => (
                <DropdownMenuItem key={p.id} className={`text-[11px] font-bold cursor-pointer ${p.color}`} onClick={() => setFilterPriority(p.id)}>
                  <Flag className="h-3 w-3 mr-2" fill="currentColor" />{p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 rounded-lg text-[10px] font-black text-muted-foreground/50 hover:text-red-400 gap-1"
              onClick={() => { setFilterAssignee(null); setFilterStatus(null); setFilterPriority(null); }}
            >
              <X className="h-3 w-3" /> Reset
            </Button>
          )}

          <span className="ml-auto text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">
            {tasks.length} task
          </span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-card/80 sticky top-0 z-10 backdrop-blur-md border-b border-border/30">
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead className="w-full h-10 px-4">
                <button
                  onClick={() => toggleSort("title")}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-white transition-colors"
                >
                  Task <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
                </button>
              </TableHead>
              <TableHead className="h-10 px-4">
                <button
                  onClick={() => toggleSort("assegnatario")}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-white transition-colors"
                >
                  Assegnato <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
                </button>
              </TableHead>
              <TableHead className="h-10 px-4 w-[140px]">
                <button
                  onClick={() => toggleSort("stato")}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-white transition-colors"
                >
                  Stato <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
                </button>
              </TableHead>
              <TableHead className="h-10 px-4 w-[120px]">
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Tempo</span>
              </TableHead>
              <TableHead className="h-10 px-4">
                <button
                  onClick={() => toggleSort("due_date")}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-white transition-colors"
                >
                  Scadenza <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
                </button>
              </TableHead>
              <TableHead className="w-16 h-10 px-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 italic">
                    Nessuna task trovata
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  depth={0}
                  utenti={utenti as any[]}
                  getUserInitials={getUserInitials}
                  getUserName={getUserName}
                />
              ))
            )}
            {/* Inline quick-add row */}
            <TableRow className="border-border/10 hover:bg-transparent">
              <TableCell colSpan={6} className="p-0">
                {quickAddActive ? (
                  <div className="flex items-center gap-3 px-6 h-12 border-t border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                    <div className="h-2 w-2 rounded-full bg-primary/40 shrink-0" />
                    <input
                      ref={quickAddRef}
                      autoFocus
                      className="flex-1 bg-transparent border-none outline-none text-[13px] font-bold text-white placeholder:text-muted-foreground/40"
                      placeholder="Nome task... (Invio per creare, Esc per annullare)"
                      value={quickAddTitle}
                      onChange={e => setQuickAddTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleQuickAdd();
                        if (e.key === "Escape") { setQuickAddActive(false); setQuickAddTitle(""); }
                      }}
                      onBlur={() => { if (!quickAddTitle.trim()) setQuickAddActive(false); }}
                    />
                    <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-wider shrink-0">
                      Invio ↵
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 border-t border-border/10">
                    <Button
                      variant="ghost"
                      className="flex-1 justify-start h-11 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 hover:text-primary hover:bg-transparent group"
                      onClick={() => { setQuickAddActive(true); setQuickAddTitle(""); }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-2 group-hover:scale-125 transition-transform" />
                      Aggiungi Task
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-11 px-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground/20 hover:text-primary/50 hover:bg-transparent"
                      onClick={() => openNewTask(nav.selectedFolderId, nav.selectedListId)}
                      title="Apri form completo"
                    >
                      Form completo
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: TaskSO | SubtaskSO;
  depth: number;
  utenti: any[];
  getUserInitials: (id?: string | null) => string | null;
  getUserName: (id?: string | null) => string | null;
}

function TaskRow({ task, depth, utenti, getUserInitials, getUserName }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { timer, selectTask, openTab } = useStudio();
  const { updateTask } = useTaskMutations();

  const subtasks = "subtasks" in task ? task.subtasks : [];
  const hasSubtasks = subtasks && subtasks.length > 0;
  const isTimerActive = timer.active_session?.task_id === task.id;

  const completedSubtasks = subtasks.filter(
    (st) => st.stateId === "done" || st.stateId === "COMPLETATO"
  ).length;
  const totalSubtasks = subtasks.length;

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTask.mutateAsync({ id: task.id, data: { stato: newStatus } });
      toast.success("Stato aggiornato");
    } catch {
      toast.error("Errore aggiornamento stato");
    }
  };

  const currentStatus =
    DEFAULT_STATES.find(
      (s) => s.id === ((task as any).state_id || (task as any).stateId)
    ) || DEFAULT_STATES[0];

  // Due date display
  const dueDate = (task as any).due_date;
  const dueDateEl = dueDate ? (() => {
    const d = parseISO(dueDate);
    const overdue = isBefore(d, new Date()) && !isToday(d);
    const today  = isToday(d);
    return (
      <span
        className={cn(
          "text-[11px] font-bold",
          overdue ? "text-red-400" : today ? "text-yellow-400" : "text-muted-foreground/60"
        )}
      >
        {overdue && "⚠ "}
        {format(d, "d MMM", { locale: it })}
        {today && " · Oggi"}
      </span>
    );
  })() : <span className="text-muted-foreground/20 text-[11px]">—</span>;

  // Assignee
  const initials = getUserInitials((task as any).assegnatario_id);
  const fullName = getUserName((task as any).assegnatario_id);

  const handleRowClick = () => {
    openTab({ type: "TASK", title: task.title, linkedId: task.id });
  };

  return (
    <>
      <TableRow
        className={cn(
          "border-b border-border/10 group cursor-pointer transition-all duration-200",
          isTimerActive ? "bg-primary/[0.08] hover:bg-primary/[0.12]" : "hover:bg-white/[0.04]"
        )}
        onClick={handleRowClick}
      >
        {/* Name */}
        <TableCell className="py-0 px-4 h-12 w-full">
          <div
            className="flex items-center gap-2.5"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {hasSubtasks ? (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="p-1 rounded-md hover:bg-white/10 text-muted-foreground/40 hover:text-white transition-colors shrink-0"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <div className="w-[22px] shrink-0" />
            )}

            <div
              className={cn(
                "h-2 w-2 rounded-full shrink-0 transition-all",
                isTimerActive
                  ? "bg-primary animate-pulse shadow-[0_0_12px_hsl(var(--primary))]"
                  : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50"
              )}
            />

            {/* Priority flag */}
            {(() => {
              const p = PRIORITIES.find(p => p.id === ((task as any).priorita || "media"));
              return p ? (
                <Flag
                  className={cn("h-3 w-3 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity", p.color)}
                  fill="currentColor"
                  title={`Priorità: ${p.label}`}
                />
              ) : null;
            })()}

            <span
              className={cn(
                "text-[13px] font-bold truncate transition-colors duration-200",
                isTimerActive ? "text-white" : "text-muted-foreground group-hover:text-white"
              )}
            >
              {task.title}
            </span>

            {isTimerActive && (
              <Badge className="ml-1 bg-primary/20 text-primary border-primary/30 text-[9px] font-black tracking-widest h-[18px] uppercase shrink-0 shadow-[0_0_10px_hsl(var(--primary)/0.2)]">
                Live
              </Badge>
            )}

            {totalSubtasks > 0 && (
              <Badge
                variant="outline"
                className="ml-2 bg-transparent border-border/30 text-muted-foreground group-hover:border-border text-[9px] font-black h-[18px] gap-1 shrink-0 transition-colors"
                title={`${completedSubtasks} completate su ${totalSubtasks}`}
              >
                <CheckCircle2 className={cn("h-2.5 w-2.5", completedSubtasks === totalSubtasks ? "text-emerald-400" : "text-primary")} />
                {completedSubtasks}/{totalSubtasks}
              </Badge>
            )}

            {(task.tempo_trascorso_minuti || 0) > 0 && !isTimerActive && (
              <Badge
                variant="outline"
                className="ml-1 bg-transparent border-transparent group-hover:border-border/30 text-muted-foreground/50 group-hover:text-muted-foreground text-[9px] font-black h-[18px] gap-1 shrink-0 transition-colors"
              >
                <Clock3 className="h-2.5 w-2.5" />
                {(task.tempo_trascorso_minuti || 0) >= 60
                  ? `${Math.floor((task.tempo_trascorso_minuti || 0) / 60)}h ${(task.tempo_trascorso_minuti || 0) % 60}m`
                  : `${task.tempo_trascorso_minuti}m`}
              </Badge>
            )}
          </div>
        </TableCell>

        {/* Assignee */}
        <TableCell className="py-0 px-4">
          {initials ? (
            <div
              className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black border border-white/5",
                avatarColor((task as any).assegnatario_id || "x")
              )}
              title={fullName || ""}
            >
              {initials}
            </div>
          ) : (
            <div className="h-7 w-7 rounded-lg bg-muted/20 border border-border/20 flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground/20">—</span>
            </div>
          )}
        </TableCell>

        {/* Status */}
        <TableCell className="py-0 px-4 w-[140px]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button
                className="flex items-center gap-1.5 px-2.5 h-[22px] rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all border group-hover:shadow-sm"
                style={{
                  borderColor: currentStatus.color + "40",
                  color: currentStatus.color,
                  backgroundColor: currentStatus.color + "10",
                }}
              >
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: currentStatus.color }} />
                <span className="truncate">{currentStatus.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-card border-border rounded-xl shadow-2xl w-44"
            >
              {DEFAULT_STATES.map((state) => (
                <DropdownMenuItem
                  key={state.id}
                  onClick={(e) => { e.stopPropagation(); handleStatusChange(state.id); }}
                  className="text-[10px] font-black uppercase tracking-widest py-2 focus:bg-primary/10 cursor-pointer"
                >
                  <div
                    className="h-2 w-2 rounded-full mr-2"
                    style={{ backgroundColor: state.color }}
                  />
                  {state.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>

        {/* Time */}
        <TableCell className="py-0 px-4 w-[120px]">
          <div className="flex items-center gap-2 tabular-nums">
            <Clock
              className={cn("h-3.5 w-3.5 shrink-0 transition-colors", isTimerActive ? "text-primary animate-pulse" : "text-muted-foreground/30 group-hover:text-muted-foreground")}
            />
            <div className="flex flex-col leading-tight">
              <span
                className={cn(
                  "text-[12px] font-bold tracking-tighter",
                  isTimerActive ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "text-muted-foreground group-hover:text-white"
                )}
              >
                {formatTime(timer.getElapsed(task.id))}
              </span>
              {"stima_minuti" in task &&
                task.stima_minuti &&
                task.stima_minuti > 0 && (
                  <span
                    className={cn(
                      "text-[9px] font-bold tracking-tight",
                      timer.getElapsed(task.id) / 60000 > task.stima_minuti * 1.2
                        ? "text-red-400"
                        : timer.getElapsed(task.id) / 60000 > task.stima_minuti
                        ? "text-orange-400"
                        : "text-muted-foreground/40 group-hover:text-muted-foreground/70"
                    )}
                  >
                    Est: {task.stima_minuti}m
                  </span>
                )}
            </div>
          </div>
        </TableCell>

        {/* Due date */}
        <TableCell className="py-0 px-4">{dueDateEl}</TableCell>

        {/* Actions */}
        <TableCell className="py-0 px-2 text-center">
          <div className="flex items-center justify-center gap-0.5">
            {!isTimerActive ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/15 rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 bg-emerald-500/5 shadow-sm"
                onClick={(e) => { e.stopPropagation(); timer.start(task.id); }}
                title="Avvia timer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                onClick={(e) => { e.stopPropagation(); timer.stop(timer.active_session!.id); }}
                title="Ferma timer"
              >
                <StopCircle className="h-3.5 w-3.5 fill-current" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground/20 hover:text-foreground/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border rounded-xl shadow-2xl w-40">
                <DropdownMenuItem
                  className="text-[11px] font-bold cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); handleRowClick(); }}
                >
                  Apri dettaglio
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      {expanded &&
        hasSubtasks &&
        subtasks.map((sub) => (
          <TaskRow
            key={sub.id}
            task={sub}
            depth={depth + 1}
            utenti={utenti}
            getUserInitials={getUserInitials}
            getUserName={getUserName}
          />
        ))}
    </>
  );
}
