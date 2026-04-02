import { 
  Zap, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTasks } from "@/hooks/useTasks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudio } from "@/hooks/useStudio";

export default function StudioHome() {
  const { data, isLoading } = useTasks();
  const { timer } = useStudio();

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl bg-[#1e293b]/20" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-3xl bg-[#1e293b]/20" />
      </div>
    );
  }

  const stats = [
    { title: "Task Totali", value: data?.total || 0, icon: Zap, color: "text-primary" },
    { title: "In Corso", value: data?.tasks.filter(t => t.state_id === "process").length || 0, icon: Clock, color: "text-blue-400" },
    { title: "Scadenze Oggi", value: 0, icon: CalendarIcon, color: "text-yellow-400" },
    { title: "Completate", value: data?.tasks.filter(t => t.state_id === "closed").length || 0, icon: CheckCircle2, color: "text-emerald-400" },
  ];

  return (
    <div className="p-8 pb-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            Benvenuto in <span className="text-primary italic">Studio OS</span>
          </h1>
          <p className="text-[#64748b] font-medium">Hai {data?.total} attività che richiedono la tua attenzione.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="lg" className="rounded-xl font-black uppercase tracking-widest px-8 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:scale-105 transition-all">
            <Plus className="h-5 w-5 mr-2" />
            Nuova Task
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-[#0f172a]/40 border-[#1e293b]/50 backdrop-blur-xl group hover:border-primary/50 transition-all duration-500 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-[#475569]">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white group-hover:scale-110 transition-transform origin-left duration-500">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#0f172a]/40 border-[#1e293b]/50 backdrop-blur-xl rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-[#1e293b]/50 px-8 py-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Task Recenti
                </CardTitle>
                <Button variant="link" className="text-xs font-black text-primary uppercase tracking-widest">
                  Vedi Tutte
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[#1e293b]/30">
                {data?.tasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="p-6 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer group">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-[#1e293b]/50 border border-[#334155]/50 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold text-white truncate">{task.title}</h4>
                        <Badge variant="outline" className={`text-[10px] font-black uppercase bg-transparent border-[#1e293b] ${
                          task.state_id === 'closed' ? 'text-emerald-400 border-emerald-400/20' : 'text-primary border-primary/20'
                        }`}>
                          {task.state_id}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#64748b] truncate">Folder ID: {task.folder_id}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {timer.active_task_id === task.id && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 animate-pulse">
                          <Clock className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-black text-primary">RECORDING</span>
                        </div>
                      )}
                      <ChevronRight className="h-4 w-4 text-[#1e293b] group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 backdrop-blur-xl rounded-3xl overflow-hidden p-6 relative group">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/30 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white leading-tight">Focus del Giorno</h3>
                <p className="text-xs text-[#94a3b8] mt-1 font-medium italic">"Non contare i giorni, fa che i giorni contino."</p>
              </div>
              <div className="pt-2">
                <Button className="w-full bg-white text-black hover:bg-[#f1f5f9] rounded-xl font-black uppercase tracking-widest text-xs h-10">
                  Ottimizza Workflow
                </Button>
              </div>
            </div>
          </Card>

          <Card className="bg-[#0f172a]/40 border-[#1e293b]/50 backdrop-blur-xl rounded-3xl p-6">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-[#475569] mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Attività Recenti
            </CardTitle>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 relative pb-4 after:absolute after:left-[7px] after:top-[22px] after:bottom-0 after:w-[2px] after:bg-[#1e293b]/30 last:after:hidden last:pb-0">
                  <div className="h-4 w-4 mt-1 rounded-full bg-[#1e293b] shrink-0 border-2 border-[#000]" />
                  <div>
                    <p className="text-xs text-white font-bold">Task completata: <span className="text-primary">Landing Page Fix</span></p>
                    <span className="text-[10px] text-[#475569] font-medium">2 ore fa</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChevronRight(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
