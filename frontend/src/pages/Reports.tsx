import { useState } from "react";
import { 
  FileText, 
  Download, 
  Eye, 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  User as UserIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useCommesse } from "@/hooks/useCommesse";
import { useClienti } from "@/hooks/useClienti";
import { useTimesheets } from "@/hooks/useTimesheet";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import { CommessaReportPDF } from "@/components/commesse/CommessaReportPDF";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { ClienteReportPDF } from "@/components/reports/ClienteReportPDF";
import { useMemo } from "react";
import { startOfYear, endOfYear, subMonths, subYears } from "date-fns";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("commesse");
  const [filterText, setFilterText] = useState("");
  const [selectedClient, setSelectedClient] = useState("ALL");
  const [consolidatedClientId, setConsolidatedClientId] = useState<string>("");
  const [consolidatedPeriod, setConsolidatedPeriod] = useState<"YTD" | "PREV_YEAR" | "6M" | "ALL">("YTD");
  const [previewCommessa, setPreviewCommessa] = useState<any | null>(null);

  const { data: commesse = [], isLoading: loadingC } = useCommesse();
  const { data: clienti = [] } = useClienti();
  
  // We fetch timesheets for the preview if needed, but for the list we don't need them all
  // In a real app, we might want a separate hook for "report data"
  const { data: previewTimesheets = [] } = useTimesheets({ 
    commessa_id: previewCommessa?.id 
  });

  const filteredCommesse = commesse.filter(c => {
    const matchesClient = selectedClient === "ALL" || c.cliente_id === selectedClient;
    const matchesText = (c.cliente?.ragione_sociale || "").toLowerCase().includes(filterText.toLowerCase());
    return matchesClient && matchesText;
  });

  const filteredConsolidatedCommesse = useMemo(() => {
    if (!consolidatedClientId) return [];
    
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (consolidatedPeriod) {
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
      return c.cliente_id === consolidatedClientId && d >= start && d <= end;
    });
  }, [commesse, consolidatedClientId, consolidatedPeriod]);

  const selectedClienteObj = clienti.find(c => c.id === consolidatedClientId);
  const periodoLabel = {
    YTD: "Anno Corrente",
    PREV_YEAR: "Anno Precedente",
    "6M": "Ultimi 6 Mesi",
    ALL: "Tutto lo Storico"
  }[consolidatedPeriod];

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
            Reporting <span className="text-primary not-italic">Hub</span>
          </h1>
          <p className="text-[#475569] text-xs font-bold uppercase tracking-[0.2em] mt-1">Generazione e archiviazione report mensili</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-card border border-border p-1 gap-1 h-12 rounded-2xl">
          <TabsTrigger value="commesse" className="rounded-xl px-8 data-[state=active]:bg-primary h-full font-bold">
            Singole Commesse
          </TabsTrigger>
          <TabsTrigger value="clienti" className="rounded-xl px-8 data-[state=active]:bg-primary h-full font-bold">
            Report Consolidati Cliente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commesse" className="space-y-8 mt-0 outline-none">
          {/* Filters */}
          <Card className="bg-card border-border shadow-2xl rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Cerca cliente..." 
                    className="pl-10 h-11 bg-muted/50 border-border text-white rounded-xl focus:border-primary transition-all"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <select 
                    className="w-full h-11 bg-muted/50 border border-border text-white rounded-xl px-4 appearance-none focus:outline-none focus:border-primary transition-all text-sm font-medium"
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                  >
                    <option value="ALL">Tutti i Clienti</option>
                    {clienti.map(cl => (
                      <option key={cl.id} value={cl.id}>{cl.ragione_sociale}</option>
                    ))}
                  </select>
                  <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] pointer-events-none" />
                </div>
                <Button variant="outline" className="h-11 bg-muted border-border text-muted-foreground hover:text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest">
                  <Filter className="h-4 w-4" />
                  Filtri Avanzati
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Reports Table */}
          <Card className="bg-card border-border shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Prospetti Disponibili
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingC ? (
                 <div className="p-8 space-y-4">
                   {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl bg-muted/50" />)}
                 </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent text-[#475569]">
                      <TableHead className="pl-8 font-black uppercase text-[10px] tracking-widest h-14">Cliente</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest h-14">Mese Ricevuto</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest h-14">Stato Commessa</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest h-14">Margine</TableHead>
                      <TableHead className="pr-8 text-right font-black uppercase text-[10px] tracking-widest h-14">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommesse.map((c) => (
                      <TableRow key={c.id} className="border-border hover:bg-muted/30 transition-colors group">
                        <TableCell className="pl-8 py-4">
                          <p className="font-bold text-white group-hover:text-primary transition-colors">{c.cliente?.ragione_sociale}</p>
                          <p className="text-[10px] text-[#475569] font-bold uppercase tracking-tight">ID: {c.id.substring(0, 8)}</p>
                        </TableCell>
                        <TableCell className="py-4">
                           <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                             <CalendarIcon className="h-3 w-3 text-[#475569]" />
                             {format(parseISO(c.mese_competenza), "MMMM yyyy", { locale: it }).toUpperCase()}
                           </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant="outline" className={`
                            ${c.stato === 'FATTURATA' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}
                            font-black text-[9px] tracking-widest uppercase rounded-lg
                          `}>
                            {c.stato}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={`text-sm font-black ${(c.margine_percentuale || 0) > 20 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {c.margine_percentuale || 0}%
                          </span>
                        </TableCell>
                        <TableCell className="pr-8 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setPreviewCommessa(c)}
                              className="h-9 w-9 p-0 bg-muted/50 text-muted-foreground hover:text-white hover:bg-primary/20 rounded-xl transition-all"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <ReportDownloadButton commessa={c} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clienti" className="space-y-8 mt-0 outline-none">
          <Card className="bg-card border-border shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                Parametri Report Consolidato
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Seleziona Cliente</label>
                  <select 
                    className="w-full h-11 bg-muted/50 border border-border text-white rounded-xl px-4 appearance-none focus:outline-none focus:border-primary transition-all text-sm font-medium"
                    value={consolidatedClientId}
                    onChange={(e) => setConsolidatedClientId(e.target.value)}
                  >
                    <option value="">Scegli un cliente...</option>
                    {clienti.map(cl => (
                      <option key={cl.id} value={cl.id}>{cl.ragione_sociale}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Periodo Analisi</label>
                  <select 
                    className="w-full h-11 bg-muted/50 border border-border text-white rounded-xl px-4 appearance-none focus:outline-none focus:border-primary transition-all text-sm font-medium"
                    value={consolidatedPeriod}
                    onChange={(e) => setConsolidatedPeriod(e.target.value as any)}
                  >
                    <option value="YTD">Anno Corrente</option>
                    <option value="PREV_YEAR">Anno Precedente</option>
                    <option value="6M">Ultimi 6 Mesi</option>
                    <option value="ALL">Tutto lo Storico</option>
                  </select>
                </div>
                <div className="flex items-end">
                  {consolidatedClientId && (
                    <PDFDownloadLink
                      document={
                        <ClienteReportPDF 
                          cliente={selectedClienteObj!} 
                          commesse={filteredConsolidatedCommesse} 
                          periodo={periodoLabel} 
                        />
                      }
                      fileName={`Consolidato_${selectedClienteObj?.ragione_sociale.replace(/\s+/g, '_')}_${consolidatedPeriod}.pdf`}
                    >
                      {({ loading }) => (
                        <Button 
                          disabled={loading || filteredConsolidatedCommesse.length === 0}
                          className="w-full h-11 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 gap-2 font-black uppercase tracking-widest"
                        >
                          <Download className="w-4 h-4" />
                          {loading ? "Generazione..." : "Genera e Scarica"}
                        </Button>
                      )}
                    </PDFDownloadLink>
                  )}
                </div>
              </div>

              {consolidatedClientId && filteredConsolidatedCommesse.length > 0 && (
                <div className="mt-8 p-6 rounded-2xl bg-muted/20 border border-border/50">
                   <div className="flex items-center gap-4 mb-4">
                      <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary text-xl font-bold">
                        {selectedClienteObj?.ragione_sociale.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-white font-bold">{selectedClienteObj?.ragione_sociale}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Anteprima: {filteredConsolidatedCommesse.length} commesse trovate</p>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase">Fatturato</p>
                        <p className="text-lg font-black text-white">€{filteredConsolidatedCommesse.reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0).toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase">Margine Medio</p>
                        <p className="text-lg font-black text-emerald-400">
                          {(filteredConsolidatedCommesse.reduce((acc, c) => acc + (c.margine_percentuale || 0), 0) / filteredConsolidatedCommesse.length).toFixed(1)}%
                        </p>
                      </div>
                   </div>
                </div>
              )}

              {consolidatedClientId && filteredConsolidatedCommesse.length === 0 && (
                <div className="mt-8 p-12 text-center border-2 border-dashed border-border rounded-3xl">
                  <p className="text-muted-foreground font-medium italic">Nessun dato trovato per questo cliente nel periodo selezionato.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewCommessa} onOpenChange={() => setPreviewCommessa(null)}>
        <DialogContent className="max-w-5xl h-[90vh] bg-card border-border p-0 flex flex-col overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 border-b border-border flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-black text-white uppercase italic">
                Anteprima <span className="text-primary not-italic">Report</span>
              </DialogTitle>
              <p className="text-xs text-[#475569] font-bold uppercase tracking-widest mt-1">
                {previewCommessa?.cliente?.ragione_sociale} - {previewCommessa && format(parseISO(previewCommessa.mese_competenza), "MMMM yyyy", { locale: it }).toUpperCase()}
              </p>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-white">
            {previewCommessa && (
              <PDFViewer width="100%" height="100%" showToolbar={false} style={{ border: "none" }}>
                <CommessaReportPDF commessa={previewCommessa} timesheets={previewTimesheets} />
              </PDFViewer>
            )}
          </div>
          <div className="p-4 border-t border-border flex justify-end gap-3 bg-card">
            <Button variant="ghost" onClick={() => setPreviewCommessa(null)} className="text-muted-foreground hover:text-white rounded-xl">
              Chiudi
            </Button>
            {previewCommessa && <ReportDownloadButton commessa={previewCommessa} big />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportDownloadButton({ commessa, big = false }: { commessa: any, big?: boolean }) {
  const { data: timesheets = [] } = useTimesheets({ 
    commessa_id: commessa.id 
  });

  return (
    <PDFDownloadLink 
      document={<CommessaReportPDF commessa={commessa} timesheets={timesheets} />} 
      fileName={`Report_${commessa.cliente?.ragione_sociale}_${commessa.mese_competenza}.pdf`}
    >
      {({ loading }) => (
        <Button 
          disabled={loading}
          size={big ? "default" : "sm"}
          className={`
            bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest transition-all
            ${!big ? 'h-9 w-9 p-0' : 'h-11 px-6'}
          `}
        >
          <Download className={big ? "h-4 w-4" : "h-4 w-4"} />
          {big && (loading ? "Generazione..." : "Scarica PDF")}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
