import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Play,
  StopCircle,
  Plus,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useStudio } from "@/hooks/useStudio";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import { useUsers } from "@/hooks/useUsers";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TaskSO } from "@/types/studio";
import { format, isBefore, isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Avatar helper ─────────────────────────────────────────────────────────────
function avatarColor(id: string): string {
  const colors = [
    "bg-violet-600", "bg-indigo-600", "bg-blue-600", "bg-cyan-600",
    "bg-teal-600", "bg-emerald-600", "bg-fuchsia-600", "bg-rose-600",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ─── Column definitions ────────────────────────────────────────────────────────
const COLUMNS = [
  { id: "DA_FARE",     label: "Da Fare",    color: "#64748b", accent: "border-slate-500/40",   bg: "bg-slate-500/5"   },
  { id: "IN_CORSO",   label: "In Corso",   color: "#7c3aed", accent: "border-violet-500/40",  bg: "bg-violet-500/5"  },
  { id: "REVISIONE",  label: "Revisione",  color: "#f59e0b", accent: "border-amber-500/40",   bg: "bg-amber-500/5"   },
  { id: "COMPLETATO", label: "Completato", color: "#10b981", accent: "border-emerald-500/40", bg: "bg-emerald-500/5" },
];

// ─── Task Card ─────────────────────────────────────────────────────────────────
interface KanbanCardProps {
  task: TaskSO;
  isDragging?: boolean;
}

function KanbanCard({ task, isDragging }: KanbanCardProps) {
  const { timer, openTab } = useStudio();
  const { data: utenti = [] } = useUsers();

  const assignee = utenti.find(u => u.id === task.assegnatario_id);
  const isRunning = timer.active_session?.task_id === task.id;
  const elapsed = timer.getElapsed(task.id);

  const dueDate = task.due_date ? parseISO(task.due_date) : null;
  const isOverdue = dueDate && isBefore(dueDate, new Date()) && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);

  const handleTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning && timer.active_session) {
      timer.stop(timer.active_session.id);
      toast.success("Timer fermato");
    } else {
      timer.start(task.id);
      toast.success("Timer avviato");
    }
  };

  const openDetail = () => {
    openTab({ type: "TASK", title: task.title, linkedId: task.id });
  };

  const completedSubs = task.subtasks?.filter(s => s.stateId === "COMPLETATO").length ?? 0;
  const totalSubs = task.subtasks?.length ?? 0;

  return (
    <div
      onClick={openDetail}
      className={cn(
        "group relative bg-card border border-border/50 rounded-xl p-3 cursor-pointer select-none",
        "hover:border-primary/30 hover:shadow-[0_0_20px_hsl(var(--primary)/0.08)] transition-all duration-200",
        isDragging && "opacity-50 shadow-2xl ring-2 ring-primary/30 scale-[0.98]",
        isRunning && "border-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.15)]",
      )}
    >
      {/* Running indicator */}
      {isRunning && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
      )}

      {/* Title */}
      <p className="text-sm font-semibold text-white/90 leading-snug mb-2.5 pr-6 line-clamp-2">
        {task.title}
      </p>

      {/* Active timer badge */}
      {isRunning && elapsed > 0 && (
        <div className="flex items-center gap-1 mb-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-primary">
            {formatTime(elapsed)}
          </span>
        </div>
      )}

      {/* Subtask progress */}
      {totalSubs > 0 && (
        <div className="mb-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Subtask</span>
            <span className="text-[10px] font-mono text-muted-foreground">{completedSubs}/{totalSubs}</span>
          </div>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 gap-2">
        {assignee ? (
          <div
            title={`${assignee.nome} ${assignee.cognome}`}
            className={cn(
              "h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0",
              avatarColor(assignee.id)
            )}
          >
            {assignee.nome?.charAt(0).toUpperCase()}{assignee.cognome?.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="h-6 w-6 rounded-lg bg-muted/30 border border-dashed border-border/50 flex-shrink-0" />
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {dueDate && (
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5",
              isOverdue  ? "text-red-400 bg-red-500/10" :
              isDueToday ? "text-yellow-400 bg-yellow-500/10" :
                           "text-muted-foreground bg-muted/30"
            )}>
              {isOverdue && <AlertCircle className="h-2.5 w-2.5" />}
              {isDueToday ? "Oggi" : format(dueDate, "dd/MM")}
            </span>
          )}

          {task.stima_minuti && task.stima_minuti > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {Math.round(task.stima_minuti / 60)}h
            </span>
          )}
        </div>
      </div>

      {/* Timer button */}
      <button
        onClick={handleTimer}
        className={cn(
          "absolute top-2.5 right-2.5 h-6 w-6 rounded-xl flex items-center justify-center transition-all shadow-lg active:scale-90",
          isRunning
            ? "opacity-100 text-primary bg-primary/10 border border-primary/20 animate-pulse"
            : "opacity-0 group-hover:opacity-100 text-slate-500 hover:text-primary hover:bg-primary/5 hover:border-primary/10 border border-transparent"
        )}
      >
        {isRunning
          ? <StopCircle className="h-4 w-4" />
          : <Play className="h-4 w-4 fill-current" />
        }
      </button>
    </div>
  );
}

// ─── Sortable card wrapper ─────────────────────────────────────────────────────
function SortableCard({ task }: { task: TaskSO }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <KanbanCard task={task} isDragging={isDragging} />
    </div>
  );
}

