import React from "react";
import { 
  Plus, 
  Clock, 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  Play, 
  Pause, 
  CheckCircle2, 
  Trash2, 
  MoreHorizontal,
  ChevronRight,
  MessageSquare,
  Link as LinkIcon,
  Paperclip
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { useStudio } from "@/hooks/useStudio";
import { useTasks } from "@/hooks/useTasks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function StudioTaskModal() {
  const { nav, selectTask, timer } = useStudio();
  const { data } = useTasks();
  const [newTitle, setNewTitle] = React.useState("");

  const task = React.useMemo(() => {
    if (nav.selectedTaskId === "new") return {
      id: "new",
      title: "",
      desc: "",
      state_id: "to do",
      subtasks: [],
      assignees: []
    } as any;
    return data?.tasks.find(t => t.id === nav.selectedTaskId) || null;
  }, [data?.tasks, nav.selectedTaskId]);

  if (!nav.selectedTaskId) return null;

  const isNew = nav.selectedTaskId === "new";
  const isTimerActive = !isNew && timer.active_task_id === task?.id;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={!!nav.selectedTaskId} onOpenChange={() => selectTask(null)}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 bg-[#020617] border-[#1e293b] shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="px-8 py-6 border-b border-[#1e293b]/50 bg-[#0f172a]/40 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
              {isNew ? 'NUOVA TASK' : 'DETTAGLIO TASK'}
            </Badge>
            {!isNew && <span className="text-[10px] font-black text-[#475569] uppercase tracking-widest">ID: {task?.id}</span>}
          </div>
          <div className="flex items-center gap-2">
            {isNew ? (
              <Button onClick={() => selectTask(null)} className="h-9 px-6 bg-primary text-white font-black uppercase tracking-widest text-[10px]">
                Salva Attività
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#475569] hover:text-white">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 border-r border-[#1e293b]/30 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 px-8 py-8">
              <div className="space-y-8">
                <div className="space-y-4">
                  {isNew ? (
                    <input 
                      autoFocus
                      placeholder="Titolo dell'attività..."
                      className="text-3xl font-black text-white bg-transparent border-none outline-none w-full placeholder:text-[#1e293b] tracking-tighter"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  ) : (
                    <DialogTitle className="text-3xl font-black text-white leading-tight tracking-tighter">
                      {task?.title}
                    </DialogTitle>
                  )}
                  <textarea 
                    placeholder={isNew ? "Aggiungi una descrizione..." : "Nessuna descrizione per questa attività."}
                    className="w-full bg-transparent border-none outline-none text-sm text-[#94a3b8] font-medium leading-relaxed resize-none min-h-[100px]"
                    defaultValue={task?.desc}
                  />
                </div>

                {!isNew && (
                  <>
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest italic">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Checklist / Subtasks
                      </div>
                      <div className="space-y-2">
                        {task?.subtasks?.map((sub: any) => (
                          <div key={sub.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer border border-transparent hover:border-[#1e293b]/50">
                            <div className="h-5 w-5 rounded-md border-2 border-[#1e293b] group-hover:border-primary/50 transition-colors" />
                            <span className="text-sm font-bold text-[#94a3b8] group-hover:text-white transition-colors">
                              {sub.title || sub.name}
                            </span>
                          </div>
                        ))}
                        <Button variant="ghost" className="w-full justify-start h-10 px-3 text-[10px] font-black uppercase tracking-widest text-[#475569] hover:text-primary hover:bg-transparent group">
                          <Plus className="h-4 w-4 mr-2" />
                          Aggiungi Subtask
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest italic">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Commenti
                      </div>
                      <div className="bg-[#0f172a]/50 rounded-2xl p-4 border border-[#1e293b]/50 text-center py-12">
                         <p className="text-xs text-[#475569] font-bold uppercase tracking-widest">Nessun commento</p>
                         <Button variant="link" className="text-[10px] text-primary font-black uppercase tracking-widest mt-2 h-auto p-0">Sii il primo a commentare</Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {!isNew && (
              <div className="p-4 bg-[#0f172a]/80 backdrop-blur-md border-t border-[#1e293b]/50 shrink-0">
                <div className="relative group">
                  <input 
                    placeholder="Scrivi un commento..." 
                    className="w-full h-12 bg-[#020617] border-[#1e293b] rounded-xl px-4 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#475569] hover:text-[#94a3b8]"><Paperclip className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#475569] hover:text-[#94a3b8]"><LinkIcon className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-80 bg-[#0f172a]/20 shrink-0 p-6 space-y-8 overflow-y-auto">
            <div className="space-y-6">
              <div className="space-y-4">
                 <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Stato</span>
                 <Button variant="outline" className="w-full justify-between bg-[#1e293b]/30 border-[#1e293b] hover:bg-[#1e293b]/50 h-10 rounded-xl px-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
                      <span className="text-xs font-black uppercase tracking-widest text-[#f1f5f9]">{task?.state_id}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#475569]" />
                 </Button>
              </div>

              {!isNew && (
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Live Timer</span>
                  <div className="bg-[#1e293b]/20 border border-primary/20 p-4 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-[2px] h-full bg-primary opacity-50" />
                      <div className="flex flex-col gap-3">
                        <div className="text-2xl font-black text-white tabular-nums tracking-tighter">
                            {formatTime(timer.getElapsed(task?.id || ''))}
                        </div>
                        <div className="flex gap-2">
                            <Button 
                              className={`flex-1 rounded-xl font-black uppercase tracking-widest text-[10px] gap-2 h-9 shadow-lg transition-all ${
                                isTimerActive ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : "bg-primary hover:bg-primary/90 shadow-primary/20"
                              }`}
                              onClick={() => isTimerActive ? timer.pause(task!.id) : timer.start(task!.id)}
                            >
                              {isTimerActive ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                              {isTimerActive ? "Pausa" : "Avvia"}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-[#1e293b] text-[#475569] hover:text-white">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                      </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                 <span className="text-[10px] font-black text-[#475569] uppercase tracking-[0.2em]">Proprietà</span>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2 text-[#475569]">
                         <UserIcon className="h-3.5 w-3.5" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Assegnatario</span>
                       </div>
                       <Avatar className="h-6 w-6 border border-[#1e293b]">
                          <AvatarFallback className="bg-primary/20 text-primary text-[8px] font-black">LL</AvatarFallback>
                       </Avatar>
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2 text-[#475569]">
                         <CalendarIcon className="h-3.5 w-3.5" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Scadenza</span>
                       </div>
                       <span className="text-[10px] font-black text-white uppercase tracking-widest">No Date</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2 text-[#475569]">
                         <Clock className="h-3.5 w-3.5" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Stima</span>
                       </div>
                       <span className="text-[10px] font-black text-white uppercase tracking-widest">0h</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
