import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Play,
  CheckCircle2,
  Trash2,
  Save,
  Briefcase,
  History,
  StopCircle,
  AlertCircle,
  Clock3,
  X,
  Check,
  ChevronsUpDown,
  Tag,
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudio } from "@/hooks/useStudio";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import { useCommesse } from "@/hooks/useCommesse";
import { useTimerSessions, useSaveTimerToTimesheet } from "@/hooks/useTimer";
import { useUsers } from "@/hooks/useUsers";
import { useTimeEstimate, useUserCapacity, type TimeEstimate, type UserCapacity } from "@/hooks/useML";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User } from "@/types";
import { TASK_STATUSES, isTaskDone, TASK_DONE_STATUS } from "@/lib/taskStatus";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

type StudioTaskRecord = NonNullable<ReturnType<typeof useTasks>["data"]>[number];

type TaskFormData = {
  titolo: string;
  descrizione: string;
  commessa_id: string;
  stato: string;
  data_inizio: string;
  data_scadenza: string;
  assegnatario_id: string;
  assegnatari: string[];
  tags: string[];
  stima_minuti: number | null;
};

function createEmptyTaskFormData(): TaskFormData {
  return {
    titolo: "",
    descrizione: "",
    commessa_id: "none",
    stato: "DA_FARE",
    data_inizio: "",
    data_scadenza: "",
    assegnatario_id: "none",
    assegnatari: [],
    tags: [],
    stima_minuti: null,
  };
}

function createTaskFormData(task: StudioTaskRecord | null): TaskFormData {
  if (!task) {
    return createEmptyTaskFormData();
  }
  const assegnatari = task.assegnatari?.map((a: { id: string; nome: string }) => a.id) ||
    (task.assegnatario_id ? [task.assegnatario_id] : []);
  return {
    titolo: task.title,
    descrizione: task.desc || "",
    commessa_id: task.commessa_id || "none",
    stato: task.state_id,
    data_inizio: task.data_inizio || "",
    data_scadenza: task.due_date || "",
    assegnatario_id: task.assegnatario_id || "none",
    assegnatari,
    tags: task.tags || [],
    stima_minuti: task.stima_minuti ?? null,
  };
}

