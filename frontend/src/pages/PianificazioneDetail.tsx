import { type ReactNode, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useApprovePianificazione,
  useConvertPianificazione,
  usePianificazione,
  usePianificazioneDelta,
} from "@/hooks/usePianificazioni";

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0);
}

function statusClasses(status: string) {
  if (status === "CONVERTED") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (status === "ACCEPTED") return "bg-blue-500/10 text-blue-300 border-blue-500/20";
  return "bg-slate-500/10 text-slate-300 border-slate-500/20";
}

function deltaClass(delta: number) {
  if (delta > 0) return "text-red-400";
  if (delta < 0) return "text-emerald-400";
  return "text-muted-foreground";
}

export default function PianificazioneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: plan, isLoading, error } = usePianificazione(id);
  const { data: delta } = usePianificazioneDelta(id);
  const approve = useApprovePianificazione();
  const convert = useConvertPianificazione();

  const [approveOpen, setApproveOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [conversionMonth, setConversionMonth] = useState(format(new Date(), "yyyy-MM"));

  const totalHours = useMemo(
    () => (plan?.lavorazioni || []).reduce((sum, item) => sum + Number(item.ore_previste || 0), 0),
    [plan],
  );

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-40 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="p-8 space-y-4">
        <p className="text-lg font-bold text-foreground">Pianificazione non trovata</p>
        <Button variant="outline" onClick={() => navigate("/commesse?tab=pianificazioni")}>
          Torna alla lista
        </Button>
      </div>
    );
  }

  const deltaSummary = delta?.summary;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        <Link to="/commesse?tab=pianificazioni" className="hover:text-white transition-colors">Pianificazioni</Link>
        <span>/</span>
        <span className="text-foreground">{plan.cliente?.ragione_sociale}</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button variant="ghost" onClick={() => navigate("/commesse?tab=pianificazioni")} className="px-0 text-muted-foreground hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Torna alle pianificazioni
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black tracking-tight text-foreground">
                {plan.cliente?.ragione_sociale || "Pianificazione"}
              </h1>
              <Badge variant="outline" className={`font-black uppercase tracking-widest ${statusClasses(plan.stato)}`}>
                {plan.stato}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Creata il {format(parseISO(plan.created_at), "dd MMMM yyyy", { locale: it })}.
              {plan.commessa_id ? " Commessa collegata disponibile." : " Nessuna commessa collegata per ora."}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {plan.stato === "PENDING" && (
            <Button onClick={() => setApproveOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approva
            </Button>
          )}
          {plan.stato === "ACCEPTED" && (
            <Button onClick={() => setConvertOpen(true)} className="bg-primary hover:bg-primary/90 text-white">
              <ArrowRight className="w-4 h-4 mr-2" />
              Converti in Commessa
            </Button>
          )}
          {plan.commessa_id && (
            <Button variant="outline" onClick={() => navigate(`/commesse/${plan.commessa_id}`)}>
              <Briefcase className="w-4 h-4 mr-2" />
              Apri Commessa
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Budget" value={euro(Number(plan.budget))} icon={<Target className="w-4 h-4 text-primary" />} />
        <MetricCard title="Costo Previsto" value={euro(Number(plan.costo_totale))} icon={<TrendingDown className="w-4 h-4 text-red-400" />} />
        <MetricCard title="Margine Previsto" value={`${Number(plan.margine_percentuale || 0).toFixed(1)}%`} icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} />
        <MetricCard title="Ore Pianificate" value={`${totalHours.toFixed(1)}h`} icon={<Clock3 className="w-4 h-4 text-blue-300" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 bg-card border-border overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Lavorazioni Previste
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Risorsa</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Lavorazione</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Ore</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Costo Orario</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Costo Previsto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.lavorazioni.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/10">
                    <TableCell className="font-medium text-foreground">
                      {item.user ? `${item.user.nome} ${item.user.cognome}` : "Non assegnata"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.tipo_lavorazione}</TableCell>
                    <TableCell className="text-right font-mono">{Number(item.ore_previste).toFixed(1)}h</TableCell>
                    <TableCell className="text-right font-mono">{euro(Number(item.costo_orario_snapshot))}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {euro(Number(item.ore_previste) * Number(item.costo_orario_snapshot))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Sintesi Operativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stato attuale</p>
              <p className="mt-2 text-sm text-foreground">
                {plan.stato === "PENDING" && "Bozza pronta per approvazione interna."}
                {plan.stato === "ACCEPTED" && "Approvata, pronta per diventare una commessa operativa."}
                {plan.stato === "CONVERTED" && "Convertita in commessa e usata come baseline di controllo."}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Note</p>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-sm text-foreground min-h-[120px] whitespace-pre-wrap">
                {plan.note || "Nessuna nota inserita."}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Delta Pianificato vs Reale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!delta?.has_commessa ? (
            <div className="rounded-2xl border border-dashed border-border/50 p-6 text-sm text-muted-foreground">
              Il confronto reale si attiva automaticamente dopo la conversione in commessa e l'arrivo dei timesheet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard title="Ore Reali" value={`${deltaSummary?.actual_hours?.toFixed(1) || "0.0"}h`} icon={<Clock3 className="w-4 h-4 text-foreground" />} />
                <MetricCard title="Costo Reale" value={euro(Number(deltaSummary?.actual_cost || 0))} icon={<TrendingDown className="w-4 h-4 text-red-400" />} />
                <MetricCard
                  title="Delta Ore"
                  value={`${Number(deltaSummary?.delta_hours || 0).toFixed(1)}h`}
                  icon={<TrendingUp className={`w-4 h-4 ${deltaClass(Number(deltaSummary?.delta_hours || 0))}`} />}
                />
                <MetricCard
                  title="Delta Costo"
                  value={euro(Number(deltaSummary?.delta_cost || 0))}
                  icon={<TrendingUp className={`w-4 h-4 ${deltaClass(Number(deltaSummary?.delta_cost || 0))}`} />}
                />
              </div>

              <div className="rounded-2xl border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Risorsa</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Ore Prev.</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Ore Reali</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Costo Prev.</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Costo Reale</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {delta.rows.map((row) => (
                      <TableRow key={row.key} className="hover:bg-muted/10">
                        <TableCell className="font-medium text-foreground">{row.label}</TableCell>
                        <TableCell className="text-right font-mono">{row.planned_hours.toFixed(1)}h</TableCell>
                        <TableCell className="text-right font-mono">{row.actual_hours.toFixed(1)}h</TableCell>
                        <TableCell className="text-right font-mono">{euro(row.planned_cost)}</TableCell>
                        <TableCell className="text-right font-mono">{euro(row.actual_cost)}</TableCell>
                        <TableCell className={`text-right font-semibold ${deltaClass(row.delta_cost)}`}>
                          {euro(row.delta_cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle>Approva Pianificazione</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Stai approvando questa pianificazione. Le risorse stimate verranno considerate come baseline operativa del team.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveOpen(false)}>Annulla</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={approve.isPending}
              onClick={async () => {
                await approve.mutateAsync(plan.id);
                setApproveOpen(false);
              }}
            >
              Conferma Approvazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="bg-card border-border text-white">
          <DialogHeader>
            <DialogTitle>Converti in Commessa</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Verrà creata automaticamente una commessa collegata a questa pianificazione.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Mese di competenza
            </label>
            <Input type="month" value={conversionMonth} onChange={(e) => setConversionMonth(e.target.value)} className="bg-muted border-border text-white" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConvertOpen(false)}>Annulla</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={convert.isPending}
              onClick={async () => {
                const [year, month] = conversionMonth.split("-");
                const result = await convert.mutateAsync({
                  id: plan.id,
                  mese_competenza: `${year}-${month}-01`,
                });
                setConvertOpen(false);
                navigate(`/commesse/${result.id}`);
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

function MetricCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-3">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
