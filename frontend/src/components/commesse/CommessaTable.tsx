import React from "react";
import { useNavigate } from "react-router-dom";
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
  Calendar,
  MoreHorizontal,
  ExternalLink,
  Filter,
  TrendingDown,
  TrendingUp,
  FileText
} from "lucide-react";
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
import type { Commessa, CommessaStatus } from "@/types";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

interface CommessaTableProps {
  commesse: Commessa[];
  onEdit: (commessa: Commessa) => void;
  onDelete: (commessa: Commessa) => void;
  isLoading: boolean;
}

export function CommessaTable({ commesse, onEdit, onDelete, isLoading }: CommessaTableProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredCommesse = commesse.filter((c) =>
    c.cliente?.ragione_sociale.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.mese_competenza.includes(searchTerm)
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
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per cliente o mese..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border text-white focus:ring-purple-500"
          />
        </div>
        <Button variant="outline" className="bg-card border-border text-muted-foreground hover:text-white">
          <Filter className="w-4 h-4 mr-2" />
          Filtri
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium py-4 pl-6">CLIENTE / MESE</TableHead>
              <TableHead className="text-muted-foreground font-medium">STATO</TableHead>
              <TableHead className="text-muted-foreground font-medium">SCOPE</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right">MANODOPERA</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right">FATTURABILE</TableHead>
              <TableHead className="text-muted-foreground font-medium text-center">MARGINE %</TableHead>
              <TableHead className="text-muted-foreground font-medium">FATTURA</TableHead>
              <TableHead className="text-right pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCommesse.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Nessuna commessa trovata.
                </TableCell>
              </TableRow>
            ) : (
              filteredCommesse.map((commessa) => (
                <TableRow 
                  key={commessa.id} 
                  className="border-border hover:bg-muted/30 cursor-pointer group transition-colors"
                  onClick={() => navigate(`/commesse/${commessa.id}`)}
                >
                  <TableCell className="py-4 pl-6">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground group-hover:text-purple-400 transition-colors">
                        {commessa.cliente?.ragione_sociale}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(commessa.mese_competenza), "MMMM yyyy", { locale: it })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CommessaStatusBadge status={commessa.stato} />
                  </TableCell>
                  <TableCell>
                    <CommessaScopeBadge oreReali={commessa.ore_reali} oreContratto={commessa.ore_contratto} />
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    €{commessa.costo_manodopera?.toLocaleString() || "0"}
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    €{commessa.valore_fatturabile?.toLocaleString() || "0"}
                  </TableCell>
                  <TableCell className="text-center">
                     <CommessaMarginBadge percentage={commessa.margine_percentuale} />
                  </TableCell>
                  <TableCell>
                    {commessa.fattura_numero ? (
                      <div className="flex items-center gap-2 text-xs text-blue-400">
                        <FileText className="w-3 h-3" />
                        <span>{commessa.fattura_numero}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#475569]">Non collegata</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-white hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border text-white">
                        <DropdownMenuLabel className="text-muted-foreground">Azioni</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-muted" />
                        <DropdownMenuItem onClick={() => navigate(`/commesse/${commessa.id}`)} className="hover:bg-muted focus:bg-muted cursor-pointer">
                          <ExternalLink className="mr-2 h-4 w-4" /> Vedi Dettaglio
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(commessa)} className="hover:bg-muted focus:bg-muted cursor-pointer">
                          <Pencil className="mr-2 h-4 w-4" /> Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(commessa)} className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer">
                          <Trash2 className="mr-2 h-4 w-4" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

function CommessaStatusBadge({ status }: { status: CommessaStatus }) {
  const styles: Record<string, string> = {
    APERTA: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    PRONTA_CHIUSURA: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    CHIUSA: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    FATTURATA: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    INCASSATA: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };

  return (
    <Badge variant="outline" className={`${styles[status] || styles.APERTA} font-medium px-2 py-0`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

function CommessaMarginBadge({ percentage }: { percentage: number | undefined | null }) {
  if (percentage === undefined || percentage === null) return <span className="text-[#475569] text-xs">N/A</span>;

  let color = "bg-red-500/10 text-red-400 border-red-500/20";
  let icon = <TrendingDown className="w-3 h-3 mr-1" />;

  if (percentage > 30) {
    color = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    icon = <TrendingUp className="w-3 h-3 mr-1" />;
  } else if (percentage >= 15) {
    color = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    icon = <TrendingUp className="w-3 h-3 mr-1 text-amber-400/70" />;
  }

  return (
    <Badge variant="outline" className={`${color} font-bold px-2 py-0.5 min-w-[60px] justify-center`}>
      {icon}
      {percentage}%
    </Badge>
  );
}

function CommessaScopeBadge({ oreReali, oreContratto }: { oreReali: number; oreContratto: number }) {
  if (!oreContratto || oreContratto <= 0) return <span className="text-[10px] text-muted-foreground uppercase opacity-50 italic">No scope set</span>;

  const percentage = (oreReali / oreContratto) * 100;
  
  let color = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  let label = "IN SCOPE";

  if (percentage >= 100) {
    color = "bg-red-500/10 text-red-100 border-red-500/20";
    label = `EXTRA ${(oreReali - oreContratto).toFixed(1)}h`;
  } else if (percentage >= 80) {
    color = "bg-amber-500/10 text-amber-100 border-amber-500/20";
    label = "WARNING";
  }

  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline" className={`${color} font-black text-[9px] px-1.5 py-0 justify-center tracking-tighter`}>
        {label}
      </Badge>
      <div className="w-16 h-1bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
          style={{ width: `${Math.min(100, percentage)}%` }} 
        />
      </div>
    </div>
  );
}
