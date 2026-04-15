import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
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
  Plus,
  Pencil,
  Clock,
  Receipt,
  ArrowRight,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCliente, useClientHealthScore } from "@/hooks/useClienti";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCommesse } from "@/hooks/useCommesse";
import { ClientAvatar } from "@/components/common/ClientAvatar";
import { format, parseISO, startOfYear, endOfYear, subMonths, subYears, differenceInDays, addMonths } from "date-fns";
import { it } from "date-fns/locale";
import { motion } from "framer-motion";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import { ClienteReportPDF } from "@/components/reports/ClienteReportPDF";
import { ClienteDialog } from "@/components/clienti/ClienteDialog";
import { useProgetti } from "@/hooks/useProgetti";
import { useFattureAttive } from "@/hooks/useFatture";
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
import { useState, useMemo, useEffect, useRef } from "react";
import { usePreventivi, usePreventivoMutations } from "@/hooks/usePreventivi";
import { PreventiviTable } from "@/components/preventivi/PreventiviTable";
import { PreventivoModal } from "@/components/preventivi/PreventivoModal";
import type { Preventivo, PreventivoStatus } from "@/types/preventivi";
import { toast } from "sonner";

export default function ClienteDetailPage() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cliente, isLoading: loadingC } = useCliente(id);
  const { data: health, isLoading: loadingH } = useClientHealthScore(id);
  const { data: commesse = [] } = useCommesse({ cliente_id: id });
  const { data: preventivi = [] } = usePreventivi({ cliente_id: id });
  const { data: progetti = [] } = useProgetti(id);
  const { data: fatture = [] } = useFattureAttive();
  const { updatePreventivo, deletePreventivo, convertToCommessa } = usePreventivoMutations();

  const [periodo, setPeriodo] = useState<"YTD" | "PREV_YEAR" | "6M" | "ALL">("YTD");
  const [isPModalOpen, setIsPModalOpen] = useState(false);
  const [selectedP, setSelectedP] = useState<Preventivo | undefined>();
  const [isClienteDialogOpen, setIsClienteDialogOpen] = useState(false);

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

  const clientFatture = useMemo(() => fatture.filter(f => f.cliente_id === id), [fatture, id]);

  const clientStats = useMemo(() => {
    const clientFatture = fatture.filter(f => f.cliente_id === id);
    const ltv = commesse.reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0);
    
    const paidFatture = clientFatture.filter(f => 
      (f.stato_pagamento.toLowerCase() === 'pagata' || f.stato_pagamento.toLowerCase() === 'incassata') && 
      f.data_emissione && f.data_incasso // Assuming we have data_incasso or we use a fallback
    );

    let avgCollectionDays = 0;
    if (paidFatture.length > 0) {
      const totalDays = paidFatture.reduce((acc, f) => {
        const emissione = parseISO(f.data_emissione!);
        const incasso = parseISO(f.data_incasso || new Date().toISOString());
        return acc + differenceInDays(incasso, emissione);
      }, 0);
      avgCollectionDays = Math.round(totalDays / paidFatture.length);
    }

    return { ltv, avgCollectionDays };
  }, [commesse, fatture, id]);

  const projectionData = useMemo(() => {
    const retainers = progetti.filter(p => p.tipo === "RETAINER" && p.stato === "ATTIVO");
    const monthlyRetainerTotal = retainers.reduce((acc, p) => acc + (p.importo_fisso || 0), 0);
    
    return Array.from({ length: 12 }, (_, i) => {
      const d = addMonths(new Date(), i);
      return {
        month: format(d, "MMM yy", { locale: it }).toUpperCase(),
        projected: monthlyRetainerTotal,
        iso: format(d, "yyyy-MM-01")
      };
    });
  }, [progetti]);

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
      {/* ── BREADCRUMB ─────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        <Link to="/clienti" className="hover:text-white transition-colors">Clienti</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{cliente.ragione_sociale}</span>
      </nav>

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
        <Button 
          variant="outline" 
          onClick={() => setIsClienteDialogOpen(true)}
          className="bg-card border-border hover:bg-muted"
        >
          <Pencil className="w-4 h-4 mr-2 text-primary" /> Modifica Cliente
        </Button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Lifetime Value (LTV)"
          value={`€${clientStats.ltv.toLocaleString()}`}
          detail="Fatturato totale storico"
          icon={<Euro className="w-4 h-4 text-emerald-400" />}
        />
        <StatCard 
          title="Tempo Incasso Medio"
          value={`${clientStats.avgCollectionDays} Giorni`}
          detail="Media giorni emissione -> incasso"
          icon={<Clock className="w-4 h-4 text-amber-400" />}
        />
        <StatCard 
          title="Project Load"
          value={`${commesse.filter(c => c.stato === 'APERTA').length}`}
          detail="Commesse attive questo mese"
          icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
        />
        <StatCard 
          title="Salute Cliente"
          value={`${score}%`}
          detail="Health Score calcolato"
          icon={<ShieldCheck className="w-4 h-4 text-purple-400" />}
        />
      </div>

      <Card className="bg-card border-border overflow-hidden rounded-[32px] border-border/50 shadow-2xl">
        <CardHeader className="border-b border-border/30 bg-muted/5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Proiezione Fatturato 12 Mesi</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Stima basata su contratti retainer attivi</CardDescription>
            </div>
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8 h-[300px]">
          <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, position: 'relative' }}>
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10} 
                    fontWeight="bold" 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10} 
                    fontWeight="bold" 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `€${val/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "16px", fontSize: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                    itemStyle={{ fontWeight: "black", color: "hsl(var(--primary))" }}
                    cursor={{ fill: "hsl(var(--primary)/0.05)" }}
                  />
                  <Bar dataKey="projected" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

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
                          <tr 
                            key={c.id} 
                            onClick={() => navigate(`/commesse/${c.id}`)}
                            className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer group"
                          >
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

          {/* ── FATTURE ────────────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2 text-white">
                <Receipt className="w-4 h-4 text-emerald-400" />
                Fatture Attive
              </CardTitle>
              <button
                onClick={() => navigate("/fatture")}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              >
                Tutte <ArrowRight className="w-3 h-3" />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              {clientFatture.length === 0 ? (
                <div className="px-6 py-8 text-center text-muted-foreground text-xs italic">
                  Nessuna fattura trovata per questo cliente
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Numero</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Data</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Importo</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientFatture.slice(0, 10).map((f) => {
                        const isPaid = f.stato_pagamento?.toLowerCase() === "pagata" || f.stato_pagamento?.toLowerCase() === "incassata";
                        const isOverdue = !isPaid && f.data_scadenza && new Date(f.data_scadenza) < new Date();
                        return (
                          <tr key={f.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="px-6 py-3 text-sm font-medium text-white">{f.numero || "—"}</td>
                            <td className="px-6 py-3 text-xs text-muted-foreground">
                              {f.data_emissione ? format(new Date(f.data_emissione), "dd/MM/yyyy") : "—"}
                            </td>
                            <td className="px-6 py-3 text-right text-sm font-black text-white tabular-nums">
                              €{Number(f.importo_totale).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isPaid
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : isOverdue
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}>
                                {f.stato_pagamento || "ATTESA"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {clientFatture.length > 10 && (
                    <div className="px-6 py-3 text-center text-xs text-muted-foreground border-t border-border">
                      + altri {clientFatture.length - 10} documenti —{" "}
                      <button onClick={() => navigate("/fatture")} className="text-primary underline">vedi tutte</button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── PROGETTI ───────────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2 text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Progetti & Task
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-muted/50 border-b border-border">
                     <tr>
                       <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nome Progetto</th>
                       <th className="px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">Stato</th>
                     </tr>
                   </thead>
                   <tbody>
                     {progetti.length === 0 ? (
                       <tr>
                         <td colSpan={2} className="px-6 py-4 text-center text-muted-foreground italic text-xs">Nessun progetto trovato</td>
                       </tr>
                     ) : (
                       progetti.map((p) => (
                         <tr 
                           key={p.id} 
                           onClick={() => navigate(`/progetti/${p.id}`)}
                           className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                         >
                           <td className="px-6 py-4">
                             <span className="text-sm font-medium text-white group-hover:text-primary transition-colors">{p.nome}</span>
                           </td>
                           <td className="px-6 py-4 text-center">
                             <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                p.stato === 'ATTIVO' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                             }`}>
                               {p.stato}
                             </div>
                           </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* ── SCHEDA CLIENTE ─────────────────────────────────────── */}
          <Card className="bg-card border-border shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Scheda Cliente
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsClienteDialogOpen(true)}
                  className="h-7 px-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground/50 hover:text-primary"
                >
                  <Pencil className="w-3 h-3 mr-1" /> Modifica
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">

              {/* Identificativo */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <ClientAvatar name={cliente.ragione_sociale} logoUrl={cliente.logo_url} size="md" className="rounded-xl shrink-0" />
                <div>
                  <p className="font-black text-white leading-tight">{cliente.ragione_sociale}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cliente.codice_cliente && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                        {cliente.codice_cliente}
                      </span>
                    )}
                    {cliente.tipologia && (
                      <span className="text-[9px] text-muted-foreground/60">{cliente.tipologia}</span>
                    )}
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${cliente.attivo ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
                      {cliente.attivo ? "Attivo" : "Inattivo"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dati fiscali */}
              {(cliente.piva || cliente.codice_fiscale || cliente.sdi || cliente.pec) && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Dati Fiscali</p>
                  <div className="space-y-1.5">
                    {cliente.piva && <InfoRow label="P.IVA" value={cliente.piva} />}
                    {cliente.codice_fiscale && <InfoRow label="Cod. Fiscale" value={cliente.codice_fiscale} />}
                    {cliente.sdi && <InfoRow label="SDI" value={cliente.sdi} />}
                    {cliente.pec && <InfoRow label="PEC" value={cliente.pec} isLink={`mailto:${cliente.pec}`} />}
                  </div>
                </div>
              )}

              {/* Contatti */}
              {(cliente.referente || cliente.email || cliente.telefono || cliente.cellulare || cliente.sito_web) && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Contatti</p>
                  <div className="space-y-1.5">
                    {cliente.referente && <InfoRow label="Referente" value={cliente.referente} />}
                    {cliente.email && <InfoRow label="Email" value={cliente.email} isLink={`mailto:${cliente.email}`} />}
                    {cliente.telefono && <InfoRow label="Tel" value={cliente.telefono} isLink={`tel:${cliente.telefono}`} />}
                    {cliente.cellulare && <InfoRow label="Cell" value={cliente.cellulare} isLink={`tel:${cliente.cellulare}`} />}
                    {cliente.sito_web && <InfoRow label="Web" value={cliente.sito_web} isLink={cliente.sito_web} />}
                  </div>
                </div>
              )}

              {/* Indirizzo */}
              {(cliente.indirizzo || cliente.comune) && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Indirizzo</p>
                  <div className="text-xs text-white/70 leading-relaxed bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    {cliente.indirizzo && <p>{cliente.indirizzo}</p>}
                    <p>
                      {[cliente.cap, cliente.comune, cliente.provincia].filter(Boolean).join(" ")}
                      {cliente.paese && cliente.paese !== "Italia" && ` (${cliente.paese})`}
                    </p>
                    {cliente.note_indirizzo && <p className="text-muted-foreground/50 italic text-[10px] mt-1">{cliente.note_indirizzo}</p>}
                  </div>
                </div>
              )}

              {/* Commerciale */}
              {(cliente.condizioni_pagamento || cliente.affidabilita || cliente.settore || cliente.categoria) && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Commerciale</p>
                  <div className="space-y-1.5">
                    {cliente.condizioni_pagamento && <InfoRow label="Pagamento" value={cliente.condizioni_pagamento} />}
                    {cliente.settore && <InfoRow label="Settore" value={cliente.settore} />}
                    {cliente.categoria && <InfoRow label="Categoria" value={`Livello ${cliente.categoria}`} />}
                    {cliente.affidabilita && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground/50">Affidabilità</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          cliente.affidabilita === "ALTA" ? "bg-emerald-500/10 text-emerald-400"
                          : cliente.affidabilita === "BASSA" ? "bg-red-500/10 text-red-400"
                          : "bg-yellow-500/10 text-yellow-400"
                        }`}>
                          {cliente.affidabilita === "ALTA" ? "🟢" : cliente.affidabilita === "BASSA" ? "🔴" : "🟡"} {cliente.affidabilita}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Note */}
              {cliente.note && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Note</p>
                  <p className="text-xs text-muted-foreground/70 italic bg-white/[0.03] rounded-xl p-3 border border-white/5 leading-relaxed">{cliente.note}</p>
                </div>
              )}

              {cliente.created_at && (
                <p className="text-[9px] text-muted-foreground/20 text-right">
                  Cliente dal {format(new Date(cliente.created_at), "d MMM yyyy", { locale: it })}
                </p>
              )}
            </CardContent>
          </Card>

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

      <ClienteDialog 
        open={isClienteDialogOpen} 
        onOpenChange={setIsClienteDialogOpen} 
        cliente={cliente as any} 
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

function StatCard({ title, value, detail, icon }: { title: string, value: string, detail: string, icon: React.ReactNode }) {
  return (
    <Card className="bg-card/40 border-border/50 hover:border-primary/30 transition-all rounded-2xl overflow-hidden relative group">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardContent className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-2 bg-background/50 rounded-xl border border-border group-hover:border-primary/30 transition-colors">
            {icon}
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#475569]">{title}</p>
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-black text-white tracking-tighter">{value}</p>
          <p className="text-[10px] text-muted-foreground font-medium italic">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const Euro = ({ className }: { className?: string }) => <span className={className}>€</span>;

function InfoRow({ label, value, isLink }: { label: string; value: string; isLink?: string }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-muted-foreground/50 text-[11px] shrink-0">{label}</span>
      {isLink ? (
        <a
          href={isLink}
          target={isLink.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="text-[11px] font-bold text-primary/80 hover:text-primary truncate max-w-[60%] text-right transition-colors"
        >
          {value}
        </a>
      ) : (
        <span className="text-[11px] font-bold text-white/80 truncate max-w-[60%] text-right">{value}</span>
      )}
    </div>
  );
}
