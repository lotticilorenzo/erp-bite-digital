import { useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ExternalLink, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useUsers";
import { useCommesse } from "@/hooks/useCommesse";
import { toast } from "sonner";
import {
  useCambiaStatoContenuto,
  useCreateContenuto,
  useDeleteContenuto,
  useUpdateContenuto,
  type Contenuto,
  type ContenutoStato,
  type ContenutoTipo,
} from "@/hooks/useContenuti";

const TIPI: ContenutoTipo[] = ["POST_SOCIAL", "COPY", "DESIGN", "VIDEO", "EMAIL", "ALTRO"];
const LABELS: Record<ContenutoStato, string> = {
  BOZZA: "Bozza",
  IN_REVISIONE_INTERNA: "Revisione interna",
  MODIFICHE_RICHIESTE_INTERNE: "Modifiche interne",
  APPROVATO_INTERNAMENTE: "Approvato interno",
  INVIATO_AL_CLIENTE: "Inviato cliente",
  MODIFICHE_RICHIESTE_CLIENTE: "Modifiche cliente",
  APPROVATO_CLIENTE: "Approvato cliente",
  PUBBLICATO: "Pubblicato",
  ARCHIVIATO: "Archiviato",
};

const NOTE_REQUIRED_STATES: ContenutoStato[] = [
  "MODIFICHE_RICHIESTE_INTERNE",
  "MODIFICHE_RICHIESTE_CLIENTE",
];

const CONTENT_MANAGER_ROLES = new Set(["ADMIN", "DEVELOPER", "PM"]);

type FormState = {
  titolo: string;
  tipo: ContenutoTipo;
  commessa_id: string;
  assegnatario_id: string;
  data_consegna_prevista: string;
  url_preview: string;
  testo: string;
  note_revisione: string;
};

function makeForm(contenuto?: Contenuto | null, defaultCommessaId?: string): FormState {
  return {
    titolo: contenuto?.titolo || "",
    tipo: contenuto?.tipo || "POST_SOCIAL",
    commessa_id: contenuto?.commessa_id || defaultCommessaId || "",
    assegnatario_id: contenuto?.assegnatario_id || "",
    data_consegna_prevista: contenuto?.data_consegna_prevista || "",
    url_preview: contenuto?.url_preview || "",
    testo: contenuto?.testo || "",
    note_revisione: contenuto?.note_revisione || "",
  };
}

type ContenutoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contenuto?: Contenuto | null;
  defaultCommessaId?: string;
};

