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
          <h1 className="text-3xl font-bold text-[#f1f5f9] tracking-tight">Commesse</h1>
          <p className="text-[#94a3b8] mt-1">
            Gestisci l'avanzamento economico e la fatturazione mensile per cliente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => {
              setSelectedCommessa(null);
              setIsDialogOpen(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all hover:scale-105"
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
        <DialogContent className="bg-[#0f172a] border-[#1e293b] text-white">
          <DialogHeader>
            <DialogTitle>Sei sicuro?</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">
              Questa azione eliminerà permanentemente la commessa per <strong>{commessaToDelete?.cliente?.ragione_sociale}</strong> ({commessaToDelete?.mese_competenza}) e tutti i dati associati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCommessaToDelete(null)} className="text-[#94a3b8] hover:text-white hover:bg-[#1e293b]">
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
