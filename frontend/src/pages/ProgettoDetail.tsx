import React from "react";
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
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProgetto } from "@/hooks/useProgetti";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export default function ProgettoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: progetto, isLoading, error } = useProgetto(id);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-[#1e293b] animate-pulse rounded" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="h-64 bg-[#0f172a] animate-pulse rounded-xl border border-[#1e293b]" />
            <div className="h-96 bg-[#0f172a] animate-pulse rounded-xl border border-[#1e293b]" />
          </div>
          <div className="h-96 bg-[#0f172a] animate-pulse rounded-xl border border-[#1e293b]" />
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
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/progetti")} 
          className="text-[#64748b] hover:text-white hover:bg-[#1e293b]"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Indietro
        </Button>
        <div className="h-4 w-px bg-[#1e293b]" />
        <div>
          <h1 className="text-3xl font-bold text-[#f1f5f9]">{progetto.nome}</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
              {progetto.tipo}
            </Badge>
            <Badge variant="outline" className={progetto.stato === "ATTIVO" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"}>
              {progetto.stato}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info */}
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

          <Card className="bg-[#0f172a] border-[#1e293b] text-white">
            <CardHeader className="border-b border-[#1e293b] py-4">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Dettagli Progetto
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-[#94a3b8] mb-2 uppercase tracking-wider">Cliente Associato</h4>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-[#1e293b]/30 border border-[#334155]">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#f1f5f9]">{progetto.cliente?.ragione_sociale}</p>
                      <p className="text-xs text-[#64748b]">{progetto.cliente?.email || "Nessuna email"}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="ml-auto text-[#64748b]" onClick={() => navigate(`/clienti`)}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-[#94a3b8] mb-2 uppercase tracking-wider">Note</h4>
                  <div className="p-4 rounded-xl bg-[#1e293b]/30 border border-[#334155]">
                    <p className="text-[#cbd5e1] whitespace-pre-wrap">
                      {progetto.note || "Nessuna nota aggiuntiva per questo progetto."}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f172a] border-[#1e293b] text-white">
            <CardHeader className="border-b border-[#1e293b] py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Commesse Correlate
              </CardTitle>
              <Button size="sm" variant="outline" className="h-8 bg-purple-600/10 text-purple-400 border-purple-500/20 hover:bg-purple-600/20">
                <Plus className="w-3 h-3 mr-1" /> Nuova Commessa
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-center py-12 border-2 border-dashed border-[#1e293b] rounded-xl">
                <p className="text-[#64748b]">Nessuna commessa ancora generata per questo progetto.</p>
                <p className="text-xs text-[#475569] mt-1">Le commesse verranno visualizzate qui una volta create.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="bg-[#0f172a] border-[#1e293b] text-white overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500" />
            <CardHeader>
              <CardTitle className="text-lg font-medium">Stato di Avanzamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#94a3b8]">Ore Utilizzate</span>
                  <span className="text-white">0 / {progetto.delivery_attesa}h</span>
                </div>
                <div className="w-full h-2 bg-[#1e293b] rounded-full overflow-hidden">
                  <div className="w-0 h-full bg-purple-500" />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-[#1e293b]">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#94a3b8]">ClickUp ID</span>
                  <Badge variant="outline" className="bg-[#1e293b] text-[#cbd5e1] border-[#334155]">
                     {progetto.clickup_list_id || "Non collegato"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#94a3b8]">Margine Previsto</span>
                  <span className="text-sm font-medium text-emerald-400">-- %</span>
                </div>
              </div>
              
              <Button className="w-full bg-[#1e293b] hover:bg-[#334155] text-white border border-[#334155]">
                Apri su ClickUp
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatSmallCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl space-y-1 hover:border-purple-500/50 transition-all group">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">{label}</span>
        {icon}
      </div>
      <p className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">{value}</p>
    </div>
  );
}
