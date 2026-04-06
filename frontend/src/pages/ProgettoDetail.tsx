import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ChevronLeft, 
  Calendar, 
  Building2, 
  Layers, 
  Target, 
  Clock,
  Euro,
  FileText,
  Plus,
  ExternalLink,
  Maximize2,
  LayoutDashboard,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProgetto } from "@/hooks/useProgetti";
import { useTasks } from "@/hooks/useTasks";
import { useStudio } from "@/hooks/useStudio";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { GanttChart } from "@/components/gantt/GanttChart";
import { StudioTaskModal } from "@/components/studio/StudioTaskModal";
import { ChatProgetto } from "@/components/chat/ChatProgetto";

export default function ProgettoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: progetto, isLoading: isLoadingProj, error } = useProgetto(id);
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks({ progetto_id: id, parent_only: false });
  const { selectTask } = useStudio();
  const [activeTab, setActiveTab] = useState("overview");

  if (isLoadingProj) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="h-64 bg-card animate-pulse rounded-xl border border-border" />
            <div className="h-96 bg-card animate-pulse rounded-xl border border-border" />
          </div>
          <div className="h-96 bg-card animate-pulse rounded-xl border border-border" />
        </div>
      </div>
    );
  }

  if (error || !progetto) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl text-white">Progetto non trovato</h2>
        <Button onClick={() => navigate("/progetti")} variant="link" className="text-purple-400">
          Torna ai progetti
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 h-screen flex flex-col overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/progetti")} 
            className="text-muted-foreground hover:text-white hover:bg-muted rounded-xl"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Indietro
          </Button>
          <div className="h-4 w-px bg-muted" />
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tighter">{progetto.nome}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] font-black uppercase">
                {progetto.tipo}
              </Badge>
              <Badge variant="outline" className={progetto.stato === "ATTIVO" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-black uppercase" : "bg-slate-500/10 text-slate-400 border-slate-500/20 text-[10px] font-black uppercase"}>
                {progetto.stato}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="bg-muted/20 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[500px]">
             <TabsList className="bg-transparent grid grid-cols-3 p-0 h-10">
                <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                   <LayoutDashboard className="w-3.5 h-3.5 mr-2" />
                   Panoramica
                </TabsTrigger>
                <TabsTrigger value="gantt" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                   <Maximize2 className="w-3.5 h-3.5 mr-2" />
                   Gantt / Timeline
                </TabsTrigger>
                <TabsTrigger value="chat" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                   <MessageSquare className="w-3.5 h-3.5 mr-2" />
                   Chat Progetto
                </TabsTrigger>
             </TabsList>
          </Tabs>
        </div>
      </div>

      <Tabs value={activeTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="hidden">
           <TabsList autoFocus />
        </div>

        <TabsContent value="overview" className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatSmallCard 
                  label="Budget Fisso" 
                  value={`€${progetto.importo_fisso.toLocaleString()}`} 
                  icon={<Euro className="w-4 h-4 text-emerald-400" />} 
                />
                <StatSmallCard 
                  label="Budget Var." 
                  value={`€${progetto.importo_variabile.toLocaleString()}`} 
                  icon={<Target className="w-4 h-4 text-blue-400" />} 
                />
                <StatSmallCard 
                  label="Delivery Attesa" 
                  value={`${progetto.delivery_attesa}h`} 
                  icon={<Clock className="w-4 h-4 text-amber-400" />} 
                />
                <StatSmallCard 
                  label="Data Creazione" 
                  value={format(new Date(progetto.created_at), "dd MMM yyyy", { locale: it })} 
                  icon={<Calendar className="w-4 h-4 text-purple-400" />} 
                />
              </div>

              <Card className="bg-card border-border text-white rounded-3xl overflow-hidden shadow-xl">
                <CardHeader className="border-b border-border/50 py-5 bg-muted/20">
                  <CardTitle className="text-lg font-black italic flex items-center gap-2 uppercase tracking-tighter">
                    <FileText className="w-4 h-4 text-purple-400" />
                    Dettagli Progetto
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-black text-[#475569] mb-3 uppercase tracking-widest">Cliente Associato</h4>
                      <div className="flex items-center gap-3 p-5 rounded-2xl bg-muted/10 border border-border/50 hover:border-primary/30 transition-all group">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform">
                          <Building2 className="w-6 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-black text-white uppercase tracking-tight">{progetto.cliente?.ragione_sociale}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">{progetto.cliente?.email || "Nessuna email"}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="ml-auto text-muted-foreground hover:text-white" 
                          onClick={() => navigate(`/clienti/${progetto.cliente_id}`)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black text-[#475569] mb-3 uppercase tracking-widest">Note Operative</h4>
                      <div className="p-5 rounded-2xl bg-muted/10 border border-border/50">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {progetto.note || "Nessuna nota aggiuntiva per questo progetto."}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border text-white rounded-3xl overflow-hidden shadow-xl">
                <CardHeader className="border-b border-border/50 py-5 bg-muted/20 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-black italic flex items-center gap-2 uppercase tracking-tighter">
                    <Layers className="w-4 h-4 text-purple-400" />
                    Commesse Correlate
                  </CardTitle>
                  <Button size="sm" variant="outline" className="h-8 bg-primary/10 text-purple-400 border-purple-500/20 hover:bg-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    <Plus className="w-3 h-3 mr-1" /> Nuova Commessa
                  </Button>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl bg-muted/5">
                    <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Layers className="w-6 h-6 text-[#475569]" />
                    </div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-tight">Nessuna commessa registrata</p>
                    <p className="text-[10px] text-[#475569] mt-1 font-black uppercase tracking-widest">Inizia a generare commesse per questo progetto</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              <Card className="bg-card border-border text-white rounded-3xl overflow-hidden shadow-xl border-t-4 border-t-primary/50 relative">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Salute Avanzamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-[#475569]">Capacità Utilizzata</span>
                      <span className="text-white">0 / {progetto.delivery_attesa}h</span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden p-0.5 border border-white/5">
                      <div className="w-0 h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#475569]">ClickUp List</span>
                      <Badge variant="outline" className="bg-muted text-foreground border-border text-[8px] font-black uppercase">
                         {progetto.clickup_list_id || "Sincronizzato"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Efficienza Team</span>
                      <span className="text-xs font-black text-emerald-400 tracking-tighter">ECCELLENTE</span>
                    </div>
                  </div>
                  
                  <Button className="w-full bg-primary hover:scale-[1.02] transition-transform text-white rounded-2xl h-12 font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                    Sincronizza Progetto
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="gantt" className="flex-1 overflow-hidden">
          {isLoadingTasks ? (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
               <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
               <p className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Genesi del piano temporale...</p>
            </div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto", maxHeight: "600px", overflowY: "auto" }}>
               <GanttChart 
                 tasks={tasks} 
                 period="month" 
                 onTaskClick={(tid) => selectTask(tid)} 
               />
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat" className="flex-1 overflow-hidden">
           <ChatProgetto 
            progettoId={id!} 
            teamMembers={progetto.team || []} 
           />
        </TabsContent>
      </Tabs>

      <StudioTaskModal />
    </div>
  );
}

function StatSmallCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/50 p-5 rounded-3xl space-y-2 hover:border-primary/50 transition-all group shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-[#475569] font-black">{label}</span>
        <div className="p-1.5 rounded-lg bg-muted/20 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <p className="text-xl font-black text-white group-hover:text-primary transition-colors tracking-tighter">{value}</p>
    </div>
  );
}
