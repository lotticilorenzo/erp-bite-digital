import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Pencil, 
  Trash2, 
  Search, 
  ArrowRight,
  Calculator,
  Calendar,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  User as UserIcon,
  Circle
} from "lucide-react";
import { EmptyState } from "../common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Pianificazione, PianificazioneStatus } from "@/types";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

interface PlanningTableProps {
  plans: Pianificazione[];
  onOpen: (plan: Pianificazione) => void;
  onEdit: (plan: Pianificazione) => void;
  onApprove: (plan: Pianificazione) => void;
  onDelete: (plan: Pianificazione) => void;
  onConvert: (plan: Pianificazione) => void;
  isLoading: boolean;
}

export function PlanningTable({ plans, onOpen, onEdit, onApprove, onDelete, onConvert, isLoading }: PlanningTableProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredPlans = plans.filter((p) =>
    p.cliente?.ragione_sociale.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.note?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 w-full bg-card animate-pulse rounded-md border border-border" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per cliente o note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border text-white focus:ring-purple-500"
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden shadow-2xl">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium py-4 pl-6 text-xs uppercase tracking-wider">Cliente / Data Creazione</TableHead>
              <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Stato</TableHead>
              <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Lavorazioni</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right text-xs uppercase tracking-wider">Budget Previsto</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right text-xs uppercase tracking-wider">Costo Stimato</TableHead>
              <TableHead className="text-muted-foreground font-medium text-center text-xs uppercase tracking-wider">Margine %</TableHead>
              <TableHead className="text-right pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-20">
                  <EmptyState 
                    icon={Calculator}
                    title="Nessuna Pianificazione"
                    description="Inizia a pianificare i costi e i margini per i prossimi progetti prima che diventino commesse attive."
                    actionLabel="Nuova Pianificazione"
                    onAction={() => window.dispatchEvent(new CustomEvent('open-new-planning-dialog'))}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredPlans.map((plan) => (
                <TableRow 
                  key={plan.id} 
                  className="border-border hover:bg-muted/30 group transition-colors cursor-pointer"
                  onClick={() => onOpen(plan)}
                >
                  <TableCell className="py-4 pl-6">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground group-hover:text-purple-400 transition-colors">
                        {plan.cliente?.ragione_sociale}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(plan.created_at), "PPP", { locale: it })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PlanningStatusBadge status={plan.stato} />
                  </TableCell>
                  <TableCell>
                    <div className="flex -space-x-2 overflow-hidden">
                      {plan.lavorazioni.map((lav, idx) => (
                        <div key={idx} className="inline-block h-6 w-6 rounded-full ring-2 ring-card bg-muted flex items-center justify-center overflow-hidden" title={`${lav.user?.nome} - ${lav.tipo_lavorazione}`}>
                           {lav.user?.avatar_url ? (
                            <img src={lav.user.avatar_url} alt="" className="h-full w-full object-cover" />
                           ) : (
                             <UserIcon className="w-3 h-3 text-muted-foreground" />
                           )}
                        </div>
                      ))}
                      {plan.lavorazioni.length === 0 && <span className="text-xs text-muted-foreground">Nessuna</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    €{plan.budget?.toLocaleString() || "0"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    €{plan.costo_totale?.toLocaleString() || "0"}
                  </TableCell>
                  <TableCell className="text-center">
                     <PlanningMarginBadge percentage={plan.margine_percentuale} />
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                       {plan.stato === "PENDING" && (
                         <Button
                            variant="outline"
                            size="sm"
                            className="h-8 bg-slate-500/10 text-slate-200 border-slate-400/20 hover:bg-slate-500/20 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              onApprove(plan);
                            }}
                          >
                            Approva
                          </Button>
                       )}
                       {plan.stato === "ACCEPTED" && (
                         <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 bg-blue-500/10 text-blue-300 border-blue-500/20 hover:bg-blue-500/20 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              onConvert(plan);
                            }}
                          >
                            <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                            Converti
                          </Button>
                       )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-white hover:bg-muted"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border text-white">
                          <DropdownMenuLabel className="text-muted-foreground">Azioni</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-muted" />
                          <DropdownMenuItem onClick={() => onOpen(plan)} className="hover:bg-muted focus:bg-muted cursor-pointer">
                            <Search className="mr-2 h-4 w-4" /> Apri dettaglio
                          </DropdownMenuItem>
                          {plan.stato !== "CONVERTED" && (
                            <DropdownMenuItem onClick={() => onEdit(plan)} className="hover:bg-muted focus:bg-muted cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" /> Modifica
                            </DropdownMenuItem>
                          )}
                          {plan.stato !== "CONVERTED" && (
                            <DropdownMenuItem onClick={() => onDelete(plan)} className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer">
                              <Trash2 className="mr-2 h-4 w-4" /> Elimina
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PlanningStatusBadge({ status }: { status: PianificazioneStatus }) {
  const styles: Record<string, string> = {
    PENDING: "bg-slate-500/10 text-slate-300 border-slate-500/20",
    ACCEPTED: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    CONVERTED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  const labels: Record<string, string> = {
    PENDING: "PENDING",
    ACCEPTED: "ACCEPTED",
    CONVERTED: "CONVERTED",
  };

  return (
    <Badge variant="outline" className={`${styles[status] || styles.PENDING} font-medium px-2 py-0`}>
      <Circle className="w-2 h-2 mr-1.5 fill-current animate-pulse" />
      {labels[status] || status}
    </Badge>
  );
}

function PlanningMarginBadge({ percentage }: { percentage: number | undefined | null }) {
  if (percentage === undefined || percentage === null) return <span className="text-[#475569] text-xs">N/A</span>;

  let color = "bg-red-500/10 text-red-100 border-red-500/20";
  let icon = <TrendingDown className="w-3 h-3 mr-1" />;

  if (percentage > 50) {
    color = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    icon = <TrendingUp className="w-3 h-3 mr-1" />;
  } else if (percentage >= 30) {
    color = "bg-amber-500/10 text-amber-100 border-amber-500/20";
    icon = <TrendingUp className="w-3 h-3 mr-1 text-amber-400" />;
  }

  return (
    <Badge variant="outline" className={`${color} font-bold px-2 py-0.5 min-w-[60px] justify-center text-[10px]`}>
      {icon}
      {percentage}%
    </Badge>
  );
}
