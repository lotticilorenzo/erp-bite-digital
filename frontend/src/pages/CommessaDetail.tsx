import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronLeft,
  Layers,
  Clock,
  Euro,
  FileText,
  TrendingDown,
  TrendingUp,
  Link as LinkIcon,
  Users,
  Briefcase,
  Target,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Lock,
  Unlock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCommessa, useUpdateCommessa } from "@/hooks/useCommesse";
import { ProgettoDialog } from "@/components/progetti/ProgettoDialog";
import { useProgetti } from "@/hooks/useProgetti";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Check, 
  Edit2, 
  Trash2 
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { CommessaReportPDF } from "@/components/commesse/CommessaReportPDF";
import { useTimesheets } from "@/hooks/useTimesheet";
import { Download } from "lucide-react";
import { ClientAvatar } from "@/components/common/ClientAvatar";
import { toast } from "sonner";

export default function CommessaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: commessa, isLoading, error } = useCommessa(id);
  const { data: timesheets = [] } = useTimesheets({ commessa_id: id });
  const { mutate: updateCommessa, isPending: isUpdating } = useUpdateCommessa();
  const { data: progettiCliente } = useProgetti(commessa?.cliente_id);
  const { user } = useAuth();
  
  const [editOreContratto, setEditOreContratto] = useState<string>("0");
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [searchProject, setSearchProject] = useState("");

  useEffect(() => {
    if (commessa) {
      setEditOreContratto(commessa.ore_contratto.toString());
    }
  }, [commessa]);

  const oreReali = useMemo(() => {
    const totalMinutes = timesheets.reduce((acc, ts) => acc + ts.durata_minuti, 0);
    return totalMinutes / 60;
  }, [timesheets]);

  const percentualeScope = useMemo(() => {
    if (!commessa || !commessa.ore_contratto || commessa.ore_contratto <= 0) return 0;
    return (oreReali / commessa.ore_contratto) * 100;
  }, [oreReali, commessa]);

  const canEdit = user?.ruolo === "ADMIN" || user?.ruolo === "PM";

  const handleUpdateScope = () => {
    if (!id) return;
    updateCommessa({ 
      id, 
      data: { ore_contratto: Number(editOreContratto) } 
    }, {
      onSuccess: () => {
        toast.success("Ore contratto aggiornate con successo");
      },
      onError: () => {
        toast.error("Errore durante l'aggiornamento");
      }
    });
  };

  const handleAddProject = async (progettoId: string) => {
    if (!commessa || !id) return;
    
    // Check if project already associated
    if (commessa.righe_progetto?.some(r => r.progetto_id === progettoId)) {
        toast.error("Progetto già associato a questa commessa");
        return;
    }

    try {
        const currentRighe = (commessa.righe_progetto || []).map(r => ({
            progetto_id: r.progetto_id,
            importo_fisso: r.importo_fisso,
            importo_variabile: r.importo_variabile,
            delivery_attesa: r.delivery_attesa
        }));

        updateCommessa({
            id: id,
            data: {
                righe_progetto: [...currentRighe, { progetto_id: progettoId }]
            }
        }, {
            onSuccess: () => {
                toast.success("Progetto associato con successo");
                setIsAddingProject(false);
            },
            onError: () => {
                toast.error("Errore durante l'associazione");
            }
        });
    } catch (e) {
        toast.error("Errore imprevisto");
    }
  };

  const handleRemoveProject = async (progettoId: string) => {
    if (!commessa || !id || !confirm("Sicuro di voler rimuovere il progetto da questa commessa?")) return;
    
    try {
        const newRighe = (commessa.righe_progetto || [])
            .filter(r => r.progetto_id !== progettoId)
            .map(r => ({
                progetto_id: r.progetto_id,
                importo_fisso: r.importo_fisso,
                importo_variabile: r.importo_variabile,
                delivery_attesa: r.delivery_attesa
            }));

        updateCommessa({
            id: id,
            data: { righe_progetto: newRighe }
        }, {
            onSuccess: () => {
                toast.success("Progetto rimosso");
            },
            onError: () => {
                toast.error("Errore durante la rimozione");
            }
        });
    } catch (e) {
        toast.error("Errore imprevisto");
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-card animate-pulse rounded-xl border border-border" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !commessa) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl text-white">Commessa non trovata</h2>
        <Button onClick={() => navigate("/commesse")} variant="link" className="text-purple-400">
          Torna alle commesse
        </Button>
      </div>
    );
  }

  const ROI = commessa.costo_manodopera > 0 
    ? ((commessa.valore_fatturabile! - commessa.costo_manodopera) / commessa.costo_manodopera * 100).toFixed(1)
    : "0";

  // Stato machine: sequenza degli stati e transizione successiva
  const STATI_SEQUENZA = ["APERTA", "PRONTA_CHIUSURA", "CHIUSA", "FATTURATA", "INCASSATA"] as const;
  type CommessaStato = typeof STATI_SEQUENZA[number];

  const STATO_LABELS: Record<string, string> = {
    APERTA: "Aperta",
    PRONTA_CHIUSURA: "Pronta Chiusura",
    CHIUSA: "Chiusa",
    FATTURATA: "Fatturata",
    INCASSATA: "Incassata",
  };

  const STATO_COLORS: Record<string, string> = {
    APERTA: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    PRONTA_CHIUSURA: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    CHIUSA: "text-slate-400 bg-slate-500/10 border-slate-500/20",
    FATTURATA: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    INCASSATA: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };

  const currentStateIndex = STATI_SEQUENZA.indexOf(commessa.stato as CommessaStato);
  const nextState = currentStateIndex < STATI_SEQUENZA.length - 1
    ? STATI_SEQUENZA[currentStateIndex + 1]
    : null;

  const handleAvanzaStato = () => {
    if (!nextState || !id || !canEdit) return;
    updateCommessa(
      { id, data: { stato: nextState } },
      {
        onSuccess: () => toast.success(`Commessa avanzata a: ${STATO_LABELS[nextState]}`),
        onError: () => toast.error("Errore nell'aggiornamento dello stato"),
      }
    );
  };

  const handleRegressoStato = () => {
    const prevState = currentStateIndex > 0 ? STATI_SEQUENZA[currentStateIndex - 1] : null;
    if (!prevState || !id || !canEdit) return;
    if (!confirm(`Sei sicuro di voler tornare a: ${STATO_LABELS[prevState]}?`)) return;
    updateCommessa(
      { id, data: { stato: prevState } },
      {
        onSuccess: () => toast.success(`Commessa retrocessa a: ${STATO_LABELS[prevState]}`),
        onError: () => toast.error("Errore nell'aggiornamento dello stato"),
      }
    );
  };

  const isLocked = ["CHIUSA", "FATTURATA", "INCASSATA"].includes(commessa.stato);

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── BREADCRUMB ─────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        <Link to="/commesse" className="hover:text-white transition-colors">Commesse</Link>
        <ChevronRight className="w-3 h-3" />
        {commessa.cliente && (
          <>
            <Link to={`/clienti/${commessa.cliente_id}`} className="hover:text-white transition-colors">
              {commessa.cliente.ragione_sociale}
            </Link>
            <ChevronRight className="w-3 h-3" />
          </>
        )}
        <span className="text-foreground">
          {format(parseISO(commessa.mese_competenza), "MMMM yyyy", { locale: it })}
        </span>
      </nav>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/commesse")}
            className="text-muted-foreground hover:text-white hover:bg-muted"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Indietro
          </Button>
          <div className="h-4 w-px bg-muted" />
          <div className="flex items-center gap-4">
            <ClientAvatar
              name={commessa.cliente?.ragione_sociale || "C"}
              logoUrl={commessa.cliente?.logo_url}
              size="lg"
              className="rounded-xl border-border"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">
                  Commessa {commessa.cliente?.ragione_sociale}
                </h1>
                {isLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
              </div>
              <p className="text-muted-foreground text-sm">
                Competenza: {format(parseISO(commessa.mese_competenza), "MMMM yyyy", { locale: it })}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PDFDownloadLink
            document={<CommessaReportPDF commessa={commessa} timesheets={timesheets} />}
            fileName={`Report_${commessa.cliente?.ragione_sociale}_${commessa.mese_competenza}.pdf`}
          >
            {({ loading }) => (
              <Button
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
              >
                <Download className="w-4 h-4" />
                {loading ? "Generazione..." : "Prospetto Mensile"}
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* ── STATE MACHINE ──────────────────────────────────── */}
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Stato attuale */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-xl border ${STATO_COLORS[commessa.stato]}`}>
                {commessa.stato === "INCASSATA" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isLocked ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <Unlock className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Stato Corrente</p>
                <p className={`text-lg font-black ${STATO_COLORS[commessa.stato].split(" ")[0]}`}>
                  {STATO_LABELS[commessa.stato]}
                </p>
              </div>
            </div>

            {/* Progressione stati */}
            <div className="flex-1 flex items-center gap-1 overflow-x-auto pb-1">
              {STATI_SEQUENZA.map((stato, idx) => (
                <React.Fragment key={stato}>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                    idx < currentStateIndex
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : idx === currentStateIndex
                        ? `border ${STATO_COLORS[stato]}`
                        : "bg-muted/30 text-muted-foreground border border-transparent"
                  }`}>
                    {idx < currentStateIndex && <CheckCircle2 className="w-3 h-3" />}
                    {STATO_LABELS[stato]}
                  </div>
                  {idx < STATI_SEQUENZA.length - 1 && (
                    <ArrowRight className={`w-3 h-3 shrink-0 ${idx < currentStateIndex ? "text-emerald-400" : "text-muted-foreground/30"}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Azioni stato */}
            {canEdit && (
              <div className="flex items-center gap-2 shrink-0">
                {currentStateIndex > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRegressoStato}
                    className="text-muted-foreground hover:text-white text-[10px] font-black uppercase tracking-widest h-9"
                  >
                    <ChevronLeft className="w-3 h-3 mr-1" /> Indietro
                  </Button>
                )}
                {nextState && (
                  <Button
                    size="sm"
                    onClick={handleAvanzaStato}
                    disabled={isUpdating}
                    className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-[10px] font-black uppercase tracking-widest h-9 gap-2"
                  >
                    Avanza a {STATO_LABELS[nextState]}
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Valore Fatturabile" 
          value={`€${commessa.valore_fatturabile?.toLocaleString() || "0"}`} 
          icon={<Euro className="w-5 h-5 text-purple-400" />}
          trend="Totale Entrate"
        />
        <KPICard 
          title="Costo Manodopera" 
          value={`€${commessa.costo_manodopera?.toLocaleString() || "0"}`} 
          icon={<Users className="w-5 h-5 text-blue-400" />}
          trend={`ROI: ${ROI}%`}
          trendPositive={Number(ROI) > 50}
        />
        <KPICard 
          title="Costi Diretti" 
          value={`€${commessa.costi_diretti?.toLocaleString() || "0"}`} 
          icon={<Briefcase className="w-5 h-5 text-amber-400" />}
          trend="Servizi esterni"
        />
        <KPICard 
          title="Margine Lordo" 
          value={`€${commessa.margine_euro?.toLocaleString() || "0"}`} 
          icon={commessa.margine_percentuale! > 30 ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
          trend={`${commessa.margine_percentuale}% su fatturato`}
          trendPositive={commessa.margine_percentuale! > 15}
          isPremium
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-card border-border text-white">
            <CardHeader className="border-b border-border flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Progetti Coinvolti
              </CardTitle>
              <Dialog open={isAddingProject} onOpenChange={setIsAddingProject}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 rounded-xl bg-white/5 border-white/5 text-[10px] font-black uppercase tracking-widest gap-2">
                    <Plus className="w-3.5 h-3.5" /> Associa Progetto
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card/95 border-white/10 backdrop-blur-xl p-0 overflow-hidden max-w-md">
                  <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-xl font-black italic uppercase italic tracking-tighter">Associa <span className="text-primary not-italic">Progetto</span></DialogTitle>
                  </DialogHeader>
                  <div className="p-6 space-y-4">
                    <div className="relative group">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569] group-focus-within:text-primary transition-colors" />
                       <Input 
                        placeholder="Cerca progetti del cliente..." 
                        value={searchProject}
                        onChange={e => setSearchProject(e.target.value)}
                        className="pl-10 bg-white/5 border-white/5 h-10 rounded-xl"
                       />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                       {progettiCliente?.filter(p => p.nome.toLowerCase().includes(searchProject.toLowerCase())).map(p => {
                         const isAssociated = commessa.righe_progetto?.some(r => r.progetto_id === p.id);
                         return (
                           <div 
                            key={p.id} 
                            onClick={() => !isAssociated && handleAddProject(p.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                              isAssociated ? 'bg-emerald-500/10 border-emerald-500/20 opacity-60' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-primary/40'
                            }`}
                           >
                             <div className="flex flex-col">
                               <span className="text-xs font-bold text-white">{p.nome}</span>
                               <span className="text-[9px] text-[#475569] font-medium uppercase tracking-widest">{p.tipo}</span>
                             </div>
                             {isAssociated ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4 text-primary" />}
                           </div>
                         );
                       })}
                       {progettiCliente?.length === 0 && (
                         <div className="text-center py-8 text-[#475569] text-xs font-medium italic">Nessun progetto trovato per questo cliente</div>
                       )}
                    </div>
                  </div>
                  <DialogFooter className="p-6 pt-0 flex items-center justify-between gap-4">
                    <Button 
                      onClick={() => {
                        setIsAddingProject(false);
                        setIsCreatingProject(true);
                      }}
                      className="bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-[10px] font-black uppercase tracking-widest px-4 h-10 rounded-xl"
                    >
                      <Plus className="w-3.5 h-3.5 mr-2" /> Crea Nuovo Progetto
                    </Button>
                    <Button variant="ghost" onClick={() => setIsAddingProject(false)} className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Chiudi</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <ProgettoDialog 
                open={isCreatingProject} 
                onOpenChange={setIsCreatingProject}
                onSuccess={(newP) => handleAddProject(newP.id)}
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent text-muted-foreground">
                    <TableHead className="pl-6 font-medium uppercase text-[10px] tracking-wider">Progetto</TableHead>
                    <TableHead className="font-medium uppercase text-[10px] tracking-wider text-right">Budget Fisso</TableHead>
                    <TableHead className="font-medium uppercase text-[10px] tracking-wider text-right">Budget Var.</TableHead>
                    <TableHead className="font-medium uppercase text-[10px] tracking-wider text-right">Delivery (h)</TableHead>
                    <TableHead className="pr-6 font-medium uppercase text-[10px] tracking-wider text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commessa.righe_progetto?.map((riga: any) => (
                    <TableRow key={riga.id} className="border-border hover:bg-muted/20 group">
                      <TableCell className="pl-6 font-medium text-foreground">
                        <div 
                          className="hover:text-primary cursor-pointer transition-colors"
                          onClick={() => navigate(`/progetti/${riga.progetto_id}`)}
                        >
                          {riga.progetto?.nome || "Progetto Scollegato"}
                        </div>
                        <div className="text-[10px] text-[#475569] uppercase tracking-widest font-black">{riga.progetto?.tipo}</div>
                      </TableCell>
                      <TableCell className="text-right text-foreground font-black tabular-nums">€{Number(riga.importo_fisso).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-foreground font-medium tabular-nums text-[#475569]">€{Number(riga.importo_variabile).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-purple-400 font-black tabular-nums">{riga.delivery_consuntiva} / {riga.delivery_attesa}h</TableCell>
                      <TableCell className="pr-6 text-right">
                         <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/5 text-[#475569] hover:text-white">
                               <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              onClick={() => handleRemoveProject(riga.progetto_id)}
                              variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-500/10 text-[#475569] hover:text-red-500"
                            >
                               <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!commessa.righe_progetto?.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-[#475569]">Nessun progetto associato</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="bg-card border-border text-white">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Dettaglio Ore Lavorate
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent text-muted-foreground">
                    <TableHead className="pl-6 font-medium uppercase text-[10px] tracking-wider">Data</TableHead>
                    <TableHead className="font-medium uppercase text-[10px] tracking-wider">Risorsa</TableHead>
                    <TableHead className="font-medium uppercase text-[10px] tracking-wider">Servizio</TableHead>
                    <TableHead className="pr-6 font-medium uppercase text-[10px] tracking-wider text-right">Durata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.map((ts) => (
                    <TableRow key={ts.id} className="border-border hover:bg-muted/20">
                      <TableCell className="pl-6 text-foreground">{format(parseISO(ts.data_attivita), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-foreground">{ts.user?.nome} {ts.user?.cognome}</TableCell>
                      <TableCell className="text-foreground">{ts.task_display_name || ts.servizio || "-"}</TableCell>
                      <TableCell className="pr-6 text-right text-purple-400 font-semibold">
                        {Math.floor(ts.durata_minuti / 60)}h {ts.durata_minuti % 60}m
                      </TableCell>
                    </TableRow>
                  ))}
                  {!timesheets.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-[#475569]">Nessun timesheet associato</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border text-white overflow-hidden">
            <div className={`h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500`} />
            <CardHeader>
              <CardTitle className="text-lg font-medium">Informazioni Fatturazione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {commessa.fattura_id ? (
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Fattura N.</span>
                    <span className="text-sm font-bold text-white">{commessa.fattura_numero}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Data Emissione</span>
                    <span className="text-sm text-foreground">{commessa.fattura_data ? format(parseISO(commessa.fattura_data), "dd/MM/yyyy") : "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Importo</span>
                    <span className="text-sm text-emerald-400 font-bold">€{commessa.fattura_importo?.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-blue-500/10">
                    <Badge className="w-full justify-center bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                      {commessa.fattura_stato || "STATO SCONOSCIUTO"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-4 border-2 border-dashed border-border rounded-xl">
                  <FileText className="w-8 h-8 text-[#1e293b] mx-auto" />
                  <p className="text-xs text-muted-foreground">Nessuna fattura collegata.</p>
                  <Button size="sm" variant="outline" className="w-full bg-primary/10 text-purple-400 border-purple-500/20 hover:bg-primary/20">
                    Collega ora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border text-white">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" />
                Monitoraggio Scope
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground uppercase tracking-wider font-bold">Consumo Ore</span>
                  <span className={`font-black ${percentualeScope >= 100 ? 'text-red-400' : 'text-purple-400'}`}>
                    {oreReali.toFixed(1)} / {commessa.ore_contratto}h
                  </span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden border border-white/5 p-[1px]">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      percentualeScope >= 100 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                      percentualeScope >= 80 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 
                      'bg-gradient-to-r from-purple-500 to-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, percentualeScope)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {percentualeScope.toFixed(1)}% dello scope utilizzato
                  </span>
                  {percentualeScope >= 100 && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 animate-pulse">
                      SCOPE SUPERATO
                    </Badge>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-2">
                  Ore Incluse nel Contratto
                </label>
                <div className="flex gap-2">
                  <Input 
                     type="number" 
                     disabled={!canEdit}
                     value={editOreContratto}
                     onChange={(e) => setEditOreContratto(e.target.value)}
                     className="bg-muted border-border text-white text-sm h-9 focus-visible:ring-purple-500/50"
                  />
                  {canEdit && commessa.ore_contratto !== Number(editOreContratto) && (
                    <Button 
                      size="sm" 
                      onClick={handleUpdateScope}
                      disabled={isUpdating}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-9 px-4 rounded-lg"
                    >
                      {isUpdating ? "..." : "Salva"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border text-white overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Note Interne</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap italic">
                {commessa.note || "Nessuna nota presente."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, trend, trendPositive = true, isPremium = false }: any) {
  return (
    <Card className={`
      bg-card border-border text-foreground transition-all hover:scale-[1.02]
      ${isPremium ? "shadow-[0_0_20px_hsl(var(--primary)/0.2)] border-purple-500/30" : ""}
    `}>
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="p-2 rounded-lg bg-muted/50 border border-border">
            {icon}
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trendPositive ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
            {trend}
          </span>
        </div>
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
