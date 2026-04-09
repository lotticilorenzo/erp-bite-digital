import { useState, useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  Calendar,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Activity,
  Briefcase
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/hooks/useTasks";
import { useUsers } from "@/hooks/useUsers";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  format, 
  addDays, 
  startOfDay, 
  endOfDay, 
  isBefore, 
  parseISO,
  differenceInDays
} from "date-fns";
import { it } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useStudio } from "@/context/StudioContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Period = "oggi" | "domani" | "dopodomani" | "settimana";

// Helper for consistent avatar colors
const getAvatarColor = (name: string) => {
  const colors = [
    "bg-indigo-500", "bg-purple-500", "bg-pink-500", 
    "bg-rose-500", "bg-orange-500", "bg-amber-500", 
    "bg-emerald-500", "bg-teal-500", "bg-sky-500", "bg-blue-500"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (firstName: string, lastName: string) => {
  return (firstName?.[0] || "") + (lastName?.[0] || "");
};

export default function CaricoLavoroPage() {
  const [period, setPeriod] = useState<Period>("oggi");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const { data: users, isLoading: loadingUsers } = useUsers();
  const { selectTask } = useStudio();

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const today = startOfDay(new Date());
    switch (period) {
      case "oggi":
        return { start: today, end: endOfDay(today) };
      case "domani":
        const domani = addDays(today, 1);
        return { start: domani, end: endOfDay(domani) };
      case "dopodomani":
        const dopodomani = addDays(today, 2);
        return { start: dopodomani, end: endOfDay(dopodomani) };
      case "settimana":
        return { start: today, end: endOfDay(addDays(today, 7)) };
      default:
        return { start: today, end: endOfDay(today) };
    }
  }, [period]);

  const { data: tasks, isLoading: loadingTasks } = useTasks({
    start_date: format(dateRange.start, "yyyy-MM-dd"),
    end_date: format(dateRange.end, "yyyy-MM-dd"),
    parent_only: false 
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!tasks) return { count: 0, hours: 0, users: 0, overdue: 0 };
    
    const count = tasks.length;
    const hours = tasks.reduce((acc, t) => acc + (t.stima_minuti || 0), 0) / 60;
    const uniqueUsers = new Set(tasks.map(t => t.assegnatario_id).filter(Boolean)).size;
    
    const now = new Date();
    const overdue = tasks.filter(t => 
      t.state_id !== "PUBBLICATO" && 
      t.due_date && 
      isBefore(parseISO(t.due_date), startOfDay(now))
    ).length;

    return { count, hours, users: uniqueUsers, overdue };
  }, [tasks]);

  // Chart Data Calculation
  const chartData = useMemo(() => {
    if (!users || !tasks) return [];

    const daysCount = period === "settimana" ? 7 : 1;
    
    return users
      .filter(u => u.attivo)
      .map(u => {
        const userTasks = tasks.filter(t => t.assegnatario_id === u.id);
        const programmedHours = userTasks.reduce((acc, t) => acc + (t.stima_minuti || 0), 0) / 60;
        
        const dailyHours = u.ore_settimanali ? (u.ore_settimanali / 5) : 8;
        const availableTotalCount = dailyHours * daysCount;
        
        const excess = Math.max(0, programmedHours - availableTotalCount);
        const free = Math.max(0, availableTotalCount - programmedHours);
        const actualProgrammed = Math.min(programmedHours, availableTotalCount);

        const status = programmedHours > availableTotalCount ? 'sovraccarico' : 
                      programmedHours > (availableTotalCount * 0.9) ? 'vicino' : 'disponibile';

        return {
          id: u.id,
          name: u.nome,
          lastName: u.cognome,
          fullName: `${u.nome} ${u.cognome}`,
          avatar: u.avatar_url || undefined,
          programmed: actualProgrammed,
          free: free,
          excess: excess,
          total: availableTotalCount,
          actualTotal: programmedHours,
          perc: availableTotalCount > 0 ? (programmedHours / availableTotalCount) * 100 : 0,
          status,
          tasks: userTasks
        };
      })
      .sort((a, b) => b.actualTotal - a.actualTotal);
  }, [users, tasks, period]);

  // Team completion
  const teamCompletion = useMemo(() => {
    if (!tasks || tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.state_id === "PUBBLICATO" || t.state_id === "PRONTO").length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  if (loadingUsers || loadingTasks) {
    return (
      <div className="p-8 space-y-8 h-full bg-background">
        <div className="flex justify-between items-center">
          <Skeleton className="h-14 w-80 rounded-2xl" />
          <Skeleton className="h-12 w-96 rounded-2xl" />
        </div>
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 rounded-3xl" />)}
        </div>
        <div className="grid grid-cols-12 gap-8">
          <Skeleton className="col-span-8 h-[500px] rounded-[40px]" />
          <Skeleton className="col-span-4 h-[500px] rounded-[40px]" />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full bg-background selection:bg-primary/30">
      <div className="p-8 space-y-10 pb-24">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-border/40 pb-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <h1 className="text-5xl font-[900] text-white tracking-tight uppercase italic flex items-center gap-4">
              <LayoutGrid className="w-10 h-10 text-primary" />
              Carico <span className="text-primary not-italic">Lavoro</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium tracking-wide flex items-center gap-2">
              <span className="h-1 w-8 bg-primary rounded-full" />
              Monitoraggio capacità e saturazione team professionale
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1 bg-card/50 p-1.5 rounded-2xl border border-border/60 shadow-xl"
          >
            {(["oggi", "domani", "dopodomani", "settimana"] as Period[]).map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-xl px-7 h-10 font-bold uppercase text-[11px] tracking-widest transition-all duration-300",
                  period === p 
                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:text-white"
                )}
              >
                {p}
              </Button>
            ))}
          </motion.div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard 
            title="Task nel periodo" 
            value={kpis.count} 
            icon={CheckCircle2} 
            color="text-indigo-500"
            bgColor="bg-indigo-500/10"
            description="Task pianificati totali"
            delay={0.1}
          />
          <KpiCard 
            title="Ore stimate" 
            value={`${kpis.hours.toFixed(1)}h`} 
            icon={Clock} 
            color="text-purple-500"
            bgColor="bg-purple-500/10"
            description="Volume di lavoro previsto"
            delay={0.2}
          />
          <KpiCard 
            title="Persone Team" 
            value={kpis.users} 
            icon={Users} 
            color="text-sky-500"
            bgColor="bg-sky-500/10"
            description="Membri attivi in dashboard"
            delay={0.3}
          />
          <KpiCard 
            title="Task Scaduti" 
            value={kpis.overdue} 
            icon={AlertTriangle} 
            color={kpis.overdue > 0 ? "text-rose-500" : "text-emerald-500"}
            bgColor={kpis.overdue > 0 ? "bg-rose-500/10" : "bg-emerald-500/10"}
            description="Pendenze da risolvere"
            delay={0.4}
          />
        </div>

        {/* MAIN VISUALIZATION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* BAR CHART */}
          <Card className="lg:col-span-8 bg-card/30 border-border/50 shadow-2xl rounded-[40px] overflow-hidden backdrop-blur-xl border">
            <CardHeader className="p-8 border-b border-border/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                    <Activity className="w-5 h-5 text-primary" />
                    Ore Programmate vs Disponibili
                  </CardTitle>
                </div>
                <div className="flex gap-6 items-center px-4 py-2 bg-muted/20 rounded-full">
                  <LegendItem color="hsl(var(--primary))" label="Programmate" />
                  <LegendItem color="#10b981" label="Libere" />
                  <LegendItem color="#ef4444" label="Eccesso" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[550px] p-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartData} 
                  layout="vertical" 
                  margin={{ left: 100, right: 30, top: 10, bottom: 10 }}
                  barCategoryGap={20}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="#ffffff05" horizontal={false} />
                  <XAxis type="number" hide={true} />
                  <YAxis 
                    dataKey="fullName" 
                    type="category" 
                    width={100}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      const user = chartData.find(u => u.fullName === payload.value);
                      if (!user) return null;
                      return (
                        <g transform={`translate(${x - 90},${y - 20})`}>
                          <foreignObject width="100" height="60">
                            <div className="flex flex-col items-center justify-center space-y-1 pr-4">
                              <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center text-[10px] font-[900] text-white border-2 border-background shadow-lg",
                                getAvatarColor(user.fullName)
                              )}>
                                {getInitials(user.name, user.lastName)}
                              </div>
                              <span className="text-[10px] font-black text-muted-foreground uppercase text-center w-full truncate">
                                {user.name}
                              </span>
                            </div>
                          </foreignObject>
                        </g>
                      );
                    }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.02)', radius: 12 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-card/95 border border-primary/20 p-5 rounded-[24px] shadow-2xl backdrop-blur-2xl min-w-[200px]"
                          >
                            <p className="text-xs font-black text-white uppercase mb-3 pb-2 border-b border-primary/10 tracking-widest">{data.fullName}</p>
                            <div className="space-y-2.5">
                              <div className="flex justify-between gap-8 text-[11px] font-bold">
                                <span className="text-muted-foreground">Programmate:</span>
                                <span className="text-white">{data.actualTotal.toFixed(1)}h</span>
                              </div>
                              <div className="flex justify-between gap-8 text-[11px] font-bold">
                                <span className="text-muted-foreground">Capacità Max:</span>
                                <span className="text-white">{data.total.toFixed(1)}h</span>
                              </div>
                              {data.excess > 0 ? (
                                <div className="flex justify-between gap-8 text-[11px] font-bold py-1 px-2 bg-rose-500/10 rounded-lg">
                                  <span className="text-rose-500 uppercase tracking-tighter">Overload:</span>
                                  <span className="text-rose-500 font-black">+{data.excess.toFixed(1)}h</span>
                                </div>
                              ) : (
                                <div className="flex justify-between gap-8 text-[11px] font-bold py-1 px-2 bg-emerald-500/10 rounded-lg">
                                  <span className="text-emerald-500 uppercase tracking-tighter">Libere:</span>
                                  <span className="text-emerald-500 font-black">-{data.free.toFixed(1)}h</span>
                                </div>
                              )}
                            </div>
                            <p className="mt-4 text-[9px] font-black uppercase text-primary tracking-[0.2em]">Saturation {Math.round(data.perc)}%</p>
                          </motion.div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="programmed" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} barSize={32}>
                     {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.perc > 100 ? 'hsl(var(--destructive))' : entry.perc > 90 ? 'hsl(var(--warning))' : 'hsl(var(--primary))'} fillOpacity={0.9} />
                    ))}
                  </Bar>
                  <Bar dataKey="free" stackId="a" fill="hsl(var(--chart-2))" radius={[0, 10, 10, 0]} barSize={32} fillOpacity={0.15} stroke="hsl(var(--chart-2))" strokeWidth={1} strokeDasharray="2 2" />
                  <Bar dataKey="excess" stackId="a" fill="hsl(var(--destructive))" radius={[0, 10, 10, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* COMPLETION PROGRESS */}
          <Card className="lg:col-span-4 h-full bg-card/30 border-border/50 shadow-2xl rounded-[40px] overflow-hidden backdrop-blur-xl border">
            <CardHeader className="p-8 border-b border-border/30">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
                <Activity className="w-5 h-5 text-primary" />
                Completamento Periodo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              
              <div className="flex flex-col items-center justify-center py-10 bg-gradient-to-br from-primary/10 via-transparent to-transparent rounded-[32px] border border-primary/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                  <CheckCircle2 size={120} />
                </div>
                
                <div className="relative mb-6">
                   <svg className="w-44 h-44 transform -rotate-90">
                    <circle
                      cx="88"
                      cy="88"
                      r="74"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      className="text-muted/10"
                    />
                    <motion.circle
                      cx="88"
                      cy="88"
                      r="74"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={465}
                      initial={{ strokeDashoffset: 465 }}
                      animate={{ strokeDashoffset: 465 - (465 * teamCompletion) / 100 }}
                      transition={{ duration: 2, ease: "circOut" }}
                      className="text-primary"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <motion.span 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-5xl font-[900] text-foreground"
                    >
                      {teamCompletion}<span className="text-3xl">%</span>
                    </motion.span>
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">Status Team</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-[900] uppercase text-muted-foreground tracking-[0.3em] pl-1">Performance Membri</p>
                <ScrollArea className="h-[200px] pr-4">
                   <div className="space-y-7">
                    {chartData.map((u) => (
                      <div key={u.id} className="space-y-2.5">
                        <div className="flex justify-between items-end">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-7 w-7 rounded-full text-[8px] font-black flex items-center justify-center text-primary-foreground", getAvatarColor(u.fullName))}>
                              {getInitials(u.name, u.lastName)}
                            </div>
                            <span className="text-[12px] font-black text-foreground uppercase tracking-tight">{u.name}</span>
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                            {u.actualTotal.toFixed(1)}h <span className="text-muted/30">/</span> {u.total.toFixed(1)}h
                          </span>
                        </div>
                        <div className="relative h-2 w-full bg-muted/20 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, u.perc)}%` }}
                            transition={{ duration: 1.5, delay: 0.2 }}
                            className={cn(
                              "h-full rounded-full transition-colors",
                              u.perc > 100 ? 'bg-destructive shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 
                              u.perc > 90 ? 'bg-amber-500' : 'bg-primary'
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DETTAGLIO ASSEGNATARI */}
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-4xl font-[900] text-foreground tracking-tighter uppercase italic">
              Dettaglio <span className="text-primary not-italic">Assegnatari</span>
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-border/80 via-border/20 to-transparent" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {chartData.map((u) => (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "bg-card/20 border border-border/50 rounded-[40px] overflow-hidden group hover:border-primary/40 transition-all duration-500 backdrop-blur-sm relative",
                  expandedUser === u.id && "ring-1 ring-primary/20 bg-card/40"
                )}
              >
                {/* Background Accent */}
                <div className={cn(
                  "absolute top-0 right-0 w-32 h-32 blur-3xl opacity-[0.03] transition-opacity duration-500 group-hover:opacity-10",
                  u.status === 'sovraccarico' ? 'bg-destructive' : 'bg-primary'
                )} />

                <div 
                  className="p-7 cursor-pointer"
                  onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-14 w-14 rounded-2xl border-2 border-background shadow-2xl relative z-10">
                          <AvatarImage src={u.avatar} />
                          <AvatarFallback className={cn("text-primary-foreground font-[900] rounded-2xl", getAvatarColor(u.fullName))}>
                            {getInitials(u.name, u.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        {/* Status Ring */}
                        <div className={cn(
                          "absolute -inset-1 rounded-[20px] blur-[2px] opacity-40",
                          u.status === 'sovraccarico' ? 'bg-destructive animate-pulse' : 
                          u.status === 'vicino' ? 'bg-amber-500' : 'bg-emerald-500'
                        )} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-foreground uppercase leading-none tracking-tight group-hover:text-primary transition-colors">{u.name} {u.lastName}</h3>
                        <div className="flex items-center gap-2 mt-2">
                           <Badge variant="secondary" className={cn(
                             "rounded-full uppercase text-[9px] font-black px-3 py-0.5 border-none",
                             u.status === 'sovraccarico' ? 'bg-destructive text-destructive-foreground' : 
                             u.status === 'vicino' ? 'bg-amber-500 text-slate-900' :
                             'bg-emerald-500 text-emerald-950'
                           )}>
                            {u.status === 'sovraccarico' ? 'Sovraccarico' : u.status === 'vicino' ? 'Quasi pieno' : 'Disponibile'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="bg-muted/30 p-2 rounded-2xl border border-border/40">
                         {expandedUser === u.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                       <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Saturazione</span>
                       <span className={cn(
                         "text-xs font-black tabular-nums",
                         u.perc > 100 ? 'text-rose-500' : 'text-primary'
                       )}>{Math.round(u.perc)}%</span>
                    </div>
                    <div className="relative h-2.5 w-full bg-muted/10 rounded-full overflow-hidden border border-border/30 p-[1px]">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, u.perc)}%` }}
                        className={cn(
                          "h-full rounded-full",
                          u.perc > 100 ? 'bg-rose-500' : u.perc > 90 ? 'bg-amber-500' : 'bg-primary'
                        )}
                      />
                    </div>
                    <div className="flex justify-between gap-4 mt-4">
                      <div className="flex-1 bg-white/[0.03] rounded-2xl p-3 border border-white/[0.05]">
                         <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Occupate</p>
                         <p className="text-sm font-black text-foreground">{u.actualTotal.toFixed(1)}h</p>
                      </div>
                      <div className="flex-1 bg-white/[0.03] rounded-2xl p-3 border border-white/[0.05]">
                         <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Capacità</p>
                         <p className="text-sm font-black text-foreground">{u.total.toFixed(1)}h</p>
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedUser === u.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/40 bg-muted/5 overflow-hidden"
                    >
                      <div className="p-6 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                           <Briefcase className="w-3 h-3 text-primary" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Task assegnati ({u.tasks.length})</span>
                        </div>
                        
                        {u.tasks.map((task) => (
                          <div 
                            key={task.id}
                            onClick={() => selectTask(task.id)}
                            className="bg-card/40 border border-border/40 p-4 rounded-3xl hover:bg-card/60 hover:border-primary/30 transition-all cursor-pointer group/task flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                               <div className={cn(
                                 "h-2 w-2 rounded-full shrink-0 shadow-lg",
                                 task.state_id === "PUBBLICATO" ? "bg-emerald-500 shadow-emerald-500/20" :
                                 task.state_id === "IN_CORSO" || task.state_id === "PROGRAMMATO" ? "bg-amber-500 shadow-amber-500/20" :
                                 "bg-primary shadow-primary/20"
                               )} />
                               <div className="flex flex-col min-w-0">
                                 <span className="text-[12px] font-bold text-foreground truncate group-hover/task:text-primary transition-colors">
                                   {task.title}
                                 </span>
                                 <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter mt-0.5">
                                   {task.progetto?.nome || 'Progetto Interno'}
                                 </span>
                               </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-4">
                               <Badge variant="outline" className="text-[9px] font-black bg-white/[0.03] border-border/60 py-1">
                                 {task.stima_minuti || 0}'
                               </Badge>
                               <div className={cn(
                                 "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                                 task.due_date && isBefore(parseISO(task.due_date), startOfDay(new Date())) 
                                  ? "text-rose-500 bg-rose-500/10" 
                                  : "text-muted-foreground"
                               )}>
                                 {task.due_date ? format(parseISO(task.due_date), "dd MMM") : '-'}
                               </div>
                            </div>
                          </div>
                        ))}
                        {u.tasks.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/30 border-2 border-dashed border-muted/20 rounded-[32px]">
                            <Calendar className="h-10 w-10 mb-2" />
                            <span className="text-xs font-black uppercase tracking-widest italic">Nessuna attività pianificata</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>

        {/* TASK SCADUTE */}
        {kpis.overdue > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pt-10"
          >
             <div className="flex items-center gap-4 text-rose-500">
              <AlertCircle className="w-10 h-10" />
              <h2 className="text-4xl font-[900] tracking-tighter uppercase italic">
                Task <span className="not-italic">Scaduti</span>
              </h2>
              <div className="h-px flex-1 bg-rose-500/20" />
              <Badge className="bg-rose-500 text-rose-50-foreground font-black px-4 py-1.5 rounded-2xl animate-bounce">SCADUTA</Badge>
            </div>

            <Card className="bg-rose-500/[0.02] border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.1)] rounded-[40px] overflow-hidden backdrop-blur-md border">
              <Table>
                <TableHeader className="bg-rose-500/5">
                  <TableRow className="border-rose-500/10 hover:bg-transparent">
                    <TableHead className="text-[11px] font-black uppercase text-rose-500/70 tracking-widest pl-10 py-6">Titolo Task</TableHead>
                    <TableHead className="text-[11px] font-black uppercase text-rose-500/70 tracking-widest text-center">Cliente / Progetto</TableHead>
                    <TableHead className="text-[11px] font-black uppercase text-rose-500/70 tracking-widest text-center">Assegnatario</TableHead>
                    <TableHead className="text-[11px] font-black uppercase text-rose-500/70 tracking-widest text-center">Scadenza</TableHead>
                    <TableHead className="text-[11px] font-black uppercase text-rose-500/70 tracking-widest text-right pr-10">Ritardo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks?.filter(t => t.state_id !== "PUBBLICATO" && t.due_date && isBefore(parseISO(t.due_date), startOfDay(new Date())))
                    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
                    .map((t, idx) => {
                      const user = users?.find(u => u.id === t.assegnatario_id);
                      const delayDays = t.due_date ? differenceInDays(new Date(), parseISO(t.due_date)) : 0;
                      
                      return (
                        <TableRow 
                          key={t.id} 
                          className={cn(
                            "border-rose-500/5 hover:bg-rose-500/[0.04] cursor-pointer transition-colors group",
                            idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]"
                          )}
                          onClick={() => selectTask(t.id)}
                        >
                          <TableCell className="pl-10 py-6">
                            <div className="flex items-center gap-4">
                               <div className="h-2 w-2 rounded-full bg-rose-500" />
                               <span className="font-bold text-[14px] text-foreground group-hover:text-rose-500 transition-colors uppercase tracking-tight">{t.title}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t.progetto?.nome || '—'}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-3">
                              <Avatar className="h-7 w-7 border-2 border-background ring-2 ring-rose-500/30">
                                <AvatarImage src={user?.avatar_url || undefined} />
                                <AvatarFallback className={cn("text-[9px] font-black text-primary-foreground", user ? getAvatarColor(user.nome) : 'bg-muted')}>
                                  {user ? getInitials(user.nome, user.cognome) : '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[11px] font-bold text-foreground uppercase">{user?.nome}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold text-rose-400 text-[11px]">
                            {t.due_date ? format(parseISO(t.due_date), "dd MMM yyyy", { locale: it }) : '—'}
                          </TableCell>
                          <TableCell className="text-right pr-10">
                            <div className="flex flex-col items-end">
                              <span className="font-[900] text-rose-500 text-lg tabular-nums">+{delayDays}d</span>
                              <span className="text-[8px] font-black text-rose-500/50 uppercase tracking-[0.2em]">Pendenza critica</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </Card>
          </motion.div>
        )}
      </div>
    </ScrollArea>
  );
}

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: any;
  description: string;
  color: string;
  bgColor: string;
  delay: number;
}

function KpiCard({ title, value, icon: Icon, description, color, bgColor, delay }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group"
    >
      <Card className="bg-card/40 border-border/50 shadow-2xl rounded-[32px] p-8 hover:border-primary/40 transition-all duration-500 overflow-hidden relative backdrop-blur-md">
        <div className={cn(
          "absolute -top-10 -right-10 p-12 blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-1000",
          bgColor
        )} />
        
        <div className="relative z-10 space-y-6">
          <div className={cn(
            "p-4 w-fit rounded-2xl border transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(0,0,0,0.1)]",
            bgColor,
            "border-white/5 group-hover:border-white/10"
          )}>
            <Icon className={cn("h-6 w-6", color, "group-hover:scale-110 transition-transform duration-500")} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground mb-2">{title}</p>
            <p className="text-5xl font-[900] text-foreground tracking-tighter tabular-nums leading-none">
              {value}
            </p>
            <div className="flex items-center gap-2 mt-4 text-[11px] font-bold text-muted-foreground/60">
               <Activity className="w-3 h-3" />
               <p className="group-hover:text-muted-foreground transition-colors">{description}</p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2.5 w-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.1)]" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}
