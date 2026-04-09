import { useMemo, useRef } from "react";
import { format, addDays, startOfToday, differenceInDays, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isValid } from "date-fns";
import { it } from "date-fns/locale";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useTaskMutations } from "@/hooks/useTasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TaskSO } from "@/types/studio";

interface GanttChartProps {
  tasks: TaskSO[];
  period: "week" | "month" | "quarter";
  onTaskClick: (taskId: string) => void;
}

const ROW_HEIGHT = 48;
const LEFT_PANEL_WIDTH = 300;

export function GanttChart({ tasks, period, onTaskClick }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { updateTask } = useTaskMutations();
  const today = startOfToday();

  // 1. Calculate Timeline Range
  const { startDate, days } = useMemo(() => {
    let start = today;
    let end = addDays(today, 30);

    if (period === "week") {
      start = startOfWeek(today, { weekStartsOn: 1 });
      end = endOfWeek(today, { weekStartsOn: 1 });
    } else if (period === "quarter") {
      end = addDays(today, 90);
    }

    // Expand range to include all tasks
    tasks.forEach(t => {
      if (t.data_inizio) {
        const d = parseISO(t.data_inizio);
        if (isValid(d) && d < start) start = d;
      }
      if (t.due_date) {
        const d = parseISO(t.due_date);
        if (isValid(d) && d > end) end = d;
      }
    });

    const interval = eachDayOfInterval({ start, end });
    return { startDate: start, days: interval };
  }, [tasks, period, today]);

  const dayWidth = 40; 
  const timelineWidth = days.length * dayWidth;

  // 2. Group Tasks by Project
  const groupedTasks = useMemo(() => {
    const groups: Record<string, TaskSO[]> = {};
    tasks.forEach(t => {
      const projId = t.progetto_id || "no-project";
      if (!groups[projId]) groups[projId] = [];
      groups[projId].push(t);
    });
    return groups;
  }, [tasks]);

  // 3. Helper to get X and Width
  const getTaskGeometry = (task: TaskSO) => {
    const start = task.data_inizio ? parseISO(task.data_inizio) : null;
    const end = task.due_date ? parseISO(task.due_date) : null;

    if (!start || !end || !isValid(start) || !isValid(end)) return null;

    const x = differenceInDays(start, startDate) * dayWidth;
    const width = Math.max((differenceInDays(end, start) + 1) * dayWidth, 20);
    
    return { x, width };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DA_FARE": return "bg-slate-500/20 border-slate-500/50";
      case "IN_CORSO": return "bg-purple-500/20 border-purple-500/50";
      case "COMPLETATO": return "bg-emerald-500/20 border-emerald-500/50";
      case "REVISIONE": return "bg-yellow-500/20 border-yellow-500/50";
      default: return "bg-slate-500/20 border-slate-500/50";
    }
  };

  const getStatusTextToken = (status: string) => {
    switch (status) {
      case "DA_FARE": return "text-slate-400";
      case "IN_CORSO": return "text-purple-400";
      case "COMPLETATO": return "text-emerald-400";
      case "REVISIONE": return "text-yellow-400";
      default: return "text-slate-400";
    }
  };

  return (
    <div className="flex w-full h-full bg-card shadow-2xl overflow-y-auto overflow-x-hidden border-t border-border/20">
      
      {/* Sidebar SINISTRA - FISSA */}
      <div 
        style={{ minWidth: LEFT_PANEL_WIDTH, maxWidth: LEFT_PANEL_WIDTH }}
        className="shrink-0 bg-card border-r border-border/50 sticky left-0 z-30 flex flex-col"
      >
        <div className="h-[48px] p-4 flex items-center shrink-0 border-b border-border/50 sticky top-0 bg-card z-40">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Attività / Progetti</span>
        </div>
        <div className="relative bg-card">
          {Object.entries(groupedTasks).map(([projId, projTasks]) => (
            <div key={projId}>
              <div className="h-[34px] bg-muted/30 px-4 flex items-center border-y border-border/20 sticky top-[48px] z-30">
                 <span className="text-[10px] font-black uppercase text-primary tracking-tighter">
                   {projTasks[0]?.progetto_id ? "Progetto ID: " + projTasks[0].progetto_id.split('-')[0] : "Task Generali"}
                 </span>
              </div>
              {(projTasks as TaskSO[]).map((task: TaskSO) => (
                <div 
                  key={task.id} 
                  style={{ height: ROW_HEIGHT }} 
                  className="px-4 flex items-center border-b border-border/10 hover:bg-muted/50 transition-colors cursor-pointer group bg-card"
                  onClick={() => onTaskClick(task.id)}
                >
                  <span className="text-xs font-bold text-foreground truncate transition-colors group-hover:text-primary">
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline DESTRA - SCROLLA Orizzontalmente */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-card relative">
        <div style={{ width: timelineWidth }} className="flex flex-col min-h-full">
          {/* Header Date */}
          <div className="h-[48px] flex shrink-0 border-b border-border/50 bg-card sticky top-0 z-40">
            {days.map((day: Date, i: number) => (
              <div 
                key={i} 
                style={{ width: dayWidth }} 
                className={`flex flex-col items-center justify-center border-r border-border/20 shrink-0 ${isSameDay(day, today) ? "bg-primary/10" : ""}`}
              >
                <span className="text-[10px] font-black text-muted-foreground uppercase">{format(day, "eee", { locale: it })}</span>
                <span className={`text-xs font-black ${isSameDay(day, today) ? "text-primary" : "text-foreground"}`}>{format(day, "dd")}</span>
              </div>
            ))}
          </div>
          
          {/* Timeline Rows Area */}
          <div className="relative flex-1" ref={containerRef}>
            {/* Background Lines */}
            <div className="absolute top-0 left-0 bottom-0 flex pointer-events-none z-0">
               {days.map((day: Date, i: number) => (
                 <div 
                   key={i} 
                   style={{ width: dayWidth }} 
                   className={`border-r border-border/5 shrink-0 ${isSameDay(day, today) ? "bg-primary/5" : ""}`}
                 />
               ))}
            </div>

            {/* Today Indicator */}
            <div 
              style={{ left: differenceInDays(today, startDate) * dayWidth + dayWidth / 2 }}
              className="absolute top-0 bottom-0 w-px bg-red-500/50 z-10 pointer-events-none"
            >
              <div className="absolute top-0 -left-1 w-2 h-2 bg-red-500 rounded-full" />
            </div>

            {/* Tasks Geometry */}
            <div className="relative z-20">
              {Object.entries(groupedTasks).map(([projId, projTasks]) => (
                <div key={projId}>
                  <div className="h-[34px] border-y border-transparent shrink-0" />
                  {(projTasks as TaskSO[]).map((task: TaskSO) => {
                    const geom = getTaskGeometry(task);
                    if (!geom) return <div key={task.id} style={{ height: ROW_HEIGHT }} className="border-b border-border/10" />;

                    return (
                      <div 
                        key={task.id} 
                        style={{ height: ROW_HEIGHT }} 
                        className="border-b border-border/10 flex items-center relative group/row w-full"
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                drag="x"
                                dragMomentum={false}
                                dragElastic={0}
                                onDragEnd={(_, info) => {
                                  const offsetDays = Math.round(info.offset.x / dayWidth);
                                  if (offsetDays === 0) return;
                                  
                                  const currentStart = parseISO(task.data_inizio!);
                                  const currentEnd = parseISO(task.due_date!);
                                  const newStart = addDays(currentStart, offsetDays);
                                  const newEnd = addDays(currentEnd, offsetDays);
                                  
                                  updateTask.mutate({
                                    id: task.id,
                                    data: {
                                      data_inizio: format(newStart, "yyyy-MM-dd"),
                                      data_scadenza: format(newEnd, "yyyy-MM-dd")
                                    }
                                  }, {
                                    onSuccess: () => toast.success("Task spostato"),
                                    onError: () => toast.error("Errore nello spostamento")
                                  });
                                }}
                                initial={{ opacity: 0, x: geom.x - 20 }}
                                animate={{ opacity: 1, x: geom.x }}
                                whileHover={{ scaleY: 1.05 }}
                                style={{ 
                                  width: geom.width,
                                  left: 0 
                                }}
                                onClick={() => {
                                  onTaskClick(task.id);
                                }}
                                className={`absolute h-8 rounded-lg border flex items-center justify-between px-3 cursor-pointer shadow-lg transition-all ${getStatusColor(task.state_id)} group hover:shadow-primary/20 backdrop-blur-sm z-30`}
                              >
                                <span className="text-[10px] font-black truncate max-w-full text-foreground tracking-widest drop-shadow-md">
                                  {task.title}
                                </span>
                                {task.stima_minuti && (
                                  <span className={`text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity ${getStatusTextToken(task.state_id)}`}>
                                    {task.stima_minuti}m
                                  </span>
                                )}
                              </motion.div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-card border-border p-4 w-64 shadow-2xl rounded-2xl">
                               <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                     <Badge variant="outline" className={`${getStatusColor(task.state_id)} text-[8px] border-none font-black`}>
                                        {task.state_id}
                                     </Badge>
                                  </div>
                                  <span className={cn(
                                    "text-[10px] uppercase font-black truncate",
                                    task.due_date && isSameDay(parseISO(task.due_date), today) ? "text-orange-400" : "text-foreground"
                                  )}>
                                    Attività
                                  </span>
                                  <h4 className="text-sm font-black text-foreground truncate leading-tight">
                                    {task.title}
                                  </h4>
                                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold">
                                     <div className="flex flex-col">
                                        <span>Inizio</span>
                                        <span className="text-foreground">{task.data_inizio ? format(parseISO(task.data_inizio), "dd MMM yyyy") : "-"}</span>
                                     </div>
                                     <div className="flex flex-col">
                                        <span>Scadenza</span>
                                        <span className={task.due_date && isSameDay(parseISO(task.due_date), today) ? "text-orange-400" : "text-foreground"}>
                                          {task.due_date ? format(parseISO(task.due_date), "dd MMM yyyy") : "-"}
                                        </span>
                                     </div>
                                  </div>
                                  {task.desc && <p className="text-[10px] text-muted-foreground italic line-clamp-2">{task.desc}</p>}
                               </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
