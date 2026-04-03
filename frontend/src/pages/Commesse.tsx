import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommessaTable } from "@/components/commesse/CommessaTable";
import { CommessaDialog } from "@/components/commesse/CommessaDialog";
import { useCommesse, useDeleteCommessa } from "@/hooks/useCommesse";
import type { Commessa } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CommessePage() {
  const { data: commesse = [], isLoading } = useCommesse();
  const deleteCommessa = useDeleteCommessa();
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedCommessa, setSelectedCommessa] = React.useState<Commessa | null>(null);
  const [commessaToDelete, setCommessaToDelete] = React.useState<Commessa | null>(null);

  const handleEdit = (commessa: Commessa) => {
    setSelectedCommessa(commessa);
    setIsDialogOpen(true);
  };

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
            Gestisci l'avanzamento economico e la fatturazione mensile per cliente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => {
              setSelectedCommessa(null);
              setIsDialogOpen(true);
            }}
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
