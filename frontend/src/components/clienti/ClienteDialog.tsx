import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCliente, useUpdateCliente } from "@/hooks/useClienti";
import type { Cliente } from "@/types";
import { Loader2, Upload, X, Building2, MapPin, CreditCard, Globe, Phone, Mail, Hash, Link2 } from "lucide-react";
import { ClientAvatar } from "../common/ClientAvatar";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

// ─── Section heading ───────────────────────────────────────────
function SectionTitle({ label }: { label: string }) {
  return (
    <div className="col-span-full flex items-center gap-3 pt-2 pb-1">
      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/30" />
    </div>
  );
}

// ─── Simple field wrapper ──────────────────────────────────────
function Field({
  label,
  icon,
  hint,
  children,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/60 flex items-center gap-1.5">
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
      {hint && <p className="text-[9px] text-muted-foreground/30">{hint}</p>}
    </div>
  );
}

const INPUT_CLS =
  "bg-white/5 border-white/10 text-white placeholder:text-slate-700 h-10 rounded-xl px-3 text-sm focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors";
const SELECT_CLS =
  "bg-white/5 border border-white/10 text-white h-10 rounded-xl px-3 text-sm focus:ring-1 focus:ring-primary/30 outline-none transition-colors";

interface ClienteDialogProps {
  cliente?: Cliente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyForm = (): Partial<Cliente> => ({
  ragione_sociale: "",
  codice_cliente: "",
  numero_progressivo: undefined,
  tipologia: "",
  referente: "",
  piva: "",
  codice_fiscale: "",
  sdi: "",
  pec: "",
  email: "",
  telefono: "",
  cellulare: "",
  sito_web: "",
  settore: "",
  categoria: "",
  indirizzo: "",
  comune: "",
  cap: "",
  provincia: "",
  paese: "Italia",
  note_indirizzo: "",
  condizioni_pagamento: "30gg DFFM",
  note: "",
  attivo: true,
  affidabilita: "MEDIA",
});

export function ClienteDialog({ cliente, open, onOpenChange }: ClienteDialogProps) {
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente();
  const isEditing = !!cliente;

  const [form, setForm] = React.useState<Partial<Cliente>>(emptyForm());
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync when cliente prop changes
  React.useEffect(() => {
    if (cliente) {
      setForm({ ...emptyForm(), ...cliente });
      setPreviewUrl(cliente.logo_url ?? null);
    } else {
      setForm(emptyForm());
      setPreviewUrl(null);
    }
    setLogoFile(null);
  }, [cliente, open]);

  const set = (key: keyof Cliente, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File troppo grande. Massimo 2MB.");
      return;
    }
    setLogoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ragione_sociale?.trim()) {
      toast.error("La ragione sociale è obbligatoria.");
      return;
    }

