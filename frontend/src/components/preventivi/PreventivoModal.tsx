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
import { usePreventivoMutations, useCalcoloPreventivo } from "@/hooks/usePreventivi";
import { useRisorse } from "@/hooks/useRisorse";
import { useAuth } from "@/hooks/useAuth";
import { hasFinanceAccess, normalizeRole } from "@/lib/access";
import { useClienti } from "@/hooks/useClienti";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Preventivo, TipoVoce, ModalitaPrezzo } from "@/types/preventivi";
import { PreventivoEconomia, calcolaEconomiaLocale } from "./PreventivoEconomia";
import { cn, formatEuro } from "@/lib/utils";

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
  // §18.1 modalita di prezzo
  modalita_prezzo: ModalitaPrezzo | "";
  markup_su: string;
  markup_pct: number | "";
  margine_pct: number | "";
  prezzo: number | "";
  margine_target: number | "";
};

type PreventivoVoceForm = {
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  ordine: number;
  // §18.2 natura della riga ("" = servizio a corpo, comportamento storico)
  tipo: TipoVoce | "";
  risorsa_id: string;
  ruolo: string;
  ore: number | "";
  tariffa: number | "";
  costo: number | "";
  ricarico_pct: number | "";
};

/** §18.2 — ogni natura ha una UI diversa perche' descrive un costo diverso. */
const NATURE: { value: TipoVoce | ""; label: string; hint: string }[] = [
  { value: "", label: "Servizio a corpo", hint: "Prezzo indicato direttamente, senza scomposizione del costo." },
  { value: "lavoro", label: "Lavoro interno", hint: "Ore x tariffa della risorsa. Alimenta il budget interno." },
  { value: "socio", label: "Socio", hint: "Costo figurativo, e' una STIMA: i soci sono capacita', non costo contrattuale." },
  { value: "esterno", label: "Fornitore esterno", hint: "Costo vivo + eventuale ricarico." },
  { value: "overhead", label: "Overhead", hint: "Quota struttura, calcolata dal coefficiente OVH sul prezzo." },
];

function createDefaultVoce(): PreventivoVoceForm {
  return { descrizione: "", quantita: 1, prezzo_unitario: 0, ordine: 0, tipo: "", risorsa_id: "", ruolo: "", ore: "", tariffa: "", costo: "", ricarico_pct: "" };
}

/** Fallback usato solo finche' il preventivo non e' salvato: a quel punto il coefficiente
 *  autorevole arriva da GET /preventivi/{id}/calcolo (registro parametri, §5b). */
