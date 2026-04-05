import React, { useMemo, useRef } from "react";
import { format, addDays, startOfToday, differenceInDays, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isValid } from "date-fns";
import { it } from "date-fns/locale";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useTaskMutations } from "@/hooks/useTasks";
import { toast } from "sonner";
import type { TaskSO } from "@/types/studio";

interface GanttChartProps {
  tasks: TaskSO[];
  period: "week" | "month" | "quarter";
  onTaskClick: (taskId: string) => void;
}

const ROW_HEIGHT = 48;
const LEFT_PANEL_WIDTH = 250;

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
    <div className="relative border border-border/50 rounded-3xl bg-card/20 overflow-hidden flex flex-col h-full shadow-2xl backdrop-blur-xl">
      <div className="flex shrink-0 border-b border-border/50 bg-card/40">
        <div style={{ width: LEFT_PANEL_WIDTH }} className="border-r border-border/50 p-4 flex items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Attività / Progetti</span>
        </div>
        <div className="flex-1 overflow-hidden" ref={containerRef}>
          <div style={{ width: timelineWidth }} className="flex h-full">
            {days.map((day: Date, i: number) => (
              <div 
                key={i} 
                style={{ width: dayWidth }} 
                className={`flex flex-col items-center justify-center border-r border-border/20 py-2 shrink-0 ${isSameDay(day, today) ? "bg-primary/10" : ""}`}
              >
                <span className="text-[10px] font-black text-slate-500 uppercase">{format(day, "eee", { locale: it })}</span>
                <span className={`text-xs font-black ${isSameDay(day, today) ? "text-primary" : "text-slate-300"}`}>{format(day, "dd")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div 
          style={{ width: LEFT_PANEL_WIDTH }} 
          className="border-r border-border/50 overflow-y-auto bg-card/10 scrollbar-none"
        >
          {Object.entries(groupedTasks).map(([projId, projTasks]) => (
            <div key={projId}>
              <div className="bg-muted/30 px-4 py-2 border-y border-border/20 sticky top-0">
                 <span className="text-[10px] font-black uppercase text-primary tracking-tighter">
                   {projTasks[0]?.progetto_id ? "Progetto ID: " + projTasks[0].progetto_id.split('-')[0] : "Task Generali"}
                 </span>
              </div>
              {(projTasks as TaskSO[]).map((task: TaskSO) => (
                <div 
                  key={task.id} 
                  style={{ height: ROW_HEIGHT }} 
                  className="px-4 flex items-center border-b border-border/10 hover:bg-white/5 transition-colors cursor-pointer group"
                  onClick={() => onTaskClick(task.id)}
                >
                  <span className="text-xs font-bold text-slate-300 truncate transition-colors group-hover:text-primary">
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto relative">
          <div style={{ width: timelineWidth, height: "100%" }} className="absolute top-0 left-0 flex">
             {days.map((day: Date, i: number) => (
               <div 
                 key={i} 
                 style={{ width: dayWidth }} 
                 className={`border-r border-border/5 shrink-0 ${isSameDay(day, today) ? "bg-primary/5" : ""}`}
               />
             ))}
          </div>

          <div 
            style={{ 
              left: differenceInDays(today, startDate) * dayWidth + dayWidth / 2,
              height: "100%"
            }}
            className="absolute top-0 w-px bg-red-500/50 z-10 pointer-events-none"
          >
            <div className="absolute top-0 -left-1 w-2 h-2 bg-red-500 rounded-full" />
          </div>

          <div style={{ width: timelineWidth }} className="relative z-20">
            {Object.entries(groupedTasks).map(([projId, projTasks]) => (
              <div key={projId}>
                <div className="h-[25px]" />
                {(projTasks as TaskSO[]).map((task: TaskSO) => {
                  const geom = getTaskGeometry(task);
                  if (!geom) return <div key={task.id} style={{ height: ROW_HEIGHT }} className="border-b border-border/10" />;

                  return (
                    <div 
                      key={task.id} 
                      style={{ height: ROW_HEIGHT }} 
                      className="border-b border-border/10 flex items-center relative group/row"
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
                              <span className="text-[10px] font-black truncate max-w-full text-white tracking-widest drop-shadow-md">
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
                                <h4 className="text-sm font-black text-white leading-tight">{task.title}</h4>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold">
                                   <div className="flex flex-col">
                                      <span>Inizio</span>
                                      <span className="text-white">{task.data_inizio ? format(parseISO(task.data_inizio), "dd MMM yyyy") : "-"}</span>
                                   </div>
                                   <div className="flex flex-col">
                                      <span>Scadenza</span>
                                      <span className={task.due_date && isSameDay(parseISO(task.due_date), today) ? "text-orange-400" : "text-white"}>
                                        {task.due_date ? format(parseISO(task.due_date), "dd MMM yyyy") : "-"}
                                      </span>
                                   </div>
                                </div>
                                {task.desc && <p className="text-[10px] text-slate-500 italic line-clamp-2">{task.desc}</p>}
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
  );
}
