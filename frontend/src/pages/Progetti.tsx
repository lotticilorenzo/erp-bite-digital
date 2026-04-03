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
        <header className="flex flex-col gap-1">
        <h1 className="text-4xl font-black tracking-tight text-foreground mb-1">Progetti</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Monitora lo stato, il budget e la marginalità di tutti i tuoi progetti creativi.
        </p>
      </header>
        <Button 
          onClick={() => {
            setSelectedProgetto(null);
            setIsDialogOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_hsl(var(--primary)/0.2)] transition-all hover:scale-105"
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
        <DialogContent className="bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle>Sei sicuro?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Questa azione eliminerà permanentemente il progetto <strong>{progettoToDelete?.nome}</strong> e tutti i dati associati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProgettoToDelete(null)} className="text-muted-foreground hover:text-white hover:bg-muted">
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
