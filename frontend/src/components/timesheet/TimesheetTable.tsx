import { Fragment, useState, useMemo } from "react";
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
  Clock3,
  MoreHorizontal,
  Edit2,
  Trash2,
  Copy,
  FolderOpen
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Timesheet } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuLabel, 
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { useBulkDeleteTimesheets } from "@/hooks/useTimesheet";

interface TimesheetTableProps {
  timesheets: Timesheet[];
  isLoading?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onEdit?: (t: Timesheet) => void;
  onDuplicate?: (t: Timesheet) => void;
}

export function TimesheetTable({ 
  timesheets, 
  isLoading = false, 
  selectedIds = [], 
  onSelectionChange = () => {},
  onEdit = () => {},
  onDuplicate
}: TimesheetTableProps) {
  const navigate = useNavigate();
  const deleteMutation = useBulkDeleteTimesheets();
  const [groupBy, setGroupBy] = useState<"NONE" | "USER" | "CLIENT" | "STATUS">("NONE");

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
  const totalCosto = timesheets.reduce((acc, t) => acc + Number(t.costo_lavoro || 0), 0);

  const groupedTimesheets = useMemo(() => {
    if (groupBy === "NONE") return { "Tutti I Record": timesheets };
    const maps: Record<string, Timesheet[]> = {};
    timesheets.forEach(t => {
      let key = "Sconosciuto";
      if (groupBy === "USER") key = t.user ? `${t.user.nome} ${t.user.cognome}` : "Utente Sconosciuto";
      else if (groupBy === "CLIENT") key = t.commessa?.cliente?.ragione_sociale || "Cliente Non Assegnato";
      else if (groupBy === "STATUS") key = t.stato;
      
      if (!maps[key]) maps[key] = [];
      maps[key].push(t);
    });
    return maps;
  }, [timesheets, groupBy]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full bg-muted/50 rounded-xl" />
        ))}
      </div>
    );
  }

  const getServiceColor = (service?: string) => {
    const s = (service || "").toLowerCase();
    if (s.includes("sviluppo") || s.includes("dev")) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (s.includes("design") || s.includes("ui") || s.includes("grafica") || s.includes("creativit")) return "bg-pink-500/10 text-pink-400 border-pink-500/20";
    if (s.includes("manage") || s.includes("pm")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (s.includes("social")) return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    if (s.includes("content") || s.includes("copy")) return "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20";
    return "bg-slate-500/10 text-slate-400 border-slate-500/20"; // default
  };

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
      <div className="p-3 border-b border-border bg-card/80 backdrop-blur-xl flex justify-between items-center overflow-x-auto gap-4">
        <div className="flex gap-2">
          <span className="text-xs font-black text-muted-foreground mr-1 self-center tracking-widest uppercase">Raggruppa:</span>
          <Button variant={groupBy === "NONE" ? "default" : "outline"} size="sm" onClick={() => setGroupBy("NONE")} className={groupBy === "NONE" ? "bg-purple-600 text-white font-bold" : "text-muted-foreground border-border"}>Nessuno</Button>
          <Button variant={groupBy === "USER" ? "default" : "outline"} size="sm" onClick={() => setGroupBy("USER")} className={groupBy === "USER" ? "bg-purple-600 text-white font-bold" : "text-muted-foreground border-border"}>Utente</Button>
          <Button variant={groupBy === "CLIENT" ? "default" : "outline"} size="sm" onClick={() => setGroupBy("CLIENT")} className={groupBy === "CLIENT" ? "bg-purple-600 text-white font-bold" : "text-muted-foreground border-border"}>Cliente</Button>
          <Button variant={groupBy === "STATUS" ? "default" : "outline"} size="sm" onClick={() => setGroupBy("STATUS")} className={groupBy === "STATUS" ? "bg-purple-600 text-white font-bold" : "text-muted-foreground border-border"}>Stato</Button>
        </div>
      </div>
      <Table className="table-fixed">
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="w-[40px] pl-4">
              <Checkbox 
                checked={selectedIds.length > 0 && selectedIds.length === timesheets.length}
                onCheckedChange={toggleAll}
                aria-label="Seleziona tutti"
              />
            </TableHead>
            <TableHead className="w-[100px] text-[10px] uppercase tracking-wider font-bold text-muted-foreground whitespace-nowrap">Data</TableHead>
            <TableHead className="w-[150px] text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Utente</TableHead>
            <TableHead className="w-[200px] text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Commessa / Task</TableHead>
            <TableHead className="w-[140px] text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Servizio</TableHead>
            <TableHead className="w-[100px] text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-left">Durata</TableHead>
            <TableHead className="w-[120px] text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-left whitespace-nowrap">Costo Lavoro</TableHead>
            <TableHead className="w-[140px] text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-center">Stato</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(groupedTimesheets).map(([groupName, groupTimesheets]) => (
            <Fragment key={groupName}>
              {groupBy !== "NONE" && (
                <TableRow className="bg-muted/10 border-y border-border hover:bg-muted/10">
                  <TableCell colSpan={9} className="py-2.5 px-4 rounded-lg m-1">
                    <div className="flex justify-between items-center w-full">
                       <span className="font-black text-foreground uppercase tracking-widest text-xs flex items-center gap-2">
                         <FolderOpen className="w-4 h-4 text-purple-400" />
                         {groupName}
                       </span>
                       <span className="text-[10px] text-muted-foreground font-black bg-background border border-border px-3 py-1 rounded-full uppercase tracking-widest">
                         {groupTimesheets.length} Report • {formatDuration(groupTimesheets.reduce((a,b)=>a+b.durata_minuti,0))}
                       </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {groupTimesheets.map((t) => (
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
                    <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                      <CalendarIcon className="w-3.5 h-3.5 text-purple-400 hidden lg:block opacity-50" />
                      {format(parseISO(t.data_attivita), "dd MMM yy", { locale: it })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <UserIcon className="w-3 h-3 text-blue-400 hidden lg:block opacity-50" />
                      <span className="truncate">{t.user?.nome} {t.user?.cognome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div 
                      className={`space-y-0.5 truncate ${t.commessa_id ? 'cursor-pointer group-hover:opacity-90 transition-opacity' : ''}`}
                      onClick={() => t.commessa_id ? navigate(`/commesse/${t.commessa_id}`) : null}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-white hover:text-primary transition-colors truncate">
                        <Briefcase className="w-3.5 h-3.5 shrink-0 text-amber-500 hidden xl:block" />
                        <span className="truncate">{t.task_display_name || "Lavoro Generico"}</span>
                      </div>
                      {t.commessa_id && (
                        <div className="text-[9px] text-[#475569] uppercase font-black tracking-widest hover:text-primary/70 transition-colors">
                          C-{t.commessa_id.slice(0, 6)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="truncate">
                    <Badge variant="outline" className={`${getServiceColor(t.servizio)} text-[10px] tracking-widest uppercase font-black`}>
                      {t.servizio || "Standard"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-left whitespace-nowrap">
                    <div className="flex items-center justify-start gap-1.5 text-sm font-black text-foreground">
                      <Clock className="w-3.5 h-3.5 text-purple-400 opacity-60" />
                      {formatDuration(t.durata_minuti)}
                    </div>
                  </TableCell>
                  <TableCell className="text-left whitespace-nowrap">
                    <span className="text-sm font-black text-emerald-400">
                      €{t.costo_lavoro?.toLocaleString() || "0,00"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(t.stato)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px] bg-card border-border text-foreground">
                        <DropdownMenuLabel className="text-xs">Azioni</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-muted" />
                        <DropdownMenuItem 
                          onClick={() => onEdit(t)} 
                          className="cursor-pointer hover:bg-muted focus:bg-primary/10 focus:text-primary font-bold"
                        >
                          <Edit2 className="mr-2 h-4 w-4" /> Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onDuplicate && onDuplicate(t)} 
                          className="cursor-pointer hover:bg-muted focus:bg-primary/10 focus:text-primary font-bold"
                        >
                          <Copy className="mr-2 h-4 w-4" /> Duplica
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem 
                          onClick={async () => {
                            if (window.confirm("Sei sicuro di voler eliminare permanentemente questo record?")) {
                              await deleteMutation.mutateAsync([t.id]);
                            }
                          }}
                          className="cursor-pointer text-red-500 focus:text-red-400 hover:bg-red-500/10 font-bold"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
          {!timesheets.length && (
            <TableRow>
              <TableCell colSpan={9} className="h-32 text-center text-muted-foreground italic">
                Nessun record trovato
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <tfoot className="bg-muted/50 border-t border-border">
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5} className="text-right text-xs font-black uppercase text-muted-foreground tracking-widest pl-10 pr-4">
              Totali (Periodo selezionato)
            </TableCell>
            <TableCell className="text-left whitespace-nowrap">
              <div className="flex items-center justify-start gap-1.5 text-sm font-black text-purple-400">
                <Clock className="w-4 h-4" />
                {formatDuration(totalMinuti)}
              </div>
            </TableCell>
            <TableCell className="text-left">
              <span className="text-sm font-black text-emerald-400">
                €{totalCosto.toLocaleString()}
              </span>
            </TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </tfoot>
      </Table>
    </div>
  );
}
