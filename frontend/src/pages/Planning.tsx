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
  isSameDay,
  addMonths,
  subMonths,
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
import { useAssenze } from '@/hooks/useAssenze';
import { AssenzeTeamPanel } from '@/components/assenze/AssenzePanel';
import { GanttChart } from '@/components/gantt/GanttChart';
import { useTasks, useTaskMutations } from '@/hooks/useTasks';
import { useUsers } from '@/hooks/useUsers';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskPlanningDialog } from '@/components/planning/TaskPlanningDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PageTransition } from '@/components/common/PageTransition';

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
  const [view, setView] = useState<'week' | 'month' | 'gantt'>('week');
  const [backlogSearch, setBacklogSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const { updateTask } = useTaskMutations();
  
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

  const { data: ganttTasks = [] } = useTasks();
  const { data: ganttUsers = [] } = useUsers();

  // Calculate costs for assigned tasks
  const { data: costs = {} } = useQuery({
    queryKey: ['tasks-costs', tasks.filter(t => t.assegnatario_id).map(t => t.id)],
    queryFn: async () => {
      const assigned = tasks.filter(t => t.assegnatario_id);
      const results: Record<string, any> = {};
      
      // Fetch costs in parallel (simple version)
      await Promise.all(assigned.map(async (t) => {
        try {
          const res = await api.get(`/planning/estimate-cost?task_id=${t.id}&user_id=${t.assegnatario_id}`);
          results[t.id] = res.data;
        } catch (e) {
          console.error("Cost fetch error", e);
        }
      }));
      return results;
    },
    enabled: tasks.length > 0
  });

  const { assenze = [] } = useAssenze();

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
  
  // Backlog Filtering
  const backlogTasks = tasks.filter(t => 
    !t.assegnatario_id && 
    (t.titolo.toLowerCase().includes(backlogSearch.toLowerCase()))
  );

  // Risorse Filtering
  const filteredRisorse = risorse.filter(r => 
    roleFilter === 'ALL' || r.ruolo === roleFilter
  );

  const roles = Array.from(new Set(risorse.map(r => r.ruolo).filter(Boolean)));

  // Smart Allocation Logic
  const handleAutoAllocation = async () => {
    const unassigned = tasks.filter(t => !t.assegnatario_id);
    if (unassigned.length === 0) {
      toast.info("Nessuna task nel backlog da assegnare.");
      return;
    }

    try {
      let count = 0;
      for (const task of unassigned) {
        // Find best resource (least loaded this week)
        const candidates = filteredRisorse.map(r => ({
          ...r,
          ...getUserWeeklyLoad(r.id)
        })).sort((a, b) => (a.load - a.capacity) - (b.load - b.capacity));

        const best = candidates[0];
        if (best && best.load < best.capacity + 8) { // Only if not severely overloaded
          await assignMutation.mutateAsync({
            taskId: task.id,
            userId: best.id,
            date: format(monday, 'yyyy-MM-dd') // Assign to Monday by default
          });
          count++;
        }
      }
      toast.success(`Assegnate automaticamente ${count} task.`);
    } catch (error) {
      toast.error("Errore durante l'assegnazione automatica.");
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
    
    // Get working days in the week (Mon-Fri)
    const workingDays = Array.from({ length: 5 }).map((_, i) => addDays(startDate, i));
    
    // Total hours available = daily capacity * (5 - days absent)
    const dailyHours = risorsaMap[userId]?.ore_settimanali / 5 || 8;
    const absentDaysCount = workingDays.filter(day => 
      assenze.some((a: any) => 
        a.user_id === userId && 
        isSameDay(new Date(a.data_inizio), day)
      )
    ).length;
    
    const availableHours = risorsaMap[userId]?.ore_settimanali - (absentDaysCount * dailyHours);

    const weeklyTasks = tasks.filter(t => 
      t.assegnatario_id === userId && 
      t.data_scadenza && 
      new Date(t.data_scadenza) >= startDate && 
      new Date(t.data_scadenza) <= endDate
    );
    const totalMinutes = weeklyTasks.reduce((sum, t) => sum + (t.stima_minuti || 0), 0);
    return { 
      load: Math.round(totalMinutes / 60), 
      capacity: Math.max(0, Math.round(availableHours))
    };
  };

  const risorsaMap = Object.fromEntries(risorse.map(r => [r.id, r]));

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

  const planningGanttTasks = ganttTasks.filter((task) => task.data_inizio && task.due_date);

  const handleOpenGanttTask = (taskId: string) => {
    const task =
      tasks.find((item) => item.id === taskId) ||
      planningGanttTasks.find((item) => item.id === taskId);
    if (!task) return;
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleGanttDateChange = async (taskId: string, newStart: string, newEnd: string) => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        data: {
          data_inizio: newStart,
          data_scadenza: newEnd,
        },
      });
      toast.success("Date task aggiornate dal Gantt");
    } catch {
      toast.error("Errore durante l'aggiornamento delle date");
    }
  };

  return (
    <PageTransition>
      <div className="p-8 space-y-8 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <header className="flex flex-col gap-1 px-1">
          <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic underline decoration-primary/30 decoration-8 underline-offset-[12px] mb-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Execution Hub
          </h1>
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mt-2">
            Gestione carichi di lavoro, allocazione dinamica e analisi team.
          </p>
        </header>

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
            <Button 
              variant={view === 'gantt' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setView('gantt')}
              className="text-[10px] font-black uppercase tracking-widest h-8"
            >
              Gantt
            </Button>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleAutoAllocation}
            disabled={assignMutation.isPending}
            className="hidden md:flex items-center gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-black uppercase italic tracking-widest text-[10px] h-9 px-4 rounded-xl shadow-lg active:scale-95 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5 fill-primary mr-1" />
            Bilancia Carico
          </Button>

          <div className="flex items-center gap-3 bg-card p-1 rounded-xl border border-border">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setCurrentDate(view === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1))}
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
              onClick={() => setCurrentDate(view === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1))}
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
                      <div className="p-4 border-r border-border bg-background/50 flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#475569]">Membro Team</span>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                          <SelectTrigger className="h-6 bg-transparent border-none p-0 text-[9px] font-black uppercase text-primary focus:ring-0">
                            <SelectValue placeholder="Tutti" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-white">
                            <SelectItem value="ALL">Tutti i ruoli</SelectItem>
                            {roles.map(role => (
                              <SelectItem key={role} value={role || ""}>{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                      {filteredRisorse.map(risorsa => (
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
                                <span className={getUserWeeklyLoad(risorsa.id).load > getUserWeeklyLoad(risorsa.id).capacity ? 'text-destructive' : 'text-primary'}>
                                  {getUserWeeklyLoad(risorsa.id).load}h / {getUserWeeklyLoad(risorsa.id).capacity}h
                                </span>
                              </div>
                              <Progress 
                                value={getUserWeeklyLoad(risorsa.id).capacity > 0 ? Math.min((getUserWeeklyLoad(risorsa.id).load / getUserWeeklyLoad(risorsa.id).capacity) * 100, 100) : 100} 
                                className={`h-1 bg-muted ${getUserWeeklyLoad(risorsa.id).load > getUserWeeklyLoad(risorsa.id).capacity ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
                              />
                            </div>
                          </div>

                          {/* Day Cells */}
                          {weekDays.map(day => {
                            const cellId = `cell|${format(day, 'yyyy-MM-dd')}|${risorsa.id}`;
                            const cellTasks = getTasksForCell(risorsa.id, day);
                            const isAbsent = assenze.some((a: any) => 
                              a.user_id === risorsa.id && 
                              isSameDay(new Date(a.data_inizio), day)
                            );
                            const absenceInfo = assenze.find((a: any) => 
                              a.user_id === risorsa.id && 
                              isSameDay(new Date(a.data_inizio), day)
                            );

                            return (
                              <CalendarCell 
                                key={cellId} 
                                id={cellId} 
                                tasks={cellTasks} 
                                isAbsent={isAbsent}
                                absenceType={absenceInfo?.tipo}
                                getProjectColor={getProjectColor}
                                costs={costs}
                                onEditTask={(task) => {
                                  setSelectedTask(task);
                                  setIsTaskDialogOpen(true);
                                }}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ) : view === 'month' ? (
              /* Month Forecast View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {filteredRisorse.map(risorsa => (
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
                          const weekData = getUserWeeklyLoad(risorsa.id, weekStart);
                          const percentage = Math.round((weekData.load / risorsa.ore_settimanali) * 100);
                          
                          return (
                            <div key={weekOffset} className="space-y-2">
                              <div className="flex justify-between text-xs items-center">
                                <span className="font-bold text-slate-400 capitalize">
                                  Settimana {format(weekStart, 'dd MMM', { locale: it })}: {weekData.load}h
                                </span>
                                <span className={`font-black ${percentage > 100 ? 'text-destructive animate-pulse' : percentage > 80 ? 'text-amber-400' : 'text-primary'}`}>
                                  {weekData.load}h ({percentage}%)
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

                    {getUserWeeklyLoad(risorsa.id, monday).load / risorsa.ore_settimanali > 1.1 && (
                      <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                        <p className="text-[10px] font-bold text-destructive uppercase tracking-wide">
                          Attenzione: Elevato sovraccarico rilevato.
                        </p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="bg-card/50 border-border backdrop-blur-xl shadow-2xl">
                  <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-white">
                        Timeline Team
                      </h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        Vista aggregata per risorsa con assenze sovrapposte e drag orizzontale sulle date.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 font-black text-primary">
                        {planningGanttTasks.length} task con date
                      </Badge>
                      <Badge variant="outline" className="border-border/60 bg-background/40 font-black text-muted-foreground">
                        {assenze.filter((item: any) => item.stato !== 'RIFIUTATA').length} assenze visibili
                      </Badge>
                    </div>
                  </div>
                </Card>

                <GanttChart
                  tasks={planningGanttTasks}
                  users={ganttUsers}
                  assenze={assenze}
                  groupBy="assignee"
                  period="month"
                  anchorDate={currentDate}
                  onTaskClick={handleOpenGanttTask}
                  onTaskDateChange={handleGanttDateChange}
                />
              </div>
            )}
          </div>

          {/* Sidebar: Unassigned Tasks */}
          <div className="lg:col-span-3">
            <Card className="bg-card/50 border-border backdrop-blur-xl shadow-2xl h-[calc(100vh-160px)] flex flex-col sticky top-6">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 p-1 rounded bg-primary/20 hover:bg-primary/30"
                    onClick={() => {
                      setSelectedTask(null);
                      setIsTaskDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  </Button>
                  Backlog
                </h3>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black">
                  {backlogTasks.length}
                </Badge>
              </div>
              
              <div className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input 
                    placeholder="Filtra per titolo o progetto..." 
                    value={backlogSearch}
                    onChange={(e) => setBacklogSearch(e.target.value)}
                    className="pl-9 h-9 bg-background/50 border-border text-xs focus-visible:ring-primary/30"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1 px-3 pb-4">
                <div className="space-y-3 pt-1">
                  {backlogTasks.map(task => (
                    <DraggableTask 
                      key={task.id} 
                      task={task} 
                      onEdit={() => {
                        setSelectedTask(task);
                        setIsTaskDialogOpen(true);
                      }}
                    />
                  ))}
                  {backlogTasks.length === 0 && (
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

        <TaskPlanningDialog
          open={isTaskDialogOpen}
          onOpenChange={setIsTaskDialogOpen}
          task={selectedTask}
        />

      <div className="mt-6">
        <AssenzeTeamPanel compact />
      </div>
      </div>
    </PageTransition>
  );
};

// --- Sub-components ---

const CalendarCell: React.FC<{ 
  id: string; 
  tasks: Task[]; 
  isAbsent?: boolean;
  absenceType?: string;
  getProjectColor: (id?: string) => string;
  costs?: Record<string, any>;
  onEditTask: (task: Task) => void;
}> = ({ id, tasks, isAbsent, absenceType, getProjectColor, costs, onEditTask }) => {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: isAbsent });

  return (
    <div 
      ref={setNodeRef}
      className={`
        p-2 min-h-[140px] transition-all duration-300 border-r border-b border-border/20
        ${isOver ? 'bg-primary/10 shadow-[inset_0_0_20px_hsl(var(--primary)/0.2)]' : 'hover:bg-white/[0.01]'}
        ${isAbsent ? 'bg-[#ef4444]/5 border-dashed border-[#ef4444]/20' : ''}
      `}
    >
      {isAbsent ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 opacity-60">
           <div className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded text-[9px] font-black text-rose-500 uppercase tracking-widest">
             {absenceType || 'ASSENTE'}
           </div>
           <p className="text-[8px] text-rose-500/50 font-bold uppercase tracking-tighter text-center">Nessuna capacità disponibile</p>
        </div>
      ) : (
        <div className="space-y-2">
           {tasks.map(task => (
            <DraggableTask 
              key={task.id} 
              task={task} 
              isMini 
              getProjectColor={getProjectColor} 
              onEdit={() => onEditTask(task)}
              cost={costs?.[task.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DraggableTask: React.FC<{ 
  task: Task; 
  isMini?: boolean; 
  getProjectColor?: (id?: string) => string;
  onEdit?: () => void;
  cost?: any;
}> = ({ task, isMini, getProjectColor, onEdit, cost }) => {
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
          <div className="flex-1 min-w-0" onClick={onEdit}>
            <p className={`${isMini ? 'text-[10px]' : 'text-xs'} font-black text-white leading-tight uppercase tracking-wide group-hover:text-primary transition-colors line-clamp-3 cursor-pointer`}>
              {task.titolo}
            </p>
          </div>
          {(task.stima_minuti || cost) && (
             <div className="flex flex-col items-end gap-1">
               {task.stima_minuti && (
                 <Badge variant="outline" className={`h-4 text-[8px] font-black bg-primary/10 border-primary/20 text-primary py-0 px-1.5 uppercase ${isMini ? 'scale-75 origin-right' : ''}`}>
                   {Math.round(task.stima_minuti / 60)}h
                 </Badge>
               )}
               {cost && (
                 <Badge variant="outline" className={`h-4 text-[8px] font-black bg-emerald-500/10 border-emerald-500/20 text-emerald-500 py-0 px-1.5 uppercase ${isMini ? 'scale-75 origin-right' : ''}`}>
                   €{Number(cost.estimated_cost).toFixed(0)}
                 </Badge>
               )}
             </div>
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
