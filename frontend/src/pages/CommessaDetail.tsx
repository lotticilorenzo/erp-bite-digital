import { useParams, useNavigate } from "react-router-dom";
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
  Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCommessa } from "@/hooks/useCommesse";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
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

export default function CommessaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: commessa, isLoading, error } = useCommessa(id);
  const { data: timesheets = [] } = useTimesheets({ commessa_id: id });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-[#1e293b] animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[#0f172a] animate-pulse rounded-xl border border-[#1e293b]" />
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

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/commesse")} 
            className="text-[#64748b] hover:text-white hover:bg-[#1e293b]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Indietro
          </Button>
          <div className="h-4 w-px bg-[#1e293b]" />
          <div className="flex items-center gap-4">
            <ClientAvatar 
              name={commessa.cliente?.ragione_sociale || "C"} 
              logoUrl={commessa.cliente?.logo_url} 
              size="lg" 
              className="rounded-xl border-[#1e293b]"
            />
            <div>
              <h1 className="text-2xl font-bold text-[#f1f5f9]">
                Commessa {commessa.cliente?.ragione_sociale}
              </h1>
              <p className="text-[#64748b] text-sm">
                Competenza: {format(parseISO(commessa.mese_competenza), "MMMM yyyy", { locale: it })}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`
            ${commessa.stato === 'FATTURATA' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}
          `}>
            {commessa.stato}
          </Badge>
          <Button variant="outline" className="bg-[#1e293b] border-[#334155] text-white">
            <LinkIcon className="w-4 h-4 mr-2" /> Collega Fattura
          </Button>
          
          <PDFDownloadLink 
            document={<CommessaReportPDF commessa={commessa} timesheets={timesheets} />} 
            fileName={`Report_${commessa.cliente?.ragione_sociale}_${commessa.mese_competenza}.pdf`}
          >
            {({ loading }) => (
              <Button 
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_rgba(124,58,237,0.3)]"
              >
                <Download className="w-4 h-4" />
                {loading ? "Generazione..." : "Prospetto Mensile"}
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

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
          <Card className="bg-[#0f172a] border-[#1e293b] text-white">
            <CardHeader className="border-b border-[#1e293b]">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Progetti Coinvolti
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b] hover:bg-transparent text-[#64748b]">
                    <TableHead className="pl-6 font-medium uppercase text-[10px] tracking-wider">Progetto</TableHead>
                    <TableHead className="font-medium uppercase text-[10px] tracking-wider text-right">Budget Fisso</TableHead>
                    <TableHead className="font-medium uppercase text-[10px] tracking-wider text-right">Budget Var.</TableHead>
                    <TableHead className="pr-6 font-medium uppercase text-[10px] tracking-wider text-right">Delivery (h)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commessa.righe_progetto?.map((riga: any) => (
                    <TableRow key={riga.id} className="border-[#1e293b] hover:bg-[#1e293b]/20">
                      <TableCell className="pl-6 font-medium text-[#f1f5f9]">
                        {riga.progetto?.nome || "Progetto Scollegato"}
                        <div className="text-[10px] text-[#475569]">{riga.progetto?.tipo}</div>
                      </TableCell>
                      <TableCell className="text-right text-[#cbd5e1]">€{riga.importo_fisso?.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-[#cbd5e1]">€{riga.importo_variabile?.toLocaleString()}</TableCell>
                      <TableCell className="pr-6 text-right text-purple-400 font-semibold">{riga.delivery_consuntiva} / {riga.delivery_attesa}h</TableCell>
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

          <Card className="bg-[#0f172a] border-[#1e293b] text-white">
            <CardHeader className="border-b border-[#1e293b]">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Dettaglio Ore Lavorate
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e293b] hover:bg-transparent text-[#64748b]">
                    <TableHead className="pl-6 font-medium uppercase text-[10px] tracking-wider">Data</TableHead>
                    <TableHead className="font-medium uppercase text-[10px] tracking-wider">Risorsa</TableHead>
                    <TableHead className="font-medium uppercase text-[10px] tracking-wider">Servizio</TableHead>
                    <TableHead className="pr-6 font-medium uppercase text-[10px] tracking-wider text-right">Durata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.map((ts) => (
                    <TableRow key={ts.id} className="border-[#1e293b] hover:bg-[#1e293b]/20">
                      <TableCell className="pl-6 text-[#f1f5f9]">{format(parseISO(ts.data_attivita), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-[#cbd5e1]">{ts.user?.nome} {ts.user?.cognome}</TableCell>
                      <TableCell className="text-[#cbd5e1]">{ts.task_display_name || ts.servizio || "-"}</TableCell>
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
          <Card className="bg-[#0f172a] border-[#1e293b] text-white overflow-hidden">
            <div className={`h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500`} />
            <CardHeader>
              <CardTitle className="text-lg font-medium">Informazioni Fatturazione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {commessa.fattura_id ? (
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#94a3b8]">Fattura N.</span>
                    <span className="text-sm font-bold text-white">{commessa.fattura_numero}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#94a3b8]">Data Emissione</span>
                    <span className="text-sm text-[#cbd5e1]">{commessa.fattura_data ? format(parseISO(commessa.fattura_data), "dd/MM/yyyy") : "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#94a3b8]">Importo</span>
                    <span className="text-sm text-emerald-400 font-bold">€{commessa.fattura_importo?.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-blue-500/10">
                    <Badge className="w-full justify-center bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                      {commessa.fattura_stato || "STATO SCONOSCIUTO"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-4 border-2 border-dashed border-[#1e293b] rounded-xl">
                  <FileText className="w-8 h-8 text-[#1e293b] mx-auto" />
                  <p className="text-xs text-[#64748b]">Nessuna fattura collegata.</p>
                  <Button size="sm" variant="outline" className="w-full bg-purple-600/10 text-purple-400 border-purple-500/20 hover:bg-purple-600/20">
                    Collega ora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0f172a] border-[#1e293b] text-white">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Note Interne</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#cbd5e1] whitespace-pre-wrap italic">
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
      bg-[#0f172a] border-[#1e293b] text-white transition-all hover:scale-[1.02]
      ${isPremium ? "shadow-[0_0_20px_rgba(124,58,237,0.15)] border-purple-500/30" : ""}
    `}>
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="p-2 rounded-lg bg-[#1e293b]/50 border border-[#334155]">
            {icon}
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trendPositive ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
            {trend}
          </span>
        </div>
        <div>
          <p className="text-sm text-[#94a3b8] uppercase tracking-wider font-medium">{title}</p>
          <p className="text-3xl font-bold text-[#f1f5f9] mt-1">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
