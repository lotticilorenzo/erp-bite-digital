import { useMemo, useState, useEffect } from "react";
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
  Clock3
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
import type { TaskSO, SubtaskSO } from "@/types/studio";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";

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

  const [formData, setFormData] = useState({
    titolo: "",
    descrizione: "",
    commessa_id: "none",
    stato: "DA_FARE",
    data_inizio: "",
    data_scadenza: "",
    assegnatario_id: "none",
    stima_minuti: 0,
  });

  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

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

  useEffect(() => {
    // @ts-ignore - estimate logic
    if (estimate?.stima_minuti && isNew && formData.stima_minuti === 0) {
      // @ts-ignore
      setFormData(prev => ({ ...prev, stima_minuti: estimate.stima_minuti }));
    }
  }, [estimate, isNew]);

  useEffect(() => {
    if (task) {
      setFormData({
        titolo: task.title,
        descrizione: task.desc || "",
        commessa_id: task.commessa_id || "none",
        stato: task.state_id,
        data_inizio: task.data_inizio || "",
        data_scadenza: task.due_date || "",
        assegnatario_id: task.assegnatario_id || "none",
        stima_minuti: task.stima_minuti || 0,
      });
    } else {
      setFormData({
        titolo: "",
        descrizione: "",
        commessa_id: "none",
        stato: "DA_FARE",
        data_inizio: "",
        data_scadenza: "",
        assegnatario_id: "none",
        stima_minuti: 0,
      });
    }
  }, [task, nav.selectedTaskId]);

  if (!nav.selectedTaskId) return null;

  const isTimerActive = !isNew && task && timer.active_session?.task_id === task.id;

  const handleSave = async () => {
    if (!formData.titolo) return toast.error("Il titolo è obbligatorio");

    const payload = {
      ...formData,
      commessa_id: formData.commessa_id === "none" ? null : formData.commessa_id,
      assegnatario_id: formData.assegnatario_id === "none" ? null : formData.assegnatario_id,
      progetto_id: nav.selectedListId,
    };

    try {
      if (isNew) {
        await createTask.mutateAsync(payload);
        toast.success("Task creata con successo");
      } else {
        await updateTask.mutateAsync({ id: task!.id, data: payload });
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
    const newStatus = (sub.stateId === "COMPLETATO" || sub.stateId === "done") ? "DA_FARE" : "COMPLETATO";
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
              className="h-9 px-6 bg-primary text-white font-black uppercase tracking-widest text-[10px] gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              {isNew ? 'Crea Task' : 'Salva Modifiche'}
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
                  {estimate && (estimate as any).confidenza !== "NESSUNA" && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        Stima basata sullo storico: ~{(estimate as any).stima_minuti} min
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-[8px] font-black h-4 px-1.5 border-none ${
                          (estimate as any).confidenza === "ALTA" ? "bg-emerald-500/10 text-emerald-500" :
                          (estimate as any).confidenza === "MEDIA" ? "bg-yellow-500/10 text-yellow-500" :
                          "bg-orange-500/10 text-orange-500"
                        }`}
                      >
                        {(estimate as any).confidenza} CONFIDENZA
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
                        <div key={sub.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group border border-transparent hover:border-border/50">
                          <button 
                            onClick={() => handleToggleSubtask(sub)}
                            className={`h-5 w-5 rounded-md border-2 border-border transition-colors flex items-center justify-center ${
                              (sub.stateId === "COMPLETATO" || sub.stateId === "done") ? "bg-emerald-500 border-emerald-500" : "group-hover:border-primary/50"
                            }`}
                          >
                            {(sub.stateId === "COMPLETATO" || sub.stateId === "done") && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                          </button>
                          <span className={`text-sm font-bold transition-colors flex-1 ${
                            (sub.stateId === "COMPLETATO" || sub.stateId === "done") ? "text-muted-foreground line-through decoration-emerald-500/50" : "text-muted-foreground group-hover:text-white"
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
                        <form onSubmit={handleCreateSubtask} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-primary/20">
                           <div className="h-5 w-5 rounded-md border-2 border-primary/50 shrink-0" />
                           <input 
                             autoFocus
                             className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-slate-600"
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
                         <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
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
                      <SelectItem value="DA_FARE">DA FARE</SelectItem>
                      <SelectItem value="IN_CORSO">IN CORSO</SelectItem>
                      <SelectItem value="REVISIONE">REVISIONE</SelectItem>
                      <SelectItem value="COMPLETATO">COMPLETATO</SelectItem>
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
                  <div className="bg-muted/20 border border-primary/20 p-4 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-[2px] h-full bg-primary opacity-50" />
                      <div className="flex flex-col gap-3">
                        <div className="text-2xl font-black text-white tabular-nums tracking-tighter">
                            {task ? formatTime(timer.getElapsed(task.id)) : "00:00:00"}
                        </div>
                        <div className="flex gap-2">
                            <Button 
                              className={`flex-1 rounded-xl font-black uppercase tracking-widest text-[10px] gap-2 h-9 shadow-lg transition-all ${
                                isTimerActive ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : "bg-primary hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
                              }`}
                              onClick={() => (isTimerActive && timer.active_session) ? timer.stop(timer.active_session.id) : (task && timer.start(task.id))}
                            >
                              {isTimerActive ? <StopCircle className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                              {isTimerActive ? "Ferma" : "Avvia"}
                            </Button>
                        </div>
                      </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                 <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Eseguito da</span>
                 <Select 
                   value={formData.assegnatario_id} 
                   onValueChange={(val) => setFormData(prev => ({ ...prev, assegnatario_id: val }))}
                 >
                   <SelectTrigger className="w-full bg-muted/30 border-border hover:bg-muted/50 h-12 rounded-xl px-4 lowercase first-letter:uppercase">
                     <SelectValue placeholder="Seleziona assegnatario" />
                   </SelectTrigger>
                   <SelectContent className="bg-card border-border text-white">
                      <SelectItem value="none">Nessun assegnatario</SelectItem>
                      {utenti?.map((u: User) => (
                        <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                      ))}
                   </SelectContent>
                 </Select>

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
                      value={formData.stima_minuti}
                      onChange={(e) => setFormData(prev => ({ ...prev, stima_minuti: parseInt(e.target.value) || 0 }))}
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
