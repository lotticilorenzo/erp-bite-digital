import React, { useState, useMemo } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, Trash2, FileText, 
  CheckCircle, Loader2, Euro,
  Calendar, Building2, Hash, Type,
  AlertCircle
} from "lucide-react";
import { usePreventivoMutations } from "@/hooks/usePreventivi";
import { useClienti } from "@/hooks/useClienti";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Preventivo } from "@/types/preventivi";
import { cn } from "@/lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preventivo?: Preventivo;
  clienteId?: string;
}

type PreventivoFormData = {
  cliente_id: string;
  numero: string;
  titolo: string;
  descrizione: string;
  data_scadenza: string;
  note: string;
};

type PreventivoVoceForm = {
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  ordine: number;
};

function createDefaultVoce(): PreventivoVoceForm {
  return { descrizione: "", quantita: 1, prezzo_unitario: 0, ordine: 0 };
}

function createDraftPreventivoNumber() {
  return `PRV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getInitialPreventivoState(
  preventivo?: Preventivo,
  clienteId?: string
): { formData: PreventivoFormData; voci: PreventivoVoceForm[] } {
  if (preventivo) {
    return {
      formData: {
        cliente_id: preventivo.cliente_id,
        numero: preventivo.numero,
        titolo: preventivo.titolo,
        descrizione: preventivo.descrizione || "",
        data_scadenza: preventivo.data_scadenza || "",
        note: preventivo.note || "",
      },
      voci: preventivo.voci.map((voce) => ({
        descrizione: voce.descrizione,
        quantita: voce.quantita,
        prezzo_unitario: voce.prezzo_unitario,
        ordine: voce.ordine,
      })),
    };
  }

  return {
    formData: {
      cliente_id: clienteId || "",
      numero: createDraftPreventivoNumber(),
      titolo: "",
      descrizione: "",
      data_scadenza: "",
      note: "",
    },
    voci: [createDefaultVoce()],
  };
}

export const PreventivoModal: React.FC<Props> = ({ isOpen, onClose, preventivo, clienteId }) => {
  const modalKey = preventivo?.id ? `edit-${preventivo.id}` : `new-${clienteId ?? "default"}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isOpen ? (
        <PreventivoModalContent
          key={modalKey}
          onClose={onClose}
          preventivo={preventivo}
          clienteId={clienteId}
        />
      ) : null}
    </Dialog>
  );
};

