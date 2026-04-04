import React, { useState } from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  MoreVertical, 
  Clock, 
  User as UserIcon,
  Play,
  StopCircle,
  CheckCircle2,
  ListTodo
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useStudio } from "@/hooks/useStudio";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TaskSO, SubtaskSO } from "@/types/studio";
import { DEFAULT_STATES } from "@/types/studio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function StudioListView() {
  const { nav, openNewTask } = useStudio();
  const { data } = useTasks();

  const tasks = React.useMemo(() => {
    if (!data) return [];
    let filtered = data;
    if (nav.selectedListId) {
      filtered = filtered.filter(t => t.progetto_id === nav.selectedListId);
    } else if (nav.selectedFolderId) {
      filtered = filtered.filter(t => t.commessa_id === nav.selectedFolderId);
    }
    return filtered;
  }, [data, nav.selectedFolderId, nav.selectedListId]);

  return (
    <div className="flex-1 overflow-auto bg-background/50">
      <Table>
        <TableHeader className="bg-card/80 sticky top-0 z-10 backdrop-blur-md border-b border-border/50">
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-[400px] text-[10px] font-black uppercase tracking-widest text-[#475569] h-12">Task Name</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#475569] h-12">Assegnatario</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#475569] h-12">Stato</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#475569] h-12">Tempo</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#475569] h-12">Scadenza</TableHead>
            <TableHead className="w-12 text-center h-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} depth={0} />
          ))}
          <TableRow className="hover:bg-white/5 border-border/20 group">
            <TableCell colSpan={6} className="p-0">
              <Button 
                variant="ghost" 
                className="w-full justify-start h-12 px-6 text-[10px] font-black uppercase tracking-widest text-[#475569] hover:text-primary hover:bg-transparent group"
                onClick={() => openNewTask(nav.selectedFolderId, nav.selectedListId)}
              >
                <Plus className="h-3.5 w-3.5 mr-2 group-hover:scale-125 transition-transform" />
                Aggiungi Task
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function TaskRow({ task, depth = 0 }: { task: TaskSO | SubtaskSO; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const { timer, selectTask } = useStudio();
  const { updateTask } = useTaskMutations();
  
  const subtasks = 'subtasks' in task ? task.subtasks : [];
  const hasSubtasks = subtasks && subtasks.length > 0;
  const isTimerActive = timer.active_session?.task_id === task.id;

  const completedSubtasks = subtasks.filter(st => st.stateId === 'done' || st.stateId === 'COMPLETATO').length;
  const totalSubtasks = subtasks.length;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTask.mutateAsync({ id: task.id, data: { stato: newStatus } });
      toast.success("Stato aggiornato");
    } catch (err) {
      toast.error("Errore durante l'aggiornamento dello stato");
    }
  };

  const currentStatus = DEFAULT_STATES.find(s => s.id === (task as any).state_id || (task as any).stateId) || DEFAULT_STATES[0];

  return (
    <>
      <TableRow 
        className={`hover:bg-white/5 border-border/10 group cursor-pointer transition-colors ${isTimerActive ? 'bg-primary/5 shadow-inner' : ''}`}
        onClick={() => selectTask(task.id)}
      >
        <TableCell className="py-3 px-6 h-14">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
            {hasSubtasks ? (
              <button 
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="p-1 rounded-md hover:bg-white/10 text-[#475569] hover:text-foreground transition-all"
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <div className="w-5.5" /> 
            )}
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 shadow-[0_0_8px_hsl(var(--primary)/0.2)] transition-colors ${isTimerActive ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
            <span className={`text-[13px] font-bold truncate ${isTimerActive ? 'text-white' : 'text-muted-foreground'}`}>
              {task.title}
            </span>
            {totalSubtasks > 0 && (
              <Badge variant="outline" className="ml-2 bg-white/5 border-border text-[9px] font-black tracking-tighter h-4 gap-1">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                {completedSubtasks}/{totalSubtasks}
              </Badge>
            )}
            {isTimerActive && (
              <Badge className="ml-2 bg-primary/20 text-primary border-primary/20 text-[9px] font-black tracking-tighter h-4">LIVE</Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex -space-x-2">
            {[1].map((i) => (
              <div key={i} className="h-6 w-6 rounded-full border border-[#020617] bg-muted flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                <UserIcon className="h-3 w-3" />
              </div>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Badge 
                variant="outline" 
                className="text-[10px] font-black uppercase bg-transparent border-border text-[#475569] hover:border-primary/50 hover:text-primary cursor-pointer transition-all"
                style={{ borderColor: currentStatus.color + '40', color: currentStatus.color }}
              >
                {currentStatus.name}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-card border-border text-foreground w-40">
              {DEFAULT_STATES.map((state) => (
                <DropdownMenuItem 
                  key={state.id} 
                  onClick={(e) => { e.stopPropagation(); handleStatusChange(state.id); }}
                  className="text-[10px] font-black uppercase tracking-widest py-2 focus:bg-primary/10 cursor-pointer"
                >
                  <div className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: state.color }} />
                  {state.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2 tabular-nums">
            <Clock className={`h-3 w-3 ${isTimerActive ? 'text-primary' : 'text-[#334155]'}`} />
            <div className="flex flex-col">
              <span className={`text-xs font-black ${isTimerActive ? 'text-primary' : 'text-[#475569]'}`}>
                {formatTime(timer.getElapsed(task.id))}
              </span>
              {('stima_minuti' in task && task.stima_minuti && task.stima_minuti > 0) && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge 
                    variant="outline" 
                    className={`text-[8px] h-3.5 px-1 font-black border-none ${
                        (timer.getElapsed(task.id) / 60000) > (task.stima_minuti * 1.2) ? "bg-red-500/10 text-red-500" :
                        (timer.getElapsed(task.id) / 60000) > (task.stima_minuti) ? "bg-orange-500/10 text-orange-500" :
                        "bg-emerald-500/10 text-emerald-500"
                    }`}
                  >
                    EST: {task.stima_minuti}m
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-xs font-bold text-[#334155]">-</span>
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1">
            {!isTimerActive ? (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                onClick={(e) => { e.stopPropagation(); timer.start(task.id); }}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                onClick={(e) => { e.stopPropagation(); timer.stop(timer.active_session!.id); }}
              >
                <StopCircle className="h-3.5 w-3.5 fill-current" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-[#1e293b] hover:text-white group-hover:text-[#475569]">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && hasSubtasks && subtasks.map((sub) => (
        <TaskRow key={sub.id} task={sub} depth={depth + 1} />
      ))}
    </>
  );
}
