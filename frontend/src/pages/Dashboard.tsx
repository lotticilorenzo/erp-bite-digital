import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Zap, Users, Briefcase, Timer } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();

  const stats = [
    { label: "Clienti Attivi", value: "12", icon: Users, color: "text-blue-500" },
    { label: "Progetti in Corso", value: "8", icon: Briefcase, color: "text-purple-500" },
    { label: "Ore Mese", value: "124h", icon: Timer, color: "text-green-500" },
    { label: "Fatturato Mese", value: "€ 12.400", icon: Zap, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Benvenuto, {user?.nome}. Ecco la panoramica dello studio.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-colors group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color} group-hover:scale-110 transition-transform`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <span className="text-green-500">↑ 12%</span> rispetto al mese scorso
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Prossime Scadenze</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-border/50">
                  <div className="w-1.5 h-10 rounded-full bg-primary/50" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Consegna Progetto X</div>
                    <div className="text-xs text-muted-foreground">Scade in 2 giorni</div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 text-xs">Dettagli</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3 bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Attività Recenti</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-sm text-center py-12 text-muted-foreground uppercase tracking-widest font-medium">
               Nessun log disponibile
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
