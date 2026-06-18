import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
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
  MessageSquare,
  Users,
  AlertCircle,
  Zap,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProgetto } from "@/hooks/useProgetti";
import { useTasks } from "@/hooks/useTasks";
import { useStudio } from "@/hooks/useStudio";
import { format, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { GanttChart } from "@/components/gantt/GanttChart";
import { StudioTaskModal } from "@/components/studio/StudioTaskModal";
import ChatProgetto from "@/components/chat/ChatProgetto";
import { useCommesse, useUpdateCommessa, useCreateCommessa } from "@/hooks/useCommesse";
import { toast } from "sonner";
import { CommessaSelectionDialog } from "@/components/progetti/CommessaSelectionDialog";
import { TemplateSelectionDialog } from "@/components/progetti/TemplateSelectionDialog";
import { ProgettoDialog } from "@/components/progetti/ProgettoDialog";

export default function ProgettoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: progetto, isLoading: isLoadingProj, error } = useProgetto(id);
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks({ progetto_id: id, parent_only: false });
  const { selectTask } = useStudio();
  const [activeTab, setActiveTab] = useState("overview");
  const currentMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const { data: allCommesse } = useCommesse({ 
    cliente_id: progetto?.cliente_id
  });
  
  const updateCommessa = useUpdateCommessa();
  const createCommessa = useCreateCommessa();
  const [isCommessaDialogOpen, setIsCommessaDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any>(null);

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

  const commesseCorrelate = allCommesse?.filter(c => 
    c.righe_progetto?.some(r => r.progetto_id === id)
  ) || [];
  
  const commessaAttiva = allCommesse?.find(c => 
    format(new Date(c.mese_competenza), "yyyy-MM-dd") === currentMonth
  );
  const isLinked = commessaAttiva?.righe_progetto?.some(r => r.progetto_id === id);

  const handleLinkToCommessa = () => setIsCommessaDialogOpen(true);

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 h-screen flex flex-col overflow-hidden">
      {/* ── BREADCRUMB ─────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground font-medium shrink-0">
        <Link to="/progetti" className="hover:text-white transition-colors">Progetti</Link>
        <ChevronRight className="w-3 h-3" />
        {progetto.cliente && (
          <>
            <Link to={`/clienti/${progetto.cliente_id}`} className="hover:text-white transition-colors">
              {progetto.cliente.ragione_sociale}
            </Link>
            <ChevronRight className="w-3 h-3" />
          </>
        )}
        <span className="text-foreground">{progetto.nome}</span>
      </nav>

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
          <Button
            variant="ghost"
            onClick={() => setIsEditDialogOpen(true)}
            className="text-muted-foreground hover:text-white hover:bg-muted rounded-xl"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Modifica
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDuplicateData({
                ...progetto,
                nome: `${progetto.nome} (Copia)`,
                id: undefined
              });
              setIsDuplicateDialogOpen(true);
            }}
            className="text-muted-foreground hover:text-white hover:bg-muted rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Duplica
          </Button>
          <div className="h-4 w-px bg-muted" />
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tighter">{progetto.nome}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] font-black uppercase">
                {progetto.tipo}
              </Badge>
              <Badge variant="outline" className={progetto.stato === "ATTIVO" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-black uppercase" : "bg-muted/10 text-muted-foreground border-border/20 text-[10px] font-black uppercase"}>
                {progetto.stato}
              </Badge>
              {progetto.delivery_attesa > 0 && (!progetto.team || progetto.team.length === 0) && (
                <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/50 text-[10px] font-black uppercase animate-pulse flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Team Mancante
                </Badge>
              )}
              {isLinked && (
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] font-black uppercase flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Fatturazione Attiva
                </Badge>
              )}
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
                  label="Valore Fisso" 
                  value={`€${progetto.importo_fisso.toLocaleString()}`} 
                  icon={<Euro className="w-4 h-4 text-emerald-400" />} 
                />
                <StatSmallCard 
                  label="Valore Var." 
                  value={`€${progetto.importo_variabile.toLocaleString()}`} 
                  icon={<Target className="w-4 h-4 text-blue-400" />} 
                />
                <StatSmallCard 
                  label="Delivery Attesa" 
                  value={`${progetto.delivery_attesa}h`} 
                  icon={<Clock className="w-4 h-4 text-amber-400" />} 
                />
                <StatSmallCard 
                  label="Data Inizio" 
                  value={progetto.data_inizio ? format(new Date(progetto.data_inizio), "dd MMM yyyy", { locale: it }) : "N/D"} 
                  icon={<Calendar className="w-4 h-4 text-purple-400" />} 
                />
                <StatSmallCard 
                  label="Data Fine" 
                  value={progetto.data_fine ? format(new Date(progetto.data_fine), "dd MMM yyyy", { locale: it }) : "N/D"} 
                  icon={<Calendar className="w-4 h-4 text-orange-400" />} 
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
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
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
                    <Users className="w-4 h-4 text-blue-400" />
                    Team Assegnato
                  </CardTitle>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] font-black uppercase">
                    {progetto.team?.length || 0} MEMBRI
                  </Badge>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {progetto.team && progetto.team.length > 0 ? (
                      progetto.team.map((membro) => (
                        <div key={membro.id} className="space-y-3 p-4 rounded-2xl bg-muted/10 border border-border/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 text-xs font-bold text-primary">
                                {membro.user?.nome?.[0]}{membro.user?.cognome?.[0]}
                              </div>
                              <div>
                                <p className="font-bold text-white text-sm">{membro.user?.nome} {membro.user?.cognome}</p>
                                <p className="text-[10px] font-medium text-muted-foreground uppercase">{membro.ruolo_progetto || "Collaboratore"}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-white">{membro.ore_previste}h</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ORE PREVISTE</p>
                            </div>
                          </div>
                          {membro.note && (
                            <div className="pt-3 border-t border-border/20">
                              <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                                <span className="font-bold text-primary/70 not-italic uppercase mr-1">Compiti:</span>
                                {membro.note}
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground italic text-sm">
                        Nessun membro assegnato al team.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border text-white rounded-3xl overflow-hidden shadow-xl">
                <CardHeader className="border-b border-border/50 py-5 bg-muted/20 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-black italic flex items-center gap-2 uppercase tracking-tighter">
                    <Layers className="w-4 h-4 text-purple-400" />
                    Commesse Correlate
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setIsTemplateDialogOpen(true)}
                      className="h-8 text-primary hover:bg-primary/10 rounded-xl text-[10px] font-black uppercase tracking-widest"
                    >
                      <Zap className="w-3 h-3 mr-1" /> Template
                    </Button>
                    {!isLinked && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleLinkToCommessa}
                        disabled={updateCommessa.isPending || createCommessa.isPending}
                        className="h-8 bg-primary/10 text-purple-400 border-purple-500/20 hover:bg-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                        <Plus className="w-3 h-3 mr-1" /> 
                        {commessaAttiva ? `Aggiungi a Commessa ${format(new Date(currentMonth), "MMM")}` : `Crea Commessa ${format(new Date(currentMonth), "MMM")}`}
                      </Button>
                    )}
                    {isLinked && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => commessaAttiva && navigate(`/commesse/${commessaAttiva.id}`)}
                        className="h-8 text-emerald-400 text-[10px] font-black uppercase tracking-widest"
                      >
                        In Commessa Attiva <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {commesseCorrelate.length > 0 ? (
                    <div className="space-y-3">
                      {commesseCorrelate.map(c => (
                        <div
                          key={c.id}
                          className="p-4 rounded-2xl bg-card/5 border border-border/50 cursor-pointer hover:bg-card/10 transition-colors flex items-center justify-between"
                          onClick={() => navigate(`/commesse/${c.id}`)}
                        >
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                              {format(new Date(c.mese_competenza), "MMMM yyyy", { locale: it })}
                            </span>
                            <p className="text-sm font-black text-white mt-1">€{(c.valore_fatturabile || 0).toLocaleString()}</p>
                          </div>
                          <Badge className={c.stato === "CHIUSA" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-black" : "bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] font-black"}>
                            {c.stato}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl bg-muted/5">
                      <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Layers className="w-6 h-6 text-[#475569]" />
                      </div>
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-tight">Nessuna commessa registrata</p>
                      <p className="text-[10px] text-[#475569] mt-1 font-black uppercase tracking-widest">Inizia a generare commesse per questo progetto</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              <Card className="bg-card border-border text-white rounded-3xl overflow-hidden shadow-xl border-t-4 border-t-primary/50 relative">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-black uppercase tracking-tighter italic text-primary">Analisi Redditività</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Ore Previste vs Reali */}
                  {(() => {
                    const oreUsate = tasks.reduce((acc, t: any) => acc + (t.tempo_trascorso_minuti || 0), 0) / 60;
                    const oreMax = progetto.delivery_attesa || 0;
                    const pct = oreMax > 0 ? Math.min(100, Math.round((oreUsate / oreMax) * 100)) : 0;
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className="text-[#475569]">Capacità Utilizzata</span>
                          <span className="text-white">{oreUsate} / {oreMax || "N/D"}h</span>
                        </div>
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden p-0.5 border border-white/5">
                          <div
                            className={`h-full bg-gradient-to-r rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-700 ${pct > 90 ? "from-red-500 to-rose-500" : pct > 70 ? "from-amber-500 to-yellow-500" : "from-purple-500 to-indigo-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Calcolo Costo Labor Previsto */}
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <Euro className="w-3.5 h-3.5 text-primary" />
                       <h4 className="text-[10px] font-black uppercase tracking-widest">Previsione Costi Team</h4>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-black text-white tracking-tighter">
                          €{(progetto.team?.reduce((acc, m) => acc + (m.ore_previste * (m.user?.costo_orario || 0)), 0) || 0).toLocaleString()}
                        </p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Costo Manodopera Previsto</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-400 tracking-tighter">
                          €{(progetto.importo_fisso + progetto.importo_variabile).toLocaleString()}
                        </p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Valore Progetto</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-primary/10 flex justify-between items-center">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase">Margine Previsto</span>
                       <span className="text-xs font-black text-emerald-400">
                         {(() => {
                           const revenue = progetto.importo_fisso + progetto.importo_variabile;
                           const cost = progetto.team?.reduce((acc, m) => acc + (m.ore_previste * (m.user?.costo_orario || 0)), 0) || 0;
                           if (revenue === 0) return "0%";
                           return `${Math.round(((revenue - cost) / revenue) * 100)}%`;
                         })()}
                       </span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Stato Margine</span>
                      {(() => {
                        const revenue = progetto.importo_fisso + progetto.importo_variabile;
                        const cost = progetto.team?.reduce((acc: number, m: any) => acc + (m.ore_previste * (m.user?.costo_orario || 0)), 0) || 0;
                        const pct = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
                        if (pct > 30) return <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[9px] font-black">OTTIMALE</Badge>;
                        if (pct > 0) return <Badge className="bg-amber-500/20 text-amber-400 border-none text-[9px] font-black">BASSO</Badge>;
                        return <Badge className="bg-red-500/20 text-red-400 border-none text-[9px] font-black">NEGATIVO</Badge>;
                      })()}
                    </div>
                  </div>
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

      <CommessaSelectionDialog 
        progetto={progetto}
        open={isCommessaDialogOpen}
        onOpenChange={setIsCommessaDialogOpen}
      />

      <TemplateSelectionDialog
        progettoId={id!}
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
      />

      <ProgettoDialog 
        progetto={progetto}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <ProgettoDialog 
        progetto={duplicateData}
        open={isDuplicateDialogOpen}
        onOpenChange={(open) => {
          setIsDuplicateDialogOpen(open);
          if (!open) setDuplicateData(null);
        }}
      />
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
