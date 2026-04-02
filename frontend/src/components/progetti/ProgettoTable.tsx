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
  Building2,
  MoreHorizontal,
  ExternalLink,
  Filter
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
import type { Progetto } from "@/types";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ProgettoTableProps {
  progetti: Progetto[];
  onEdit: (progetto: Progetto) => void;
  onDelete: (progetto: Progetto) => void;
  isLoading: boolean;
}

export function ProgettoTable({ progetti, onEdit, onDelete, isLoading }: ProgettoTableProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredProgetti = progetti.filter((p) =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cliente?.ragione_sociale.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-full bg-[#1e293b] animate-pulse rounded-md" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 w-full bg-[#0f172a] animate-pulse rounded-md border border-[#1e293b]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
          <Input
            placeholder="Cerca progetto o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#0f172a] border-[#1e293b] text-white focus:ring-purple-500"
          />
        </div>
        <Button variant="outline" className="bg-[#0f172a] border-[#1e293b] text-[#94a3b8] hover:text-white hover:bg-[#1e293b]">
          <Filter className="w-4 h-4 mr-2" />
          Filtri
        </Button>
      </div>

      <div className="rounded-md border border-[#1e293b] bg-[#0f172a] overflow-hidden">
        <Table>
          <TableHeader className="bg-[#1e293b]/50">
            <TableRow className="border-[#1e293b] hover:bg-transparent">
              <TableHead className="text-[#94a3b8] font-medium py-4 pl-6">PROGETTO</TableHead>
              <TableHead className="text-[#94a3b8] font-medium">CLIENTE</TableHead>
              <TableHead className="text-[#94a3b8] font-medium">TIPO</TableHead>
              <TableHead className="text-[#94a3b8] font-medium">STATO</TableHead>
              <TableHead className="text-[#94a3b8] font-medium">BUDGET</TableHead>
              <TableHead className="text-right pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProgetti.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-[#64748b]">
                  Nessun progetto trovato.
                </TableCell>
              </TableRow>
            ) : (
              filteredProgetti.map((progetto) => (
                <TableRow 
                  key={progetto.id} 
                  className="border-[#1e293b] hover:bg-[#1e293b]/30 cursor-pointer group transition-colors"
                >
                  <TableCell className="py-4 pl-6" onClick={() => window.location.href = `/progetti/${progetto.id}`}>
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#f1f5f9] group-hover:text-purple-400 transition-colors">
                        {progetto.nome}
                      </span>
                      <span className="text-[11px] text-[#64748b] mt-0.5">
                        Creato il {format(new Date(progetto.created_at), "dd MMM yyyy", { locale: it })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell onClick={() => window.location.href = `/progetti/${progetto.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <Building2 className="w-3 h-3 text-purple-400" />
                      </div>
                      <span className="text-[#cbd5e1]">{progetto.cliente?.ragione_sociale || "N/A"}</span>
                    </div>
                  </TableCell>
                  <TableCell onClick={() => window.location.href = `/progetti/${progetto.id}`}>
                    <Badge 
                      variant="outline" 
                      className={`
                        ${progetto.tipo === "RETAINER" 
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        } font-medium px-2 py-0
                      `}
                    >
                      {progetto.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={() => window.location.href = `/progetti/${progetto.id}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${progetto.stato === "ATTIVO" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-500"}`} />
                      <span className={progetto.stato === "ATTIVO" ? "text-emerald-400" : "text-[#64748b]"}>
                        {progetto.stato}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell onClick={() => window.location.href = `/progetti/${progetto.id}`}>
                    <div className="flex flex-col">
                      <span className="text-[#cbd5e1] font-medium">€{(Number(progetto.importo_fisso) + Number(progetto.importo_variabile)).toLocaleString()}</span>
                      <span className="text-[10px] text-[#64748b]">Budget Totale</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-[#64748b] hover:text-white hover:bg-[#1e293b]">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#0f172a] border-[#1e293b] text-white">
                        <DropdownMenuLabel className="text-[#94a3b8]">Azioni</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-[#1e293b]" />
                        <DropdownMenuItem onClick={() => window.location.href = `/progetti/${progetto.id}`} className="hover:bg-[#1e293b] focus:bg-[#1e293b] cursor-pointer">
                          <ExternalLink className="mr-2 h-4 w-4" /> Vedi Dettaglio
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(progetto)} className="hover:bg-[#1e293b] focus:bg-[#1e293b] cursor-pointer">
                          <Pencil className="mr-2 h-4 w-4" /> Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(progetto)} className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer">
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
