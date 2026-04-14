import React, { useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommessaTable } from "@/components/commesse/CommessaTable";
import { CommessaDialog } from "@/components/commesse/CommessaDialog";
import { useCommesse, useDeleteCommessa } from "@/hooks/useCommesse";
import { useCliente } from "@/hooks/useClienti";
import type { Commessa, CommessaStatus } from "@/types";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePianificazioni, useDeletePianificazione, useConvertPianificazione } from "@/hooks/usePianificazioni";
import { PlanningTable } from "@/components/planning/PlanningTable";
import { PlanningDialog } from "@/components/planning/PlanningDialog";
import type { Pianificazione } from "@/types";
import { Calculator } from "lucide-react";
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
  const statoFilter = searchParams.get("stato") as CommessaStatus | undefined;

  const { data: commesse = [], isLoading } = useCommesse({
    cliente_id: clienteIdFilter,
    mese: meseFilter,
    stato: statoFilter,
  });
  const { data: clienteFiltro } = useCliente(clienteIdFilter);
  const deleteCommessa = useDeleteCommessa();
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isPlanningDialogOpen, setIsPlanningDialogOpen] = React.useState(false);
  const [selectedCommessa, setSelectedCommessa] = React.useState<Commessa | null>(null);
  const [selectedPlanning, setSelectedPlanning] = React.useState<Pianificazione | null>(null);
  const [commessaToDelete, setCommessaToDelete] = React.useState<Commessa | null>(null);
  const [planningToDelete, setPlanningToDelete] = React.useState<Pianificazione | null>(null);
  const [planningToConvert, setPlanningToConvert] = React.useState<Pianificazione | null>(null);
  const [conversionMese, setConversionMese] = React.useState(format(new Date(), "yyyy-MM"));

  const activeTab = searchParams.get("tab") || "commesse";

  const { data: pianificazioni = [], isLoading: isPlanningLoading } = usePianificazioni({
    cliente_id: clienteIdFilter,
  });

  const deletePlanning = useDeletePianificazione();
  const convertPlanning = useConvertPianificazione();

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

    const openPlanningListener = () => {
      setSelectedPlanning(null);
      setIsPlanningDialogOpen(true);
    };
    window.addEventListener('open-new-planning-dialog', openPlanningListener);
    
    return () => {
      window.removeEventListener('open-new-planning-dialog', openPlanningListener);
    };
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
    statoFilter ? `stato ${statoFilter.replace("_", " ")}` : null,
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
          <Button 
            onClick={() => {
              setSelectedPlanning(null);
              setIsPlanningDialogOpen(true);
            }}
            variant="outline"
            className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-white transition-all shadow-[0_0_15px_hsl(var(--purple-500)/0.1)]"
          >
            <Calculator className="w-4 h-4 mr-2" />
            Nuova Pianificazione
          </Button>
        </div>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={(v) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", v);
        setSearchParams(nextParams, { replace: true });
      }}>
        <TabsList className="bg-muted/50 p-1 border border-border">
          <TabsTrigger value="commesse" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Esecuzione (Commesse)
          </TabsTrigger>
          <TabsTrigger value="pianificazioni" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            Pianificazione
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commesse" className="mt-6 space-y-6">
          <CommessaTable 
            commesse={commesse} 
            isLoading={isLoading} 
            onEdit={handleEdit}
            onDelete={(c) => setCommessaToDelete(c)}
          />
        </TabsContent>

        <TabsContent value="pianificazioni" className="mt-6 space-y-6">
          <PlanningTable 
            plans={pianificazioni}
            isLoading={isPlanningLoading}
            onEdit={(p) => {
              setSelectedPlanning(p);
              setIsPlanningDialogOpen(true);
            }}
            onDelete={(p) => setPlanningToDelete(p)}
            onConvert={(p) => setPlanningToConvert(p)}
          />
        </TabsContent>
      </Tabs>


      <CommessaDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        commessa={selectedCommessa} 
      />

      <PlanningDialog
        open={isPlanningDialogOpen}
        onOpenChange={setIsPlanningDialogOpen}
        plan={selectedPlanning}
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

      <Dialog open={!!planningToDelete} onOpenChange={() => setPlanningToDelete(null)}>
        <DialogContent className="bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle>Elimina Pianificazione</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Sei sicuro di voler eliminare la pianificazione per <strong>{planningToDelete?.cliente?.ragione_sociale}</strong>? 
              Tutti i dati preventivati andranno persi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlanningToDelete(null)}>Annulla</Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (planningToDelete) {
                  await deletePlanning.mutateAsync(planningToDelete.id);
                  setPlanningToDelete(null);
                }
              }}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!planningToConvert} onOpenChange={() => setPlanningToConvert(null)}>
        <DialogContent className="bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle>Converti in Commessa</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Stai per trasformare la pianificazione di <strong>{planningToConvert?.cliente?.ragione_sociale}</strong> in una commessa operativa.
              Scegli il mese di competenza per la fatturazione.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
               <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">Mese Competenza</label>
               <Input 
                  type="month" 
                  className="bg-muted border-border text-white" 
                  value={conversionMese}
                  onChange={(e) => setConversionMese(e.target.value)}
                />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlanningToConvert(null)}>Annulla</Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={async () => {
                if (planningToConvert) {
                  const [year, month] = conversionMese.split("-");
                  const meseStr = `${year}-${month}-01`;
                  await convertPlanning.mutateAsync({ id: planningToConvert.id, mese_competenza: meseStr });
                  setPlanningToConvert(null);
                }
              }}
            >
              Conferma Conversione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
