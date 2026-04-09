import { useState, useEffect } from "react";
import { 
  Users, 
  CheckCircle2, 
  AlertTriangle,
  AlertCircle,
  LayoutDashboard,
  Clock,
  ArrowRight,
  Projector,
  Briefcase
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudio } from "@/context/StudioContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import axios from "axios";

interface ProjectStats {
  kpis: {
    total: number;
    today: number;
    overdue: number;
    upcoming: number;
  };
  status_distribution: Array<{ status: string; count: number }>;
  team_stats: Array<{
    id: string;
    nome: string;
    cognome: string;
    avatar_url: string | null;
    total_tasks: number;
    overdue_tasks: number;
  }>;
  critical_tasks: Array<{
    id: string;
    titolo: string;
    data_scadenza: string;
    assegnatario: {
      nome: string;
      avatar_url: string | null;
    } | null;
  }>;
}

export default function StudioOverviewPage() {
  const { nav, currentFolder, currentList, selectTask } = useStudio();
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);

  const targetId = nav.selectedListId || nav.selectedFolderId;
  const targetType = nav.selectedListId ? "projects" : "clienti";

  useEffect(() => {
    if (!targetId) return;
    
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/v1/${targetType}/${targetId}/stats`);
        setStats(res.data);
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [targetId, targetType]);

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-indigo-500", "bg-purple-500", "bg-pink-500", 
      "bg-rose-500", "bg-orange-500", "bg-amber-500", 
      "bg-emerald-500", "bg-teal-500", "bg-sky-500"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading || !stats) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
           <Skeleton className="h-10 w-64 rounded-xl" />
        </div>
        <div className="grid grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-3xl" />)}
        </div>
        <div className="grid grid-cols-12 gap-8">
           <Skeleton className="col-span-6 h-[400px] rounded-[40px]" />
           <Skeleton className="col-span-6 h-[400px] rounded-[40px]" />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full bg-background selection:bg-primary/30">
      <div className="p-8 space-y-10 pb-20">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col space-y-2">
           <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
             <Projector className="w-3.5 h-3.5" />
             <span>Overview {nav.selectedListId ? "Progetto" : "Cliente"}</span>
           </div>
           <div className="flex items-center gap-6">
              <div className={cn(
                "h-16 w-16 rounded-[22px] flex items-center justify-center text-white shadow-2xl border-2 border-background",
                getAvatarColor(currentList?.nome || currentFolder?.ragione_sociale || "Studio")
              )}>
                {nav.selectedListId ? <Briefcase className="w-8 h-8" /> : <Users className="w-8 h-8" />}
              </div>
              <div>
                <h1 className="text-4xl font-[900] text-white tracking-tighter uppercase italic">
                  {currentList?.nome || currentFolder?.ragione_sociale || "Dashboard"}
                </h1>
                <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-[0.1em] mt-1 flex items-center gap-2">
                  <span className="h-1 w-6 bg-primary rounded-full" />
                  Monitoraggio prestazioni e pendenze critiche
                </p>
              </div>
           </div>
        </div>

        {/* KPI GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <KpiCard 
             label="Task Totali"
             value={stats.kpis.total}
             description="In questo orizzonte"
             icon={LayoutDashboard}
             color="text-indigo-400"
             bgColor="bg-indigo-400/10"
           />
           <KpiCard 
             label="Oggi"
             value={stats.kpis.today}
             description="Scadenze giornaliere"
             icon={Clock}
             color="text-amber-400"
             bgColor="bg-amber-400/10"
           />
           <KpiCard 
             label="Scadute"
             value={stats.kpis.overdue}
             description="Pendenze da recuperare"
             icon={AlertTriangle}
             color={stats.kpis.overdue > 0 ? "text-rose-500" : "text-emerald-500"}
             bgColor={stats.kpis.overdue > 0 ? "bg-rose-500/10" : "bg-emerald-500/10"}
           />
           <KpiCard 
             label="In Scadenza"
             value={stats.kpis.upcoming}
             description="Prossimi 7 giorni"
             icon={ArrowRight}
             color="text-sky-400"
             bgColor="bg-sky-400/10"
           />
        </div>

        {/* MAIN ANALYSIS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
           
           {/* TEAM SECTION (LEFT) */}
           <Card className="lg:col-span-5 bg-card/40 border-border/50 shadow-2xl rounded-[40px] backdrop-blur-xl border">
              <CardHeader className="p-8 border-b border-border/30">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-3">
                    <Users className="w-4 h-4 text-primary" />
                    Team Assegnato
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                 <div className="space-y-2">
                    {stats.team_stats.map((member) => (
                       <div 
                         key={member.id}
                         className="flex items-center justify-between p-4 rounded-3xl hover:bg-white/[0.03] transition-colors group"
                       >
                          <div className="flex items-center gap-4">
                             <Avatar className="h-10 w-10 border-2 border-background ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                                <AvatarImage src={member.avatar_url || undefined} />
                                <AvatarFallback className={cn("text-white font-[900] text-[10px]", getAvatarColor(member.nome))}>
                                   {member.nome[0]}{member.cognome[0]}
                                </AvatarFallback>
                             </Avatar>
                             <div className="flex flex-col">
                                <span className="text-sm font-bold text-white group-hover:text-primary transition-colors uppercase tracking-tight">{member.nome} {member.cognome}</span>
                                <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-tighter mt-0.5">{member.total_tasks} task totali</span>
                             </div>
                          </div>

                          {member.overdue_tasks > 0 && (
                            <Badge className="bg-rose-500/10 text-rose-500 border-none rounded-full px-3 py-1 font-black text-[9px] uppercase tracking-tighter">
                               {member.overdue_tasks} scad.
                            </Badge>
                          )}
                       </div>
                    ))}
                    {stats.team_stats.length === 0 && (
                      <div className="py-20 text-center text-muted-foreground/30 italic text-xs font-bold uppercase tracking-widest">Nessun membro assegnato</div>
                    )}
                 </div>
              </CardContent>
           </Card>

           {/* STATUS DISTRIBUTION (RIGHT) */}
           <Card className="lg:col-span-7 bg-card/40 border-border/50 shadow-2xl rounded-[40px] backdrop-blur-xl border overflow-hidden">
              <CardHeader className="p-8 border-b border-border/30">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Stato Avanzamento
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-10 space-y-12">
                 <div className="space-y-10">
                    <StatusProgress 
                      label="Completato"
                      color="bg-emerald-500"
                      count={stats.status_distribution.find(s => s.status === "PUBBLICATO" || s.status === "PRONTO")?.count || 0}
                      total={stats.kpis.total}
                      delay={0.2}
                    />
                    <StatusProgress 
                      label="In Corso"
                      color="bg-purple-500"
                      count={stats.status_distribution.filter(s => ["IN_CORSO", "IN_REVIEW", "DA_CORREGGERE"].includes(s.status)).reduce((acc, curr) => acc + curr.count, 0)}
                      total={stats.kpis.total}
                      delay={0.4}
                    />
                    <StatusProgress 
                      label="To Do"
                      color="bg-[#475569]"
                      count={stats.status_distribution.filter(s => ["DA_FARE", "BOZZE_IDEE"].includes(s.status)).reduce((acc, curr) => acc + curr.count, 0)}
                      total={stats.kpis.total}
                      delay={0.6}
                    />
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* CRITICAL OVERDUE SECTION (BOTTOM) */}
        {stats.critical_tasks.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pt-6"
          >
             <div className="flex items-center gap-4 text-rose-500">
               <AlertCircle className="w-8 h-8" />
               <h2 className="text-3xl font-[900] tracking-tighter uppercase italic">
                 Analisi <span className="not-italic">Criticità</span>
               </h2>
               <div className="h-px flex-1 bg-rose-500/20" />
               <Badge className="bg-rose-500 text-white font-black px-4 py-1.5 rounded-2xl">LATE TASKS</Badge>
             </div>

             <Card className="bg-rose-400/[0.015] border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.05)] rounded-[32px] overflow-hidden backdrop-blur-md border">
                <Table>
                   <TableHeader className="bg-rose-500/5">
                      <TableRow className="border-rose-500/10 hover:bg-transparent">
                         <TableHead className="text-[10px] font-black uppercase text-rose-500/70 tracking-widest pl-8 py-5">Titolo Task</TableHead>
                         <TableHead className="text-[10px] font-black uppercase text-rose-500/70 tracking-widest text-center">Deadline</TableHead>
                         <TableHead className="text-[10px] font-black uppercase text-rose-500/70 tracking-widest text-right pr-8">Assignee</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {stats.critical_tasks.map((task) => (
                        <TableRow 
                          key={task.id} 
                          className="border-rose-500/5 hover:bg-rose-500/[0.04] cursor-pointer transition-colors group"
                          onClick={() => selectTask(task.id)}
                        >
                           <TableCell className="pl-8 py-5 font-bold text-sm text-white group-hover:text-rose-500 transition-colors uppercase tracking-tight">
                              {task.titolo}
                           </TableCell>
                           <TableCell className="text-center">
                              <Badge className="bg-rose-500/10 text-rose-500 border-none rounded-lg px-3 py-1 font-black text-[10px] uppercase tracking-tighter">
                                {format(parseISO(task.data_scadenza), "dd MMM")} - Scad.
                              </Badge>
                           </TableCell>
                           <TableCell className="text-right pr-8">
                              <Avatar className="h-8 w-8 ml-auto border border-rose-500/30">
                                 <AvatarImage src={task.assegnatario?.avatar_url || undefined} />
                                 <AvatarFallback className={cn("text-[8px] font-black text-white", task.assegnatario ? getAvatarColor(task.assegnatario.nome) : 'bg-muted')}>
                                    {task.assegnatario ? task.assegnatario.nome[0] : '?'}
                                 </AvatarFallback>
                              </Avatar>
                           </TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </Card>
          </motion.div>
        )}
      </div>
    </ScrollArea>
  );
}

function KpiCard({ label, value, icon: Icon, description, color, bgColor }: any) {
  return (
    <Card className="bg-card/40 border-border/50 shadow-2xl rounded-[32px] p-8 hover:border-primary/40 transition-all duration-500 overflow-hidden relative group backdrop-blur-md">
       <div className={cn("absolute -top-10 -right-10 p-12 blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-1000", bgColor)} />
       <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
          <div className={cn("p-4 rounded-2xl w-fit flex items-center justify-center border border-white/5", bgColor)}>
             <Icon className={cn("h-6 w-6", color)} />
          </div>
          <div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 mb-1">{label}</p>
             <p className="text-5xl font-[900] text-white tracking-tighter tabular-nums leading-none">
                {value}
             </p>
             <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter mt-3 flex items-center gap-1.5">
               <div className="h-1 w-4 bg-muted rounded-full" />
               {description}
             </p>
          </div>
       </div>
    </Card>
  );
}

function StatusProgress({ label, color, count, total, delay }: any) {
  const perc = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-4">
       <div className="flex justify-between items-end">
          <div className="flex items-center gap-3">
             <div className={cn("h-2.5 w-2.5 rounded-full shadow-lg", color)} />
             <span className="text-sm font-black text-white uppercase tracking-tight">{label}</span>
          </div>
          <span className="text-[11px] font-black text-muted-foreground tabular-nums tracking-widest">{count} TASK</span>
       </div>
       <div className="relative h-2.5 w-full bg-muted/10 rounded-full overflow-hidden p-[1px] border border-border/10">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${perc}%` }}
            transition={{ duration: 1, delay, ease: "circOut" }}
            className={cn("h-full rounded-full transition-all", color)}
          />
       </div>
    </div>
  );
}
