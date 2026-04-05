import React, { useState, useEffect } from "react";
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
  CheckCircle, Loader2, Euro
} from "lucide-react";
import { usePreventivoMutations } from "@/hooks/usePreventivi";
import { useClienti } from "@/hooks/useClienti";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import type { Preventivo } from "@/types/preventivi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preventivo?: Preventivo; // Se presente, siamo in edit
}

export const PreventivoModal: React.FC<Props> = ({ isOpen, onClose, preventivo }) => {
  const { createPreventivo, updatePreventivo } = usePreventivoMutations();
  const { data: clienti } = useClienti();
  
  const [formData, setFormData] = useState({
    cliente_id: "",
    numero: "",
    titolo: "",
    descrizione: "",
    data_scadenza: "",
    note: "",
  });

  const [voci, setVoci] = useState([
    { descrizione: "", quantita: 1, prezzo_unitario: 0, ordine: 0 }
  ]);

  useEffect(() => {
    if (preventivo) {
      setFormData({
        cliente_id: preventivo.cliente_id,
        numero: preventivo.numero,
        titolo: preventivo.titolo,
        descrizione: preventivo.descrizione || "",
        data_scadenza: preventivo.data_scadenza || "",
        note: preventivo.note || "",
      });
      setVoci(preventivo.voci.map(v => ({
        descrizione: v.descrizione,
        quantita: v.quantita,
        prezzo_unitario: v.prezzo_unitario,
        ordine: v.ordine
      })));
    } else {
      // Default numero preventivo? Forse un timestamp o sequenziale
      setFormData(prev => ({ ...prev, numero: `PRV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}` }));
    }
  }, [preventivo, isOpen]);

  const addVoce = () => {
    setVoci([...voci, { descrizione: "", quantita: 1, prezzo_unitario: 0, ordine: voci.length }]);
  };

  const removeVoce = (index: number) => {
    setVoci(voci.filter((_, i) => i !== index));
  };

  const updateVoce = (index: number, field: string, value: any) => {
    const newVoci = [...voci];
    newVoci[index] = { ...newVoci[index], [field]: value };
    setVoci(newVoci);
  };

  const total = voci.reduce((acc, v) => acc + (v.quantita * v.prezzo_unitario), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, voci };
    
    if (preventivo) {
      await updatePreventivo.mutateAsync({ id: preventivo.id, payload });
    } else {
      await createPreventivo.mutateAsync(payload);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            {preventivo ? "Modifica Preventivo" : "Nuovo Preventivo"}
          </DialogTitle>
          <DialogDescription>
            Crea un preventivo professionale per il partner. Voci e totali verranno calcolati automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select 
                value={formData.cliente_id} 
                onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}
                disabled={!!preventivo}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona Partner" />
                </SelectTrigger>
                <SelectContent>
                  {clienti?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.ragione_sociale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Codice Preventivo</Label>
              <Input 
                value={formData.numero} 
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                placeholder="es. PRV-2024-001"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Oggetto / Titolo</Label>
              <Input 
                value={formData.titolo} 
                onChange={(e) => setFormData({ ...formData, titolo: e.target.value })}
                placeholder="es. Restyling Sito Web + SEO"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrizione Breve (opzionale)</Label>
              <Textarea 
                value={formData.descrizione} 
                onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                placeholder="Descrizione sintetica del progetto..."
              />
            </div>
            <div className="space-y-2">
              <Label>Scadenza Validità</Label>
              <Input 
                type="date"
                value={formData.data_scadenza} 
                onChange={(e) => setFormData({ ...formData, data_scadenza: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Voci Preventivo</h3>
              <Button type="button" variant="outline" size="sm" onClick={addVoce} className="h-8 gap-1">
                <Plus className="w-4 h-4" /> Aggiungi Riga
              </Button>
            </div>
            
            <div className="space-y-3">
              {voci.map((voce, index) => (
                <div key={index} className="flex gap-3 group animate-in fade-in slide-in-from-top-1">
                  <div className="flex-[4] space-y-1">
                    <Input 
                      placeholder="Descrizione prestazione..." 
                      value={voce.descrizione}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVoce(index, "descrizione", e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex-[1] space-y-1">
                    <Input 
                      type="number" 
                      placeholder="Q.tà" 
                      value={voce.quantita}
                      onChange={(e) => updateVoce(index, "quantita", parseFloat(e.target.value))}
                      required
                    />
                  </div>
                  <div className="flex-[1.5] space-y-1">
                    <div className="relative">
                      <Euro className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                      <Input 
                        type="number" 
                        className="pl-8"
                        placeholder="Prezzo" 
                        value={voce.prezzo_unitario}
                        onChange={(e) => updateVoce(index, "prezzo_unitario", parseFloat(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex-[1.5] space-y-1">
                    <Input 
                      className="bg-slate-50 font-bold text-right"
                      value={new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(voce.quantita * voce.prezzo_unitario)}
                      readOnly
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeVoce(index)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 mt-1"
                    disabled={voci.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 flex flex-col items-end gap-2">
            <div className="flex items-center gap-4 text-slate-500">
              <span className="text-sm">Imponibile Totale:</span>
              <span className="text-lg font-mono">
                {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(total)}
              </span>
            </div>
            <div className="flex items-center gap-4 text-purple-600">
              <span className="text-sm font-bold uppercase tracking-tighter">Totale Stimato (IVA Incl.):</span>
              <span className="text-2xl font-black">
                {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(total * 1.22)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Note e Vincoli</Label>
            <Textarea 
              value={formData.note} 
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="Inserisci note legali, tempi di esecuzione o vincoli..."
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
            <Button 
              type="submit" 
              className="bg-purple-600 hover:bg-purple-700"
              disabled={createPreventivo.isPending || updatePreventivo.isPending}
            >
              {createPreventivo.isPending || updatePreventivo.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              {preventivo ? "Salva Modifiche" : "Crea Preventivo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
