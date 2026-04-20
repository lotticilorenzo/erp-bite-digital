import { useMemo, useRef, useEffect, useState } from "react";
import {
  addDays,
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isPast,
  isSameDay,
  isToday,
  isValid,
  parseISO,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, Clock, GripHorizontal, MoveHorizontal } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/types";
import type { Assenza } from "@/hooks/useAssenze";
import type { TaskSO } from "@/types/studio";

interface GanttChartProps {
  tasks: TaskSO[];
  period: "week" | "month" | "quarter";
  onTaskClick: (taskId: string) => void;
  users?: User[];
  assenze?: Assenza[];
  groupBy?: "project" | "assignee";
  anchorDate?: Date;
  onTaskDateChange?: (taskId: string, newStart: string, newEnd: string) => void | Promise<void>;
}

interface GroupRow {
  key: string;
  label: string;
  sublabel?: string;
  userId?: string;
  tasks: TaskSO[];
}

const ROW_HEIGHT = 52;
const GROUP_HEADER_H = 32;
const LEFT_W = 260;

const STATUS_STYLES: Record<string, { bar: string; text: string; label: string }> = {
  DA_FARE: { bar: "bg-slate-400", text: "text-slate-400", label: "Da Fare" },
  IN_CORSO: { bar: "bg-violet-500", text: "text-violet-400", label: "In Corso" },
  COMPLETATO: { bar: "bg-emerald-500", text: "text-emerald-400", label: "Completato" },
  REVISIONE: { bar: "bg-amber-400", text: "text-amber-400", label: "Revisione" },
  todo: { bar: "bg-slate-400", text: "text-slate-400", label: "Da Fare" },
  "in-progress": { bar: "bg-violet-500", text: "text-violet-400", label: "In Corso" },
  done: { bar: "bg-emerald-500", text: "text-emerald-400", label: "Completato" },
  review: { bar: "bg-amber-400", text: "text-amber-400", label: "Revisione" },
};

type DragState = {
  taskId: string;
  startX: number;
  initialStart: Date;
  initialEnd: Date;
  deltaDays: number;
};

const getFallbackStyle = () => ({ bar: "bg-slate-500", text: "text-slate-400", label: "Sconosciuto" });
const getStyle = (state: string) => STATUS_STYLES[state] || getFallbackStyle();

function isOverdue(task: TaskSO) {
  if (!task.due_date) return false;
  const dueDate = parseISO(task.due_date);
  if (!isValid(dueDate)) return false;
  return isPast(dueDate) && !isToday(dueDate) && task.state_id !== "COMPLETATO" && task.state_id !== "done";
}

function progressPct(task: TaskSO) {
  if (task.state_id === "COMPLETATO" || task.state_id === "done") return 100;
  if (!task.stima_minuti || task.stima_minuti === 0) return 0;
  return Math.min(100, Math.round(((task.tempo_trascorso_minuti || 0) / task.stima_minuti) * 100));
}

