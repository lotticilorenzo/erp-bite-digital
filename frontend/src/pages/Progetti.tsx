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
import { PageTransition } from "@/components/common/PageTransition";

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
    <PageTransition>
      <div className="p-8 space-y-8 pb-20">
        <div className="flex justify-between items-start">
          <header className="flex flex-col gap-1 px-1">
            <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic underline decoration-primary/30 decoration-8 underline-offset-[12px] mb-4">
              Progetti
            </h1>
            <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mt-2">
              Monitoraggio operativo di budget, marginalità e performance creativa.
            </p>
          </header>
          <Button 
            onClick={() => {
              setSelectedProgetto(null);
              setIsDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-[10px] font-black uppercase italic tracking-widest text-primary-foreground shadow-xl shadow-[0_0_20px_hsl(var(--primary)/0.2)] h-10 px-6 rounded-xl transition-all active:scale-[0.98]"
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
          <DialogContent className="bg-card/90 backdrop-blur-xl border-border/50 text-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic tracking-tight">Sei sicuro?</DialogTitle>
              <DialogDescription className="text-slate-400 font-medium">
                Questa azione eliminerà permanentemente <strong>{progettoToDelete?.nome}</strong>. Questa operazione non è reversibile.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 flex gap-3">
              <Button variant="ghost" onClick={() => setProgettoToDelete(null)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">
                Annulla
              </Button>
              <Button onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase italic text-[10px] tracking-widest shadow-lg shadow-red-900/20">
                Sì, elimina progetto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