function ContenutoDialogBody({
  contenuto,
  defaultCommessaId,
  onOpenChange,
  canManageContent,
}: Omit<ContenutoDialogProps, "open"> & { canManageContent: boolean }) {
  const [form, setForm] = useState<FormState>(() => makeForm(contenuto, defaultCommessaId));
  const { data: users = [] } = useUsers(true, canManageContent);
  const { data: commesse = [] } = useCommesse(undefined, canManageContent);
  const createContenuto = useCreateContenuto();
  const updateContenuto = useUpdateContenuto();
  const deleteContenuto = useDeleteContenuto();
  const changeState = useCambiaStatoContenuto();

  const handleSave = async () => {
    const contenutoId = contenuto?.id;
    const isEditing = Boolean(contenutoId);
    const payload = {
      titolo: form.titolo,
      tipo: form.tipo,
      data_consegna_prevista: form.data_consegna_prevista || null,
      url_preview: form.url_preview || null,
      testo: form.testo || null,
      note_revisione: form.note_revisione || null,
      ...((canManageContent || isEditing) ? { commessa_id: form.commessa_id || null } : {}),
      ...(canManageContent ? { assegnatario_id: form.assegnatario_id || null } : {}),
    };

    if (isEditing) {
      await updateContenuto.mutateAsync({ id: contenutoId!, data: payload });
    } else {
      await createContenuto.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!contenuto?.id || !window.confirm("Eliminare questo contenuto?")) return;
    await deleteContenuto.mutateAsync(contenuto.id);
    onOpenChange(false);
  };

  const handleTransition = async (target: ContenutoStato) => {
    if (!contenuto?.id) return;
    if (NOTE_REQUIRED_STATES.includes(target) && !form.note_revisione.trim()) {
      toast.error("Inserisci una nota revisione prima di richiedere modifiche");
      return;
    }
    await changeState.mutateAsync({
      id: contenuto.id,
      stato: target,
      note_revisione: form.note_revisione || undefined,
    });
    onOpenChange(false);
  };

  return (
    <DialogContent className="sm:max-w-[900px] bg-card border-border text-foreground p-0 overflow-hidden">
      <div className="grid md:grid-cols-[1.3fr_0.9fr]">
        <div className="p-6 space-y-4 border-b md:border-b-0 md:border-r border-border/40">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {contenuto ? "Dettaglio Contenuto" : "Nuovo Contenuto"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2">
              <Label>Titolo</Label>
              <Input value={form.titolo} onChange={(e) => setForm((p) => ({ ...p, titolo: e.target.value }))} className="bg-muted/20 border-border/50" />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as ContenutoTipo }))} className="flex h-10 w-full rounded-md border border-border/50 bg-muted/20 px-3 text-sm">
                {TIPI.map((tipo) => <option key={tipo} value={tipo}>{tipo.replaceAll("_", " ")}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Assegnatario</Label>
              {canManageContent ? (
                <select value={form.assegnatario_id || "NONE"} onChange={(e) => setForm((p) => ({ ...p, assegnatario_id: e.target.value === "NONE" ? "" : e.target.value }))} className="flex h-10 w-full rounded-md border border-border/50 bg-muted/20 px-3 text-sm">
                  <option value="NONE">Non assegnato</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.nome} {user.cognome}</option>)}
                </select>
              ) : (
                <div className="flex h-10 items-center rounded-md border border-border/50 bg-muted/10 px-3 text-sm text-muted-foreground">
                  {contenuto?.assegnatario_nome || "Assegnazione automatica al tuo profilo"}
                </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Commessa</Label>
              {canManageContent ? (
                <select value={form.commessa_id || "NONE"} onChange={(e) => setForm((p) => ({ ...p, commessa_id: e.target.value === "NONE" ? "" : e.target.value }))} className="flex h-10 w-full rounded-md border border-border/50 bg-muted/20 px-3 text-sm">
                  <option value="NONE">Nessuna commessa</option>
                  {commesse.map((commessa) => <option key={commessa.id} value={commessa.id}>{commessa.cliente?.ragione_sociale || "Cliente"} - {commessa.mese_competenza}</option>)}
                </select>
              ) : (
                <div className="flex h-10 items-center rounded-md border border-border/50 bg-muted/10 px-3 text-sm text-muted-foreground">
                  {contenuto?.cliente_nome || (form.commessa_id ? "Commessa impostata dal contesto corrente" : "Nessuna commessa collegata")}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Data consegna</Label>
              <Input type="date" value={form.data_consegna_prevista} onChange={(e) => setForm((p) => ({ ...p, data_consegna_prevista: e.target.value }))} className="bg-muted/20 border-border/50" />
            </div>

            <div className="space-y-2">
              <Label>URL preview</Label>
              <Input value={form.url_preview} onChange={(e) => setForm((p) => ({ ...p, url_preview: e.target.value }))} className="bg-muted/20 border-border/50" placeholder="https://..." />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Testo / note operative</Label>
              <Textarea value={form.testo} onChange={(e) => setForm((p) => ({ ...p, testo: e.target.value }))} className="min-h-[150px] bg-muted/20 border-border/50" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Note revisione</Label>
              <Textarea value={form.note_revisione} onChange={(e) => setForm((p) => ({ ...p, note_revisione: e.target.value }))} className="min-h-[90px] bg-muted/20 border-border/50" />
              {contenuto?.transizioni_possibili?.some((stato) => NOTE_REQUIRED_STATES.includes(stato)) && (
                <p className="text-[11px] text-muted-foreground">
                  La nota e obbligatoria quando richiedi modifiche interne o del cliente.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 flex-col gap-2 sm:flex-row sm:justify-between sm:space-x-0">
            <div>{contenuto?.id && <Button variant="outline" onClick={handleDelete} className="border-rose-500/30 bg-rose-500/5 text-rose-300 hover:bg-rose-500/10"><Trash2 className="mr-2 h-4 w-4" />Elimina</Button>}</div>
            <Button onClick={handleSave} disabled={!form.titolo.trim() || createContenuto.isPending || updateContenuto.isPending} className="bg-primary hover:bg-primary/90 text-white">
              <Save className="mr-2 h-4 w-4" />
              {contenuto ? "Salva modifiche" : "Crea contenuto"}
            </Button>
          </DialogFooter>
        </div>

        <div className="p-6 space-y-4 bg-muted/10">
          {contenuto ? (
            <>
              <div className="rounded-2xl border border-border/40 bg-card/80 p-4 space-y-3">
                <Badge variant="outline" className="font-black uppercase tracking-widest">
                  {LABELS[contenuto.stato]}
                </Badge>
                <p className="text-sm font-semibold text-foreground">{contenuto.cliente_nome || "Contenuto interno"}</p>
                {contenuto.url_preview && (
                  <a href={contenuto.url_preview} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Apri preview <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {contenuto.transizioni_possibili.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Prossimi step</p>
                  <div className="flex flex-wrap gap-2">
                    {contenuto.transizioni_possibili.map((stato) => (
                      <Button
                        key={stato}
                        size="sm"
                        variant="outline"
                        onClick={() => handleTransition(stato)}
                        disabled={changeState.isPending || (NOTE_REQUIRED_STATES.includes(stato) && !form.note_revisione.trim())}
                        className="text-[11px] font-black uppercase tracking-widest"
                      >
                        <Send className="mr-2 h-3 w-3" />
                        {LABELS[stato]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Storico</p>
                <div className="space-y-3">
                  {[...(contenuto.eventi || [])].reverse().map((evento) => (
                    <div key={evento.id} className="rounded-2xl border border-border/40 bg-card/80 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">{LABELS[evento.stato_nuovo]}</Badge>
                        <span className="text-[11px] text-muted-foreground">{format(parseISO(evento.created_at), "dd MMM yyyy, HH:mm", { locale: it })}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{evento.autore_nome || "Sistema"}</p>
                      {evento.nota && <p className="mt-2 text-sm text-foreground">{evento.nota}</p>}
                    </div>
                  ))}
                  {!contenuto.eventi?.length && <div className="rounded-2xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">Nessun evento registrato.</div>}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
              Crea il contenuto in bozza e poi spostalo lungo il flusso di approvazione.
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );
}

export function ContenutoDialog({
  open,
  onOpenChange,
  contenuto,
  defaultCommessaId,
}: ContenutoDialogProps) {
  const { user } = useAuth();
  const canManageContent = CONTENT_MANAGER_ROLES.has(user?.ruolo ?? "");
  const dialogKey = `${contenuto?.id ?? "new"}:${defaultCommessaId ?? "none"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ContenutoDialogBody
          key={dialogKey}
          contenuto={contenuto}
          defaultCommessaId={defaultCommessaId}
          onOpenChange={onOpenChange}
          canManageContent={canManageContent}
        />
      ) : null}
    </Dialog>
  );
}