// ─── Column ────────────────────────────────────────────────────────────────────
interface ColumnProps {
  col: typeof COLUMNS[0];
  tasks: TaskSO[];
  onAddTask: () => void;
}

function KanbanColumn({ col, tasks, onAddTask }: ColumnProps) {
  return (
    <div className={cn(
      "flex flex-col flex-shrink-0 w-72 rounded-2xl border h-full max-h-full",
      col.accent, col.bg
    )}>
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: col.color + "30" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: col.color, boxShadow: `0 0 6px ${col.color}90` }}
          />
          <span className="text-xs font-black uppercase tracking-widest text-white/80">{col.label}</span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-md">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 shadow-lg active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="p-2 space-y-2 min-h-[80px]">
            {tasks.map(task => (
              <SortableCard key={task.id} task={task} />
            ))}
            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-8 w-8 rounded-xl bg-muted/20 flex items-center justify-center mb-2">
                  <Plus className="h-4 w-4 text-muted-foreground/40" />
                </div>
                <p className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider">Nessuna task</p>
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

// ─── Board ─────────────────────────────────────────────────────────────────────
export function StudioKanbanView() {
  const { nav, openNewTask } = useStudio();
  const { data: tasks = [], isLoading } = useTasks(
    nav.selectedListId ? { progetto_id: nav.selectedListId } : undefined
  );
  const { updateTask } = useTaskMutations();

  const [activeTask, setActiveTask] = useState<TaskSO | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const grouped = useMemo(() => {
    const map: Record<string, TaskSO[]> = {};
    COLUMNS.forEach(c => { map[c.id] = []; });
    tasks.forEach(t => {
      const stateUp = (t.state_id || "DA_FARE").toUpperCase();
      if (map[stateUp]) map[stateUp].push(t);
      else map["DA_FARE"].push(t);
    });
    return map;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask((event.active.data.current as { task: TaskSO } | undefined)?.task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const destCol =
      COLUMNS.find(c => c.id === over.id) ??
      COLUMNS.find(c => grouped[c.id].some(t => t.id === over.id));

    if (!destCol) return;

    const task = tasks.find(t => t.id === active.id);
    if (!task) return;

    if ((task.state_id || "DA_FARE").toUpperCase() !== destCol.id) {
      updateTask({ id: task.id, data: { stato: destCol.id } });
      toast.success(`Spostato in "${destCol.label}"`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-3" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Caricamento Board...</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              tasks={grouped[col.id] ?? []}
              onAddTask={() => openNewTask(nav.selectedFolderId, nav.selectedListId)}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rotate-1 scale-105 opacity-90 shadow-2xl w-72">
            <KanbanCard task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
