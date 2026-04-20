import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  FileText,
  User,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Edit3,
  Trash2,
  GitBranch,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface FattureTableProps {
  data: any[];
  type: "attive" | "passive";
  onAction?: (fattura: any, action: "view" | "edit" | "delete" | "imputa") => void;
}

export function FattureTable({ data, type, onAction }: FattureTableProps) {
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "paid" || s === "incassata" || s === "pagata") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 font-bold px-2.5 py-0.5 uppercase text-[10px] tracking-widest">
          <CheckCircle2 className="h-3 w-3" />
          Pagata
        </Badge>
      );
    }
    if (s === "overdue" || s === "scaduta") {
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20 gap-1.5 font-bold px-2.5 py-0.5 uppercase text-[10px] tracking-widest">
          <AlertCircle className="h-3 w-3" />
          Scaduta
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1.5 font-bold px-2.5 py-0.5 uppercase text-[10px] tracking-widest">
        <Clock className="h-3 w-3" />
        In Attesa
      </Badge>
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-card/20 border border-dashed border-border rounded-3xl">
        <FileText className="h-12 w-12 text-[#1e293b] mb-4" />
        <p className="text-[#475569] font-bold uppercase tracking-widest text-xs">Nessuna fattura trovata</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/50 bg-card/30 overflow-hidden backdrop-blur-sm">
      <Table>
        <TableHeader className="bg-card/50">
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12">Numero</TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12">
              {type === "attive" ? "Cliente" : "Fornitore"}
            </TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12 text-center">Data</TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12 text-right">Imponibile</TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12 text-right">Totale</TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12 text-center">Stato</TableHead>
            <TableHead className="text-[10px] uppercase font-black tracking-widest text-[#475569] h-12 text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className="group border-border/30 hover:bg-primary/5 transition-colors duration-300">
              <TableCell className="font-mono text-xs font-bold text-foreground">
                {item.numero || "N/D"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white truncate max-w-[200px]">
                      {item.cliente?.ragione_sociale || item.fornitore?.ragione_sociale || "Cliente Sconosciuto"}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-white uppercase tabular-nums">
                    {item.data_emissione ? format(new Date(item.data_emissione), "dd MMM yyyy", { locale: it }) : "—"}
                  </span>
                  {item.data_scadenza && (
                    <span className="text-[9px] font-bold text-[#475569] uppercase mt-0.5">
                      Scad. {format(new Date(item.data_scadenza), "dd/MM/yy")}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                {formatCurrency(item.importo_netto || 0)}
              </TableCell>
              <TableCell className="text-right">
                <span className="font-mono text-xs font-black text-white">
                  {formatCurrency(item.importo_totale)}
                </span>
              </TableCell>
              <TableCell className="text-center">
                {getStatusBadge(item.stato_pagamento)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-[#475569] hover:text-white hover:bg-primary transition-all duration-300 shadow-lg outline-none">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-border/50 rounded-xl p-2 shadow-2xl">
                      <DropdownMenuItem 
                        onClick={() => onAction?.(item, "view")}
                        className="flex items-center gap-2 rounded-lg py-2 cursor-pointer focus:bg-primary/10 focus:text-primary transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Visualizza</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onAction?.(item, "edit")}
                        className="flex items-center gap-2 rounded-lg py-2 cursor-pointer focus:bg-primary/10 focus:text-primary transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Modifica</span>
                      </DropdownMenuItem>
                      {type === "passive" && (
                        <DropdownMenuItem
                          onClick={() => onAction?.(item, "imputa")}
                          className="flex items-center gap-2 rounded-lg py-2 cursor-pointer focus:bg-primary/10 focus:text-primary transition-colors"
                        >
                          <GitBranch className="h-4 w-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Imputa Costi</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="bg-border/50 my-1" />
                      <DropdownMenuItem
                        onClick={() => onAction?.(item, "delete")}
                        className="flex items-center gap-2 rounded-lg py-2 cursor-pointer text-rose-500 focus:bg-rose-500/10 focus:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Elimina</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