export function StudioTaskModal() {
  const { nav, selectTask, timer } = useStudio();
  const { data: tasks } = useTasks({ parent_only: false });
  const { data: commesse } = useCommesse();
  const { data: utenti } = useUsers();
  const { createTask, updateTask, deleteTask } = useTaskMutations();

  const isNew = nav.selectedTaskId === "new";

  const task = useMemo(() => {
    if (isNew || !nav.selectedTaskId) return null;
    return tasks?.find(t => t.id === nav.selectedTaskId) || null;
  }, [tasks, nav.selectedTaskId, isNew]);

  const { data: sessions = [] } = useTimerSessions(task?.id || null);
  const saveToTimesheetMutation = useSaveTimerToTimesheet();

  const formSourceId = task?.id ?? `new:${nav.selectedListId ?? "none"}`;
  const baseFormData = useMemo(() => createTaskFormData(task), [task]);
  const [formDraft, setFormDraft] = useState<{ sourceId: string; data: TaskFormData } | null>(null);
  const formData = formDraft?.sourceId === formSourceId ? formDraft.data : baseFormData;
  const setFormData = (updater: TaskFormData | ((current: TaskFormData) => TaskFormData)) => {
    setFormDraft((current) => {
      const currentData = current?.sourceId === formSourceId ? current.data : baseFormData;
      return {
        sourceId: formSourceId,
        data: typeof updater === "function"
          ? (updater as (current: TaskFormData) => TaskFormData)(currentData)
          : updater,
      };
    });
  };

  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [assegnatariOpen, setAssegnatariOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");

  // Il modale è montato in modo permanente nel layout: senza questo reset il draft
  // sopravvive alla chiusura e, riaprendo con lo stesso formSourceId (es. "Nuovo task"
  // nello stesso progetto), il form ricomparirebbe precompilato col contenuto precedente.
  useEffect(() => {
    if (!nav.selectedTaskId) {
      setFormDraft(null);
      setIsAddingSubtask(false);
      setNewSubtaskTitle("");
      setTagInput("");
      setAssegnatariOpen(false);
    }
  }, [nav.selectedTaskId]);

  const [debouncedTitolo, setDebouncedTitolo] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTitolo(formData.titolo);
    }, 500);
    return () => clearTimeout(handler);
  }, [formData.titolo]);

  const { data: estimate } = useTimeEstimate(
    formData.assegnatario_id !== "none" ? formData.assegnatario_id : null,
    debouncedTitolo
  ) as { data: TimeEstimate | undefined };

  const { data: capacity } = useUserCapacity(
    formData.assegnatario_id !== "none" ? formData.assegnatario_id : null
  ) as { data: UserCapacity | undefined };
  const effectiveStimaMinuti =
    formData.stima_minuti ?? (isNew ? estimate?.stima_minuti ?? null : null);
  const lastActiveSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (timer.active_session && timer.active_session.task_id === task?.id) {
      lastActiveSessionIdRef.current = timer.active_session.id;
    } else if (!timer.active_session && lastActiveSessionIdRef.current && task) {
      // Timer appena stoppato! Mostriamo il toast per il salvataggio
      const sessionIdToSave = lastActiveSessionIdRef.current;
      toast("Sessione terminata", {
        description: "Vuoi salvare il tempo nel timesheet?",
        action: {
          label: "SÌ, SALVA",
          onClick: () => {
            saveToTimesheetMutation.mutate({ 
              session_ids: [sessionIdToSave], 
              commessa_id: task.commessa_id === "none" ? undefined : task.commessa_id 
            });
          }
        },
        duration: 10000,
      });
      lastActiveSessionIdRef.current = null;
    }
  }, [timer.active_session, task, saveToTimesheetMutation]);

  if (!nav.selectedTaskId) return null;

  const isTimerActive = !isNew && task && timer.active_session?.task_id === task.id;

  const handleSave = async () => {
    if (formData.data_inizio && formData.data_scadenza) {
      if (new Date(formData.data_scadenza) < new Date(formData.data_inizio)) {
        return toast.error("La data di scadenza non può essere antecedente alla data di inizio");
      }
    }

    const primaryAssegnatario = formData.assegnatari[0] ?? null;
    const payload = {
      ...formData,
      commessa_id: formData.commessa_id === "none" ? null : formData.commessa_id,
      assegnatario_id: primaryAssegnatario,
      assegnatari: formData.assegnatari.length > 0 ? formData.assegnatari : undefined,
      tags: formData.tags,
      progetto_id: nav.selectedListId,
    };

    const cleanPayload = {
      ...payload,
      data_inizio: payload.data_inizio || null,
      data_scadenza: payload.data_scadenza || null,
      stima_minuti: effectiveStimaMinuti,
      commessa_id: payload.commessa_id || null,
    };

    try {
      if (isNew) {
        await createTask.mutateAsync(cleanPayload);
        toast.success("Task creata con successo");
      } else {
        await updateTask.mutateAsync({ id: task!.id, data: cleanPayload });
        toast.success("Task aggiornata");
      }
      selectTask(null);
    } catch (err) {
      toast.error("Errore durante il salvataggio");
    }
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !task) return;

    try {
      await createTask.mutateAsync({
        titolo: newSubtaskTitle.trim(),
        parent_id: task.id,
        progetto_id: task.progetto_id,
        commessa_id: task.commessa_id,
        stato: "DA_FARE"
      });
      setNewSubtaskTitle("");
      setIsAddingSubtask(false);
      toast.success("Subtask creata");
    } catch (err) {
      toast.error("Errore nella creazione della subtask");
    }
  };

  const handleToggleSubtask = async (sub: any) => {
    const newStatus = isTaskDone(sub.stateId) ? "DA_FARE" : TASK_DONE_STATUS;
    try {
      await updateTask.mutateAsync({ id: sub.id, data: { stato: newStatus } });
    } catch (err) {
      toast.error("Errore nell'aggiornamento della subtask");
    }
  };

  const handleDeleteSubtask = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler eliminare questa subtask?")) return;
    try {
      await deleteTask.mutateAsync(id);
      toast.success("Subtask eliminata");
    } catch (err) {
      toast.error("Errore nell'eliminazione della subtask");
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Sei sicuro di voler eliminare questa task?")) {
      try {
        await deleteTask.mutateAsync(task!.id);
        toast.success("Task eliminata");
        selectTask(null);
      } catch (err) {
        toast.error("Errore durante l'eliminazione");
      }
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={!!nav.selectedTaskId} onOpenChange={() => selectTask(null)}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 bg-background border-border shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="px-8 py-6 border-b border-border/50 bg-card/40 flex flex-row items-center justify-between shrink-0">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                {isNew ? 'NUOVA TASK' : 'DETTAGLIO TASK'}
              </Badge>
              {!isNew && <span className="text-[10px] font-black text-[#475569] uppercase tracking-widest">ID: {task?.id.split('-')[0]}</span>}
            </div>
            <DialogTitle className="sr-only">{isNew ? 'Nuova Task' : `Dettaglio Task ${task?.title}`}</DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleSave} 
              disabled={createTask.isPending || updateTask.isPending}
              className="h-9 px-6 bg-primary text-white font-black uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
            >
              {(createTask.isPending || updateTask.isPending) ? (
                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isNew ? (createTask.isPending ? 'Creazione...' : 'Crea Task') : (updateTask.isPending ? 'Salvataggio...' : 'Salva Modifiche')}
            </Button>
            {!isNew && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleDelete}
                className="h-9 w-9 text-red-500/50 hover:text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 border-r border-border/30 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 px-8 py-8">
              <div className="space-y-8">
                <div className="space-y-4">
                  <input 
                    autoFocus
                    placeholder="Titolo dell'attività..."
                    className="text-3xl font-black text-white bg-transparent border-none outline-none w-full placeholder:text-[#1e293b] tracking-tighter"
                    value={formData.titolo}
                    onChange={(e) => setFormData(prev => ({ ...prev, titolo: e.target.value }))}
                  />
                  {estimate?.confidenza && estimate.confidenza !== "NESSUNA" && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                        Stima basata sullo storico: ~{estimate.stima_minuti} min
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-[8px] font-black h-4 px-1.5 border-none ${
                          estimate.confidenza === "ALTA" ? "bg-emerald-500/10 text-emerald-500" :
                          estimate.confidenza === "MEDIA" ? "bg-yellow-500/10 text-yellow-500" :
                          "bg-orange-500/10 text-orange-500"
                        }`}
                      >
                        {estimate.confidenza} CONFIDENZA
                      </Badge>
                    </div>
                  )}
                  <textarea 
                    placeholder="Aggiungi una descrizione..."
                    className="w-full bg-transparent border-none outline-none text-sm text-muted-foreground font-medium leading-relaxed resize-none min-h-[150px]"
                    value={formData.descrizione}
                    onChange={(e) => setFormData(prev => ({ ...prev, descrizione: e.target.value }))}
                  />
                </div>

                {!isNew && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest italic">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Checklist / Subtasks
                    </div>
                    <div className="space-y-2">
                      {task?.subtasks?.map((sub: any) => (
                        <div key={sub.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-card/5 transition-colors group border border-transparent hover:border-border/50">
                          <button 
                            onClick={() => handleToggleSubtask(sub)}
                            className={`h-5 w-5 rounded-md border-2 border-border transition-colors flex items-center justify-center ${
                              isTaskDone(sub.stateId) ? "bg-emerald-500 border-emerald-500" : "group-hover:border-primary/50"
                            }`}
                          >
                            {isTaskDone(sub.stateId) && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                          </button>
                          <span className={`text-sm font-bold transition-colors flex-1 ${
                            isTaskDone(sub.stateId) ? "text-muted-foreground line-through decoration-emerald-500/50" : "text-muted-foreground group-hover:text-white"
                          }`}>
                            {sub.title}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteSubtask(sub.id)}
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      
                      {isAddingSubtask ? (
                        <form onSubmit={handleCreateSubtask} className="flex items-center gap-3 p-3 rounded-xl bg-card/5 border border-primary/20">
                           <div className="h-5 w-5 rounded-md border-2 border-primary/50 shrink-0" />
                           <input 
                             autoFocus
                             className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-foreground"
                             placeholder="Titolo subtask... (Invio per salvare)"
                             value={newSubtaskTitle}
                             onChange={(e) => setNewSubtaskTitle(e.target.value)}
                             onBlur={() => !newSubtaskTitle && setIsAddingSubtask(false)}
                           />
                        </form>
                      ) : (
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start h-10 px-3 text-[10px] font-black uppercase tracking-widest text-[#475569] hover:text-primary hover:bg-transparent group"
                          onClick={() => setIsAddingSubtask(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Aggiungi Subtask
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {!isNew && sessions.length > 0 && (
                   <div className="space-y-6">
                    <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest italic">
                      <History className="h-4 w-4 text-emerald-500" />
                      Cronologia Sessioni
                    </div>
                    <div className="space-y-2">
                       {sessions.map((session) => (
                         <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-card/5 border border-white/10">
                            <div className="flex flex-col">
                               <span className="text-xs font-bold text-white">
                                 {format(new Date(session.started_at), "dd MMM yyyy HH:mm")}
                               </span>
                               <span className="text-[10px] text-muted-foreground uppercase font-black">
                                 {session.note || "Nessuna nota"}
                               </span>
                            </div>
                            <div className="flex items-center gap-3">
                               <span className="text-xs font-black text-emerald-400 tabular-nums">
                                 {session.durata_minuti || 0} min
                               </span>
                               {session.salvato_timesheet ? (
                                 <Badge className="bg-emerald-500/20 text-emerald-500 border-none text-[8px] h-4">SAVED</Badge>
                               ) : (
                                 <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 px-2 text-[8px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                                  onClick={() => saveToTimesheetMutation.mutate({ session_ids: [session.id], commessa_id: task?.commessa_id })}
                                 >
                                   Salva Timesheet
                                 </Button>
                               )}
                            </div>
                         </div>
                       ))}
                    </div>
                   </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="w-80 bg-card/20 shrink-0 p-6 space-y-8 overflow-y-auto">
            <div className="space-y-6">
              <div className="space-y-2">
                 <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Stato</span>
                 <Select 
                   value={formData.stato} 
                   onValueChange={(val) => setFormData(prev => ({ ...prev, stato: val }))}
                 >
                   <SelectTrigger className="w-full bg-muted/30 border-border hover:bg-muted/50 h-10 rounded-xl px-4 text-xs font-black uppercase tracking-widest">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent className="bg-card border-border text-white">
                      {TASK_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label.toUpperCase()}</SelectItem>
                      ))}
                   </SelectContent>
                 </Select>
              </div>

              <div className="space-y-2">
                 <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Commessa ERP</span>
                 <Select 
                   value={formData.commessa_id} 
                   onValueChange={(val) => setFormData(prev => ({ ...prev, commessa_id: val }))}
                 >
                   <SelectTrigger className="w-full bg-muted/30 border-border hover:bg-muted/50 h-10 rounded-xl px-4 text-xs font-bold truncate">
                     <Briefcase className="h-3.5 w-3.5 mr-2 text-primary" />
                     <SelectValue placeholder="Collega a Commessa" />
                   </SelectTrigger>
                   <SelectContent className="bg-card border-border text-white">
                      <SelectItem value="none">Nessuna Commessa</SelectItem>
                      {commesse?.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.cliente?.ragione_sociale} - {new Date(c.mese_competenza).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}
                        </SelectItem>
                      ))}
                   </SelectContent>
                 </Select>
              </div>

              {!isNew && (
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Live Timer</span>
                  <div className="bg-muted/20 border border-primary/20 p-5 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-[2px] h-full bg-primary opacity-50" />
                      <div className="flex flex-col gap-4">
                        <div>
                          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">Tempo Totale (Acc.)</span>
                          <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
                              {task ? formatTime((task.tempo_trascorso_minuti || 0) * 60 * 1000 + timer.getElapsed(task.id)) : "00:00:00"}
                          </div>
                        </div>

                        {task?.stima_minuti && task.stima_minuti > 0 && (
                          <div className="space-y-2">
                             <div className="flex justify-between items-end">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">Progresso Stima</span>
                                <span className="text-[9px] font-black text-white italic">
                                  {Math.round(((task.tempo_trascorso_minuti || 0) + (timer.getElapsed(task.id) / 60000)))} / {task.stima_minuti} min
                                </span>
                             </div>
                             <div className="h-1.5 w-full bg-card/5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${
                                    ((task.tempo_trascorso_minuti || 0) + (timer.getElapsed(task.id) / 60000)) > task.stima_minuti 
                                    ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" 
                                    : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                  }`}
                                  style={{ width: `${Math.min(100, (((task.tempo_trascorso_minuti || 0) + (timer.getElapsed(task.id) / 60000)) / task.stima_minuti) * 100)}%` }}
                                />
                             </div>
                             <p className="text-[9px] font-medium text-muted-foreground italic">
                               {((task.tempo_trascorso_minuti || 0) + (timer.getElapsed(task.id) / 60000)) > task.stima_minuti 
                                 ? `Sopra stima di ${Math.round(((task.tempo_trascorso_minuti || 0) + (timer.getElapsed(task.id) / 60000)) - task.stima_minuti)} min`
                                 : `Rimanenti ~${Math.round(task.stima_minuti - ((task.tempo_trascorso_minuti || 0) + (timer.getElapsed(task.id) / 60000)))} min`
                               }
                             </p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <Button 
                              className={`flex-1 rounded-xl font-black uppercase tracking-widest text-[10px] gap-2 h-10 shadow-lg transition-all ${
                                isTimerActive ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : "bg-primary hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
                              }`}
                              onClick={() => (isTimerActive && timer.active_session) ? timer.stop(timer.active_session.id) : (task && timer.start(task.id))}
                            >
                              {isTimerActive ? <StopCircle className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                              {isTimerActive ? "Ferma" : "Avvia Timer"}
                            </Button>
                        </div>
                      </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Eseguito da</span>
                <Popover open={assegnatariOpen} onOpenChange={setAssegnatariOpen}>
                  <PopoverTrigger asChild>
                    <button className="w-full flex items-center justify-between bg-muted/30 border border-border hover:bg-muted/50 h-10 rounded-xl px-4 text-xs font-bold text-left transition-colors">
                      <span className={cn("truncate", formData.assegnatari.length === 0 && "text-muted-foreground")}>
                        {formData.assegnatari.length === 0
                          ? "Seleziona assegnatari"
                          : formData.assegnatari
                              .map(id => utenti?.find((u: User) => u.id === id))
                              .filter((u): u is User => !!u)
                              .map(u => u.nome)
                              .join(", ")}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0 bg-card border-border shadow-2xl" align="end">
                    <Command>
                      <CommandInput placeholder="Cerca..." className="text-xs h-9" />
                      <CommandList>
                        <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">Nessun utente trovato</CommandEmpty>
                        <CommandGroup>
                          {utenti?.map((u: User) => {
                            const selected = formData.assegnatari.includes(u.id);
                            return (
                              <CommandItem
                                key={u.id}
                                value={`${u.nome} ${u.cognome}`}
                                onSelect={() => {
                                  const next = selected
                                    ? formData.assegnatari.filter(id => id !== u.id)
                                    : [...formData.assegnatari, u.id];
                                  setFormData(prev => ({ ...prev, assegnatari: next, assegnatario_id: next[0] ?? "none" }));
                                }}
                                className="text-xs cursor-pointer"
                              >
                                <Check className={cn("h-3 w-3 mr-2 shrink-0", selected ? "opacity-100 text-primary" : "opacity-0")} />
                                {u.nome} {u.cognome}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {formData.assegnatari.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.assegnatari.map(id => {
                      const u = utenti?.find((u: User) => u.id === id);
                      if (!u) return null;
                      const initials = `${u.nome[0] ?? ""}${u.cognome?.[0] ?? ""}`.toUpperCase();
                      return (
                        <span key={id} className="flex items-center gap-1 text-[10px] font-bold bg-primary/10 border border-primary/20 text-primary rounded-lg px-2 py-0.5">
                          <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-black">{initials}</span>
                          {u.nome}
                          <button onClick={() => setFormData(prev => ({ ...prev, assegnatari: prev.assegnatari.filter(a => a !== id), assegnatario_id: prev.assegnatari.filter(a => a !== id)[0] ?? "none" }))}>
                            <X className="h-2.5 w-2.5 ml-0.5 opacity-60 hover:opacity-100" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {capacity && (
                  <div className={`p-3 rounded-xl border ${
                    (capacity as any).percentuale_carico >= 100 ? "bg-red-500/10 border-red-500/30" :
                    (capacity as any).percentuale_carico > 90 ? "bg-yellow-500/10 border-yellow-500/30" :
                    "bg-emerald-500/10 border-emerald-500/30"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {(capacity as any).percentuale_carico >= 100 ? <AlertCircle className="h-3 w-3 text-red-500" /> : <Clock3 className="h-3 w-3 text-emerald-500" />}
                      <span className={`text-[10px] font-black uppercase ${
                        (capacity as any).percentuale_carico >= 100 ? "text-red-500" : "text-emerald-500"
                      }`}>
                        {(capacity as any).percentuale_carico >= 100 ? "Capacità Massima" : "Disponibilità Team"}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground leading-tight">
                      {(capacity as any).ore_gia_assegnate}h assegnate oggi su {(capacity as any).ore_disponibili_oggi}h totali.
                      {(capacity as any).percentuale_carico >= 100 ? " Carico massimo raggiunto." : ` Rimangono ${(capacity as any).ore_rimanenti}h.`}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Tag
                </span>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 text-[10px] font-bold bg-muted/10 border border-border/20 text-muted-foreground rounded-lg px-2 py-0.5">
                        {tag}
                        <button onClick={() => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}>
                          <X className="h-2.5 w-2.5 ml-0.5 opacity-60 hover:opacity-100" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  className="w-full bg-muted/30 border border-border h-9 rounded-xl px-3 text-xs text-white placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                  placeholder="Aggiungi tag... (Invio)"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = tagInput.trim().toLowerCase();
                      if (t && !formData.tags.includes(t)) {
                        setFormData(prev => ({ ...prev, tags: [...prev.tags, t] }));
                      }
                      setTagInput("");
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Inizio</span>
                   <input 
                    type="date"
                    className="w-full bg-muted/30 border border-border h-10 rounded-xl px-4 text-xs font-black text-white"
                    value={formData.data_inizio}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_inizio: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                   <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Scadenza</span>
                   <input 
                    type="date"
                    className="w-full bg-muted/30 border border-border h-10 rounded-xl px-4 text-xs font-black text-white"
                    value={formData.data_scadenza}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_scadenza: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                 <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Stima Ore</span>
                 <div className="flex items-center gap-3">
                    <input 
                      type="number"
                      className="w-24 bg-muted/30 border border-border h-10 rounded-xl px-4 text-xs font-black text-white"
                      value={effectiveStimaMinuti ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          stima_minuti: e.target.value === "" ? null : parseInt(e.target.value, 10) || 0,
                        }))
                      }
                    />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">minuti</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
