import { useMemo, useState, useEffect } from "react";
import {
  Play,
  CheckCircle2,
  PanelRightClose,
  Save,
  StopCircle,
  Calendar,
  User as UserIcon,
  Plus,
  Clock,
  BookCheck,
  History,
  Flag,
} from "lucide-react";
import { useStudio } from "@/hooks/useStudio";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import { useTimerSessions, useSaveTimerToTimesheet } from "@/hooks/useTimer";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { TaskCommentSection } from "@/components/studio/TaskCommentSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import type { User } from "@/types";
import type { TimerSessionSO } from "@/types/studio";
import { PRIORITIES } from "@/types/studio";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function TaskDetailView({ taskId, onClose }: { taskId: string; onClose?: () => void }) {
  const { timer, activeTabId, closeTab } = useStudio();
  const handleClose = onClose ?? (() => closeTab(activeTabId!));
  const { user } = useAuth();
  const isAdmin = (user as any)?.ruolo === "ADMIN";
  const queryClient = useQueryClient();
  const { data: tasks } = useTasks({ parent_only: false });
  const { data: utenti } = useUsers();
  const { updateTask, createTask } = useTaskMutations();
  const { data: sessions = [] } = useTimerSessions(taskId);
  const saveToTimesheet = useSaveTimerToTimesheet();

  const task = useMemo(() => tasks?.find(t => t.id === taskId) || null, [tasks, taskId]);

  const [formData, setFormData] = useState({
    titolo: "",
    descrizione: "",
    commessa_id: "none",
    stato: "DA_FARE",
    data_inizio: "",
    data_scadenza: "",
    assegnatario_id: "none",
    stima_minuti: 0,
    priorita: "media",
  });

  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  // ───────────────────────────────────────────────────────────

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
        priorita: task.priorita || "media",
      });
    }
  }, [task]);

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
        <p className="text-sm font-black uppercase tracking-widest italic">Caricamento Task...</p>
      </div>
    );
  }

  const isTimerActive = timer.active_session?.task_id === task.id;

  // Total tracked time: saved sessions + current live elapsed
  const savedMinutes = sessions.reduce((acc, s) => acc + (s.durata_minuti ?? 0), 0);
  const liveMs = timer.getElapsed(task.id);
  const totalMs = savedMinutes * 60 * 1000 + liveMs;

  // Sessions not yet saved to timesheet
  const unsavedSessions = sessions.filter(s => !s.salvato_timesheet);

  const handleSave = async () => {
    try {
      const cleanPayload = {
        ...formData,
        commessa_id: formData.commessa_id === "none" ? null : formData.commessa_id,
        assegnatario_id: formData.assegnatario_id === "none" ? null : formData.assegnatario_id,
        data_inizio: formData.data_inizio || null,
        data_scadenza: formData.data_scadenza || null,
        stima_minuti: formData.stima_minuti || null,
        priorita: formData.priorita || "media",
      };
      await updateTask.mutateAsync({ id: task.id, data: cleanPayload });
      toast.success("Task aggiornata");
    } catch {
      toast.error("Errore durante il salvataggio");
    }
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        titolo: newSubtaskTitle.trim(),
        parent_id: task.id,
        progetto_id: task.progetto_id,
        commessa_id: task.commessa_id,
        stato: "DA_FARE",
      });
      setNewSubtaskTitle("");
      setIsAddingSubtask(false);
      toast.success("Subtask creata");
    } catch {
      toast.error("Errore nella creazione della subtask");
    }
  };

  const toggleSelectSession = (id: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllUnsaved = () => {
    setSelectedSessions(new Set(unsavedSessions.map(s => s.id)));
  };

  const handleSaveToTimesheet = async () => {
    const ids = selectedSessions.size > 0
      ? Array.from(selectedSessions)
      : unsavedSessions.map(s => s.id);
    if (ids.length === 0) {
      toast.error("Nessuna sessione da salvare");
      return;
    }
    await saveToTimesheet.mutateAsync({
      session_ids: ids,
      commessa_id: formData.commessa_id !== "none" ? formData.commessa_id : undefined,
    });
    setSelectedSessions(new Set());
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border/50 bg-card/20 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
            TASK {task.id.split("-")[0]}
          </Badge>
          <div className="h-4 w-[1px] bg-border/50" />
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isTimerActive ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-slate-600"}`} />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              {isTimerActive ? "In Registrazione" : "In Pausa"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={updateTask.isPending}
            className="h-8 px-4 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[9px] gap-2 shadow-lg shadow-primary/20"
          >
            <Save className="h-3 w-3" />
            Salva
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 text-muted-foreground hover:text-white"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col border-r border-border/30 overflow-hidden">
          <ScrollArea className="flex-1 px-12 py-10">
            <div className="max-w-3xl mx-auto space-y-10">
              {/* Title / Description */}
              <div className="space-y-4">
                <input
                  autoFocus
                  placeholder="Titolo dell'attività..."
                  className="text-4xl font-black text-white bg-transparent border-none outline-none w-full placeholder:text-slate-800 tracking-tighter"
                  value={formData.titolo}
                  onChange={e => setFormData(p => ({ ...p, titolo: e.target.value }))}
                />
                <textarea
                  placeholder="Aggiungi una descrizione dettagliata..."
                  className="w-full bg-transparent border-none outline-none text-base text-muted-foreground font-medium leading-relaxed resize-none min-h-[150px] placeholder:text-slate-800/50"
                  value={formData.descrizione}
                  onChange={e => setFormData(p => ({ ...p, descrizione: e.target.value }))}
                />
              </div>

              {/* Checklist */}
              <div className="space-y-5 pt-6 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Checklist
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    {task.subtasks?.filter((s: any) => s.stateId === "COMPLETATO" || s.stateId === "done").length ?? 0}
                    {" / "}
                    {task.subtasks?.length ?? 0} Completati
                  </span>
                </div>

                <div className="space-y-2">
                  {task.subtasks?.map((sub: any) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.03] border border-transparent hover:border-white/5 transition-all group"
                    >
                      <div className={`h-5 w-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                        sub.stateId === "COMPLETATO" || sub.stateId === "done"
                          ? "bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                          : "border-border group-hover:border-primary/50"
                      }`}>
                        {(sub.stateId === "COMPLETATO" || sub.stateId === "done") && (
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <span className={`text-sm font-bold flex-1 transition-all ${
                        sub.stateId === "COMPLETATO" || sub.stateId === "done"
                          ? "text-muted-foreground line-through opacity-50"
                          : "text-white/80 group-hover:text-white"
                      }`}>
                        {sub.title}
                      </span>
                    </div>
                  ))}

                  {isAddingSubtask ? (
                    <form
                      onSubmit={handleCreateSubtask}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-primary/20"
                    >
                      <div className="h-5 w-5 rounded-lg border-2 border-primary/30 shrink-0" />
                      <input
                        autoFocus
                        className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-slate-700"
                        placeholder="Nuovo elemento... (Invio per confermare)"
                        value={newSubtaskTitle}
                        onChange={e => setNewSubtaskTitle(e.target.value)}
                        onBlur={() => !newSubtaskTitle && setIsAddingSubtask(false)}
                      />
                    </form>
                  ) : (
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-11 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-2xl border border-dashed border-border group"
                      onClick={() => setIsAddingSubtask(true)}
                    >
                      <Plus className="h-4 w-4 mr-3 group-hover:scale-110 transition-transform" />
                      Aggiungi Elemento
                    </Button>
                  )}
                </div>
              </div>

              {/* Sessions History */}
              {sessions.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest">
                      <History className="h-4 w-4 text-primary" />
                      Sessioni Timer
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-md">
                        {sessions.length}
                      </span>
                    </div>

                    {unsavedSessions.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={selectAllUnsaved}
                          className="text-[10px] text-muted-foreground hover:text-white underline transition-colors"
                        >
                          Seleziona tutte
                        </button>
                        <Button
                          size="sm"
                          disabled={saveToTimesheet.isPending}
                          onClick={handleSaveToTimesheet}
                          className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[9px] gap-1.5"
                        >
                          <BookCheck className="h-3 w-3" />
                          Salva Timesheet
                          {selectedSessions.size > 0 && ` (${selectedSessions.size})`}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {sessions.map((s: TimerSessionSO) => {
                      const isSel = selectedSessions.has(s.id);
                      const dur = s.durata_minuti ? formatMinutes(s.durata_minuti) : "In corso...";
                      const startedAt = s.started_at ? format(new Date(s.started_at), "dd/MM HH:mm", { locale: it }) : "—";

                      return (
                        <div
                          key={s.id}
                          onClick={() => !s.salvato_timesheet && toggleSelectSession(s.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            s.salvato_timesheet
                              ? "border-emerald-500/20 bg-emerald-500/5 cursor-default"
                              : isSel
                                ? "border-primary/40 bg-primary/10 cursor-pointer"
                                : "border-border/30 hover:border-border/60 cursor-pointer hover:bg-white/[0.02]"
                          }`}
                        >
                          {!s.salvato_timesheet ? (
                            <div className={`h-4 w-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              isSel ? "bg-primary border-primary" : "border-border"
                            }`}>
                              {isSel && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                            </div>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-mono font-bold text-white/80">{startedAt}</span>
                              <span className="text-xs font-mono font-black text-primary">{dur}</span>
                            </div>
                            {s.note && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.note}</p>
                            )}
                          </div>

                          {s.salvato_timesheet && (
                            <Badge className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1.5 h-4 flex-shrink-0">
                              Timesheet
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Comments Section ── */}
              <div className="pt-6 border-t border-border/30">
                <TaskCommentSection taskId={taskId} />
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-card/10 backdrop-blur-sm shrink-0 p-8 space-y-8 overflow-y-auto">
          {/* Timer */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Tracciamento
              </span>
              {isTimerActive && (
                <Badge className="bg-red-500/20 text-red-400 border-none text-[8px] h-4 animate-pulse">LIVE</Badge>
              )}
            </div>

            <div className="bg-gradient-to-br from-card to-card/50 border border-white/5 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-1000" />

              <div className="flex flex-col gap-4 relative z-10">
                {/* Live clock */}
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Tempo Totale</span>
                  <div className="text-4xl font-black text-white tabular-nums tracking-tighter leading-none">
                    {formatMs(totalMs)}
                  </div>
                  {task.stima_minuti && task.stima_minuti > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-muted-foreground">Utilizzo budget</span>
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {formatMinutes(savedMinutes)} / {formatMinutes(task.stima_minuti)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            savedMinutes > task.stima_minuti ? "bg-red-500" : "bg-primary"
                          }`}
                          style={{ width: `${Math.min((savedMinutes / task.stima_minuti) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  className={`h-12 w-full rounded-2xl font-black uppercase tracking-widest text-[10px] gap-3 shadow-xl transition-all duration-300 ${
                    isTimerActive
                      ? "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                      : "bg-primary hover:bg-primary/90 shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                  }`}
                  onClick={() =>
                    isTimerActive && timer.active_session
                      ? timer.stop(timer.active_session.id)
                      : timer.start(task.id)
                  }
                >
                  {isTimerActive ? (
                    <><StopCircle className="h-4 w-4 fill-white animate-pulse" />Ferma Timer</>
                  ) : (
                    <><Play className="h-4 w-4 fill-white" />Avvia Sessione</>
                  )}
                </Button>

                {unsavedSessions.length > 0 && (
                  <button
                    onClick={handleSaveToTimesheet}
                    disabled={saveToTimesheet.isPending}
                    className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors py-1"
                  >
                    <BookCheck className="h-3 w-3" />
                    {unsavedSessions.length} sess. da salvare nel timesheet
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Properties */}
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Stato</label>
              <Select value={formData.stato} onValueChange={val => setFormData(p => ({ ...p, stato: val }))}>
                <SelectTrigger className="w-full bg-white/5 border-white/5 hover:bg-white/[0.08] h-11 rounded-xl px-4 text-xs font-black uppercase tracking-widest text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl shadow-2xl p-1">
                  <SelectItem value="DA_FARE">Da Fare</SelectItem>
                  <SelectItem value="IN_CORSO">In Corso</SelectItem>
                  <SelectItem value="REVISIONE">Revisione</SelectItem>
                  <SelectItem value="COMPLETATO">Completato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1 flex items-center gap-2">
                <Flag className="h-3 w-3" />
                Priorità
              </label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setFormData(prev => ({ ...prev, priorita: p.id }))}
                    className={`flex-1 h-9 rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all border ${
                      formData.priorita === p.id
                        ? `${p.bg} ${p.color} border-current/30 scale-[1.03] shadow-lg`
                        : "bg-white/5 text-muted-foreground/40 border-white/5 hover:bg-white/10"
                    }`}
                  >
                    <Flag className="h-2.5 w-2.5 fill-current" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1 flex items-center gap-2">
                <UserIcon className="h-3 w-3" />
                Assegnato a
              </label>
              <Select value={formData.assegnatario_id} onValueChange={val => setFormData(p => ({ ...p, assegnatario_id: val }))}>
                <SelectTrigger className="w-full bg-white/5 border-white/5 hover:bg-white/[0.08] h-11 rounded-xl px-4 text-xs font-bold text-white">
                  <SelectValue placeholder="Senz'assegnatario" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl shadow-2xl p-1">
                  <SelectItem value="none" className="opacity-50 italic">Senz'assegnatario</SelectItem>
                  {utenti?.map((u: User) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                Timeline
              </label>
              <div className="space-y-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter ml-1">Inizio</span>
                  <input
                    type="date"
                    className="w-full bg-white/5 border-none h-10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-primary/30"
                    value={formData.data_inizio}
                    onChange={e => setFormData(p => ({ ...p, data_inizio: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter ml-1">Scadenza</span>
                  <input
                    type="date"
                    className="w-full bg-white/5 border-none h-10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-primary/30"
                    value={formData.data_scadenza}
                    onChange={e => setFormData(p => ({ ...p, data_scadenza: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1 flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Budget Tempo
              </label>
              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                <input
                  type="number"
                  min={0}
                  className="w-full bg-transparent border-none text-xl font-black text-primary outline-none text-center"
                  value={formData.stima_minuti}
                  onChange={e => setFormData(p => ({ ...p, stima_minuti: parseInt(e.target.value) || 0 }))}
                />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest pr-2">min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
