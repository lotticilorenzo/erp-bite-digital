import { useState, useMemo } from "react";
import { 
  Users, 
  Calendar, 
  CheckCircle2, 
  ChevronUp,
  ChevronDown,
  UserPlus,
  Edit2,
  Mail,
  Phone,
  Euro,
  MapPin,
  CreditCard,
  MessageSquare
} from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { useTasks } from "@/hooks/useTasks";
import { useUserCapacity } from "@/hooks/useML";
import { useStudio } from "@/hooks/useStudio";
import { useChat } from "@/hooks/useChat";
import { useProgetti } from "@/hooks/useProgetti";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { format, isBefore, startOfDay, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { User, Progetto } from "@/types";
import type { TaskSO } from "@/types/studio";
import { CollaboratorForm } from "@/components/collaboratori/CollaboratorForm";
import { Button } from "@/components/ui/button";

export function StudioTeamView() {
  const { data: users = [], isLoading: isLoadingUsers } = useUsers(true);
  const { data: progetti = [] } = useProgetti();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isCollaboratorFormOpen, setIsCollaboratorFormOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<User | null>(null);

  if (isLoadingUsers) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs font-black uppercase tracking-widest">Caricamento Team...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center">
          <Users className="h-8 w-8 opacity-20" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-black uppercase tracking-tight text-white">Nessun membro nel team</h3>
          <p className="text-xs">Aggiungi membri dalle impostazioni per iniziare.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full bg-background/50">
      <div className="p-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic">Team Overview</h1>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Monitoring capacità e task odierni</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary py-1 px-3">
                <Users className="h-3 w-3 mr-2" />
                {users.length} MEMBRI ATTIVI
              </Badge>
              <Button 
                onClick={() => {
                  setSelectedCollaborator(null);
                  setIsCollaboratorFormOpen(true);
                }}
                className="font-black uppercase tracking-widest text-[10px] gap-2 h-9 px-4 bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Nuovo Membro
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {users.map((user) => (
              <TeamMemberCard 
                key={user.id} 
                user={user} 
                progetti={progetti}
                isExpanded={expandedUserId === user.id}
                onToggle={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                onEdit={() => {
                  setSelectedCollaborator(user);
                  setIsCollaboratorFormOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      </div>
      
      <CollaboratorForm 
        open={isCollaboratorFormOpen}
        onOpenChange={setIsCollaboratorFormOpen}
        collaborator={selectedCollaborator}
      />
    </ScrollArea>
  );
}

function TeamMemberCard({ 
  user,
  progetti,
  isExpanded, 
  onToggle,
  onEdit
}: { 
  user: User; 
  progetti: Progetto[];
  isExpanded: boolean; 
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { selectTask, setView } = useStudio();
  const { startDirectChat } = useChat();
  const { data: capacity } = useUserCapacity(user.id);
  const { data: allTasks = [] } = useTasks({ assegnatario_id: user.id, parent_only: false });

  // Filter tasks for today
  const todayTasks = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return allTasks.filter(t => {
      if (!t.due_date) return false;
      const isToday = t.due_date === today;
      const isOverdueIncomplete = t.due_date < today && t.state_id !== "COMPLETATO" && t.state_id !== "done";
      return isToday || isOverdueIncomplete;
    });
  }, [allTasks]);

  // Sort tasks: overdue first, then by title
  const sortedTasks = useMemo(() => {
    const now = startOfDay(new Date());
    return [...todayTasks].sort((a, b) => {
      const isAOverdue = a.due_date && isBefore(parseISO(a.due_date), now);
      const isBOverdue = b.due_date && isBefore(parseISO(b.due_date), now);
      
      if (isAOverdue && !isBOverdue) return -1;
      if (!isAOverdue && isBOverdue) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [todayTasks]);

  const capacityPerc = capacity?.percentuale_carico ?? 0;
  
  const getCapacityColor = (perc: number) => {
    if (perc >= 90) return "text-red-500 bg-red-500/20";
    if (perc >= 70) return "text-yellow-500 bg-yellow-500/20";
    return "text-emerald-500 bg-emerald-500/20";
  };

  const getCapacityBarColor = (perc: number) => {
    if (perc >= 90) return "bg-red-500";
    if (perc >= 70) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const overdueCount = sortedTasks.filter(t => {
     const now = startOfDay(new Date());
     return t.due_date && isBefore(parseISO(t.due_date), now);
  }).length;

  return (
    <motion.div 
      layout
      className={`relative group bg-card/40 border border-border/50 rounded-2xl overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 ${
        isExpanded ? "ring-2 ring-primary/20 border-primary/40 bg-card/60" : ""
      }`}
    >
      <div 
        className="p-5 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 rounded-xl border-2 border-border/50 shadow-inner group-hover:border-primary/50 transition-colors">
            <AvatarImage src={user.avatar_url || ""} />
            <AvatarFallback className="bg-muted text-xs font-black uppercase text-muted-foreground">
              {user.nome?.[0]}{user.cognome?.[0]}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-white truncate uppercase tracking-tight leading-none mb-1">
                {user.nome} {user.cognome}
              </h3>
              <Badge variant="outline" className={`text-[9px] font-black h-5 px-2 border-none ${getCapacityColor(capacityPerc)}`}>
                {todayTasks.length} TASK
              </Badge>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate mb-3">
              {user.ruolo || "Team Member"}
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Capacità Giornaliera</span>
                <span className={capacityPerc >= 90 ? "text-red-500" : capacityPerc >= 70 ? "text-yellow-500" : "text-emerald-500"}>
                  {capacity?.ore_gia_assegnate ?? 0}h / {capacity?.ore_disponibili_oggi ?? 8}h
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(capacityPerc, 100)}%` }}
                  className={`h-full ${getCapacityBarColor(capacityPerc)} rounded-full shadow-[0_0_8px_rgba(16,185,129,0.2)]`}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between border-t border-border/10 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="h-7 text-[9px] font-black uppercase tracking-widest text-primary hover:text-white hover:bg-primary/20"
            >
              <Edit2 className="h-3 w-3 mr-1.5" />
              Modifica
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={async (e) => {
                e.stopPropagation();
                const channel = await startDirectChat(user.id);
                if (channel) {
                  setView("chat");
                  // The URL sync will happen in ChatHub OR we can do it here if needed
                  // but ChatHub's effect should handle it if activeChannelId is global.
                }
              }}
              className="h-7 text-[9px] font-black uppercase tracking-widest text-[#10b981] hover:text-white hover:bg-[#10b981]/20"
            >
              <MessageSquare className="h-3 w-3 mr-1.5" />
              Messaggio
            </Button>
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground/30" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="border-t border-border/30 bg-muted/5"
          >
            <div className="p-5 pt-0 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/20">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Task assegnati oggi</span>
                {overdueCount > 0 && (
                   <Badge variant="outline" className="bg-red-500/10 border-red-500/20 text-red-500 text-[8px] font-black px-1.5 h-4">
                      {overdueCount} SCADUTI
                   </Badge>
                )}
              </div>

              {/* Rich Professional Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border/10">
                <div className="space-y-3">
                   <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                      <Mail className="h-3 w-3 text-primary/60" />
                      {user.email || "—"}
                   </div>
                   <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                      <Phone className="h-3 w-3 text-primary/60" />
                      {user.telefono || "—"}
                   </div>
                   <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                      <Euro className="h-3 w-3 text-primary/60" />
                      P.IVA: {user.piva || "—"}
                   </div>
                </div>
                <div className="space-y-3">
                   <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                      <CreditCard className="h-3 w-3 text-primary/60" />
                      IBAN: {user.iban ? `****${user.iban.slice(-4)}` : "—"}
                   </div>
                   <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                      <MapPin className="h-3 w-3 text-primary/60" />
                      <span className="truncate">{user.indirizzo || "—"}</span>
                   </div>
                   {user.codice_fiscale && (
                     <div className="text-[9px] font-black text-primary/40 uppercase tracking-widest">
                       CF: {user.codice_fiscale}
                     </div>
                   )}
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {sortedTasks.length > 0 ? (
                  sortedTasks.map((task) => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      progetto={progetti.find(p => p.id === task.progetto_id)}
                      onClick={() => selectTask(task.id)} 
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase text-white tracking-tight">Nessuna task oggi</p>
                      <p className="text-[10px] text-muted-foreground italic font-medium">Grande lavoro, rilassati o pianifica domani!</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TaskItem({ 
  task, 
  progetto,
  onClick 
}: { 
  task: TaskSO; 
  progetto?: Progetto;
  onClick: () => void 
}) {
  const isOverdue = useMemo(() => {
    if (!task.due_date) return false;
    const now = startOfDay(new Date());
    return isBefore(parseISO(task.due_date), now);
  }, [task.due_date]);

  const statusColor = useMemo(() => {
    switch (task.state_id) {
      case "DA_FARE": return "bg-slate-500";
      case "IN_CORSO": return "bg-primary";
      case "REVISIONE": return "bg-amber-500";
      case "COMPLETATO": return "bg-emerald-500";
      default: return "bg-slate-500";
    }
  }, [task.state_id]);

  return (
    <div 
      className="p-3 bg-card/60 border border-border/40 rounded-xl hover:border-primary/40 hover:bg-card transition-all cursor-pointer group/task"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${statusColor} shadow-[0_0_8px_rgba(255,255,255,0.1)]`} />
        
        <div className="flex-1 min-w-0">
          <h4 className={`text-xs font-bold truncate transition-colors group-hover/task:text-primary ${isOverdue ? "text-red-400" : "text-white"}`}>
            {task.title}
          </h4>
          <p className="text-[9px] font-medium text-muted-foreground truncate uppercase tracking-tight">
            {progetto ? `${progetto.nome} / ${progetto.cliente?.ragione_sociale || "—"}` : "PROGETTO GENERICO"}
          </p>
          
          <div className="mt-2 flex items-center gap-3">
            {task.stima_minuti && (
              <Badge variant="outline" className="bg-muted/30 border-border text-[8px] font-black px-1 h-4">
               {Math.floor(task.stima_minuti / 60)}h {task.stima_minuti % 60}m
              </Badge>
            )}
            
            {task.due_date && (
              <div className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                <Calendar className="h-2.5 w-2.5" />
                {isOverdue ? "Scaduto" : format(parseISO(task.due_date), "dd MMM", { locale: it })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
