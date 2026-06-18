import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useProgetti } from "@/hooks/useProgetti";
import { useCommesse, useCreateCommessa, useUpdateCommessa } from "@/hooks/useCommesse";
import { Loader2, Plus, Info, CheckCircle2, AlertCircle, Euro } from "lucide-react";
import { toast } from "sonner";
import type { Progetto } from "@/types";

interface CommessaSelectionDialogProps {
  progetto: Progetto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CommessaSelectionDialog({ progetto, open, onOpenChange, onSuccess }: CommessaSelectionDialogProps) {
  const navigate = useNavigate();
  const [meseCompetenza, setMeseCompetenza] = useState(format(new Date(), "yyyy-MM-01"));
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  
  const monthName = useMemo(() => {
    try {
      return format(new Date(meseCompetenza), "MMMM yyyy", { locale: it });
    } catch (e) {
      return "Mese non valido";
    }
  }, [meseCompetenza]);

  // 1. Cerca se esiste già una commessa per questo cliente e questo mese
  const { data: commesseMese, isLoading: isLoadingCommesse } = useCommesse({
    cliente_id: progetto.cliente_id,
    mese: meseCompetenza
  }, open);
  
  // 2. Recupera tutti i progetti attivi del cliente
  const { data: progettiCliente, isLoading: isLoadingProgetti } = useProgetti(progetto.cliente_id, "ATTIVO");
  const createCommessa = useCreateCommessa();
  const updateCommessa = useUpdateCommessa();

  const existingCommessa = commesseMese?.[0];

  // Filtra i progetti che non sono ancora in una commessa per questo mese
  const availableProjects = useMemo(() => {
    if (!progettiCliente) return [];
    
    // Se la commessa esiste già, escludiamo quelli già collegati
    const alreadyLinkedIds = existingCommessa?.righe_progetto?.map(r => r.progetto_id) || [];
    
    return progettiCliente.filter(p => 
      p.id !== progetto.id && // Escludiamo il progetto corrente che è sempre selezionato
      !alreadyLinkedIds.includes(p.id)
    );
  }, [progettiCliente, existingCommessa, progetto.id]);

  // Resetta lo stato quando apre
  React.useEffect(() => {
    if (open) {
      setSelectedProjectIds([progetto.id]);
      setNote("");
    }
  }, [open, progetto.id]);

  const isPending = createCommessa.isPending || updateCommessa.isPending;
  const isLoading = isLoadingCommesse || isLoadingProgetti;

  const handleConfirm = async () => {
    if (isPending) return;
    try {
      if (existingCommessa) {
        // AGGIUNTA A COMMESSA ESISTENTE
        const currentRows = existingCommessa.righe_progetto.map(r => ({
          progetto_id: r.progetto_id,
          importo_fisso: r.importo_fisso,
          importo_variabile: r.importo_variabile,
          delivery_attesa: r.delivery_attesa,
          delivery_consuntiva: r.delivery_consuntiva
        }));

        // Aggiungiamo solo i nuovi selezionati
        const newProjects = selectedProjectIds
          .filter(id => !existingCommessa.righe_progetto.some(r => r.progetto_id === id))
          .map(id => {
            const p = progettiCliente?.find(pc => pc.id === id);
            return {
              progetto_id: id,
              importo_fisso: p?.importo_fisso || 0,
              importo_variabile: p?.importo_variabile || 0,
              delivery_attesa: p?.delivery_attesa || 0,
              delivery_consuntiva: 0
            };
          });

        const res = await updateCommessa.mutateAsync({
          id: existingCommessa.id,
          data: {
            righe_progetto: [...currentRows, ...newProjects],
            ...(note && { note: existingCommessa.note ? `${existingCommessa.note}\n${note}` : note })
          }
        });
        toast.success("Progetti aggiunti", {
          description: "La commessa esistente è stata aggiornata.",
          action: {
            label: "Apri Commessa",
            onClick: () => navigate(`/commesse/${existingCommessa.id}`)
          }
        });
      } else {
        // CREAZIONE NUOVA COMMESSA
        const righe = selectedProjectIds.map(id => {
          const p = progettiCliente?.find(pc => pc.id === id) || (id === progetto.id ? progetto : null);
          return {
            progetto_id: id,
            importo_fisso: p?.importo_fisso || 0,
            importo_variabile: p?.importo_variabile || 0,
            delivery_attesa: p?.delivery_attesa || 0
          };
        });

        const res = await createCommessa.mutateAsync({
          cliente_id: progetto.cliente_id,
          mese_competenza: meseCompetenza,
          note: note,
          righe_progetto: righe
        });
        toast.success("Commessa creata", {
          description: `Nuova commessa per ${monthName} generata.`,
          action: {
            label: "Apri Commessa",
            onClick: () => navigate(`/commesse/${res.id}`)
          }
        });
      }
      
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      // Errore gestito dal hook
    }
  };

  const financialImpact = useMemo(() => {
    const allAvailable = [progetto, ...(progettiCliente || [])];
    const uniqueIds = Array.from(new Set(selectedProjectIds));
    const selected = uniqueIds.map(id => allAvailable.find(p => p.id === id)).filter(Boolean);

    const totalRevenue = selected.reduce((acc, p) => acc + ((p?.importo_fisso || 0) + (p?.importo_variabile || 0)), 0);
    const totalHours = selected.reduce((acc, p) => acc + (p?.delivery_attesa || 0), 0);

    return { totalRevenue, totalHours };
  }, [selectedProjectIds, progettiCliente, progetto]);

  const toggleProject = (id: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border text-white rounded-3xl overflow-hidden shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tighter flex items-center gap-2">
            {existingCommessa ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Commessa Esistente Trovata
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 text-primary" />
                Crea Nuova Commessa
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {existingCommessa 
              ? `È già presente una commessa per ${progetto.cliente?.ragione_sociale} nel mese di ${monthName}. Vuoi aggiungere questo progetto?`
              : `Non esiste ancora una commessa per questo cliente in ${monthName}. Creiamone una ora.`
            }
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Analisi dati in corso...</p>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Mese Competenza
                </Label>
                <Input 
                  type="date"
                  value={meseCompetenza}
                  onChange={(e) => setMeseCompetenza(e.target.value)}
                  className="bg-muted border-border text-xs rounded-xl h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Titolo / Riferimento
                </Label>
                <Input 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Es. Sviluppo Q2, Landing Pages..."
                  className="bg-muted border-border text-xs rounded-xl h-10"
                />
              </div>
            </div>
            {/* Sezione Altri Progetti */}
            {availableProjects.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <Label className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                    Altri progetti disponibili per questo cliente
                  </Label>
                </div>
                <ScrollArea className="max-h-[150px] rounded-2xl border border-border/50 bg-muted/20 p-2">
                  <div className="space-y-1">
                    {availableProjects.map(p => (
                      <div 
                        key={p.id} 
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-card/5 transition-colors group cursor-pointer"
                        onClick={() => toggleProject(p.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            id={`proj-${p.id}`} 
                            checked={selectedProjectIds.includes(p.id)}
                            onCheckedChange={() => toggleProject(p.id)}
                            className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <div>
                            <p className="text-xs font-bold text-white leading-none">{p.nome}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-medium mt-1">{p.tipo}</p>
                          </div>
                        </div>
                        <p className="text-[10px] font-black text-emerald-400">€{(p.importo_fisso + p.importo_variabile).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-[9px] text-muted-foreground italic px-1">
                  Puoi selezionare altri progetti da fatturare insieme in questa commessa mensile.
                </p>
              </div>
            )}


            {existingCommessa && (
              <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                   <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-tight">Consiglio</p>
                   <p className="text-[10px] text-muted-foreground leading-relaxed">
                     L'uso di una singola commessa mensile per cliente è la strada consigliata per una fatturazione pulita e un monitoraggio dei costi centralizzato.
                   </p>
                </div>
              </div>
            )}

            <div className="p-4 rounded-3xl bg-primary/5 border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-primary/10 rounded-xl">
                    <Euro className="w-4 h-4 text-primary" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Impatto Valore</p>
                    <p className="text-lg font-black text-white mt-1">€{financialImpact.totalRevenue.toLocaleString()}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Ore Totali</p>
                 <p className="text-lg font-black text-primary mt-1">{financialImpact.totalHours}h</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white rounded-xl">
            Annulla
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || createCommessa.isPending || updateCommessa.isPending}
            className="bg-primary hover:bg-primary/90 text-white rounded-xl px-8 font-bold"
          >
            {(createCommessa.isPending || updateCommessa.isPending) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              existingCommessa ? "Conferma e Aggiungi" : "Crea Commessa"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
