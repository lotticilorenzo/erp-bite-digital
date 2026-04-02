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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Search, 
  UserPlus,
  Building2,
  Mail,
  Phone,
  ExternalLink
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Cliente } from "@/types";
import { useDeleteCliente } from "@/hooks/useClienti";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// We need to create the Badge component if it doesn't exist
// Or I'll just use a div with classes for now if I forget to add it via shadcn.
// Let's assume I'll add it.

interface ClienteTableProps {
  clienti: Cliente[];
  isLoading: boolean;
  onEdit: (cliente: Cliente) => void;
  onNew: () => void;
}

export function ClienteTable({ clienti, isLoading, onEdit, onNew }: ClienteTableProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const deleteCliente = useDeleteCliente();

  const filteredClienti = clienti.filter((c) =>
    c.ragione_sociale.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.piva?.includes(searchTerm)
  );

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCliente.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-[300px] bg-[#1e293b]" />
          <Skeleton className="h-10 w-[120px] bg-primary/20" />
        </div>
        <div className="rounded-xl border border-[#1e293b] overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full mb-[1px] bg-[#0f172a]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#0f172a] p-4 rounded-xl border border-[#1e293b] shadow-xl">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
          <Input
            placeholder="Cerca per ragione sociale, email o P.IVA..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#1e293b] border-[#334155] text-[#f1f5f9] focus:ring-primary w-full"
          />
        </div>
        <Button onClick={onNew} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 w-full md:w-auto">
          <UserPlus className="mr-2 h-4 w-4" /> Nuovo Cliente
        </Button>
      </div>

      <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] shadow-2xl overflow-hidden">
        <Table>
          <TableHeader className="bg-[#1e293b]/50">
            <TableRow className="hover:bg-transparent border-[#1e293b]">
              <TableHead className="text-[#94a3b8] font-bold py-4">Ragione Sociale</TableHead>
              <TableHead className="text-[#94a3b8] font-bold">Email / Tel</TableHead>
              <TableHead className="text-[#94a3b8] font-bold text-center">Stato</TableHead>
              <TableHead className="text-right text-[#94a3b8] font-bold pr-6">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClienti.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-[#64748b]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Building2 className="h-8 w-8 opacity-20" />
                    <p>Nessun cliente trovato</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredClienti.map((cliente) => (
                <TableRow 
                  key={cliente.id} 
                  className="group hover:bg-[#1e293b]/30 border-[#1e293b] transition-colors cursor-pointer"
                  onClick={() => onEdit(cliente)}
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 group-hover:bg-primary/20 transition-colors">
                        {cliente.ragione_sociale.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[#f1f5f9] group-hover:text-primary transition-colors">
                          {cliente.ragione_sociale}
                        </span>
                        <span className="text-[11px] text-[#64748b]">P.IVA: {cliente.piva || "---"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {cliente.email && (
                        <div className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                          <Mail className="h-3 w-3" /> {cliente.email}
                        </div>
                      )}
                      {cliente.telefono && (
                        <div className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                          <Phone className="h-3 w-3" /> {cliente.telefono}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      cliente.attivo 
                        ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                        : "bg-red-500/10 text-red-500 border border-red-500/20"
                    }`}>
                      {cliente.attivo ? "Attivo" : "Inattivo"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-[#64748b] hover:text-white hover:bg-[#1e293b]">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#0f172a] border-[#1e293b] text-[#f1f5f9]">
                        <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-[#1e293b]" />
                        <DropdownMenuItem onClick={() => onEdit(cliente)} className="focus:bg-primary/10 focus:text-primary">
                          <Pencil className="mr-2 h-4 w-4" /> Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-primary/10 focus:text-primary">
                          <ExternalLink className="mr-2 h-4 w-4" /> Vedi Dettagli
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#1e293b]" />
                        <DropdownMenuItem 
                          onClick={() => setDeleteId(cliente.id)}
                          className="text-red-500 focus:bg-red-500/10 focus:text-red-500"
                        >
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

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-[#0f172a] border-[#1e293b] text-white">
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">
              Sei sicuro di voler eliminare questo cliente? L'azione è irreversibile e potrebbe influire su progetti e commesse collegati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-[#94a3b8]">Annulla</Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteCliente.isPending}
            >
              {deleteCliente.isPending ? "Eliminazione..." : "Elimina Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
