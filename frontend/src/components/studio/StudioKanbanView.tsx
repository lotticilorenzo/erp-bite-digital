import React from "react";
import { 
  Zap, 
  Plus, 
  MoreVertical, 
  Clock, 
  User as UserIcon,
  ChevronRight
} from "lucide-react";
import { useStudio } from "@/hooks/useStudio";
import { useTasks } from "@/hooks/useTasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_STATES } from "@/types/studio";
import type { TaskSO } from "@/types/studio";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function StudioKanbanView() {
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

  // Group tasks by status
  // For now we use ClickUp statuses mapped to our local IDs loosely
  // Usually ClickUp has many statuses, we'll map them to To Do / In Progress / Done
  const columns = DEFAULT_STATES.map(state => ({
    ...state,
    tasks: tasks.filter(t => {
      if (state.id === 'todo') return t.state_id === 'to do' || t.state_id === 'open';
      if (state.id === 'in-progress') return t.state_id === 'in progress' || t.state_id === 'process';
      if (state.id === 'done') return t.state_id === 'complete' || t.state_id === 'closed';
      return false;
    })
  }));

  return (
    <ScrollArea className="flex-1 w-full bg-[#020617]/50">
      <div className="flex gap-6 p-6 h-[calc(100vh-140px)] min-w-max">
        {columns.map((column) => (
          <div key={column.id} className="w-80 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full shadow-[0_0_10px_rgba(124,58,237,0.3)]" style={{ backgroundColor: column.color }} />
                <h3 className="text-xs font-black uppercase tracking-widest text-white">{column.name}</h3>
                <Badge variant="outline" className="text-[10px] bg-white/5 border-[#1e293b] text-[#475569] px-1.5 h-4 min-w-4 justify-center">
                  {column.tasks.length}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-[#1e293b] hover:text-[#475569]">
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex-1 space-y-3 p-1 overflow-y-auto custom-scrollbar">
              {column.tasks.map((task) => (
                <KanbanCard key={task.id} task={task} />
              ))}
              <Button 
                variant="ghost" 
                className="w-full justify-start h-10 px-4 text-[10px] font-black uppercase tracking-widest text-[#1e293b] hover:text-primary hover:bg-white/5 group border border-dashed border-[#1e293b]/50 rounded-xl"
                onClick={() => openNewTask(nav.selectedFolderId, nav.selectedListId)}
              >
                <Plus className="h-3.5 w-3.5 mr-2 group-hover:scale-125 transition-transform" />
                Nuova Task
              </Button>
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function KanbanCard({ task }: { task: TaskSO }) {
  const { timer, selectTask } = useStudio();
  const isTimerActive = timer.active_session?.task_id === task.id;

  return (
    <div 
      className={`bg-[#0f172a]/60 border border-[#1e293b]/50 p-4 rounded-2xl shadow-xl hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden ${
        isTimerActive ? 'border-primary shadow-[0_0_20px_rgba(124,58,237,0.1)]' : ''
      }`}
      onClick={() => selectTask(task.id)}
    >
      {isTimerActive && (
        <div className="absolute top-0 left-0 w-full h-[2px] bg-primary animate-pulse" />
      )}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start gap-2">
          <Badge variant="outline" className="text-[8px] font-black uppercase bg-primary/5 border-primary/20 text-primary px-1.5 h-3.5 tracking-tighter">
            PROGETTO
          </Badge>
          <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1 text-[#1e293b] hover:text-[#475569]">
            <MoreVertical className="h-3 w-3" />
          </Button>
        </div>
        
        <h4 className={`text-sm font-bold leading-tight line-clamp-2 ${isTimerActive ? 'text-white' : 'text-[#f1f5f9]'}`}>
          {task.title}
        </h4>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5 bg-[#1e293b]/30 px-2 py-0.5 rounded-lg border border-white/5">
            <Clock className={`h-3 w-3 ${isTimerActive ? 'text-primary animate-pulse' : 'text-[#334155]'}`} />
            <span className={`text-[10px] font-black tabular-nums ${isTimerActive ? 'text-primary' : 'text-[#475569]'}`}>
              {Math.floor(timer.getElapsed(task.id) / 1000 / 60)}m
            </span>
          </div>

          <div className="flex -space-x-2">
            <div className="h-6 w-6 rounded-full border border-[#0f172a] bg-[#1e293b] flex items-center justify-center text-[8px] font-bold text-white uppercase overflow-hidden ring-2 ring-[#0f172a]">
              <UserIcon className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
