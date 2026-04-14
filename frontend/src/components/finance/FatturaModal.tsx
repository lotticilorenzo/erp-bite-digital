import React, { useEffect, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useClienti } from "@/hooks/useClienti";
import { useFornitori } from "@/hooks/useFornitori";
import { useCreateFattura, useUpdateFattura } from "@/hooks/useFatture";
import { toast } from "sonner";
import { 
  Plus, 
  Trash2, 
  Calculator, 
  FileText, 
  Calendar,
  Building2,
  Receipt
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface FatturaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "attive" | "passive";
  fattura?: any; // If provided, we are in edit mode
}

export function FatturaModal({ open, onOpenChange, type, fattura }: FatturaModalProps) {
  const isEdit = !!fattura;
  const isAttiva = type === "attive";

  const { data: clienti = [] } = useClienti();
  const { data: fornitori = [] } = useFornitori();
  const createMutation = useCreateFattura();
  const updateMutation = useUpdateFattura();

  const [formData, setFormData] = useState<any>({
    numero: "",
    data_emissione: new Date().toISOString().split('T')[0],
    data_scadenza: "",
    cliente_id: "",
    fornitore_id: "",
    importo_netto: 0,
    importo_iva: 0,
    importo_totale: 0,
    stato_pagamento: "ATTESA",
    valuta: "EUR",
    items: []
  });

  useEffect(() => {
    if (fattura) {
      setFormData({
        ...fattura,
        data_emissione: fattura.data_emissione ? fattura.data_emissione.split('T')[0] : "",
        data_scadenza: fattura.data_scadenza ? fattura.data_scadenza.split('T')[0] : "",
        items: fattura.items || fattura.fic_raw_data?.items || []
      });
    } else {
      setFormData({
        numero: "",
        data_emissione: new Date().toISOString().split('T')[0],
        data_scadenza: "",
        cliente_id: "",
        fornitore_id: "",
        importo_netto: 0,
        importo_iva: 0,
        importo_totale: 0,
        stato_pagamento: "ATTESA",
        valuta: "EUR",
        items: []
      });
    }
  }, [fattura, open]);

  const handleAddItem = () => {
    const newItems = [...formData.items, { description: "", qty: 1, price: 0, amount: 0 }];
    setFormData({ ...formData, items: newItems });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = formData.items.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, items: newItems });
    recalculateTotals(newItems);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "qty" || field === "price") {
      newItems[index].amount = Number(newItems[index].qty || 0) * Number(newItems[index].price || 0);
    }
    
    setFormData({ ...formData, items: newItems });
    recalculateTotals(newItems);
  };

  const recalculateTotals = (items: any[]) => {
    const netto = items.reduce((acc, item) => acc + (item.amount || 0), 0);
    const iva = netto * 0.22; // Default 22% VAT for simulation
    setFormData((prev: any) => ({
      ...prev,
      importo_netto: netto,
      importo_iva: iva,
      importo_totale: netto + iva
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        importo_totale: Number(formData.importo_totale),
        importo_netto: Number(formData.importo_netto),
        importo_iva: Number(formData.importo_iva),
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id: fattura.id, type, data: payload });
        toast.success("Fattura aggiornata con successo");
      } else {
        await createMutation.mutateAsync({ type, data: payload });
        toast.success("Fattura creata con successo");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Errore durante il salvataggio");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-card border-border text-white rounded-[32px] overflow-hidden p-0 shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-[6px] bg-gradient-to-r from-primary via-purple-500 to-blue-500" />
        
        <form onSubmit={handleSubmit}>
          <div className="p-8 space-y-8 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">
                {isEdit ? "Modifica" : "Nuova"} Fattura <span className="text-primary not-italic">{isAttiva ? "Attiva" : "Passiva"}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Main Info */}
              <div className="space-y-6">
                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-border/50">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <FileText className="h-3 w-3" /> Numero Documento
                      </Label>
                      <Input 
                        value={formData.numero} 
                        onChange={(e) => setFormData({...formData, numero: e.target.value})}
                        placeholder="es: 2024/001"
                        className="bg-background/50 border-border focus:ring-primary h-11 font-bold"
                        required
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569] flex items-center gap-2">
                          <Calendar className="h-3 w-3" /> Data Emissione
                        </Label>
                        <Input 
                          type="date"
                          value={formData.data_emissione} 
                          onChange={(e) => setFormData({...formData, data_emissione: e.target.value})}
                          className="bg-background/50 border-border h-11"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569] flex items-center gap-2">
                          <Calendar className="h-3 w-3" /> Data Scadenza
                        </Label>
                        <Input 
                          type="date"
                          value={formData.data_scadenza} 
                          onChange={(e) => setFormData({...formData, data_scadenza: e.target.value})}
                          className="bg-background/50 border-border h-11"
                        />
                      </div>
                   </div>
                </div>

                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-border/50">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Building2 className="h-3 w-3" /> {isAttiva ? "Cliente" : "Fornitore"}
                    </Label>
                    <Select 
                      value={isAttiva ? formData.cliente_id : formData.fornitore_id} 
                      onValueChange={(v) => setFormData({...formData, [isAttiva ? "cliente_id" : "fornitore_id"]: v})}
                    >
                      <SelectTrigger className="bg-background/50 border-border h-11 font-bold">
                        <SelectValue placeholder={`Seleziona ${isAttiva ? "cliente" : "fornitore"}`} />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-white">
                        {isAttiva ? (
                          clienti.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.ragione_sociale}</SelectItem>
                          ))
                        ) : (
                          fornitori.map((f: any) => (
                            <SelectItem key={f.id} value={f.id}>{f.ragione_sociale}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Totals & Status */}
              <div className="space-y-6">
                <div className="bg-primary/10 border border-primary/20 p-8 rounded-[2rem] flex flex-col justify-center items-center text-center">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Totale Documento</p>
                   <p className="text-5xl font-black text-white tracking-tighter tabular-nums mb-4">
                     {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(formData.importo_totale)}
                   </p>
                   <div className="flex gap-4 w-full">
                      <div className="flex-1 bg-background/30 p-3 rounded-xl">
                        <span className="text-[8px] font-black uppercase text-[#475569] block">Imponibile</span>
                        <span className="text-sm font-bold text-white">{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(formData.importo_netto)}</span>
                      </div>
                      <div className="flex-1 bg-background/30 p-3 rounded-xl">
                        <span className="text-[8px] font-black uppercase text-[#475569] block">IVA (22%)</span>
                        <span className="text-sm font-bold text-white">{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(formData.importo_iva)}</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Stato Pagamento</Label>
                   <div className="flex gap-2">
                      {["ATTESA", "PAGATA", "SCADUTA"].map(s => (
                        <Button 
                          key={s}
                          type="button"
                          variant={formData.stato_pagamento === s ? "default" : "outline"}
                          className={`flex-1 text-[10px] font-black rounded-xl h-10 ${formData.stato_pagamento === s ? "bg-primary text-white" : "text-[#475569]"}`}
                          onClick={() => setFormData({...formData, stato_pagamento: s})}
                        >
                          {s}
                        </Button>
                      ))}
                   </div>
                </div>
              </div>
            </div>

            <Separator className="bg-border/30" />

            {/* Line Items */}
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase italic tracking-tighter text-white">Line Items</h3>
                  <Button type="button" size="sm" onClick={handleAddItem} className="bg-white/5 border-border/50 text-[10px] font-black uppercase gap-2 rounded-xl">
                    <Plus className="h-4 w-4" /> Aggiungi Riga
                  </Button>
               </div>
               
               <div className="space-y-3">
                  {formData.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-border/30 group">
                      <div className="flex-[4] space-y-1">
                        <Input 
                          placeholder="Descrizione..." 
                          value={item.description} 
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                          className="bg-transparent border-none text-xs font-bold p-0 h-auto focus-visible:ring-0 placeholder:text-[#475569]"
                        />
                      </div>
                      <div className="flex-1">
                        <Input 
                          type="number" 
                          placeholder="Qtà" 
                          value={item.qty} 
                          onChange={(e) => handleItemChange(idx, "qty", Number(e.target.value))}
                          className="bg-background/50 border-border text-xs font-bold h-9 text-center"
                        />
                      </div>
                      <div className="flex-[2]">
                        <div className="relative">
                          <Euro className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#475569]" />
                          <Input 
                            type="number" 
                            placeholder="Prezzo" 
                            value={item.price} 
                            onChange={(e) => handleItemChange(idx, "price", Number(e.target.value))}
                            className="bg-background/50 border-border text-xs font-bold h-9 pl-7"
                          />
                        </div>
                      </div>
                      <div className="flex-[2] text-right font-black text-xs text-white tabular-nums">
                        {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(item.amount || 0)}
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10" onClick={() => handleRemoveItem(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {formData.items.length === 0 && (
                    <div className="py-12 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center opacity-30">
                       <Receipt className="h-8 w-8 mb-2" />
                       <p className="text-[10px] font-black uppercase tracking-widest">Nessun dettaglio riga aggiunto</p>
                    </div>
                  )}
               </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-card border-t border-border flex gap-4">
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-border text-[10px] font-black uppercase px-8">
                Annulla
             </Button>
             <Button type="submit" className="rounded-xl bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase px-8 shadow-xl shadow-primary/20">
                {isEdit ? "Salva Modifiche" : "Crea Fattura"}
             </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const Euro = ({ className }: { className?: string }) => (
  <span className={className}>€</span>
);
