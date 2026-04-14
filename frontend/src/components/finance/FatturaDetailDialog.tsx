import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

import {
  FileText,
  Calendar,
  User,
  CreditCard,
  Building2,
  Phone,
  Mail,
  Receipt,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  MapPin,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useIncassaFattura, useUpdateFattura } from "@/hooks/useFatture";
import { toast } from "sonner";
import { it } from "date-fns/locale";

interface FatturaDetailDialogProps {
  fattura: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "attive" | "passive";
}

export function FatturaDetailDialog({
  fattura,
  open,
  onOpenChange,
  type
}: FatturaDetailDialogProps) {
  const navigate = useNavigate();
  const incassaMutation = useIncassaFattura();
  const updateMutation = useUpdateFattura();

  if (!fattura) return null;

  const isAttiva = type === "attive";
  const entity = isAttiva ? fattura.cliente : fattura.fornitore;
  
  // Extract items from fic_raw_data if available
  const items = fattura.fic_raw_data?.items || fattura.fic_raw_data?.details || [];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "paid" || s === "incassata" || s === "pagata") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 font-bold px-3 py-1 uppercase text-[10px] tracking-widest">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Pagata
        </Badge>
      );
    }
    if (s === "overdue" || s === "scaduta") {
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20 gap-1.5 font-bold px-3 py-1 uppercase text-[10px] tracking-widest">
          <AlertCircle className="h-3.5 w-3.5" />
          Scaduta
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1.5 font-bold px-3 py-1 uppercase text-[10px] tracking-widest">
        <Clock className="h-3.5 w-3.5" />
        In Attesa
      </Badge>
    );
  };

  const handleMarkAsPaid = async () => {
    try {
      if (isAttiva) {
        await incassaMutation.mutateAsync({ id: fattura.id, data_incasso: new Date().toISOString() });
      } else {
        await updateMutation.mutateAsync({ id: fattura.id, type: "passive", data: { stato_pagamento: "PAGATA", importo_pagato: fattura.importo_totale, importo_residuo: 0 } });
      }
      toast.success("Fattura segnata come pagata");
    } catch (err) {
      toast.error("Errore durante l'aggiornamento");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-card/95 backdrop-blur-2xl border-border/50 text-white rounded-[32px] overflow-hidden p-0 shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-[6px] bg-gradient-to-r from-primary via-purple-500 to-blue-500" />
        
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase italic">
                    Fattura <span className="text-primary not-italic">#{fattura.numero || "N/A"}</span>
                  </h2>
                  <p className="text-[10px] font-bold text-[#475569] uppercase tracking-widest">
                    ID Interno: {fattura.id.split('-')[0]} • FIC ID: {fattura.fic_id}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              {getStatusBadge(fattura.stato_pagamento)}
              <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" className="bg-white/5 border-border/50 text-xs font-bold rounded-xl h-9 hover:bg-white/10">
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Scarica PDF
                 </Button>
                 <Button size="sm" className="bg-primary text-white text-xs font-bold rounded-xl h-9">
                    Vai su FIC
                    <ExternalLink className="h-3.5 w-3.5 ml-2" />
                 </Button>
              </div>
            </div>
          </div>

          <Separator className="bg-border/30" />

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Info Mittente/Destinatario */}
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                  {isAttiva ? "Cliente / Destinatario" : "Fornitore / Mittente"}
                </h3>
                <div className="bg-white/5 border border-border/50 rounded-2xl p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div 
                      className="cursor-pointer group/entity hover:bg-white/10 transition-all"
                      onClick={() => navigate(isAttiva ? `/clienti/${entity?.id}` : `/fornitori/${entity?.id}`)}
                    >
                      <h4 className="font-black text-white text-lg leading-tight uppercase group-hover/entity:text-primary transition-colors">
                        {entity?.ragione_sociale || fattura.fornitore_nome || "Dati non disponibili"}
                      </h4>
                      <p className="text-xs font-bold text-[#475569] mt-1 flex items-center gap-2">
                        P.IVA/CF: {entity?.piva || "N/A"}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover/entity:opacity-100 transition-opacity" />
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-medium">{entity?.indirizzo || "Indirizzo non specificato"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="font-medium">{entity?.email || "Email non presente"}</span>
                    </div>
                    {entity?.pec && (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Receipt className="h-4 w-4 text-primary" />
                        <span className="font-bold text-[10px] uppercase">PEC: {entity.pec}</span>
                      </div>
                    )}
                    {entity?.sdi && (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Info className="h-4 w-4 text-primary" />
                        <span className="font-bold text-[10px] uppercase text-primary/80">SDI: {entity.sdi}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dettagli Fattura */}
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Dettagli Documento</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-border/50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[9px] font-black uppercase text-[#475569]">Data Emissione</span>
                    </div>
                    <div className="text-lg font-black text-white tabular-nums">
                      {fattura.data_emissione ? format(new Date(fattura.data_emissione), "dd/MM/yyyy") : "—"}
                    </div>
                  </div>
                  <div className="bg-white/5 border border-border/50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[9px] font-black uppercase text-[#475569]">Scadenza</span>
                    </div>
                    <div className="text-lg font-black text-white tabular-nums">
                      {fattura.data_scadenza ? format(new Date(fattura.data_scadenza), "dd/MM/yyyy") : "—"}
                    </div>
                  </div>
                </div>
                
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">Totale Fattura</span>
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] font-black uppercase tracking-widest">
                      {fattura.valuta || "EUR"}
                    </Badge>
                  </div>
                  <div className="text-4xl font-black text-white tracking-tighter tabular-nums drop-shadow-lg">
                    {formatCurrency(fattura.importo_totale)}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-primary/10">
                    <div>
                      <span className="text-[9px] font-bold text-[#475569] uppercase block mb-1">Imponibile</span>
                      <span className="text-sm font-black text-white tabular-nums">{formatCurrency(fattura.importo_netto || 0)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-[#475569] uppercase block mb-1">IVA</span>
                      <span className="text-sm font-black text-white tabular-nums">{formatCurrency(fattura.importo_iva || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Righe Fattura */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Elenco Prestazioni / Prodotti</h3>
            <div className="rounded-2xl border border-border/50 bg-white/5 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-border/50">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#475569]">Descrizione</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#475569] text-center w-24">Quantità</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#475569] text-right w-32">Prezzo Unit.</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#475569] text-right w-32">Totale Riga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.length > 0 ? (
                    items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-white leading-relaxed block max-w-md">
                            {item.description || item.name || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs font-mono font-bold text-[#475569]">
                            {item.qty || item.quantity || 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-mono font-bold text-[#475569]">
                            {formatCurrency(item.net_price || item.price || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-mono font-black text-white">
                            {formatCurrency(item.gross_amount || item.amount || 0)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-xs font-bold text-[#475569] uppercase tracking-widest">
                        Dettaglio righe non disponibile per questo documento
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer stats */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Importo Pagato</span>
                <div className="text-xl font-black text-white tabular-nums mt-1">{formatCurrency(fattura.importo_pagato || 0)}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <div className="flex-1 bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Residuo da Pagare</span>
                <div className="text-xl font-black text-white tabular-nums mt-1">{formatCurrency(fattura.importo_residuo || 0)}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-rose-500" />
              </div>
            </div>
          </div>

          {fattura.importo_residuo > 0 && (
            <div className="pt-4 flex gap-4">
              <Button 
                onClick={handleMarkAsPaid}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[10px] h-12 rounded-2xl gap-2 shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="h-4 w-4" />
                Segna come Pagata oggi
              </Button>
              {isAttiva && (
                <Button 
                  variant="outline"
                  onClick={() => toast.info("Sollecito inviato via email (Simulato)")}
                  className="flex-1 border-border bg-white/5 text-white font-black uppercase text-[10px] h-12 rounded-2xl gap-2 hover:bg-white/10"
                >
                  <Mail className="h-4 w-4" />
                  Invia Sollecito
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
