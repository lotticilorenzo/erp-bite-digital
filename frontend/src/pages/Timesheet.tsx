import { useState, useMemo } from "react";
import { 
  Plus, 
  FileDown, 
  Filter, 
  LayoutGrid,
  List,
  Search,
  Calendar,
  Clock,
  Euro,
  FileCheck,
  Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useTimesheets } from "@/hooks/useTimesheet";
import { useAuth } from "@/hooks/useAuth";
import { TimesheetTable } from "@/components/timesheet/TimesheetTable";
import { TimesheetDialog } from "@/components/timesheet/TimesheetDialog";
import { TimesheetCalendar } from "@/components/timesheet/TimesheetCalendar";
import { TimesheetDetailDialog } from "@/components/timesheet/TimesheetDetailDialog";
import { BulkActionsHeader } from "@/components/timesheet/BulkActionsHeader";
import { TimesheetExportPDF } from "@/components/reports/TimesheetExportPDF";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { format, startOfMonth, subMonths, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Timesheet } from "@/types";

export default function TimesheetPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    mese: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    stato: "",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const { data: timesheets = [], isLoading } = useTimesheets(filters);

  const filteredTimesheets = useMemo(() => {
    if (!searchQuery) return timesheets;
    const q = searchQuery.toLowerCase();
    return timesheets.filter(t => {
      const matchServizio = t.servizio?.toLowerCase().includes(q) || false;
      const matchNote = t.note?.toLowerCase().includes(q) || false;
      const matchUser = t.user?.nome?.toLowerCase().includes(q) || t.user?.cognome?.toLowerCase().includes(q) || false;
      const matchCommessa = t.commessa?.righe_progetto?.[0]?.progetto?.nome?.toLowerCase().includes(q) || false;
      const matchCliente = t.commessa?.cliente?.ragione_sociale?.toLowerCase().includes(q) || false;
      return matchServizio || matchNote || matchUser || matchCommessa || matchCliente;
    });
  }, [timesheets, searchQuery]);

  const months = [
    startOfMonth(new Date()),
    startOfMonth(subMonths(new Date(), 1)),
    startOfMonth(subMonths(new Date(), 2)),
    startOfMonth(subMonths(new Date(), 3)),
  ];

  const exportPeriodLabel = format(parseISO(filters.mese), "MMMM yyyy", { locale: it });

  // KPIs
  const totalMinuti = filteredTimesheets.reduce((acc, t) => acc + t.durata_minuti, 0);
  const totalCosto = filteredTimesheets.reduce((acc, t) => acc + Number(t.costo_lavoro || 0), 0);
  const pendingMinuti = filteredTimesheets.filter(t => t.stato === "PENDING").reduce((acc, t) => acc + t.durata_minuti, 0);
  const hoursFormat = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Timesheet</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestione ore, approvazioni e consuntivi.</p>
        </div>
        <div className="flex items-center gap-3">
          <PDFDownloadLink
            document={
              <TimesheetExportPDF 
                timesheets={filteredTimesheets} 
                filters={filters} 
                userName={user ? `${user.nome} ${user.cognome}` : "Team Bite"} 
              />
            }
            fileName={`Timesheet_${exportPeriodLabel.replace(/\s+/g, '_')}.pdf`}
          >
            {({ loading }) => (
              <Button disabled={loading || filteredTimesheets.length === 0} variant="outline" className="bg-muted border-border text-white gap-2 font-bold">
                <FileDown className="w-4 h-4" /> 
                {loading ? "Esportazione..." : "Esporta PDF"}
              </Button>
            )}
          </PDFDownloadLink>
          <Button 
            onClick={() => {
              setIsDuplicate(false);
              setSelectedTimesheet(undefined);
              setSelectedDate(undefined);
              setIsDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_hsl(var(--primary)/0.2)] font-black"
          >
            <Plus className="w-4 h-4 mr-2" /> Aggiungi Ore
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-5 hover:border-primary/50 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Tempo Speso</p>
              <h3 className="text-2xl font-black text-foreground">{hoursFormat(totalMinuti)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-5 hover:border-primary/50 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Euro className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Valore Lordo</p>
              <h3 className="text-2xl font-black text-foreground">€ {totalCosto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-5 hover:border-primary/50 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Da Approvare</p>
              <h3 className="text-2xl font-black text-foreground">{hoursFormat(pendingMinuti)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-5 hover:border-primary/50 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Interventi</p>
              <h3 className="text-2xl font-black text-foreground">{filteredTimesheets.length} <span className="text-sm font-normal text-muted-foreground">report</span></h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569] group-focus-within:text-purple-400 transition-colors" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca attività, utente, note..." 
            className="pl-10 bg-card border-border text-white focus-visible:ring-purple-500/50"
          />
        </div>
        
        <Select 
          value={filters.mese} 
          onValueChange={(v) => setFilters(prev => ({ ...prev, mese: v }))}
        >
          <SelectTrigger className="bg-card border-border text-white capitalize">
            <Calendar className="w-4 h-4 mr-2 text-purple-400" />
            <SelectValue placeholder="Mese" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-white">
            {months.map(m => (
              <SelectItem key={m.toISOString()} value={format(m, "yyyy-MM-dd")}>
                {format(m, "MMMM yyyy", { locale: it })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={filters.stato} 
          onValueChange={(v) => setFilters(prev => ({ ...prev, stato: v }))}
        >
          <SelectTrigger className="bg-card border-border text-white">
            <Filter className="w-4 h-4 mr-2 text-blue-400" />
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-white">
            <SelectItem value="ALL">Tutti gli stati</SelectItem>
            <SelectItem value="PENDING">Da Approvare</SelectItem>
            <SelectItem value="APPROVATO">Approvati</SelectItem>
            <SelectItem value="RIFIUTATO">Rifiutati</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex bg-card border border-border rounded-lg p-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`flex-1 ${viewMode === "table" ? "bg-muted text-white" : "text-muted-foreground hover:text-white"}`}
            onClick={() => setViewMode("table")}
          >
            <List className="w-4 h-4 mr-2" /> Tabella
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`flex-1 ${viewMode === "calendar" ? "bg-muted text-white" : "text-muted-foreground hover:text-white"}`}
            onClick={() => setViewMode("calendar")}
          >
            <LayoutGrid className="w-4 h-4 mr-2" /> Calendar
          </Button>
        </div>
      </div>

      {viewMode === "table" ? (
        <TimesheetTable 
          timesheets={filteredTimesheets} 
          isLoading={isLoading} 
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onDuplicate={(t) => {
            setIsDuplicate(true);
            setSelectedTimesheet(t);
            setIsDialogOpen(true);
          }}
          onEdit={(t) => {
            setIsDuplicate(false);
            setSelectedTimesheet(t);
            setIsDetailOpen(true); // Table edit action now opens the Detail view instead
          }}
        />
      ) : (
        <div className="h-[750px] animate-in fade-in zoom-in-95 duration-300">
          <TimesheetCalendar
            timesheets={filteredTimesheets}
            currentMonth={parseISO(filters.mese)}
            onView={(t) => {
              setIsDuplicate(false);
              setSelectedTimesheet(t);
              setIsDetailOpen(true);
            }}
            onAdd={(date) => {
              setIsDuplicate(false);
              setSelectedTimesheet(undefined);
              setSelectedDate(date);
              setIsDialogOpen(true);
            }}
          />
        </div>
      )}

      <BulkActionsHeader 
        selectedIds={selectedIds} 
        onClearSelection={() => setSelectedIds([])} 
      />

      <TimesheetDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        timesheet={selectedTimesheet}
        initialDate={selectedDate}
        isDuplicate={isDuplicate}
      />
      
      <TimesheetDetailDialog 
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        timesheet={selectedTimesheet}
        onEditClick={(t) => {
          setIsDuplicate(false);
          setSelectedTimesheet(t);
          setIsDialogOpen(true);
        }}
      />
    </div>
  );
}
