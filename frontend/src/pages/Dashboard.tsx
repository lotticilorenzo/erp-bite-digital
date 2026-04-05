import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Users, Briefcase, Timer, Calendar, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useTimesheets } from "@/hooks/useTimesheet";
import { motion } from "framer-motion";
import { 
  formatDistanceToNow, 
  parseISO, 
  isBefore, 
  isSameDay, 
  startOfDay
} from "date-fns";
import { it } from "date-fns/locale";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: analytics, isLoading: isLoadingAnalytics } = useAnalytics();
  const { data: allTimesheets = [], isLoading: isLoadingTimesheets } = useTimesheets();

  const isLoading = isLoadingAnalytics || isLoadingTimesheets;

  const stats = [
    { 
      label: "Clienti Attivi", 
      value: isLoading ? "..." : analytics?.kpis.activeClients.toString(), 
      icon: Users, 
      color: "text-blue-500" 
    },
    { 
      label: "Progetti in Corso", 
      value: isLoading ? "..." : analytics?.kpis.ongoingProjects.toString(), 
      icon: Briefcase, 
      color: "text-purple-500" 
    },
    { 
      label: "Ore Mese", 
      value: isLoading ? "..." : `${Math.round(analytics?.kpis.monthlyHours || 0)}h`, 
      icon: Timer, 
      color: "text-green-500" 
    },
    { 
      label: "Fatturato Mese", 
      value: isLoading ? "..." : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(analytics?.kpis.monthlyRevenue || 0), 
      icon: Zap, 
      color: "text-yellow-500" 
    },
  ];

  const currentDate = new Date().toLocaleDateString('it-IT', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // 1. Prossime Scadenze (dagli alerts di tipo TASK con scadenza vicina)
  const today = startOfDay(new Date());
  
  const relevantAlerts = (analytics?.alerts || [])
    .filter(a => a.type === "TASK")
    .map(a => {
      const date = parseISO(a.value || "");
      let colorClass = "text-blue-500";
      if (isBefore(date, today)) colorClass = "text-red-500";
      else if (isSameDay(date, today)) colorClass = "text-yellow-500";
      
      return { ...a, date, colorClass };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  // 2. Attività Recenti (ultimi timesheet inseriti)
  const recentActivities = [...allTimesheets]
    .sort((a, b) => new Date(b.created_at || b.data_attivita).getTime() - new Date(a.created_at || a.data_attivita).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-12 max-w-7xl mx-auto pt-4 pb-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl font-black tracking-tight text-foreground mb-1">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium capitalize">
          <span className="text-primary/80">⚡</span>
          {currentDate}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className={`
            bg-card border-border relative overflow-hidden group shadow-2xl
            hover:border-primary/50 transition-all duration-500 hover:shadow-primary/5 hover:-translate-y-1
          `}>
            {/* Top Gradient Border */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${
              i === 0 ? "from-purple-500 to-purple-400" :
              i === 1 ? "from-blue-500 to-blue-400" :
              i === 2 ? "from-green-500 to-green-400" :
              "from-amber-500 to-amber-400"
            }`} />
            
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-muted-foreground pt-5">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
                {stat.label}
              </CardTitle>
              <div className={`p-2 rounded-lg bg-muted/50 border border-border/50 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-500`}>
                <stat.icon className={`h-4 w-4 ${stat.color} group-hover:scale-110 transition-transform`} />
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="text-4xl font-black tracking-tighter text-foreground mb-1 transition-colors duration-500">
                {stat.value}
              </div>
              <div className="h-1 w-12 bg-muted rounded-full group-hover:w-20 group-hover:bg-primary/50 transition-all duration-700" />
            </CardContent>

            {/* Subtle Glow Effect on Hover */}
            <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* PROSSIME SCADENZE */}
        <Card className="col-span-4 bg-card border-border shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Prossime Scadenze
              </CardTitle>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => navigate("/studio-os")}
                className="text-[10px] uppercase font-bold tracking-widest text-primary hover:bg-primary/10"
              >
                Vedi tutte
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {relevantAlerts.length > 0 ? (
              <div className="divide-y divide-border/50">
                {relevantAlerts.map((alert, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-all duration-300 group cursor-pointer relative">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-500" />
                    <div className="flex-1 min-w-0 pl-2">
                      <div className="text-sm font-bold text-foreground truncate">{alert.title}</div>
                      <div className={`text-[11px] font-medium ${alert.colorClass}`}>
                        Scadenza: {new Intl.DateTimeFormat('it-IT').format(alert.date)}
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-primary/40 pr-2">
                      TASK
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground opacity-20" />
                <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">
                  Nessuna scadenza imminente
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ATTIVITÀ RECENTI */}
        <Card className="col-span-3 bg-card border-border shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Attività Recenti
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivities.length > 0 ? (
              <div className="divide-y divide-border/50">
                {recentActivities.map((ts, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-all duration-300">
                    <Avatar className="h-8 w-8 border border-border/50">
                      <AvatarImage src={ts.user?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                        {ts.user?.email?.[0].toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">
                        {ts.servizio || "Registrazione Ore"}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium">
                        {ts.durata_minuti} min • {ts.task_display_name || "Generale"}
                      </div>
                    </div>
                    <div className="text-[9px] text-muted-foreground whitespace-nowrap italic">
                      {formatDistanceToNow(parseISO(ts.data_attivita), { addSuffix: true, locale: it })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center border border-border/50">
                  <span className="text-lg opacity-30">📋</span>
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">
                  Nessuna attività registrata
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1">
        <Card className="bg-card border-border shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500" />
          <CardHeader className="px-6 py-4 flex flex-row items-center justify-between border-b border-border/50">
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Clienti & Progetti a Rischio
            </CardTitle>
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 px-3 py-1 font-black text-[10px] tracking-widest">
              MONITORAGGIO ATTIVO
            </Badge>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {(analytics?.alerts || []).filter(a => a.type === "SCOPE" || a.type === "MARGIN").map((alert, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.1 }}
                   className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-red-500/30 transition-all cursor-pointer group"
                   onClick={() => navigate(alert.type === "SCOPE" ? "/commesse" : "/analytics")}
                 >
                   <div className="flex justify-between items-start mb-2">
                      <div className={`p-1.5 rounded-lg ${alert.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {alert.type === "SCOPE" ? <Briefcase className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                      </div>
                      <span className={`text-[10px] font-black tracking-widest ${alert.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                        {alert.value}
                      </span>
                   </div>
                   <h4 className="text-sm font-bold text-foreground mb-1 group-hover:text-red-400 transition-colors">
                     {alert.title.replace("Scope Check: ", "").replace("Margine basso: ", "")}
                   </h4>
                   <p className="text-[10px] text-muted-foreground uppercase opacity-70">
                     {alert.type === "SCOPE" ? "Sforamento Scope" : "Criticità Margine"}
                   </p>
                 </motion.div>
               ))}
               {(analytics?.alerts || []).filter(a => a.type === "SCOPE" || a.type === "MARGIN").length === 0 && (
                 <div className="col-span-full py-8 text-center text-muted-foreground/40 italic text-sm">
                   Nessun rischio critico rilevato oggi.
                 </div>
               )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
