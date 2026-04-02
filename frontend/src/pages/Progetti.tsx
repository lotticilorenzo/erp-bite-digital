import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgettoTable } from "@/components/progetti/ProgettoTable";
import { ProgettoDialog } from "@/components/progetti/ProgettoDialog";
import { useProgetti, useDeleteProgetto } from "@/hooks/useProgetti";
import type { Progetto } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProgettiPage() {
  const { data: progetti = [], isLoading } = useProgetti();
  const deleteProgetto = useDeleteProgetto();
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedProgetto, setSelectedProgetto] = React.useState<Progetto | null>(null);
  const [progettoToDelete, setProgettoToDelete] = React.useState<Progetto | null>(null);

  const handleEdit = (progetto: Progetto) => {
    setSelectedProgetto(progetto);
    setIsDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (progettoToDelete) {
      try {
        await deleteProgetto.mutateAsync(progettoToDelete.id);
        setProgettoToDelete(null);
      } catch (error) {
        console.error("Errore durante l'eliminazione del progetto:", error);
      }
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-[#f1f5f9] tracking-tight">Progetti</h1>
          <p className="text-[#94a3b8] mt-1">
            Gestisci i progetti attivi, i retainer e le commesse one-off.
          </p>
        </div>
        <Button 
          onClick={() => {
            setSelectedProgetto(null);
            setIsDialogOpen(true);
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Progetto
        </Button>
      </div>

      <ProgettoTable 
        progetti={progetti} 
        isLoading={isLoading} 
        onEdit={handleEdit}
        onDelete={(p) => setProgettoToDelete(p)}
      />

      <ProgettoDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        progetto={selectedProgetto} 
      />

      <Dialog open={!!progettoToDelete} onOpenChange={() => setProgettoToDelete(null)}>
        <DialogContent className="bg-[#0f172a] border-[#1e293b] text-white">
          <DialogHeader>
            <DialogTitle>Sei sicuro?</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">
              Questa azione eliminerà permanentemente il progetto <strong>{progettoToDelete?.nome}</strong> e tutti i dati associati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProgettoToDelete(null)} className="text-[#94a3b8] hover:text-white hover:bg-[#1e293b]">
              Annulla
            </Button>
            <Button onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700 text-white">
              Sì, elimina progetto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
