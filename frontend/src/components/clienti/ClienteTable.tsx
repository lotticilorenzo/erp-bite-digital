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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useDeleteCliente, useClientHealthScore } from "@/hooks/useClienti";
// ... existing imports

function HealthIndicator({ id }: { id: string }) {
  const { data: health, isLoading } = useClientHealthScore(id);

  if (isLoading) return <div className="h-4 w-12 bg-muted animate-pulse rounded mx-auto" />;
  if (!health) return <span className="text-muted-foreground text-xs">--</span>;

  const score = health.score;
  let color = "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]";
  if (score < 40) color = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]";
  else if (score < 70) color = "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs font-black text-foreground">{score}%</div>
      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden p-[1px] border border-white/5">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ... existing ClienteTable component
import { ClientAvatar } from "../common/ClientAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClienteTableProps {
  clienti: Cliente[];
  isLoading: boolean;
  onEdit: (cliente: Cliente) => void;
  onNew: () => void;
}

export function ClienteTable({ clienti, isLoading, onEdit, onNew }: ClienteTableProps) {
  const navigate = useNavigate();
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
          <Skeleton className="h-10 w-[300px] bg-muted" />
          <Skeleton className="h-10 w-[120px] bg-primary/20" />
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full mb-[1px] bg-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-xl">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per ragione sociale, email o P.IVA..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted border-border text-foreground focus:ring-primary w-full"
          />
        </div>
        <Button onClick={onNew} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-[0_0_20px_hsl(var(--primary)/0.2)] w-full md:w-auto">
          <UserPlus className="mr-2 h-4 w-4" /> Nuovo Cliente
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-muted-foreground font-bold py-4 pl-6 font-black uppercase text-[10px] tracking-widest">Ragione Sociale</TableHead>
              <TableHead className="text-muted-foreground font-bold font-black uppercase text-[10px] tracking-widest">Email / Tel</TableHead>
              <TableHead className="text-muted-foreground font-bold text-center font-black uppercase text-[10px] tracking-widest">Health</TableHead>
              <TableHead className="text-muted-foreground font-bold text-center font-black uppercase text-[10px] tracking-widest">Stato</TableHead>
              <TableHead className="text-right text-muted-foreground font-bold pr-6 font-black uppercase text-[10px] tracking-widest">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClienti.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
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
                  className="group hover:bg-muted/30 border-border transition-colors cursor-pointer"
                  onClick={() => navigate(`/clienti/${cliente.id}`)}
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <ClientAvatar 
                        name={cliente.ragione_sociale} 
                        logoUrl={cliente.logo_url} 
                        size="sm" 
                        className="rounded-lg border-border"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {cliente.ragione_sociale}
                        </span>
                        <span className="text-[11px] text-muted-foreground">P.IVA: {cliente.piva || "---"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {cliente.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {cliente.email}
                        </div>
                      )}
                      {cliente.telefono && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {cliente.telefono}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <HealthIndicator id={cliente.id} />
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
                        <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-white hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                        <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-muted" />
                        <DropdownMenuItem onClick={() => onEdit(cliente)} className="focus:bg-primary/10 focus:text-primary">
                          <Pencil className="mr-2 h-4 w-4" /> Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/clienti/${cliente.id}`)} className="focus:bg-primary/10 focus:text-primary">
                          <ExternalLink className="mr-2 h-4 w-4" /> Vedi Dettagli
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-muted" />
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
        <DialogContent className="bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Sei sicuro di voler eliminare questo cliente? L'azione è irreversibile e potrebbe influire su progetti e commesse collegati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-muted-foreground">Annulla</Button>
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
