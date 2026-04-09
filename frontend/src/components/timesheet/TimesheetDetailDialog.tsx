import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Briefcase, 
  Clock, 
  Calendar, 
  User as UserIcon, 
  Edit2, 
  AlignLeft, 
  ExternalLink,
  Tag
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Timesheet } from "@/types";
import { Badge } from "@/components/ui/badge";
import { useDeleteTimesheetManual } from "@/hooks/useTimesheet";
import { Loader2, Trash2 } from "lucide-react";

interface TimesheetDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timesheet?: Timesheet;
  onEditClick: (timesheet: Timesheet) => void;
}

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export function TimesheetDetailDialog({ 
  open, 
  onOpenChange, 
  timesheet, 
  onEditClick 
}: TimesheetDetailDialogProps) {
  const deleteMutation = useDeleteTimesheetManual();

  if (!timesheet) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-card border-border shadow-2xl p-0 overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-primary/20 via-primary/5 to-transparent p-6 border-b border-border">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`font-black tracking-widest text-[10px] uppercase ${
                  timesheet.stato === 'APPROVATO' 
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' 
                    : timesheet.stato === 'PENDING'
                    ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                    : 'border-slate-500/30 text-slate-400 bg-slate-500/10'
                }`}>
                  {timesheet.stato}
                </Badge>
                <div className="flex items-center text-xs font-medium text-muted-foreground bg-black/20 px-2 py-0.5 rounded-full">
                  <Calendar className="w-3 h-3 mr-1.5 opacity-70" />
                  {timesheet.data_attivita ? format(parseISO(timesheet.data_attivita), "dd MMMM yyyy", { locale: it }) : "-"}
                </div>
              </div>
              
              <DialogTitle className="text-2xl font-black text-foreground tracking-tight leading-tight mt-3 mb-1">
                {timesheet.task_display_name || timesheet.servizio || "Attività Senza Nome"}
              </DialogTitle>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mt-2">
                <UserIcon className="w-4 h-4 text-purple-400 shrink-0" />
                {timesheet.user ? `${timesheet.user.nome} ${timesheet.user.cognome}` : 'Utente Sconosciuto'}
              </div>
            </div>

            <div className="flex flex-col items-end">
              <div className="bg-primary/10 border border-primary/20 text-primary rounded-xl px-4 py-3 flex flex-col items-center justify-center min-w-[80px]">
                <Clock className="w-5 h-5 mb-1 opacity-80" />
                <span className="text-xl font-black tracking-tighter">
                  {formatDuration(timesheet.durata_minuti)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Cliente e Commessa Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cliente Associato</span>
              {timesheet.commessa?.cliente ? (
                <Link 
                  to={`/clienti/${timesheet.commessa.cliente.id}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all text-sm font-medium group"
                >
                  <Building2 className="w-4 h-4 mr-2.5 text-blue-400 group-hover:text-primary transition-colors shrink-0" />
                  <span className="truncate flex-1 group-hover:text-primary transition-colors">
                    {timesheet.commessa.cliente.ragione_sociale}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                </Link>
              ) : (
                <div className="flex items-center p-3 rounded-lg bg-muted/10 border border-border/30 text-sm font-medium text-muted-foreground italic">
                  Non assegnato
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Commessa / Task</span>
              <div className="flex z-10 flex-col items-start p-3 rounded-lg bg-muted/30 border border-border/50 text-sm font-medium h-full justify-center group/commessa">
                <div className="flex w-full overflow-hidden items-center">
                  <Briefcase className="w-4 h-4 mr-2.5 text-orange-400 shrink-0" />
                  {timesheet.commessa ? (
                    <Link 
                      to={`/commesse/${timesheet.commessa.id}`} 
                      onClick={() => onOpenChange(false)}
                      className="truncate text-foreground hover:text-primary transition-colors flex itens-center flex-1"
                    >
                      {timesheet.commessa?.righe_progetto?.[0]?.progetto?.nome || "Commessa Generica"}
                    </Link>
                  ) : (
                    <span className="truncate text-foreground">Senza Commessa</span>
                  )}
                </div>
                {timesheet.clickup_task_id && (
                  <a 
                    href={`https://app.clickup.com/t/${timesheet.clickup_task_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 ml-6.5 text-[10px] font-bold text-[#64748b] hover:text-primary hover:bg-primary/10 transition-all flex items-center bg-black/20 px-1.5 py-0.5 rounded w-fit border border-transparent hover:border-primary/20"
                  >
                     <Tag className="w-2.5 h-2.5 mr-1" />
                     Task ID: {timesheet.clickup_task_id}
                     <ExternalLink className="w-2 h-2 ml-1" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Note / Servizio espanso */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center text-sm font-black text-foreground">
              <AlignLeft className="w-4 h-4 mr-2 text-purple-400" />
              Descrizione Dettagliata
            </div>
            <div className="bg-black/20 border border-white/5 rounded-lg p-4 min-h-[100px] text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {timesheet.note ? timesheet.note : (
                <span className="italic opacity-50">Nessuna nota aggiuntiva presente per questo timesheet. La descrizione faceva riferimento solo al servizio: {timesheet.servizio || "Sviluppo"}</span>
              )}
            </div>
            {timesheet.servizio && timesheet.note && (
              <div className="text-[11px] text-[#64748b] bg-muted/20 w-fit px-2 py-1 rounded inline-flex mt-2 border border-border">
                SERVIZIO: {timesheet.servizio}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/20 flex gap-2 sm:justify-between items-center sm:flex-row flex-col">
          <div className="flex w-full sm:w-auto gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-muted-foreground hover:text-white">
              Chiudi
            </Button>
            <Button 
              variant="destructive" 
              className="w-full sm:w-auto bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 font-bold gap-2"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                if (window.confirm("Sei sicuro di voler eliminare permanentemente questo record?")) {
                  await deleteMutation.mutateAsync(timesheet.id);
                  onOpenChange(false);
                }
              }}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </div>
          <Button 
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold gap-2 shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
            onClick={() => {
              onOpenChange(false);
              onEditClick(timesheet);
            }}
          >
            <Edit2 className="w-4 h-4" />
            Modifica Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