export function GanttChart({
  tasks,
  period,
  onTaskClick,
  users = [],
  assenze = [],
  groupBy = "project",
  anchorDate,
  onTaskDateChange,
}: GanttChartProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [totalWidth, setTotalWidth] = useState(800);
  const baseDate = anchorDate ?? startOfToday();

  useEffect(() => {
    const element = outerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setTotalWidth(element.clientWidth));
    observer.observe(element);
    setTotalWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const { startDate, days } = useMemo(() => {
    let start =
      period === "week"
        ? startOfWeek(baseDate, { weekStartsOn: 1 })
        : startOfMonth(baseDate);
    let end =
      period === "week"
        ? endOfWeek(baseDate, { weekStartsOn: 1 })
        : period === "quarter"
          ? addDays(startOfMonth(baseDate), 89)
          : endOfMonth(baseDate);

    tasks.forEach((task) => {
      if (task.data_inizio) {
        const parsed = parseISO(task.data_inizio);
        if (isValid(parsed) && parsed < start) start = parsed;
      }
      if (task.due_date) {
        const parsed = parseISO(task.due_date);
        if (isValid(parsed) && parsed > end) end = parsed;
      }
    });

    return {
      startDate: start,
      days: eachDayOfInterval({ start, end }),
    };
  }, [baseDate, period, tasks]);

  const timelineW = Math.max(totalWidth - LEFT_W, 1);
  const dayWidth = Math.max(16, Math.floor(timelineW / Math.max(days.length, 1)));
  const showDay = dayWidth >= 22;
  const showWeekDay = dayWidth >= 18;
  const today = startOfToday();
  const todayX = differenceInDays(today, startDate) * dayWidth + dayWidth / 2;

  useEffect(() => {
    if (!dragState || !onTaskDateChange) return;

    function handleMove(event: MouseEvent) {
      const current = dragStateRef.current;
      if (!current) return;
      const delta = Math.round((event.clientX - current.startX) / dayWidth);
      if (delta !== current.deltaDays) {
        setDragState((prev) => (prev ? { ...prev, deltaDays: delta } : prev));
      }
    }

    function handleUp() {
      const current = dragStateRef.current;
      setDragState(null);
      dragStateRef.current = null;
      if (!current || current.deltaDays === 0) return;

      const nextStart = addDays(current.initialStart, current.deltaDays);
      const nextEnd = addDays(current.initialEnd, current.deltaDays);
      onTaskDateChange?.(
        current.taskId,
        format(nextStart, "yyyy-MM-dd"),
        format(nextEnd, "yyyy-MM-dd")
      );
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dayWidth, dragState, onTaskDateChange]);

  const groups = useMemo<GroupRow[]>(() => {
    if (groupBy === "assignee") {
      const map = new Map<string, GroupRow>();

      users.forEach((user) => {
        map.set(user.id, {
          key: user.id,
          label: `${user.nome} ${user.cognome}`,
          sublabel: user.ruolo || "Team Member",
          userId: user.id,
          tasks: [],
        });
      });

      tasks.forEach((task) => {
        const assigneeId = (task as any).assegnatario_id || task.assignees?.[0] || "unassigned";
        const existing = map.get(assigneeId);
        if (existing) {
          existing.tasks.push(task);
          return;
        }
        map.set(assigneeId, {
          key: assigneeId,
          label: assigneeId === "unassigned" ? "Non assegnati" : "Assegnatario",
          sublabel: assigneeId === "unassigned" ? "Backlog" : undefined,
          userId: assigneeId === "unassigned" ? undefined : assigneeId,
          tasks: [task],
        });
      });

      return Array.from(map.values()).filter((group) => group.tasks.length > 0 || !!group.userId);
    }

    const projectMap = new Map<string, GroupRow>();
    tasks.forEach((task) => {
      const key = task.progetto?.nome ?? (task.progetto_id ? "Progetto" : "Task Liberi");
      const existing = projectMap.get(key) ?? ({
        key,
        label: key,
        tasks: [],
      } as GroupRow);
      existing.tasks.push(task);
      projectMap.set(key, existing);
    });
    return Array.from(projectMap.values());
  }, [groupBy, tasks, users]);

  const absenceByUser = useMemo(() => {
    const map = new Map<string, Assenza[]>();
    assenze.forEach((assenza) => {
      if (assenza.stato === "RIFIUTATA") return;
      const list = map.get(assenza.user_id) ?? [];
      list.push(assenza);
      map.set(assenza.user_id, list);
    });
    return map;
  }, [assenze]);

  function getGeometry(task: TaskSO) {
    const start = task.data_inizio ? parseISO(task.data_inizio) : null;
    const end = task.due_date ? parseISO(task.due_date) : null;
    if (!start || !end || !isValid(start) || !isValid(end)) return null;

    let x = differenceInDays(start, startDate) * dayWidth;
    const width = Math.max((differenceInDays(end, start) + 1) * dayWidth, dayWidth);

    if (dragState?.taskId === task.id) {
      x += dragState.deltaDays * dayWidth;
    }

    return { x, width, start, end };
  }

  function handleBarMouseDown(event: React.MouseEvent, task: TaskSO) {
    if (!onTaskDateChange || !task.data_inizio || !task.due_date) return;

    const start = parseISO(task.data_inizio);
    const end = parseISO(task.due_date);
    if (!isValid(start) || !isValid(end)) return;

    event.preventDefault();
    event.stopPropagation();
    setDragState({
      taskId: task.id,
      startX: event.clientX,
      initialStart: start,
      initialEnd: end,
      deltaDays: 0,
    });
  }

  return (
    <div ref={outerRef} className="flex w-full overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl">
      <div style={{ width: LEFT_W, minWidth: LEFT_W }} className="shrink-0 border-r border-border/50 bg-card">
        <div className="flex h-[48px] items-center px-4 border-b border-border/50 bg-muted/20">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {groupBy === "assignee" ? "Risorsa" : "Attività"}
          </span>
        </div>

        <div className="overflow-y-auto overflow-x-hidden">
          {groups.map((group) => {
            const rows = group.tasks.length > 0 ? group.tasks : [null];
            return (
              <div key={group.key}>
                <div
                  style={{ height: GROUP_HEADER_H }}
                  className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-muted/20 px-3"
                >
                  <span className="truncate text-[10px] font-black uppercase tracking-widest text-primary">
                    {group.label}
                  </span>
                  <span className="ml-2 shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                    {group.tasks.length}
                  </span>
                </div>

                {rows.map((task, index) => {
                  if (!task) {
                    return (
                      <div key={`${group.key}-empty-${index}`} style={{ height: ROW_HEIGHT }} className="flex items-center px-3 border-b border-border/10">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">
                          Nessun task assegnato
                        </span>
                      </div>
                    );
                  }

                  const overdue = isOverdue(task);
                  const completion = progressPct(task);
                  const statusStyle = getStyle(task.state_id);

                  return (
                    <div
                      key={task.id}
                      style={{ height: ROW_HEIGHT }}
                      className="group flex flex-col justify-center border-b border-border/10 px-3 transition-colors hover:bg-muted/30"
                      onClick={() => onTaskClick(task.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        {overdue && <AlertTriangle className="h-3 w-3 shrink-0 text-rose-400" />}
                        <span className={`truncate text-xs font-bold ${overdue ? "text-rose-300" : "text-foreground group-hover:text-primary"}`}>
                          {task.title || "Task senza nome"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/40">
                          <div className={`h-full rounded-full ${statusStyle.bar}`} style={{ width: `${completion}%` }} />
                        </div>
                        <span className={`text-[9px] font-black ${statusStyle.text}`}>{completion}%</span>
                      </div>
                      {group.sublabel && (
                        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
                          {group.sublabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex h-[48px] border-b border-border/50 bg-muted/20">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              style={{ width: dayWidth, minWidth: dayWidth }}
              className={`flex shrink-0 flex-col items-center justify-center border-r border-border/10 ${
                isSameDay(day, today) ? "bg-primary/10" : ""
              }`}
            >
              {showWeekDay && (
                <span className="text-[8px] font-bold uppercase text-muted-foreground">
                  {format(day, "eee", { locale: it })}
                </span>
              )}
              {showDay && (
                <span className={`text-[10px] font-black ${isSameDay(day, today) ? "text-primary" : "text-foreground"}`}>
                  {format(day, "dd")}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="relative overflow-y-auto overflow-x-auto">
          <div className="absolute inset-0 z-0 flex pointer-events-none">
            {days.map((day) => (
              <div
                key={day.toISOString()}
                style={{ width: dayWidth, minWidth: dayWidth }}
                className={`h-full shrink-0 border-r border-border/5 ${
                  isSameDay(day, today)
                    ? "bg-primary/5"
                    : day.getDay() === 0 || day.getDay() === 6
                      ? "bg-muted/10"
                      : ""
                }`}
              />
            ))}
          </div>

          {todayX >= 0 && todayX <= timelineW && (
            <div style={{ left: todayX }} className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500/70">
              <div className="absolute -top-1 -left-1.5 h-3 w-3 rounded-full bg-red-500 shadow-lg shadow-red-500/40" />
            </div>
          )}

          <div className="relative z-20">
            {groups.map((group) => {
              const rows = group.tasks.length > 0 ? group.tasks : [null];
              const absences = group.userId ? absenceByUser.get(group.userId) ?? [] : [];

              return (
                <div key={group.key}>
                  <div style={{ height: GROUP_HEADER_H }} className="border-b border-border/20" />

                  {rows.map((task, index) => (
                    <div
                      key={task?.id ?? `${group.key}-empty-${index}`}
                      style={{ height: ROW_HEIGHT }}
                      className="relative flex items-center border-b border-border/10"
                    >
                      {absences.map((assenza) => {
                        const start = parseISO(assenza.data_inizio);
                        const end = parseISO(assenza.data_fine);
                        if (!isValid(start) || !isValid(end)) return null;

                        const x = differenceInDays(start, startDate) * dayWidth;
                        const width = Math.max((differenceInDays(end, start) + 1) * dayWidth, dayWidth);
                        return (
                          <div
                            key={`${assenza.id}-${index}`}
                            style={{ left: x, width }}
                            className="absolute top-1.5 bottom-1.5 rounded-md bg-rose-500/10 border border-rose-500/20"
                          >
                            {width > 60 && (
                              <span className="absolute inset-0 flex items-center px-2 text-[9px] font-black uppercase tracking-widest text-rose-300/70">
                                {assenza.tipo}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {task ? (
                        (() => {
                          const geometry = getGeometry(task);
                          const overdue = isOverdue(task);
                          const completion = progressPct(task);
                          const statusStyle = getStyle(task.state_id);

                          if (!geometry) {
                            return (
                              <div className="absolute left-3 text-[9px] italic font-bold text-muted-foreground/30">
                                nessuna data
                              </div>
                            );
                          }

                          return (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    style={{ left: geometry.x, width: geometry.width }}
                                    className={`absolute z-30 flex h-7 cursor-pointer items-center overflow-hidden rounded-lg border shadow transition-all hover:brightness-110 ${
                                      overdue ? "border-rose-500/40 bg-rose-500/10" : "border-white/10 bg-[#1a1d2e]"
                                    } ${onTaskDateChange ? "cursor-grab active:cursor-grabbing" : ""}`}
                                    onClick={() => onTaskClick(task.id)}
                                    onMouseDown={(event) => handleBarMouseDown(event, task)}
                                  >
                                    <div className={`h-full w-1 shrink-0 ${statusStyle.bar}`} />
                                    <div
                                      className={`absolute left-1 top-0 bottom-0 opacity-15 ${statusStyle.bar}`}
                                      style={{ width: `calc(${completion}% - 4px)` }}
                                    />
                                    {geometry.width > 34 && (
                                      <span className="relative z-10 flex-1 truncate px-1.5 text-[10px] font-black text-white/85">
                                        {task.title}
                                      </span>
                                    )}
                                    {onTaskDateChange && geometry.width > 56 && (
                                      <MoveHorizontal className="mr-1 h-3.5 w-3.5 shrink-0 text-white/50" />
                                    )}
                                  </div>
                                </TooltipTrigger>

                                <TooltipContent side="bottom" className="w-72 border-border bg-transparent p-0 shadow-2xl" avoidCollisions>
                                  <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="text-sm font-black leading-tight text-foreground">{task.title}</h4>
                                      <Badge variant="outline" className="shrink-0 border-border text-[9px] font-black">
                                        {statusStyle.label}
                                      </Badge>
                                    </div>

                                    <div>
                                      <div className="mb-1 flex justify-between text-[10px] font-bold">
                                        <span className="text-muted-foreground">Completamento</span>
                                        <span className={statusStyle.text}>{completion}%</span>
                                      </div>
                                      <div className="h-1.5 overflow-hidden rounded-full bg-border">
                                        <div className={`h-full rounded-full ${statusStyle.bar}`} style={{ width: `${completion}%` }} />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                      <div>
                                        <p className="mb-0.5 font-bold uppercase tracking-widest text-muted-foreground">Inizio</p>
                                        <p className="font-black text-foreground">
                                          {format(geometry.start, "dd MMM yyyy", { locale: it })}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="mb-0.5 font-bold uppercase tracking-widest text-muted-foreground">Scadenza</p>
                                        <p className={`font-black ${overdue ? "text-rose-400" : "text-foreground"}`}>
                                          {format(geometry.end, "dd MMM yyyy", { locale: it })}
                                        </p>
                                      </div>
                                    </div>

                                    {!!task.stima_minuti && (
                                      <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-[10px]">
                                        <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        <span className="text-muted-foreground">
                                          <span className="font-black text-foreground">{task.tempo_trascorso_minuti ?? 0}m</span>
                                          {" / "}
                                          {task.stima_minuti}m stimati
                                        </span>
                                      </div>
                                    )}

                                    {task.desc && (
                                      <p className="border-t border-border pt-2 text-[10px] italic text-muted-foreground line-clamp-2">
                                        {task.desc}
                                      </p>
                                    )}

                                    {onTaskDateChange && (
                                      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] text-primary">
                                        <GripHorizontal className="h-3 w-3 shrink-0" />
                                        Drag orizzontale per spostare le date del task.
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()
                      ) : (
                        <div className="absolute left-3 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/25">
                          slot libero
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
