import { useState } from "react";
import { 
  Plus, 
  FileDown, 
  Filter, 
  LayoutGrid, 
  List,
  Search,
  Calendar
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
import { TimesheetTable } from "@/components/timesheet/TimesheetTable";
import { TimesheetDialog } from "@/components/timesheet/TimesheetDialog";
import { BulkActionsHeader } from "@/components/timesheet/BulkActionsHeader";
import { format, startOfMonth, subMonths } from "date-fns";
import { it } from "date-fns/locale";

export default function TimesheetPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    mese: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    stato: "",
  });

  const { data: timesheets, isLoading } = useTimesheets(filters);

  const months = [
    startOfMonth(new Date()),
    startOfMonth(subMonths(new Date(), 1)),
    startOfMonth(subMonths(new Date(), 2)),
    startOfMonth(subMonths(new Date(), 3)),
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Timesheet</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestione ore, approvazioni e consuntivi.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-muted border-border text-white">
            <FileDown className="w-4 h-4 mr-2" /> Esporta
          </Button>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_hsl(var(--primary)/0.2)] font-black"
          >
            <Plus className="w-4 h-4 mr-2" /> Aggiungi Ore
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569] group-focus-within:text-purple-400 transition-colors" />
          <Input 
            placeholder="Cerca attività..." 
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
          <Button variant="ghost" size="sm" className="flex-1 bg-muted text-white">
            <List className="w-4 h-4 mr-2" /> Tabella
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground hover:text-white">
            <LayoutGrid className="w-4 h-4 mr-2" /> Calendar
          </Button>
        </div>
      </div>

      <TimesheetTable 
        timesheets={timesheets || []} 
        isLoading={isLoading} 
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <BulkActionsHeader 
        selectedIds={selectedIds} 
        onClearSelection={() => setSelectedIds([])} 
      />

      <TimesheetDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
      />
    </div>
  );
}
