import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Users, Briefcase, Timer } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";

export default function DashboardPage() {
  const { data: analytics, isLoading } = useAnalytics();

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
        <Card className="col-span-4 bg-card border-border shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Prossime Scadenze
              </CardTitle>
              <Button size="sm" variant="ghost" className="text-[10px] uppercase font-bold tracking-widest text-primary hover:bg-primary/10">Vedi tutte</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-all duration-300 group cursor-pointer relative">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-500" />
                  <div className="flex-1 min-w-0 pl-2">
                    <div className="text-sm font-bold text-foreground truncate transition-colors">Consegna Progetto X</div>
                    <div className="text-[11px] text-muted-foreground font-medium">Scade tra 2 giorni • Cliente ABC</div>
                  </div>
                  <div className="text-[10px] font-black text-primary/40 transition-colors pr-2">
                    #PROJ-0{j}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-card border-border shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
            <CardTitle className="text-base font-bold text-foreground">Attività Recenti</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-12">
             <div className="flex flex-col items-center justify-center text-center gap-3">
               <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center border border-border/50 group">
                  <span className="text-xl opacity-30 group-hover:opacity-100 transition-opacity">📋</span>
               </div>
               <div className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-60">
                 Nessun log disponibile
               </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
