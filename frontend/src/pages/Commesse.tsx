import React, { useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommessaTable } from "@/components/commesse/CommessaTable";
import { CommessaDialog } from "@/components/commesse/CommessaDialog";
import { useCommesse, useDeleteCommessa } from "@/hooks/useCommesse";
import { useCliente } from "@/hooks/useClienti";
import type { Commessa } from "@/types";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CommessePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clienteIdFilter = searchParams.get("cliente_id") || undefined;
  const clienteNomeFilter = searchParams.get("cliente_nome") || undefined;
  const meseFilter = searchParams.get("mese") || undefined;

  const { data: commesse = [], isLoading } = useCommesse({
    cliente_id: clienteIdFilter,
    mese: meseFilter,
  });
  const { data: clienteFiltro } = useCliente(clienteIdFilter);
  const deleteCommessa = useDeleteCommessa();
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedCommessa, setSelectedCommessa] = React.useState<Commessa | null>(null);
  const [commessaToDelete, setCommessaToDelete] = React.useState<Commessa | null>(null);

  const handleEdit = (commessa: Commessa) => {
    setSelectedCommessa(commessa);
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedCommessa(null);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      handleNew();
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("action");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const clearClienteFilter = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("cliente_id");
    nextParams.delete("cliente_nome");
    setSearchParams(nextParams, { replace: true });
  };

  const clearMeseFilter = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("mese");
    setSearchParams(nextParams, { replace: true });
  };

  const meseLabel = meseFilter ? format(parseISO(meseFilter), "MMM yyyy", { locale: it }) : null;
  const activeFilters = [
    clienteIdFilter ? `cliente ${clienteFiltro?.ragione_sociale || clienteNomeFilter || "selezionato"}` : null,
    meseLabel ? `mese ${meseLabel}` : null,
  ].filter(Boolean);

  const handleDeleteConfirm = async () => {
    if (commessaToDelete) {
      try {
        await deleteCommessa.mutateAsync(commessaToDelete.id);
        setCommessaToDelete(null);
      } catch (error) {
        console.error("Errore durante l'eliminazione della commessa:", error);
      }
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Commesse</h1>
          <p className="text-muted-foreground mt-1">
            {activeFilters.length > 0
              ? `Vista filtrata per ${activeFilters.join(" · ")}.`
              : "Gestisci l'avanzamento economico e la fatturazione mensile per cliente."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {clienteIdFilter && (
            <Button variant="outline" onClick={clearClienteFilter}>
              Rimuovi cliente
            </Button>
          )}
          {meseFilter && (
            <Button variant="outline" onClick={clearMeseFilter}>
              Rimuovi mese
            </Button>
          )}
          <Button 
            onClick={handleNew}
            className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_hsl(var(--primary)/0.2)] transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuova Commessa
          </Button>
        </div>
      </div>

      <CommessaTable 
        commesse={commesse} 
        isLoading={isLoading} 
        onEdit={handleEdit}
        onDelete={(c) => setCommessaToDelete(c)}
      />

      <CommessaDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        commessa={selectedCommessa} 
      />

      <Dialog open={!!commessaToDelete} onOpenChange={() => setCommessaToDelete(null)}>
        <DialogContent className="bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle>Sei sicuro?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Questa azione eliminerà permanentemente la commessa per <strong>{commessaToDelete?.cliente?.ragione_sociale}</strong> ({commessaToDelete?.mese_competenza}) e tutti i dati associati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCommessaToDelete(null)} className="text-muted-foreground hover:text-white hover:bg-muted">
              Annulla
            </Button>
            <Button onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700 text-white">
              Sì, elimina commessa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
