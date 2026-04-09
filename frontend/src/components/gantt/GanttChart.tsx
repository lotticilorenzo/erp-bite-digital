import { useMemo, useRef, useEffect, useState } from "react";
import {
  format,
  addDays,
  startOfToday,
  differenceInDays,
  isSameDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  parseISO,
  isValid,
  isPast,
  isToday,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";
import type { TaskSO } from "@/types/studio";

interface GanttChartProps {
  tasks: TaskSO[];
  period: "week" | "month" | "quarter";
  onTaskClick: (taskId: string) => void;
}

const ROW_HEIGHT = 48;
const GROUP_HEADER_H = 32;
const LEFT_W = 240;

const STATUS_STYLES: Record<string, { bar: string; text: string; label: string }> = {
  DA_FARE:    { bar: "bg-slate-400",   text: "text-slate-400",   label: "Da Fare" },
  IN_CORSO:   { bar: "bg-violet-500",  text: "text-violet-400",  label: "In Corso" },
  COMPLETATO: { bar: "bg-emerald-500", text: "text-emerald-400", label: "Completato" },
  REVISIONE:  { bar: "bg-amber-400",   text: "text-amber-400",   label: "Revisione" },
  todo:         { bar: "bg-slate-400",   text: "text-slate-400",   label: "Da Fare" },
  "in-progress":{ bar: "bg-violet-500",  text: "text-violet-400",  label: "In Corso" },
  done:         { bar: "bg-emerald-500", text: "text-emerald-400", label: "Completato" },
  review:       { bar: "bg-amber-400",   text: "text-amber-400",   label: "Revisione" },
};
const getFallbackStyle = () => ({ bar: "bg-slate-500", text: "text-slate-400", label: "Sconosciuto" });
const getStyle = (state: string) => STATUS_STYLES[state] || getFallbackStyle();

function isOverdue(t: TaskSO) {
  if (!t.due_date) return false;
  const d = parseISO(t.due_date);
  if (!isValid(d)) return false;
  return isPast(d) && !isToday(d) && t.state_id !== "COMPLETATO" && t.state_id !== "done";
}

function pct(t: TaskSO) {
  if (t.state_id === "COMPLETATO" || t.state_id === "done") return 100;
  if (!t.stima_minuti || t.stima_minuti === 0) return 0;
  return Math.min(100, Math.round(((t.tempo_trascorso_minuti || 0) / t.stima_minuti) * 100));
}

export function GanttChart({ tasks, period, onTaskClick }: GanttChartProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [totalWidth, setTotalWidth] = useState(800);
  const today = startOfToday();

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ob = new ResizeObserver(() => setTotalWidth(el.clientWidth));
    ob.observe(el);
    setTotalWidth(el.clientWidth);
    return () => ob.disconnect();
  }, []);

  // ── Timeline range ────────────────────────────────────────────────────────
  const { startDate, days } = useMemo(() => {
    let start = today;
    let end =
      period === "week"
        ? endOfWeek(today, { weekStartsOn: 1 })
        : period === "quarter"
        ? addDays(today, 89)
        : addDays(today, 29);

    if (period === "week") start = startOfWeek(today, { weekStartsOn: 1 });

    // Expand to cover task dates
    tasks.forEach((t) => {
      if (t.data_inizio) {
        const d = parseISO(t.data_inizio);
        if (isValid(d) && d < start) start = d;
      }
      if (t.due_date) {
        const d = parseISO(t.due_date);
        if (isValid(d) && d > end) end = d;
      }
    });

    return { startDate: start, days: eachDayOfInterval({ start, end }) };
  }, [tasks, period, today]);

  // ── Auto dayWidth: fill exactly the available timeline area ──────────────
  const timelineW = Math.max(totalWidth - LEFT_W, 1);
  const dayWidth  = Math.max(4, Math.floor(timelineW / days.length));
  const showDay   = dayWidth >= 22;
  const showWday  = dayWidth >= 16;

  // ── Group by project name ─────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const g: Record<string, TaskSO[]> = {};
    tasks.forEach((t) => {
      const key = t.progetto?.nome ?? (t.progetto_id ? "Progetto" : "Task Liberi");
      if (!g[key]) g[key] = [];
      g[key].push(t);
    });
    return g;
  }, [tasks]);

  const todayX = differenceInDays(today, startDate) * dayWidth + dayWidth / 2;

  // ── Geometry ──────────────────────────────────────────────────────────────
  function geom(t: TaskSO) {
    const s = t.data_inizio ? parseISO(t.data_inizio) : null;
    const e = t.due_date    ? parseISO(t.due_date)    : null;
    if (!s || !e || !isValid(s) || !isValid(e)) return null;
    const x = differenceInDays(s, startDate) * dayWidth;
    const w = Math.max((differenceInDays(e, s) + 1) * dayWidth, dayWidth);
    return { x, w };
  }

  return (
    <div ref={outerRef} className="flex w-full h-full overflow-hidden bg-card border-t border-border/20">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <div style={{ width: LEFT_W, minWidth: LEFT_W }} className="shrink-0 flex flex-col border-r border-border/50 bg-card z-20">
        {/* column header */}
        <div className="h-[48px] flex items-center px-4 border-b border-border/50 bg-muted/20 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Attività</span>
        </div>

        {/* rows */}
        <div className="overflow-y-auto flex-1 overflow-x-hidden">
          {Object.entries(grouped).map(([grp, grpTasks]) => (
            <div key={grp}>
              {/* group header */}
              <div
                style={{ height: GROUP_HEADER_H }}
                className="flex items-center justify-between px-3 bg-muted/20 border-b border-border/30 sticky top-0 z-10"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-primary truncate">{grp}</span>
                <span className="text-[9px] text-muted-foreground font-bold bg-background px-2 py-0.5 rounded-full border border-border shrink-0 ml-1">
                  {grpTasks.length}
                </span>
              </div>
              {/* task rows */}
              {grpTasks.map((t) => {
                const overdue = isOverdue(t);
                const p = pct(t);
                const st = getStyle(t.state_id);
                return (
                  <div
                    key={t.id}
                    style={{ height: ROW_HEIGHT }}
                    className="flex flex-col justify-center px-3 border-b border-border/10 hover:bg-muted/30 cursor-pointer group transition-colors"
                    onClick={() => onTaskClick(t.id)}
                  >
                    <div className="flex items-center gap-1.5">
                      {overdue && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                      <span className={`text-xs font-bold truncate group-hover:text-primary transition-colors ${overdue ? "text-red-300" : "text-foreground"}`}>
                        {t.title || "Task senza nome"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 rounded-full bg-border/50 overflow-hidden">
                        <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${p}%`, transition: "width 0.4s" }} />
                      </div>
                      <span className={`text-[9px] font-black shrink-0 ${st.text}`}>{p}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground italic">
              Nessun task trovato
            </div>
          )}
        </div>
      </div>

      {/* ── TIMELINE PANEL ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* date header */}
        <div className="h-[48px] flex shrink-0 border-b border-border/50 bg-muted/20 overflow-hidden">
          {days.map((day, i) => (
            <div
              key={i}
              style={{ width: dayWidth, minWidth: dayWidth }}
              className={`flex flex-col items-center justify-center border-r border-border/10 shrink-0 ${isSameDay(day, today) ? "bg-primary/10" : ""}`}
            >
              {showWday && <span className="text-[8px] font-bold text-muted-foreground uppercase">{format(day, "eee", { locale: it })}</span>}
              {showDay  && <span className={`text-[10px] font-black ${isSameDay(day, today) ? "text-primary" : "text-foreground"}`}>{format(day, "dd")}</span>}
            </div>
          ))}
        </div>

        {/* rows + bars */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">

          {/* bg grid */}
          <div className="absolute inset-0 flex pointer-events-none z-0">
            {days.map((day, i) => (
              <div
                key={i}
                style={{ width: dayWidth, minWidth: dayWidth }}
                className={`border-r border-border/5 shrink-0 h-full ${
                  isSameDay(day, today) ? "bg-primary/5" :
                  day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/10" : ""
                }`}
              />
            ))}
          </div>

          {/* TODAY line */}
          {todayX >= 0 && todayX <= timelineW && (
            <div style={{ left: todayX }} className="absolute top-0 bottom-0 w-px bg-red-500/70 z-10 pointer-events-none">
              <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
            </div>
          )}

          {/* task groups */}
          <div className="relative z-20">
            {Object.entries(grouped).map(([grp, grpTasks]) => (
              <div key={grp}>
                {/* spacer matching group header */}
                <div style={{ height: GROUP_HEADER_H }} className="border-b border-border/20" />

                {grpTasks.map((t) => {
                  const g = geom(t);
                  const overdue = isOverdue(t);
                  const p = pct(t);
                  const st = getStyle(t.state_id);

                  return (
                    <div
                      key={t.id}
                      style={{ height: ROW_HEIGHT }}
                      className="border-b border-border/10 relative flex items-center"
                    >
                      {g ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                style={{ left: g.x, width: g.w }}
                                className={`absolute h-7 rounded-lg cursor-pointer flex items-center overflow-hidden shadow transition-all hover:brightness-125 z-30 border ${
                                  overdue ? "border-red-500/40 bg-red-500/10" : "border-white/8 bg-[#1a1d2e]"
                                }`}
                                onClick={() => onTaskClick(t.id)}
                              >
                                {/* colored accent strip */}
                                <div className={`h-full w-1 shrink-0 ${st.bar}`} />
                                {/* completion fill overlay */}
                                <div
                                  className={`absolute left-1 top-0 bottom-0 ${st.bar} opacity-15`}
                                  style={{ width: `calc(${p}% - 4px)` }}
                                />
                                {/* title */}
                                {g.w > 30 && (
                                  <span className="relative z-10 text-[10px] font-black text-white/80 truncate px-1.5 flex-1 leading-none">
                                    {t.title}
                                  </span>
                                )}
                                {overdue && g.w > 24 && (
                                  <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mr-1" />
                                )}
                              </div>
                            </TooltipTrigger>

                            <TooltipContent side="bottom" className="p-0 border-border bg-transparent shadow-2xl w-72" avoidCollisions>
                              <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="text-sm font-black text-foreground leading-tight">{t.title}</h4>
                                  <Badge variant="outline" className="text-[9px] font-black shrink-0 border-border">
                                    {st.label}
                                  </Badge>
                                </div>

                                {/* progress */}
                                <div>
                                  <div className="flex justify-between text-[10px] font-bold mb-1">
                                    <span className="text-muted-foreground">Completamento</span>
                                    <span className={`font-black ${st.text}`}>{p}%</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                                    <div className={`h-full ${st.bar} rounded-full`} style={{ width: `${p}%` }} />
                                  </div>
                                </div>

                                {/* dates */}
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  <div>
                                    <p className="text-muted-foreground font-bold uppercase tracking-widest mb-0.5">Inizio</p>
                                    <p className="font-black text-foreground">
                                      {t.data_inizio && isValid(parseISO(t.data_inizio))
                                        ? format(parseISO(t.data_inizio), "dd MMM yyyy", { locale: it }) : "—"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground font-bold uppercase tracking-widest mb-0.5">Scadenza</p>
                                    <p className={`font-black ${overdue ? "text-red-400" : "text-foreground"}`}>
                                      {t.due_date && isValid(parseISO(t.due_date))
                                        ? format(parseISO(t.due_date), "dd MMM yyyy", { locale: it }) : "—"}
                                    </p>
                                  </div>
                                </div>

                                {/* time */}
                                {!!t.stima_minuti && (
                                  <div className="flex items-center gap-2 text-[10px] bg-muted/30 rounded-lg px-3 py-2">
                                    <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <span className="text-muted-foreground">
                                      <span className="text-foreground font-black">{t.tempo_trascorso_minuti ?? 0}m</span>
                                      {" / "}{t.stima_minuti}m stimati
                                    </span>
                                  </div>
                                )}

                                {overdue && (
                                  <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span className="font-black">Task in Ritardo!</span>
                                  </div>
                                )}

                                {t.desc && (
                                  <p className="text-[10px] text-muted-foreground italic line-clamp-2 border-t border-border pt-2">
                                    {t.desc}
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        /* no dates */
                        <div className="absolute left-2 text-[9px] text-muted-foreground/30 font-bold italic">
                          nessuna data
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