    // Build clean payload — remove empty strings to avoid overwriting with ""
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === "" || v === undefined) payload[k] = null;
      else payload[k] = v;
    }
    // Always keep ragione_sociale
    payload.ragione_sociale = form.ragione_sociale;

    try {
      let clienteId = cliente?.id;
      if (isEditing && cliente) {
        await updateCliente.mutateAsync({ id: cliente.id, data: payload });
      } else {
        const newCliente = await createCliente.mutateAsync(payload as any);
        clienteId = (newCliente as any).id;
      }

      // Logo upload
      if (clienteId) {
        if (logoFile) {
          const fd = new FormData();
          fd.append("file", logoFile);
          await api.post(`/clienti/${clienteId}/logo`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else if (previewUrl === null && cliente?.logo_url) {
          await api.delete(`/clienti/${clienteId}/logo`);
        }
      }

      toast.success(isEditing ? "Cliente Aggiornato" : "Cliente Creato", {
        icon: <Building2 className="h-4 w-4 text-emerald-500" />
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Errore durante il salvataggio");
    }
  };

  const isPending = createCliente.isPending || updateCliente.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto bg-card border-border text-white custom-scrollbar">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-black tracking-tight text-foreground">
            {isEditing ? "Modifica cliente" : "Nuovo cliente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-0">
          {/* ── Logo ─────────────────────────────────────────── */}
          <div className="flex items-center gap-5 py-4 border-b border-border/30 mb-2">
            <div className="relative group shrink-0">
              <ClientAvatar
                name={form.ragione_sociale || "C"}
                logoUrl={previewUrl}
                size="xl"
                className="rounded-2xl border-2 border-white/10"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
              >
                <Upload className="w-6 h-6 text-white" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-black text-white">Logo Aziendale</p>
              <p className="text-[11px] text-muted-foreground">PNG, JPG o SVG · Max 2MB</p>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-border bg-transparent text-muted-foreground hover:text-white"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Carica nuovo
                </Button>
                {previewUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-400/10"
                    onClick={() => { setLogoFile(null); setPreviewUrl(null); }}
                  >
                    <X className="w-3 h-3 mr-1" /> Rimuovi
                  </Button>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-4 pb-2">

            {/* ═══ IDENTIFICATIVO ═══════════════════════════════ */}
            <SectionTitle label="Identificativo" />

            <Field label="Sigla Cliente" hint="Es. BEC — unica">
              <Input
                className={INPUT_CLS}
                placeholder="BEC"
                value={form.codice_cliente ?? ""}
                onChange={(e) => set("codice_cliente", e.target.value.toUpperCase())}
                maxLength={10}
              />
            </Field>

            <Field label="Codice Interno (N°)" hint="Da FIC o manuale">
              <Input
                className={INPUT_CLS}
                placeholder="1"
                type="number"
                value={form.numero_progressivo ?? ""}
                onChange={(e) => set("numero_progressivo", e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>

            {/* ═══ ANAGRAFICA ════════════════════════════════════ */}
            <SectionTitle label="Anagrafica" />

            <Field label="Ragione Sociale" className="col-span-full">
              <Input
                className={INPUT_CLS}
                placeholder="Nome Azienda S.r.l."
                value={form.ragione_sociale ?? ""}
                onChange={(e) => set("ragione_sociale", e.target.value)}
                required
              />
            </Field>

            <Field label="Tipologia">
              <select
                className={SELECT_CLS}
                value={form.tipologia ?? ""}
                onChange={(e) => set("tipologia", e.target.value)}
              >
                <option value="">—</option>
                <option value="SRL">S.R.L.</option>
                <option value="SPA">S.P.A.</option>
                <option value="SRLS">S.R.L.S.</option>
                <option value="SNC">S.N.C.</option>
                <option value="SAS">S.A.S.</option>
                <option value="DITTA_INDIVIDUALE">Ditta Individuale</option>
                <option value="LIBERO_PROFESSIONISTA">Libero Professionista</option>
                <option value="ASSOCIAZIONE">Associazione</option>
                <option value="ENTE_PUBBLICO">Ente Pubblico</option>
                <option value="PRIVATO">Privato</option>
              </select>
            </Field>

            <Field label="Referente">
              <Input
                className={INPUT_CLS}
                placeholder="Mario Rossi"
                value={form.referente ?? ""}
                onChange={(e) => set("referente", e.target.value)}
              />
            </Field>

            <Field label="Settore">
              <select
                className={SELECT_CLS}
                value={form.settore ?? ""}
                onChange={(e) => set("settore", e.target.value)}
              >
                <option value="">—</option>
                <option value="ristorazione">Ristorazione / Food</option>
                <option value="retail">Retail / Moda</option>
                <option value="immobiliare">Immobiliare</option>
                <option value="professionale">Servizi Professionali</option>
                <option value="salute">Salute / Benessere</option>
                <option value="tech">Tecnologia</option>
                <option value="turismo">Turismo / Hospitality</option>
                <option value="industria">Industria / Manifattura</option>
                <option value="finanza">Finanza / Assicurazioni</option>
                <option value="istruzione">Istruzione / Formazione</option>
                <option value="no_profit">No Profit</option>
                <option value="altro">Altro</option>
              </select>
            </Field>

            <Field label="Categoria Cliente">
              <select
                className={SELECT_CLS}
                value={form.categoria ?? ""}
                onChange={(e) => set("categoria", e.target.value)}
              >
                <option value="">—</option>
                <option value="A">A — Top</option>
                <option value="B">B — Standard</option>
                <option value="C">C — Occasionale</option>
                <option value="VIP">VIP</option>
                <option value="PROSPECT">Prospect</option>
              </select>
            </Field>

            {/* Dati fiscali */}
            <Field label="P.IVA" icon={<Hash className="h-2.5 w-2.5" />}>
              <Input
                className={INPUT_CLS}
                placeholder="01234567890"
                value={form.piva ?? ""}
                onChange={(e) => set("piva", e.target.value)}
              />
            </Field>

            <Field label="Codice Fiscale" icon={<Hash className="h-2.5 w-2.5" />}>
              <Input
                className={INPUT_CLS}
                placeholder="RSSMRA80A01H501Z"
                value={form.codice_fiscale ?? ""}
                onChange={(e) => set("codice_fiscale", e.target.value)}
              />
            </Field>

            <Field label="PEC" icon={<Mail className="h-2.5 w-2.5" />}>
              <Input
                className={INPUT_CLS}
                type="email"
                placeholder="pec@pec.it"
                value={form.pec ?? ""}
                onChange={(e) => set("pec", e.target.value)}
              />
            </Field>

            <Field label="Codice SDI" hint="7 caratteri">
              <Input
                className={INPUT_CLS}
                placeholder="ABCDEFG"
                value={form.sdi ?? ""}
                onChange={(e) => set("sdi", e.target.value.toUpperCase())}
                maxLength={7}
              />
            </Field>

            {/* ═══ CONTATTI ══════════════════════════════════════ */}
            <SectionTitle label="Contatti" />

            <Field label="Telefono" icon={<Phone className="h-2.5 w-2.5" />}>
              <Input
                className={INPUT_CLS}
                placeholder="+39 02 1234567"
                value={form.telefono ?? ""}
                onChange={(e) => set("telefono", e.target.value)}
              />
            </Field>

            <Field label="Cellulare" icon={<Phone className="h-2.5 w-2.5" />}>
              <Input
                className={INPUT_CLS}
                placeholder="+39 333 1234567"
                value={form.cellulare ?? ""}
                onChange={(e) => set("cellulare", e.target.value)}
              />
            </Field>

            <Field label="Email" icon={<Mail className="h-2.5 w-2.5" />}>
              <Input
                className={INPUT_CLS}
                type="email"
                placeholder="info@azienda.it"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>

            <Field label="Sito Web" icon={<Globe className="h-2.5 w-2.5" />}>
              <Input
                className={INPUT_CLS}
                placeholder="https://www.azienda.it"
                value={form.sito_web ?? ""}
                onChange={(e) => set("sito_web", e.target.value)}
              />
            </Field>

            {/* ═══ INDIRIZZO ═════════════════════════════════════ */}
            <SectionTitle label="Indirizzo" />

            <Field label="Indirizzo" className="col-span-full" icon={<MapPin className="h-2.5 w-2.5" />}>
              <Input
                className={INPUT_CLS}
                placeholder="Via Roma, 1"
                value={form.indirizzo ?? ""}
                onChange={(e) => set("indirizzo", e.target.value)}
              />
            </Field>

            <Field label="Comune">
              <Input
                className={INPUT_CLS}
                placeholder="Milano"
                value={form.comune ?? ""}
                onChange={(e) => set("comune", e.target.value)}
              />
            </Field>

            <Field label="CAP">
              <Input
                className={INPUT_CLS}
                placeholder="20121"
                value={form.cap ?? ""}
                onChange={(e) => set("cap", e.target.value)}
                maxLength={5}
              />
            </Field>

            <Field label="Provincia">
              <Input
                className={INPUT_CLS}
                placeholder="MI"
                value={form.provincia ?? ""}
                onChange={(e) => set("provincia", e.target.value.toUpperCase())}
                maxLength={2}
              />
            </Field>

            <Field label="Paese">
              <Input
                className={INPUT_CLS}
                placeholder="Italia"
                value={form.paese ?? "Italia"}
                onChange={(e) => set("paese", e.target.value)}
              />
            </Field>

            <Field label="Note Indirizzo" className="col-span-full">
              <Input
                className={INPUT_CLS}
                placeholder="Scala B, 3° piano..."
                value={form.note_indirizzo ?? ""}
                onChange={(e) => set("note_indirizzo", e.target.value)}
              />
            </Field>

            {/* ═══ COMMERCIALE ═══════════════════════════════════ */}
            <SectionTitle label="Commerciale" />

            <Field label="Accordo di Pagamento" icon={<CreditCard className="h-2.5 w-2.5" />}>
              <select
                className={SELECT_CLS}
                value={form.condizioni_pagamento ?? ""}
                onChange={(e) => set("condizioni_pagamento", e.target.value)}
              >
                <option value="">— Seleziona —</option>
                <option value="Immediato">Immediato</option>
                <option value="15gg DFFM">15gg DFFM</option>
                <option value="30gg DFFM">30gg DFFM</option>
                <option value="60gg DFFM">60gg DFFM</option>
                <option value="90gg DFFM">90gg DFFM</option>
                <option value="Bonifico anticipato">Bonifico anticipato</option>
                <option value="RiBa 30gg">RiBa 30gg</option>
                <option value="Personalizzato">Personalizzato</option>
              </select>
            </Field>

            <Field label="Affidabilità">
              <select
                className={SELECT_CLS}
                value={form.affidabilita ?? "MEDIA"}
                onChange={(e) => set("affidabilita", e.target.value as any)}
              >
                <option value="ALTA">🟢 Alta</option>
                <option value="MEDIA">🟡 Media</option>
                <option value="BASSA">🔴 Bassa</option>
              </select>
            </Field>

            <Field label="Note Commerciali" className="col-span-full">
              <Textarea
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-700 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/30 focus:border-primary/40 resize-none"
                rows={3}
                placeholder="Accordi particolari, preferenze, note interne..."
                value={form.note ?? ""}
                onChange={(e) => set("note", e.target.value)}
              />
            </Field>

            <Field label="Stato">
              <select
                className={SELECT_CLS}
                value={form.attivo ? "attivo" : "inattivo"}
                onChange={(e) => set("attivo", e.target.value === "attivo")}
              >
                <option value="attivo">Attivo</option>
                <option value="inattivo">Inattivo</option>
              </select>
            </Field>

            {/* ═══ FILE DRIVE ════════════════════════════════════ */}
            <SectionTitle label="File collegati (Drive)" />

            <div className="col-span-full">
              <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-muted-foreground/50 hover:border-primary/30 hover:text-primary/50 transition-all cursor-pointer group">
                <Link2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-black uppercase tracking-wider">
                  + Collega file da Google Drive
                </span>
              </div>
              {(form.drive_files ?? []).length > 0 && (
                <div className="mt-2 space-y-1">
                  {(form.drive_files ?? []).map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground bg-white/5 px-3 py-2 rounded-lg">
                      <Link2 className="h-3 w-3 text-primary/60" />
                      <span className="flex-1 truncate">{f.name || f.url || f}</span>
                      <button
                        type="button"
                        onClick={() => set("drive_files", (form.drive_files ?? []).filter((_, j) => j !== i))}
                        className="text-muted-foreground/40 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          <DialogFooter className="pt-6 border-t border-border/30">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-white hover:bg-muted"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-primary hover:bg-primary/90 text-[10px] font-black uppercase italic tracking-widest text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.2)] min-w-[140px]"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEditing ? (
                "Salva Modifiche"
              ) : (
                "Crea Cliente"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
