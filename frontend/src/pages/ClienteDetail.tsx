import { useParams, useNavigate } from "react-router-dom";
import { 
  ChevronLeft, 
  ShieldCheck, 
  TrendingUp, 
  CreditCard, 
  History,
  AlertTriangle,
  CheckCircle2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCliente, useClientHealthScore } from "@/hooks/useClienti";
import { useCommesse } from "@/hooks/useCommesse";
import { ClientAvatar } from "@/components/common/ClientAvatar";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { motion } from "framer-motion";

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cliente, isLoading: loadingC } = useCliente(id);
  const { data: health, isLoading: loadingH } = useClientHealthScore(id);
  const { data: commesse = [] } = useCommesse({ cliente_id: id });

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
        {/* Health Score Main Card */}
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

        {/* Factors Breakdown */}
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
        {/* Project History */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2 text-white">
                <History className="w-4 h-4 text-purple-400" />
                Storico Commesse
              </CardTitle>
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
        </div>

        {/* Client Info Card */}
        <div>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-white">Info Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Email Referente</label>
                  <p className="text-sm text-foreground">{cliente.email || "---"}</p>
               </div>
               <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Note Pagamento</label>
                  <p className="text-sm text-foreground">{cliente.condizioni_pagamento || "Standard (30 gg)"}</p>
               </div>
               <div className="pt-4 border-t border-border">
                  <Button variant="outline" className="w-full border-border hover:bg-muted" onClick={() => navigate(`/clienti`)}>
                    Gestisci in CRM
                  </Button>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FactorCard({ title, score, detail, icon }: any) {
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