const COEFF_OVH_FALLBACK = 0.15;

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
        modalita_prezzo: (preventivo.modalita_prezzo as ModalitaPrezzo) || "",
        markup_su: preventivo.markup_su || "costo_totale",
        markup_pct: preventivo.markup_pct ?? "",
        margine_pct: preventivo.margine_pct ?? "",
        prezzo: preventivo.prezzo ?? "",
        margine_target: preventivo.margine_target ?? "",
      },
      voci: preventivo.voci.map((voce) => ({
        descrizione: voce.descrizione,
        quantita: voce.quantita,
        prezzo_unitario: voce.prezzo_unitario,
        ordine: voce.ordine,
        tipo: (voce.tipo as TipoVoce) || "",
        risorsa_id: voce.risorsa_id || "",
        ruolo: voce.ruolo || "",
        ore: voce.ore ?? "",
        tariffa: voce.tariffa ?? "",
        costo: voce.costo ?? "",
        ricarico_pct: voce.ricarico_pct ?? "",
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
      modalita_prezzo: "",
      markup_su: "costo_totale",
      markup_pct: "",
      margine_pct: "",
      prezzo: "",
      margine_target: "",
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
    setVoci([...voci, { ...createDefaultVoce(), ordine: voci.length }]);
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

  const { data: risorse } = useRisorse();
  // Gate finance: la rotta resta ERP (i PM non perdono l'accesso), ma costi e margini no.
  const { user } = useAuth();
  const isFinance = hasFinanceAccess(normalizeRole(user?.ruolo));
  const { data: calcoloServer } = useCalcoloPreventivo(isFinance ? preventivo?.id : undefined);
  const coeffOvh = calcoloServer?.coefficiente_ovh ?? COEFF_OVH_FALLBACK;
  const hasNature = voci.some((v) => v.tipo !== "");

  const ecoProps = useMemo(() => ({
    voci: voci.map((v) => ({ tipo: v.tipo || null, ore: Number(v.ore) || 0, tariffa: Number(v.tariffa) || 0, costo: Number(v.costo) || 0, ricarico_pct: Number(v.ricarico_pct) || 0 })),
    modalita: (formData.modalita_prezzo || null) as ModalitaPrezzo | null,
    markupPct: formData.markup_pct === "" ? null : Number(formData.markup_pct),
    markupSu: formData.markup_su,
    marginePct: formData.margine_pct === "" ? null : Number(formData.margine_pct),
    prezzoDato: formData.prezzo === "" ? null : Number(formData.prezzo),
    coeffOvh: coeffOvh,
    margineTarget: formData.margine_target === "" ? null : Number(formData.margine_target),
  }), [voci, formData, coeffOvh]);
  const eco = useMemo(() => calcolaEconomiaLocale(ecoProps), [ecoProps]);

  // Con le nature §18 l'imponibile e' il prezzo calcolato; senza, resta il totale riga per riga (storico).
  const totalRighe = useMemo(() => voci.reduce((acc, v) => acc + (v.quantita * v.prezzo_unitario), 0), [voci]);
  const total = isFinance && formData.modalita_prezzo ? eco.prezzo : (preventivo?.importo_totale ?? totalRighe);
  const iva = total * 0.22;
  const grandTotal = total + iva;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cliente_id || !formData.titolo) return;
    
    const num = (v: number | "") => (v === "" ? null : Number(v));
    const payload = {
      ...formData,
      data_scadenza: formData.data_scadenza || null,
      descrizione: formData.descrizione || null,
      note: formData.note || null,
      modalita_prezzo: formData.modalita_prezzo || null,
      markup_pct: num(formData.markup_pct),
      margine_pct: num(formData.margine_pct),
      prezzo: isFinance && formData.modalita_prezzo ? eco.prezzo : num(formData.prezzo),
      margine_target: num(formData.margine_target),
      voci: voci.map((v) => ({
        ...v,
        tipo: v.tipo || null,
        risorsa_id: v.risorsa_id || null,
        ruolo: v.ruolo || null,
        ore: num(v.ore),
        tariffa: num(v.tariffa),
        costo: num(v.costo),
        ricarico_pct: num(v.ricarico_pct),
      })),
    };
    
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

          {/* SEZIONE 1b: MODALITA DI PREZZO (§18.1) — markup/margine sono dati finance */}
          {isFinance && (
          <div className="rounded-2xl border border-border/50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary italic">Modalita di prezzo</h3>
              <Badge variant="outline" className="text-[9px] px-1.5">§18.1</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Metodo</Label>
                <Select value={formData.modalita_prezzo || "nessuna"} onValueChange={(v) => setFormData({ ...formData, modalita_prezzo: v === "nessuna" ? "" : (v as ModalitaPrezzo) })}>
                  <SelectTrigger className="h-11 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nessuna">Prezzo a corpo (righe)</SelectItem>
                    <SelectItem value="markup">Cost-up (markup sui costi)</SelectItem>
                    <SelectItem value="margine">Margine target (sul prezzo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.modalita_prezzo === "markup" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base markup</Label>
                    <Select value={formData.markup_su} onValueChange={(v) => setFormData({ ...formData, markup_su: v })}>
                      <SelectTrigger className="h-11 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="costo_totale">Tutti i costi diretti</SelectItem>
                        <SelectItem value="solo_lavoro">Solo lavoro interno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Markup %</Label>
                    <Input type="number" step="0.01" className="h-11 rounded-xl text-xs" value={formData.markup_pct}
                      onChange={(e) => setFormData({ ...formData, markup_pct: e.target.value === "" ? "" : parseFloat(e.target.value) })} />
                  </div>
                </>
              )}
              {formData.modalita_prezzo === "margine" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Margine %</Label>
                    <Input type="number" step="0.01" className="h-11 rounded-xl text-xs" value={formData.margine_pct}
                      onChange={(e) => setFormData({ ...formData, margine_pct: e.target.value === "" ? "" : parseFloat(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prezzo imposto (opz.)</Label>
                    <Input type="number" step="0.01" className="h-11 rounded-xl text-xs" value={formData.prezzo}
                      onChange={(e) => setFormData({ ...formData, prezzo: e.target.value === "" ? "" : parseFloat(e.target.value) })} />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Margine target €</Label>
                <Input type="number" step="0.01" className="h-11 rounded-xl text-xs" value={formData.margine_target}
                  onChange={(e) => setFormData({ ...formData, margine_target: e.target.value === "" ? "" : parseFloat(e.target.value) })} />
              </div>
            </div>
          </div>
          )}

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
              {voci.map((voce, index) => {
                const natura = NATURE.find((nn) => nn.value === voce.tipo)!;
                const costoRiga =
                  voce.tipo === "lavoro" || voce.tipo === "socio" ? (Number(voce.ore) || 0) * (Number(voce.tariffa) || 0)
                  : voce.tipo === "esterno" ? (Number(voce.costo) || 0)
                  : voce.tipo === "overhead" ? eco.overhead
                  : voce.quantita * voce.prezzo_unitario;
                const prezzoEsterno = (Number(voce.costo) || 0) * (1 + (Number(voce.ricarico_pct) || 0) / 100);
                return (
                <div key={index} className="rounded-2xl border border-border/50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-3 items-center">
                    <div className="w-52 shrink-0">
                      <Select value={voce.tipo || "corpo"} onValueChange={(v) => updateVoce(index, "tipo", (v === "corpo" ? "" : v) as TipoVoce | "")}>
                        <SelectTrigger className="h-10 rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NATURE.map((nt) => (
                            <SelectItem key={nt.value || "corpo"} value={nt.value || "corpo"}>{nt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="Descrizione della prestazione..."
                      value={voce.descrizione}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVoce(index, "descrizione", e.target.value)}
                      className="h-10 rounded-xl text-xs flex-1"
                      required
                    />
                    {voce.tipo === "socio" && (
                      <Badge variant="outline" className="text-[9px] px-1.5 shrink-0">STIMA</Badge>
                    )}
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => removeVoce(index)}
                      className={cn("h-10 w-10 rounded-xl text-destructive/60 hover:text-destructive hover:bg-destructive/10 shrink-0",
                        voci.length === 1 && "opacity-0 pointer-events-none")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* UI specifica per natura (18.2): ogni riga chiede solo cio che serve a quel costo */}
                  {voce.tipo === "" && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1"><Label className="text-[10px]">Quantita</Label>
                        <Input type="number" className="h-10 rounded-xl text-xs" value={voce.quantita}
                          onChange={(e) => updateVoce(index, "quantita", parseFloat(e.target.value) || 0)} /></div>
                      <div className="space-y-1"><Label className="text-[10px]">Prezzo unitario</Label>
                        <Input type="number" step="0.01" className="h-10 rounded-xl text-xs" value={voce.prezzo_unitario}
                          onChange={(e) => updateVoce(index, "prezzo_unitario", parseFloat(e.target.value) || 0)} /></div>
                      <div className="space-y-1"><Label className="text-[10px]">Totale riga</Label>
                        <div className="h-10 rounded-xl bg-muted/40 flex items-center justify-end px-3 font-mono text-xs font-bold">{formatEuro(costoRiga)}</div></div>
                    </div>
                  )}

                  {voce.tipo === "lavoro" && (
                    <div className={cn("grid gap-3", isFinance ? "grid-cols-4" : "grid-cols-3")}>
                      <div className="space-y-1"><Label className="text-[10px]">Risorsa</Label>
                        <Select value={voce.risorsa_id || "nessuna"} onValueChange={(v) => {
                          const r: any = (risorse || []).find((x: any) => x.id === v);
                          updateVoce(index, "risorsa_id", v === "nessuna" ? "" : v);
                          if (r?.costo_orario_effettivo != null) updateVoce(index, "tariffa", Number(r.costo_orario_effettivo));
                        }}>
                          <SelectTrigger className="h-10 rounded-xl text-xs"><SelectValue placeholder="-" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nessuna">Generica (per ruolo)</SelectItem>
                            {(risorse || []).map((r: any) => (
                              <SelectItem key={r.id} value={r.id}>{r.nome} {r.cognome ?? ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select></div>
                      <div className="space-y-1"><Label className="text-[10px]">Ruolo</Label>
                        <Input className="h-10 rounded-xl text-xs" value={voce.ruolo}
                          onChange={(e) => updateVoce(index, "ruolo", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-[10px]">Ore</Label>
                        <Input type="number" step="0.25" className="h-10 rounded-xl text-xs" value={voce.ore}
                          onChange={(e) => updateVoce(index, "ore", e.target.value === "" ? "" : parseFloat(e.target.value))} /></div>
                      {isFinance && (
                        <div className="space-y-1"><Label className="text-[10px]">Tariffa oraria</Label>
                          <Input type="number" step="0.01" className="h-10 rounded-xl text-xs" value={voce.tariffa}
                            onChange={(e) => updateVoce(index, "tariffa", e.target.value === "" ? "" : parseFloat(e.target.value))} /></div>
                      )}
                    </div>
                  )}

                  {voce.tipo === "socio" && (
                    <div className="space-y-2">
                      <div className={cn("grid gap-3", isFinance ? "grid-cols-3" : "grid-cols-1")}>
                        <div className="space-y-1"><Label className="text-[10px]">Ore stimate</Label>
                          <Input type="number" step="0.25" className="h-10 rounded-xl text-xs" value={voce.ore}
                            onChange={(e) => updateVoce(index, "ore", e.target.value === "" ? "" : parseFloat(e.target.value))} /></div>
                        {isFinance && (
                          <>
                            <div className="space-y-1"><Label className="text-[10px]">Tariffa figurativa</Label>
                              <Input type="number" step="0.01" className="h-10 rounded-xl text-xs" value={voce.tariffa}
                                onChange={(e) => updateVoce(index, "tariffa", e.target.value === "" ? "" : parseFloat(e.target.value))} /></div>
                            <div className="space-y-1"><Label className="text-[10px]">Costo figurativo</Label>
                              <div className="h-10 rounded-xl bg-muted/40 flex items-center justify-end px-3 font-mono text-xs font-bold">{formatEuro(costoRiga)}</div></div>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">{natura.hint} Non entra nel budget interno ne nel simulatore ore.</p>
                    </div>
                  )}

                  {voce.tipo === "esterno" && (
                    <div className={cn("grid gap-3", isFinance ? "grid-cols-3" : "grid-cols-1")}>
                      {isFinance && (
                        <>
                          <div className="space-y-1"><Label className="text-[10px]">Costo vivo</Label>
                            <Input type="number" step="0.01" className="h-10 rounded-xl text-xs" value={voce.costo}
                              onChange={(e) => updateVoce(index, "costo", e.target.value === "" ? "" : parseFloat(e.target.value))} /></div>
                          <div className="space-y-1"><Label className="text-[10px]">Ricarico %</Label>
                            <Input type="number" step="0.01" className="h-10 rounded-xl text-xs" value={voce.ricarico_pct}
                              onChange={(e) => updateVoce(index, "ricarico_pct", e.target.value === "" ? "" : parseFloat(e.target.value))} /></div>
                        </>
                      )}
                      <div className="space-y-1"><Label className="text-[10px]">Prezzo al cliente</Label>
                        <div className="h-10 rounded-xl bg-muted/40 flex items-center justify-end px-3 font-mono text-xs font-bold">{formatEuro(prezzoEsterno)}</div></div>
                    </div>
                  )}

                  {voce.tipo === "overhead" && isFinance && (
                    <div className="grid grid-cols-3 gap-3 items-end">
                      <div className="space-y-1"><Label className="text-[10px]">Coefficiente OVH</Label>
                        <div className="h-10 rounded-xl bg-muted/40 flex items-center justify-end px-3 font-mono text-xs font-bold">{(coeffOvh * 100).toFixed(2)}%</div></div>
                      <div className="space-y-1"><Label className="text-[10px]">Quota struttura</Label>
                        <div className="h-10 rounded-xl bg-muted/40 flex items-center justify-end px-3 font-mono text-xs font-bold">{formatEuro(eco.overhead)}</div></div>
                      <p className="text-[10px] text-muted-foreground italic">Calcolata sul prezzo, dal registro parametri. Include gia la quota admin dei soci.</p>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* SEZIONE 2b: ECONOMIA + SIMULATORE (18.1 / 18.3) */}
          {isFinance && (hasNature || formData.modalita_prezzo) && (
            <PreventivoEconomia {...ecoProps} />
          )}

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
