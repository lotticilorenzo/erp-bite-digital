import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/hooks/useStudio";
import { useTasks } from "@/hooks/useTasks";
import { useUsers } from "@/hooks/useUsers";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isBefore,
  isToday,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { TaskSO } from "@/types/studio";

function avatarColor(id: string): string {
  const colors = ["bg-violet-600", "bg-indigo-600", "bg-blue-600", "bg-cyan-600", "bg-teal-600", "bg-emerald-600", "bg-fuchsia-600", "bg-rose-600"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function StudioCalendarView() {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const { nav, openNewTask, openTab } = useStudio();
  const { data: tasks = [] } = useTasks(
    nav.selectedListId ? { progetto_id: nav.selectedListId } : undefined
  );
  const { data: utenti = [] } = useUsers();

  const nextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const prevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const tasksWithDates = React.useMemo(() => tasks.filter(t => t.due_date), [tasks]);

  // Count tasks per status for header bar
  const statusCounts = React.useMemo(() => {
    const month = tasksWithDates.filter(t => {
      const d = parseISO(t.due_date!);
      return isSameMonth(d, currentMonth);
    });
    return {
      total: month.length,
      done: month.filter(t => t.state_id?.toUpperCase() === "COMPLETATO").length,
      overdue: month.filter(t => {
        const d = parseISO(t.due_date!);
        return isBefore(d, new Date()) && !isToday(d) && t.state_id?.toUpperCase() !== "COMPLETATO";
      }).length,
    };
  }, [tasksWithDates, currentMonth]);

  const handleTaskClick = (task: TaskSO) => {
    openTab({ type: "TASK", title: task.title, linkedId: task.id });
  };

  const handleAddTask = (_day: Date) => {
    openNewTask(nav.selectedFolderId, nav.selectedListId);
  };

  const STATE_COLORS: Record<string, string> = {
    DA_FARE:    "bg-slate-500/20 border-slate-500/30 text-slate-300",
    IN_CORSO:   "bg-violet-500/20 border-violet-500/30 text-violet-300",
    REVISIONE:  "bg-amber-500/20 border-amber-500/30 text-amber-300",
    COMPLETATO: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background/50">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border/50 bg-card/40 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <h2 className="text-base font-black text-white uppercase tracking-tighter">
              {format(currentMonth, "MMMM yyyy", { locale: it })}
            </h2>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              {statusCounts.total} task
            </span>
            <span className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {statusCounts.done} completate
            </span>
            {statusCounts.overdue > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {statusCounts.overdue} scadute
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 text-muted-foreground hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white"
            onClick={() => setCurrentMonth(new Date())}
          >
            Oggi
          </Button>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 text-muted-foreground hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day header row */}
      <div className="grid grid-cols-7 border-b border-border/20 flex-shrink-0">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(day => (
          <div
            key={day}
            className="py-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-r border-border/20 last:border-r-0 bg-card/10"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
        {calendarDays.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isCurrentDay = isSameDay(day, new Date());
          const dayTasks = tasksWithDates.filter(t => isSameDay(parseISO(t.due_date!), day));
          const hasOverdue = dayTasks.some(t => {
            const d = parseISO(t.due_date!);
            return isBefore(d, new Date()) && !isToday(d) && t.state_id?.toUpperCase() !== "COMPLETATO";
          });

          return (
            <div
              key={i}
              className={cn(
                "min-h-[100px] p-1.5 border-r border-b border-border/10 transition-colors group relative",
                "hover:bg-white/[0.02]",
                !isCurrentMonth && "opacity-25",
                isCurrentDay && "bg-primary/5",
              )}
            >
              {/* Day number */}
              <div className="flex justify-between items-center mb-1.5">
                <span className={cn(
                  "text-xs font-black w-6 h-6 flex items-center justify-center rounded-full",
                  isCurrentDay ? "bg-primary text-white shadow-[0_0_10px_hsl(var(--primary)/0.4)]" :
                  hasOverdue    ? "text-red-400" :
                                  "text-muted-foreground/70"
                )}>
                  {format(day, "d")}
                </span>

                {/* + add button */}
                <button
                  onClick={() => handleAddTask(day)}
                  className="h-5 w-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-all"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Tasks */}
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => {
                  const state = (task.state_id || "DA_FARE").toUpperCase();
                  const colorClass = STATE_COLORS[state] || STATE_COLORS["DA_FARE"];
                  const assignee = utenti.find(u => u.id === task.assegnatario_id);

                  return (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className={cn(
                        "px-1.5 py-0.5 rounded-md text-[10px] font-bold truncate cursor-pointer border transition-all",
                        "hover:brightness-110 hover:scale-[1.02]",
                        colorClass,
                      )}
                      title={task.title}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {task.stima_minuti && (
                          <Clock className="h-2 w-2 flex-shrink-0 opacity-60" />
                        )}
                        <span className="truncate">{task.title}</span>
                        {assignee && (
                          <div className={cn(
                            "h-3.5 w-3.5 rounded-sm flex items-center justify-center text-[8px] font-black text-white flex-shrink-0 ml-auto",
                            avatarColor(assignee.id)
                          )}>
                            {assignee.nome?.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* overflow indicator */}
                {dayTasks.length > 3 && (
                  <div className="px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground/60 hover:text-muted-foreground cursor-default">
                    +{dayTasks.length - 3} altre
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
