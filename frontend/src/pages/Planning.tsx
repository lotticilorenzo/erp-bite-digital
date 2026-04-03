import React, { useState } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  defaultDropAnimationSideEffects,
  useDroppable,
  useDraggable
} from '@dnd-kit/core';
import { 
  sortableKeyboardCoordinates, 
} from '@dnd-kit/sortable';
import { 
  format, 
  addDays, 
  startOfWeek, 
  addWeeks, 
  subWeeks, 
  isSameDay 
} from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Users,
  AlertCircle,
  Search,
  Plus
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

// Types
interface Risorsa {
  id: string;
  user_id: string;
  nome: string;
  cognome: string;
  ruolo?: string;
  ore_settimanali: number;
}

interface Task {
  id: string;
  titolo: string;
  assegnatario_id: string | null;
  data_scadenza: string | null;
  stima_minuti: number | null;
  progetto_id?: string;
  stato: string;
}

const PlanningPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'week' | 'month'>('week');
  
  // Sensors for DND
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Queries
  const { data: risorse = [] } = useQuery<Risorsa[]>({
    queryKey: ['risorse'],
    queryFn: async () => {
      const res = await api.get('/risorse');
      return res.data;
    }
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['planning-tasks'],
    queryFn: async () => {
      const res = await api.get('/planning/tasks');
      return res.data;
    }
  });

  // Start of current week (Monday)
  const monday = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }).map((_, i) => addDays(monday, i));

  // Assignment Mutation
  const assignMutation = useMutation({
    mutationFn: async ({ taskId, userId, date }: { taskId: string, userId: string, date: string }) => {
      return api.post(`/planning/assign?task_id=${taskId}&user_id=${userId}&due_date=${date}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-tasks'] });
    }
  });

  // Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const [overType, overValue, overUserId] = (over.id as string).split('|');
    const taskId = active.id as string;

    if (overType === 'cell') {
      assignMutation.mutate({
        taskId,
        userId: overUserId,
        date: overValue // format: YYYY-MM-DD
      });
    }
  };

  // Helper to get tasks for a specific user and day
  const getTasksForCell = (userId: string, date: Date) => {
    return tasks.filter(t => 
      t.assegnatario_id === userId && 
      t.data_scadenza && 
      isSameDay(new Date(t.data_scadenza), date)
    );
  };

  // Calculate weekly load for a user
  const getUserWeeklyLoad = (userId: string, startDate: Date = monday) => {
    const endDate = addDays(startDate, 4);
    const weeklyTasks = tasks.filter(t => 
      t.assegnatario_id === userId && 
      t.data_scadenza && 
      new Date(t.data_scadenza) >= startDate && 
      new Date(t.data_scadenza) <= endDate
    );
    const totalMinutes = weeklyTasks.reduce((sum, t) => sum + (t.stima_minuti || 0), 0);
    return Math.round(totalMinutes / 60);
  };

  // Project color helper
  const getProjectColor = (projectId?: string) => {
    if (!projectId) return 'border-slate-700 bg-slate-800/50';
    const colors = [
      'border-purple-500/50 bg-purple-500/10 text-purple-400',
      'border-blue-500/50 bg-blue-500/10 text-blue-400',
      'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
      'border-amber-500/50 bg-amber-500/10 text-amber-400',
      'border-rose-500/50 bg-rose-500/10 text-rose-400',
      'border-cyan-500/50 bg-cyan-500/10 text-cyan-400',
    ];
    const index = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen text-slate-200">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Planning Risorse
          </h1>
          <p className="text-slate-400 font-medium">Gestione carichi di lavoro e allocazione team</p>
        </div>

        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex bg-card p-1 rounded-lg border border-border">
            <Button 
              variant={view === 'week' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setView('week')}
              className="text-[10px] font-black uppercase tracking-widest h-8"
            >
              Settimana
            </Button>
            <Button 
              variant={view === 'month' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setView('month')}
              className="text-[10px] font-black uppercase tracking-widest h-8"
            >
              Previsione
            </Button>
          </div>

          <div className="flex items-center gap-3 bg-card p-1 rounded-xl border border-border">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
              className="hover:bg-white/5 text-slate-400 h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-4 py-1.5 flex items-center gap-2 font-black text-xs uppercase tracking-widest text-white min-w-[180px] justify-center">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              {view === 'week' ? (
                `${format(monday, 'dd MMM', { locale: it })} - ${format(addDays(monday, 4), 'dd MMM', { locale: it })}`
              ) : (
                format(currentDate, 'MMMM yyyy', { locale: it })
              )}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
              className="hover:bg-white/5 text-slate-400 h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-9 space-y-6">
            {view === 'week' ? (
              <Card className="bg-card/50 border-border backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Calendar Header */}
                    <div className="grid grid-cols-[200px_repeat(5,1fr)] border-b border-border">
                      <div className="p-4 border-r border-border bg-background/50 flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#475569]">Membro Team</span>
                      </div>
                      {weekDays.map(day => (
                        <div key={day.toString()} className="p-4 text-center bg-background/30">
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#475569] mb-1">
                            {format(day, 'EEEE', { locale: it })}
                          </div>
                          <div className={`text-sm font-black ${isSameDay(day, new Date()) ? 'text-primary' : 'text-white'}`}>
                            {format(day, 'dd MMMM', { locale: it })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Calendar Body */}
                    <div className="divide-y divide-[#1e293b]">
                      {risorse.map(risorsa => (
                        <div key={risorsa.id} className="grid grid-cols-[200px_repeat(5,1fr)] group">
                          {/* User Info & Capacity */}
                          <div className="p-4 border-r border-border bg-background/20 flex flex-col justify-between overflow-hidden">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 border border-border">
                                <AvatarFallback className="bg-primary/20 text-[10px] font-black uppercase text-primary">
                                  {risorsa.nome[0]}{risorsa.cognome[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="text-xs font-black text-white truncate">{risorsa.nome} {risorsa.cognome}</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase truncate">{risorsa.ruolo || 'Team Member'}</div>
                              </div>
                            </div>
                            
                            {/* Capacity Bar */}
                            <div className="space-y-1.5 mt-4">
                              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                                <span className="text-[#475569]">Carico sett.</span>
                                <span className={getUserWeeklyLoad(risorsa.id) > risorsa.ore_settimanali ? 'text-destructive' : 'text-primary'}>
                                  {getUserWeeklyLoad(risorsa.id)}h / {risorsa.ore_settimanali}h
                                </span>
                              </div>
                              <Progress 
                                value={Math.min((getUserWeeklyLoad(risorsa.id) / risorsa.ore_settimanali) * 100, 100)} 
                                className={`h-1 bg-muted ${getUserWeeklyLoad(risorsa.id) > risorsa.ore_settimanali ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
                              />
                            </div>
                          </div>

                          {/* Day Cells */}
                          {weekDays.map(day => {
                            const cellId = `cell|${format(day, 'yyyy-MM-dd')}|${risorsa.id}`;
                            const cellTasks = getTasksForCell(risorsa.id, day);
                            return (
                              <CalendarCell 
                                key={cellId} 
                                id={cellId} 
                                tasks={cellTasks} 
                                getProjectColor={getProjectColor}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              /* Month Forecast View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {risorse.map(risorsa => (
                  <Card key={risorsa.id} className="bg-card/50 border-border p-6 space-y-6 backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-primary/20 p-0.5">
                          <AvatarFallback className="bg-primary/10 text-primary font-black uppercase">
                            {risorsa.nome[0]}{risorsa.cognome[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-lg font-black text-white">{risorsa.nome} {risorsa.cognome}</h3>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{risorsa.ruolo || 'Resource'}</p>
                        </div>
                      </div>
                      <Badge className="bg-white/5 border-white/10 text-muted-foreground font-black uppercase text-[10px]">
                        Capacità: {risorsa.ore_settimanali}h/sett
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#475569]">Previsione 4 Settimane</p>
                      <div className="space-y-4">
                        {[0, 1, 2, 3].map(weekOffset => {
                          const weekStart = addWeeks(monday, weekOffset);
                          const load = getUserWeeklyLoad(risorsa.id, weekStart);
                          const percentage = Math.round((load / risorsa.ore_settimanali) * 100);
                          
                          return (
                            <div key={weekOffset} className="space-y-2">
                              <div className="flex justify-between text-xs items-center">
                                <span className="font-bold text-slate-400 capitalize">
                                  Settimana {format(weekStart, 'dd MMM', { locale: it })}
                                </span>
                                <span className={`font-black ${percentage > 100 ? 'text-destructive animate-pulse' : percentage > 80 ? 'text-amber-400' : 'text-primary'}`}>
                                  {load}h ({percentage}%)
                                </span>
                              </div>
                              <Progress 
                                value={Math.min(percentage, 100)} 
                                className={`h-2 bg-background ${percentage > 100 ? '[&>div]:bg-destructive' : percentage > 80 ? '[&>div]:bg-amber-400' : '[&>div]:bg-primary'}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {getUserWeeklyLoad(risorsa.id, monday) > risorsa.ore_settimanali && (
                      <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                        <p className="text-[10px] font-bold text-destructive uppercase tracking-wide">
                          Attenzione: Sovraccarico rilevato nella settimana corrente.
                        </p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: Unassigned Tasks */}
          <div className="lg:col-span-3">
            <Card className="bg-card/50 border-border backdrop-blur-xl shadow-2xl h-[calc(100vh-160px)] flex flex-col sticky top-6">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <div className="p-1 rounded bg-primary/20">
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Backlog
                </h3>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black">
                  {tasks.filter(t => !t.assegnatario_id).length}
                </Badge>
              </div>
              
              <div className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input 
                    placeholder="Filtra per titolo o progetto..." 
                    className="pl-9 h-9 bg-background/50 border-border text-xs focus-visible:ring-primary/30"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1 px-3 pb-4">
                <div className="space-y-3 pt-1">
                  {tasks.filter(t => !t.assegnatario_id).map(task => (
                    <DraggableTask key={task.id} task={task} />
                  ))}
                  {tasks.filter(t => !t.assegnatario_id).length === 0 && (
                    <div className="text-center py-20 opacity-30 space-y-4">
                      <div className="mx-auto h-16 w-16 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                        <Users className="h-8 w-8" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Pianificazione completa</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay adjustScale={true} dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeId ? (
            <div className="w-[180px] p-2.5 bg-muted border border-primary/50 shadow-2xl rounded-xl opacity-90 scale-110 cursor-grabbing ring-4 ring-primary/20 backdrop-blur-md">
              <p className="text-[10px] font-black leading-tight text-white uppercase tracking-wide truncate">
                {tasks.find(t => t.id === activeId)?.titolo}
              </p>
              <div className="h-1 w-8 bg-primary rounded-full mt-2" />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

// --- Sub-components ---

const CalendarCell: React.FC<{ id: string; tasks: Task[]; getProjectColor: (id?: string) => string }> = ({ id, tasks, getProjectColor }) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div 
      ref={setNodeRef}
      className={`
        p-2 min-h-[140px] transition-all duration-300 border-r border-b border-border/20
        ${isOver ? 'bg-primary/10 shadow-[inset_0_0_20px_hsl(var(--primary)/0.2)]' : 'hover:bg-white/[0.01]'}
      `}
    >
      <div className="space-y-2">
        {tasks.map(task => (
          <DraggableTask key={task.id} task={task} isMini getProjectColor={getProjectColor} />
        ))}
      </div>
    </div>
  );
};

const DraggableTask: React.FC<{ task: Task; isMini?: boolean; getProjectColor?: (id?: string) => string }> = ({ task, isMini, getProjectColor }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined;

  const projectColor = getProjectColor ? getProjectColor(task.progetto_id) : 'border-slate-700 bg-slate-800/50';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        relative group cursor-grab active:cursor-grabbing rounded-xl border-l-[3px] transition-all duration-300
        ${isDragging ? 'opacity-20 grayscale' : 'opacity-100'}
        ${isMini 
          ? `p-2 ${projectColor} border-y border-r border-border/50 hover:scale-[1.02] shadow-sm` 
          : `p-4 bg-card/80 border-slate-700 hover:border-primary/50 shadow-lg border-y border-r`
        }
      `}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className={`${isMini ? 'text-[10px]' : 'text-xs'} font-black text-white leading-tight uppercase tracking-wide group-hover:text-primary transition-colors line-clamp-3`}>
            {task.titolo}
          </p>
          {!isMini && task.stima_minuti && (
             <Badge variant="outline" className="h-5 text-[9px] font-black bg-primary/10 border-primary/20 text-primary py-0 px-1.5 uppercase">
               {Math.round(task.stima_minuti / 60)}h
             </Badge>
          )}
        </div>
        
        {isMini && task.stima_minuti && (
          <div className="flex items-center gap-1.5">
             <div className="h-1 w-1 rounded-full bg-primary/50" />
             <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">
               {Math.round(task.stima_minuti / 60)}h
             </span>
          </div>
        )}

        {!isMini && (
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.2)]" />
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.1em] truncate">
              {task.progetto_id ? 'Analisi Project X' : 'Backlog Generale'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanningPage;
