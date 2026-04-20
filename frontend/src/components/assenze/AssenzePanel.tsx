import { useState } from "react";
import {
  Calendar,
  Plus,
  Check,
  X,
  Clock,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import {
  useMyAssenze,
  useTeamAssenze,
  useAssenze,
  useApprovaAssenza,
  useRifiutaAssenza,
  type Assenza,
} from "@/hooks/useAssenze";

const STATO_BADGE: Record<string, { label: string; className: string }> = {
  PENDING:   { label: "In Attesa", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  APPROVATA: { label: "Approvata", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  RIFIUTATA: { label: "Rifiutata", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const TIPO_OPTIONS = ["FERIE", "MALATTIA", "PERMESSO", "ALTRO"];

interface AssenzeRequestDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function AssenzeRequestDialog({ open, onOpenChange }: AssenzeRequestDialogProps) {
  const { user } = useAuth();
  const { createAssenza } = useAssenze();
  const [form, setForm] = useState<{
    tipo: 'FERIE' | 'MALATTIA' | 'PERMESSO' | 'ALTRO';
    data_inizio: string;
    data_fine: string;
    note: string;
  }>({ tipo: "FERIE", data_inizio: "", data_fine: "", note: "" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.data_inizio || !form.data_fine || !user?.id) return;
    setSaving(true);
    try {
      await createAssenza({ user_id: user.id, ...form });
      onOpenChange(false);
      setForm({ tipo: "FERIE", data_inizio: "", data_fine: "", note: "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 border-border/50 backdrop-blur-xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tighter">Richiedi Assenza</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Tipo</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as any }))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest">Dal</Label>
              <Input type="date" className="h-9 text-xs" value={form.data_inizio}
                onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest">Al</Label>
              <Input type="date" className="h-9 text-xs" value={form.data_fine}
                onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Note</Label>
            <Textarea placeholder="Opzionale…" className="text-xs h-20 resize-none"
              value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button size="sm" disabled={saving || !form.data_inizio || !form.data_fine} onClick={handleSave}>
            {saving ? "Salvo…" : "Invia Richiesta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssenzaRow({ assenza, isAdmin }: { assenza: Assenza; isAdmin: boolean }) {
  const approva = useApprovaAssenza();
  const rifiuta = useRifiutaAssenza();
  const { deleteAssenza } = useAssenze();
  const badge = STATO_BADGE[assenza.stato] ?? STATO_BADGE.PENDING;

  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/10 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground">
            {format(parseISO(assenza.data_inizio), "dd MMM", { locale: it })} →{" "}
            {format(parseISO(assenza.data_fine), "dd MMM yyyy", { locale: it })}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">{assenza.tipo}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border ${badge.className}`}>
          {badge.label}
        </Badge>
        {isAdmin && assenza.stato === "PENDING" && (
          <>
            <button
              onClick={() => approva.mutate(assenza.id)}
              className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => rifiuta.mutate(assenza.id)}
              className="h-7 w-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}
        {assenza.stato === "PENDING" && !isAdmin && (
          <button
            onClick={() => deleteAssenza(assenza.id)}
            className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

interface AssenzeTeamPanelProps {
  compact?: boolean;
}

export function AssenzeTeamPanel({ compact = false }: AssenzeTeamPanelProps) {
  const { user } = useAuth();
  const isAdmin = user?.ruolo === "ADMIN" || user?.ruolo === "PM";
  const [requestOpen, setRequestOpen] = useState(false);

  const { data: myAssenze = [], isLoading: loadingMine } = useMyAssenze();
  const { data: teamAssenze = [], isLoading: loadingTeam } = useTeamAssenze(
    isAdmin ? { stato: "PENDING" } : undefined
  );

  const pendingCount = teamAssenze.filter(a => a.stato === "PENDING").length;

  return (
    <>
      <Card className="bg-card/40 border-border/50 rounded-3xl overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {isAdmin ? "Richieste Assenze" : "Le Mie Assenze"}
            {isAdmin && pendingCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] font-black uppercase tracking-widest px-1.5 py-0 ml-1">
                {pendingCount}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)}
            className="h-7 text-[10px] font-black uppercase tracking-widest gap-1.5 rounded-lg">
            <Plus className="h-3 w-3" />
            Richiedi
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {isAdmin ? (
            loadingTeam ? (
              <p className="text-xs text-muted-foreground italic">Caricamento…</p>
            ) : teamAssenze.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nessuna richiesta in attesa</p>
            ) : (
              (compact ? teamAssenze.slice(0, 4) : teamAssenze).map(a => (
                <AssenzaRow key={a.id} assenza={a} isAdmin={isAdmin} />
              ))
            )
          ) : (
            loadingMine ? (
              <p className="text-xs text-muted-foreground italic">Caricamento…</p>
            ) : myAssenze.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nessuna assenza registrata</p>
            ) : (
              (compact ? myAssenze.slice(0, 4) : myAssenze).map(a => (
                <AssenzaRow key={a.id} assenza={a} isAdmin={false} />
              ))
            )
          )}
        </CardContent>
      </Card>

      <AssenzeRequestDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </>
  );
}