const PreventivoModalContent: React.FC<Omit<Props, "isOpen">> = ({ onClose, preventivo, clienteId }) => {
  const { createPreventivo, updatePreventivo } = usePreventivoMutations();
  const { data: clienti } = useClienti();
  const initialState = getInitialPreventivoState(preventivo, clienteId);
  const [formData, setFormData] = useState<PreventivoFormData>(() => initialState.formData);
  const [voci, setVoci] = useState<PreventivoVoceForm[]>(() => initialState.voci);

  const addVoce = () => {
    setVoci([...voci, { descrizione: "", quantita: 1, prezzo_unitario: 0, ordine: voci.length }]);
  };

  const removeVoce = (index: number) => {
    if (voci.length > 1) {
      setVoci(voci.filter((_, i) => i !== index));
    }
  };

  const updateVoce = (
    index: number,
    field: keyof PreventivoVoceForm,
    value: PreventivoVoceForm[keyof PreventivoVoceForm]
  ) => {
    const newVoci = [...voci];
    newVoci[index] = { ...newVoci[index], [field]: value };
    setVoci(newVoci);
  };

  const total = useMemo(() => voci.reduce((acc, v) => acc + (v.quantita * v.prezzo_unitario), 0), [voci]);
  const iva = total * 0.22;
  const grandTotal = total + iva;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cliente_id || !formData.titolo) return;
    
    const payload = { ...formData, voci };
    
    try {
      if (preventivo) {
        await updatePreventivo.mutateAsync({ id: preventivo.id, payload });
      } else {
        await createPreventivo.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden bg-[#0a0a0b]/95 backdrop-blur-2xl border-white/5 text-white p-0 rounded-[2rem] shadow-2xl flex flex-col">
        <DialogHeader className="p-8 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-3xl font-black italic tracking-tighter flex items-center gap-3 uppercase">
                <div className="p-2.5 bg-primary/20 rounded-2xl border border-primary/30">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                {preventivo ? "Modifica Offerta" : "Nuova Proposta Commerciale"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium mt-1">
                Configura i dettagli dell'offerta, le voci di costo e i termini per il partner.
              </DialogDescription>
            </div>
            {!preventivo && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                BOZZA AUTOMATICA
              </Badge>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 space-y-8 scrollbar-thin scrollbar-thumb-white/10 pb-8">
          {/* SEZIONE 1: INFO GENERALI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-card/5 p-6 rounded-[2rem] border border-white/5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1">
                <Building2 className="w-3 h-3" /> Partner / Cliente
              </Label>
              <Select 
                value={formData.cliente_id} 
                onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}
                disabled={!!preventivo}
              >
                <SelectTrigger className="bg-[#0f0f10] border-white/5 h-12 rounded-2xl focus:ring-primary/20 transition-all">
                  <SelectValue placeholder="Seleziona Partner..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f10] border-white/10 text-white">
                  {clienti?.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="focus:bg-primary/20 focus:text-white cursor-pointer">
                      {c.ragione_sociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1">
                <Hash className="w-3 h-3" /> Codice Preventivo
              </Label>
              <Input 
                value={formData.numero} 
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                className="bg-[#0f0f10] border-white/5 h-12 rounded-2xl font-mono text-primary font-bold"
                placeholder="es. PRV-2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1">
                <Calendar className="w-3 h-3" /> Scadenza Offerta
              </Label>
              <Input 
                type="date"
                value={formData.data_scadenza} 
                onChange={(e) => setFormData({ ...formData, data_scadenza: e.target.value })}
                className="bg-[#0f0f10] border-white/5 h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1">
                <Type className="w-3 h-3" /> Oggetto dell'Offerta
              </Label>
              <Input 
                value={formData.titolo} 
                onChange={(e) => setFormData({ ...formData, titolo: e.target.value })}
                className="bg-[#0f0f10] border-white/5 h-12 rounded-2xl text-lg font-bold"
                placeholder="Es. Sviluppo E-commerce 2024 - Fase 1"
              />
            </div>
          </div>

          {/* SEZIONE 2: VOCI PREVENTIVO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary italic">Dettaglio Servizi e Prestazioni</h3>
                <Badge className="bg-primary/10 text-primary border-none text-[9px] px-1.5">{voci.length} RIGHE</Badge>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addVoce} className="h-9 gap-1.5 rounded-xl border-dashed border-white/20 hover:border-primary/50 hover:bg-primary/10 transition-all group">
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> 
                <span className="text-[10px] font-black uppercase">Aggiungi Riga</span>
              </Button>
            </div>
            
            <div className="space-y-3">
              {voci.map((voce, index) => (
                <div key={index} className="flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-300 group">
                  <div className="flex-[5] relative">
                    <Input 
                      placeholder="Descrizione della prestazione o prodotto..." 
                      value={voce.descrizione}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVoce(index, "descrizione", e.target.value)}
                      className="bg-[#0f0f10] border-white/5 h-11 rounded-xl text-xs focus:bg-card/5 transition-all"
                      required
                    />
                  </div>
                  <div className="w-24">
                    <Input 
                      type="number" 
                      placeholder="Q.tà" 
                      value={voce.quantita}
                      onChange={(e) => updateVoce(index, "quantita", parseFloat(e.target.value) || 0)}
                      className="bg-[#0f0f10] border-white/5 h-11 rounded-xl text-center text-xs font-bold"
                      required
                    />
                  </div>
                  <div className="w-40 relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input 
                      type="number" 
                      className="bg-[#0f0f10] border-white/5 h-11 rounded-xl pl-9 text-xs font-bold"
                      placeholder="0.00" 
                      value={voce.prezzo_unitario}
                      onChange={(e) => updateVoce(index, "prezzo_unitario", parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="w-44">
                    <div className="bg-primary/5 border border-primary/10 h-11 rounded-xl flex items-center justify-end px-4">
                       <span className="text-xs font-black text-white tracking-tighter">
                         €{(voce.quantita * voce.prezzo_unitario).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                       </span>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeVoce(index)}
                    className={cn(
                      "h-11 w-11 rounded-xl text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0",
                      voci.length === 1 && "opacity-0 pointer-events-none"
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* SEZIONE 3: RIEPILOGO FINANZIARIO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Note, Vincoli e Termini</Label>
                <Textarea 
                  value={formData.note} 
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Es. Pagamento 30gg d.f., Consegna stimata in 4 settimane..."
                  className="bg-card/5 border-white/5 rounded-[1.5rem] min-h-[120px] text-xs leading-relaxed focus:bg-card/10 transition-all"
                />
              </div>
              <div className="flex items-center gap-2 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                 <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                 <p className="text-[10px] text-amber-500/80 leading-tight font-medium italic">
                   L'imposta IVA (22%) verrà calcolata automaticamente sul totale dell'imponibile.
                 </p>
              </div>
            </div>

            <div className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/20 space-y-6 flex flex-col justify-center shadow-[0_20px_50px_rgba(168,85,247,0.1)]">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-black uppercase tracking-widest">Imponibile Netto</span>
                <span className="text-xl font-bold tracking-tighter text-white">€{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground border-t border-primary/10 pt-4">
                <span className="text-[10px] font-black uppercase tracking-widest">IVA (22%)</span>
                <span className="text-xl font-bold tracking-tighter text-white">€{iva.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <Separator className="bg-primary/20" />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Totale Lordo</span>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-1">IVA INCLUSA</p>
                </div>
                <span className="text-4xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                  €{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </form>

        <DialogFooter className="p-8 pt-4 bg-[#0f0f10]/50 backdrop-blur-md border-t border-white/5">
          <div className="flex items-center justify-between w-full">
            <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-white rounded-2xl px-6 h-12 font-bold uppercase tracking-widest text-[10px]">
              Annulla Proposta
            </Button>
            <Button 
              type="submit" 
              onClick={handleSubmit}
              className="bg-primary hover:bg-primary/90 text-white rounded-2xl px-10 h-12 font-black uppercase tracking-widest text-[11px] shadow-[0_10px_20px_rgba(168,85,247,0.3)] transition-all hover:scale-[1.02]"
              disabled={createPreventivo.isPending || updatePreventivo.isPending}
            >
              {createPreventivo.isPending || updatePreventivo.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-5 h-5 mr-2" />
              )}
              {preventivo ? "Salva Modifiche" : "Genera Proposta"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
  );
};
