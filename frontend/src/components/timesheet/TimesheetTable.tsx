import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  User as UserIcon, 
  Briefcase, 
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock3
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Timesheet } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface TimesheetTableProps {
  timesheets: Timesheet[];
  isLoading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function TimesheetTable({ 
  timesheets, 
  isLoading, 
  selectedIds, 
  onSelectionChange 
}: TimesheetTableProps) {

  const toggleAll = () => {
    if (selectedIds.length === timesheets.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(timesheets.map(t => t.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const totalMinuti = timesheets.reduce((acc, t) => acc + t.durata_minuti, 0);
  const totalCosto = timesheets.reduce((acc, t) => acc + (t.costo_lavoro || 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full bg-muted/50 rounded-xl" />
        ))}
      </div>
    );
  }

  const getStatusBadge = (stato: string) => {
    switch (stato) {
      case "APPROVATO":
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> APPROVATO</Badge>;
      case "PENDING":
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20"><Clock3 className="w-3 h-3 mr-1" /> DA APPROVARE</Badge>;
      case "RIFIUTATO":
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><XCircle className="w-3 h-3 mr-1" /> RIFIUTATO</Badge>;
      default:
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">BOZZA</Badge>;
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xl">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="w-[40px] pl-4">
              <Checkbox 
                checked={selectedIds.length > 0 && selectedIds.length === timesheets.length}
                onCheckedChange={toggleAll}
                aria-label="Seleziona tutti"
              />
            </TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Data</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Utente</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Commessa / Task</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Servizio</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-right">Durata</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-right">Costo Lavoro</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-center">Stato</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {timesheets.map((t) => (
            <TableRow 
              key={t.id} 
              className={`border-border hover:bg-muted/20 transition-colors ${selectedIds.includes(t.id) ? 'bg-primary/5' : ''}`}
            >
              <TableCell className="pl-4">
                <Checkbox 
                  checked={selectedIds.includes(t.id)}
                  onCheckedChange={() => toggleOne(t.id)}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CalendarIcon className="w-3.5 h-3.5 text-purple-400" />
                  {format(parseISO(t.data_attivita), "dd MMM yyyy", { locale: it })}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                  {t.user?.nome} {t.user?.cognome}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                    {t.task_display_name || "Lavoro Generico"}
                  </div>
                  {t.commessa_id && (
                    <div className="text-[10px] text-[#475569] uppercase font-bold tracking-tighter">
                      ID Commessa: {t.commessa_id.slice(0, 8)}...
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                <span className="text-xs text-muted-foreground italic">
                  {t.servizio || t.note || "—"}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1.5 text-sm font-bold text-foreground">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  {formatDuration(t.durata_minuti)}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-medium text-emerald-400">
                  €{t.costo_lavoro?.toLocaleString() || "0,00"}
                </span>
              </TableCell>
              <TableCell className="text-center">
                {getStatusBadge(t.stato)}
              </TableCell>
            </TableRow>
          ))}
          {!timesheets.length && (
            <TableRow>
              <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">
                Nessun record trovato
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <tfoot className="bg-muted/50 border-t border-border">
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5} className="text-right text-xs font-black uppercase text-muted-foreground tracking-widest pl-10">
              Totali (Periodo selezionato)
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-sm font-black text-purple-400">
                <Clock className="w-4 h-4" />
                {formatDuration(totalMinuti)}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <span className="text-sm font-black text-emerald-400">
                €{totalCosto.toLocaleString()}
              </span>
            </TableCell>
            <TableCell />
          </TableRow>
        </tfoot>
      </Table>
    </div>
  );
}
