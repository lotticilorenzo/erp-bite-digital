import React, { useState } from "react";
import { 
  Plus, 
  Clock, 
  User as UserIcon
} from "lucide-react";
import { useStudio } from "@/hooks/useStudio";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_STATES } from "@/types/studio";
import type { TaskSO } from "@/types/studio";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

export function StudioKanbanView() {
  const { nav, openNewTask } = useStudio();
  const { data } = useTasks();
  const { updateTask } = useTaskMutations();
  const [activeTask, setActiveTask] = useState<TaskSO | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const columns = DEFAULT_STATES.map(state => ({
    ...state,
    tasks: tasks.filter(t => {
      const s = t.state_id?.toLowerCase();
      if (state.id === 'todo') return s === 'to do' || s === 'open' || s === 'todo' || s === 'da_fare';
      if (state.id === 'in-progress') return s === 'in progress' || s === 'process' || s === 'in-progress' || s === 'in_corso';
      if (state.id === 'done') return s === 'complete' || s === 'closed' || s === 'done' || s === 'completato';
      return false;
    })
  }));

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (over && active.id !== over.id) {
      const taskId = active.id as string;
      const newStateId = over.id as string;
      
      // Map frontend column IDs to backend state IDs if necessary
      const backendState = newStateId === 'todo' ? 'DA_FARE' : 
                          newStateId === 'in-progress' ? 'IN_CORSO' : 
                          'COMPLETATO';

      try {
        await updateTask.mutateAsync({ id: taskId, data: { stato: backendState } });
        toast.success(`Task spostata in ${newStateId}`);
      } catch (err) {
        toast.error("Errore durante lo spostamento");
      }
    }
  };

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="flex-1 w-full bg-background/50">
        <div className="flex gap-6 p-6 h-[calc(100vh-140px)] min-w-max">
          {columns.map((column) => (
            <DroppableColumn key={column.id} column={column} openNewTask={() => openNewTask(nav.selectedFolderId, nav.selectedListId)} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeTask ? (
          <div className="w-80 opacity-90 scale-105 rotate-2 shadow-2xl">
            <KanbanCard task={activeTask} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumn({ column, openNewTask }: { column: any; openNewTask: () => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`w-80 flex flex-col gap-4 rounded-2xl transition-colors ${
        isOver ? 'bg-primary/5 ring-2 ring-primary/20 ring-inset' : ''
      }`}
    >
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full shadow-[0_0_10px_hsl(var(--primary)/0.2)]" style={{ backgroundColor: column.color }} />
          <h3 className="text-xs font-black uppercase tracking-widest text-white">{column.name}</h3>
          <Badge variant="outline" className="text-[10px] bg-white/5 border-border text-[#475569] px-1.5 h-4 min-w-4 justify-center">
            {column.tasks.length}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={openNewTask} className="h-6 w-6 text-[#1e293b] hover:text-[#475569]">
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 space-y-3 p-1 overflow-y-auto custom-scrollbar">
        {column.tasks.map((task: TaskSO) => (
          <DraggableCard key={task.id} task={task} />
        ))}
        <Button 
          variant="ghost" 
          className="w-full justify-start h-10 px-4 text-[10px] font-black uppercase tracking-widest text-[#1e293b] hover:text-primary hover:bg-white/5 group border border-dashed border-border/50 rounded-xl"
          onClick={openNewTask}
        >
          <Plus className="h-3.5 w-3.5 mr-2 group-hover:scale-125 transition-transform" />
          Nuova Task
        </Button>
      </div>
    </div>
  );
}

function DraggableCard({ task }: { task: TaskSO }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <KanbanCard task={task} />
    </div>
  );
}

function KanbanCard({ task, isOverlay = false }: { task: TaskSO; isOverlay?: boolean }) {
  const { timer, selectTask } = useStudio();
  const isTimerActive = timer.active_session?.task_id === task.id;

  const completedSubtasks = task.subtasks?.filter(st => st.stateId === 'done' || st.stateId === 'COMPLETATO').length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <div 
      className={`bg-card/60 border border-border/50 p-4 rounded-2xl shadow-xl hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden ${
        isTimerActive ? 'border-primary shadow-[0_0_20px_hsl(var(--primary)/0.2)]' : ''
      } ${isOverlay ? 'cursor-grabbing' : ''}`}
      onClick={() => selectTask(task.id)}
    >
      {isTimerActive && (
        <div className="absolute top-0 left-0 w-full h-[2px] bg-primary animate-pulse" />
      )}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start gap-2">
          <Badge variant="outline" className="text-[8px] font-black uppercase bg-primary/5 border-primary/20 text-primary px-1.5 h-3.5 tracking-tighter">
            {task.progetto_id ? 'PROGETTO' : 'TASK'}
          </Badge>
          {totalSubtasks > 0 && (
            <Badge variant="outline" className="text-[8px] font-black uppercase bg-white/5 border-border text-[#475569] px-1.5 h-3.5">
              {completedSubtasks}/{totalSubtasks} SUB
            </Badge>
          )}
        </div>
        
        <h4 className={`text-sm font-bold leading-tight line-clamp-2 ${isTimerActive ? 'text-white' : 'text-foreground'}`}>
          {task.title}
        </h4>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-lg border border-white/5">
            <Clock className={`h-3 w-3 ${isTimerActive ? 'text-primary animate-pulse' : 'text-[#334155]'}`} />
            <span className={`text-[10px] font-black tabular-nums ${isTimerActive ? 'text-primary' : 'text-[#475569]'}`}>
              {Math.floor(timer.getElapsed(task.id) / 1000 / 60)}m
            </span>
          </div>

          <div className="flex -space-x-2">
            <div className="h-6 w-6 rounded-full border border-[#0f172a] bg-muted flex items-center justify-center text-[8px] font-bold text-white uppercase overflow-hidden ring-2 ring-[#0f172a]">
              <UserIcon className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
