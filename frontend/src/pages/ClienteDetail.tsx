import { useParams, useNavigate } from "react-router-dom";
import { 
  ChevronLeft, 
  ShieldCheck, 
  TrendingUp, 
  CreditCard, 
  History,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Download,
  FileText,
  Eye,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCliente, useClientHealthScore } from "@/hooks/useClienti";
import { useCommesse } from "@/hooks/useCommesse";
import { ClientAvatar } from "@/components/common/ClientAvatar";
import { format, parseISO, startOfYear, endOfYear, subMonths, subYears } from "date-fns";
import { it } from "date-fns/locale";
import { motion } from "framer-motion";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import { ClienteReportPDF } from "@/components/reports/ClienteReportPDF";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { usePreventivi, usePreventivoMutations } from "@/hooks/usePreventivi";
import { PreventiviTable } from "@/components/preventivi/PreventiviTable";
import { PreventivoModal } from "@/components/preventivi/PreventivoModal";
import type { Preventivo, PreventivoStatus } from "@/types/preventivi";
import { toast } from "sonner";

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cliente, isLoading: loadingC } = useCliente(id);
  const { data: health, isLoading: loadingH } = useClientHealthScore(id);
  const { data: commesse = [] } = useCommesse({ cliente_id: id });
  const { data: preventivi = [] } = usePreventivi({ cliente_id: id });
  const { updatePreventivo, deletePreventivo, convertToCommessa } = usePreventivoMutations();

  const [periodo, setPeriodo] = useState<"YTD" | "PREV_YEAR" | "6M" | "ALL">("YTD");
  const [isPModalOpen, setIsPModalOpen] = useState(false);
  const [selectedP, setSelectedP] = useState<Preventivo | undefined>();

  const filteredCommesse = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (periodo) {
      case "YTD":
        start = startOfYear(now);
        break;
      case "PREV_YEAR":
        start = startOfYear(subYears(now, 1));
        end = endOfYear(subYears(now, 1));
        break;
      case "6M":
        start = subMonths(now, 6);
        break;
      default:
        start = new Date(0);
    }

    return commesse.filter(c => {
      const d = parseISO(c.mese_competenza);
      return d >= start && d <= end;
    });
  }, [commesse, periodo]);

  const handleEditP = (p: Preventivo) => {
    setSelectedP(p);
    setIsPModalOpen(true);
  };

  const handleStatusChangeP = async (pId: string, status: PreventivoStatus) => {
    await updatePreventivo.mutateAsync({ id: pId, payload: { stato: status } });
    toast.success("Stato preventivo aggiornato");
  };

  const handleDeleteP = async (pId: string) => {
    if (confirm("Sei sicuro di voler eliminare questo preventivo?")) {
      await deletePreventivo.mutateAsync(pId);
      toast.success("Preventivo eliminato");
    }
  };

  const handleConvertP = async (pId: string) => {
    try {
      const result = await convertToCommessa.mutateAsync(pId);
      toast.success(result.message);
      navigate(`/commesse/${result.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Errore durante la conversione");
    }
  };

  if (loadingC || loadingH) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!cliente) return <div className="p-8">Cliente non trovato</div>;

  const score = health?.score || 0;
  const status = score >= 70 ? "ECCELLENTE" : score >= 40 ? "ATTENZIONE" : "CRITICO";
  const statusColor = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
  const statusBg = score >= 70 ? "bg-emerald-500/10 border-emerald-500/20" : score >= 40 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

  const periodoLabel = {
    YTD: `Anno Corrente (${format(new Date(), "yyyy")})`,
    PREV_YEAR: `Anno Precedente (${format(subYears(new Date(), 1), "yyyy")})`,
    "6M": "Ultimi 6 Mesi",
    ALL: "Tutto lo Storico"
  }[periodo];

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/clienti")} 
            className="text-muted-foreground hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Indietro
          </Button>
          <div className="h-4 w-px bg-muted" />
          <div className="flex items-center gap-4">
            <ClientAvatar 
              name={cliente.ragione_sociale} 
              logoUrl={cliente.logo_url} 
              size="lg" 
              className="rounded-xl"
            />
            <div>
              <h1 className="text-2xl font-bold text-white">{cliente.ragione_sociale}</h1>
              <p className="text-muted-foreground text-sm">Analisi Salute & Performance</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="bg-card border-border overflow-hidden relative group">
          <div className={`absolute top-0 left-0 w-full h-1 ${score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} />
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center justify-between">
              Client Health Score
              <ShieldCheck className={`w-5 h-5 ${statusColor}`} />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-8">
            <div className="relative w-48 h-48 mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96" cy="96" r="88"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-muted"
                />
                <motion.circle
                  cx="96" cy="96" r="88"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeDasharray={553}
                  initial={{ strokeDashoffset: 553 }}
                  animate={{ strokeDashoffset: 553 - (553 * score) / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className={statusColor}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-white">{score}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Punti / 100</span>
              </div>
            </div>
            <div className={`px-4 py-1.5 rounded-full border ${statusBg} ${statusColor} text-[10px] font-black tracking-widest`}>
              STATO: {status}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <FactorCard 
            title="Marginalità (40%)"
            score={health?.factors.margine || 0}
            detail={`${health?.details.avg_margin_pct}% media ultimi 3 mesi`}
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          />
          <FactorCard 
            title="Puntualità Pagamenti (30%)"
            score={health?.factors.pagamenti || 0}
            detail={`${health?.details.invoices_paid} fatture pagate (12m)`}
            icon={<CreditCard className="w-4 h-4 text-blue-400" />}
          />
          <FactorCard 
            title="Sforamento Scope (20%)"
            score={health?.factors.revisioni || 0}
            detail={`${health?.details.avg_scope_creep} creep medio (12m)`}
            icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          />
          <FactorCard 
            title="Longevità Rapporto (10%)"
            score={health?.factors.longevita || 0}
            detail={`${health?.details.days_with_us} giorni con noi`}
            icon={<CheckCircle2 className="w-4 h-4 text-purple-400" />}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-medium flex items-center gap-2 text-white">
                <History className="w-4 h-4 text-purple-400" />
                Storico Commesse
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs bg-muted/50 border-border">
                    <Calendar className="w-3 h-3 mr-2" />
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-white">
                    <SelectItem value="YTD">Anno Corrente</SelectItem>
                    <SelectItem value="PREV_YEAR">Anno Precedente</SelectItem>
                    <SelectItem value="6M">Ultimi 6 Mesi</SelectItem>
                    <SelectItem value="ALL">Tutto lo Storico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-muted/50 border-b border-border">
                     <tr>
                       <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Mese</th>
                       <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Margine %</th>
                       <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Scope</th>
                       <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Fatturato</th>
                     </tr>
                   </thead>
                   <tbody>
                     {commesse.map((c) => {
                        const creep = c.ore_contratto > 0 ? (c.ore_reali / c.ore_contratto) : 1;
                        return (
                          <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm font-medium text-white">
                                  {format(parseISO(c.mese_competenza), "MMM yyyy", { locale: it })}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`text-sm font-bold ${c.margine_percentuale! > 30 ? 'text-emerald-400' : c.margine_percentuale! > 15 ? 'text-amber-400' : 'text-red-400'}`}>
                                {c.margine_percentuale}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <div className="flex flex-col items-end gap-1">
                                 <span className={`text-[10px] font-black ${creep > 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                                   {creep.toFixed(2)}x
                                 </span>
                                 <div className="w-16 h-1 bg-muted rounded-full">
                                   <div 
                                      className={`h-full ${creep > 1.2 ? 'bg-red-500' : creep > 1 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${Math.min(100, creep * 100)}%` }}
                                   />
                                 </div>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-black text-white">€{c.valore_fatturabile?.toLocaleString()}</span>
                            </td>
                          </tr>
                        );
                     })}
                   </tbody>
                 </table>
               </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2 text-white">
                <FileText className="w-4 h-4 text-blue-400" />
                Preventivi & Offerte
              </CardTitle>
              <Button size="sm" variant="outline" className="h-8 border-border" onClick={() => { setSelectedP(undefined); setIsPModalOpen(true); }}>
                <Plus className="w-3 h-3 mr-1" /> Nuovo
              </Button>
            </CardHeader>
            <CardContent>
              <PreventiviTable 
                data={preventivi} 
                onEdit={handleEditP}
                onDelete={handleDeleteP}
                onStatusChange={handleStatusChangeP}
                onConvert={handleConvertP}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="bg-card border-border shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500" />
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2 text-white">
                <FileText className="w-4 h-4 text-purple-400" />
                Reporting & Consolidati
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Report Selezionato</p>
                  <p className="text-sm font-bold text-white">Consolidato Cliente</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Range Temporale</p>
                  <p className="text-sm text-foreground">{periodoLabel}</p>
                </div>
                
                <div className="pt-2 flex flex-col gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full h-11 border-border hover:bg-muted gap-2">
                        <Eye className="w-4 h-4" /> Anteprima Report
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl h-[90vh] bg-card border-border p-0 overflow-hidden">
                      <DialogHeader className="p-6 border-b border-border bg-muted/20">
                        <DialogTitle className="text-xl font-bold flex items-center gap-3">
                          <FileText className="w-6 h-6 text-purple-400" />
                          Consolidato: {cliente.ragione_sociale} ({periodoLabel})
                        </DialogTitle>
                      </DialogHeader>
                      <div className="flex-1 w-full h-full bg-slate-100">
                        <PDFViewer width="100%" height="100%" className="border-none">
                          <ClienteReportPDF 
                            cliente={cliente} 
                            commesse={filteredCommesse} 
                            periodo={periodoLabel} 
                          />
                        </PDFViewer>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <PDFDownloadLink
                    document={
                      <ClienteReportPDF 
                        cliente={cliente} 
                        commesse={filteredCommesse} 
                        periodo={periodoLabel} 
                      />
                    }
                    fileName={`Report_${cliente.ragione_sociale.replace(/\s+/g, '_')}_${periodo}.pdf`}
                  >
                    {({ loading }) => (
                      <Button 
                        disabled={loading || filteredCommesse.length === 0}
                        className="w-full h-11 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 gap-2 font-bold"
                      >
                        <Download className="w-4 h-4" />
                        {loading ? "Generazione..." : "Scarica Report Consolidato"}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
                
                {filteredCommesse.length === 0 && (
                  <p className="text-[10px] text-amber-400 text-center italic">
                    Nessuna commessa trovata per il periodo selezionato.
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                 <div className="flex justify-between items-center bg-muted/20 p-3 rounded-lg border border-border/50">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-black uppercase">Email Referente</p>
                      <p className="text-xs font-bold text-white">{cliente.email || "---"}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-xs underline" onClick={() => navigate(`/clienti`)}>CRM</Button>
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PreventivoModal 
        isOpen={isPModalOpen} 
        onClose={() => setIsPModalOpen(false)} 
        preventivo={selectedP} 
      />
    </div>
  );
}

function FactorCard({ title, score, detail, icon }: { title: string, score: number, detail: string, icon: React.ReactNode }) {
  return (
    <Card className="bg-card border-border hover:shadow-xl transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-muted/50 rounded-lg border border-border">
            {icon}
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-white">{score}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-tighter">Fattore Pt</div>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <Progress value={score} className="h-1 bg-muted" />
          <p className="text-[10px] text-muted-foreground italic">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}
