import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Clock,
  Eye,
  FolderOpen,
  History,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Trophy,
  TrendingUp,
  Zap,
} from "lucide-react";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useUpdateClienteAffidabilita } from "@/hooks/useClienti";
import { DashboardKpiCard } from "@/components/analytics/DashboardKpiCard";
import { PageTransition } from "@/components/common/PageTransition";
import { ForecastTable } from "@/components/analytics/ForecastTable";
import { ForecastWidget } from "@/components/analytics/ForecastWidget";
import { CommessaDialog } from "@/components/commesse/CommessaDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ClienteAffidabilita, Commessa } from "@/types";

function capitalizeLabel(value: string) {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const initialDate = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(String(initialDate.getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(initialDate.getFullYear()));
  const [isCommessaDialogOpen, setIsCommessaDialogOpen] = useState(false);
  const [selectedCommessa, setSelectedCommessa] = useState<Commessa | null>(null);
  const updateClienteAffidabilita = useUpdateClienteAffidabilita();

  const selectedDate = useMemo(
    () => new Date(Number(selectedYear), Number(selectedMonth), 1),
    [selectedMonth, selectedYear]
  );
  const { data: analytics, isLoading } = useAnalytics(selectedDate);

  const currentMonthName = format(selectedDate, "MMMM yyyy", { locale: it });
  const currentMonthShortName = capitalizeLabel(format(selectedDate, "MMM yyyy", { locale: it }));
  const previousMonthName = capitalizeLabel(
    format(subMonths(selectedDate, 1), "MMM yyyy", { locale: it })
  );
  const selectedMonthQuery = format(selectedDate, "yyyy-MM-01");

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => ({
        value: String(monthIndex),
        label: capitalizeLabel(format(new Date(2026, monthIndex, 1), "LLLL", { locale: it })),
      })),
    []
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>();

    (analytics?.commesse || []).forEach((commessa) => {
      if (!commessa.mese_competenza) return;
      years.add(parseISO(commessa.mese_competenza).getFullYear());
    });

    years.add(initialDate.getFullYear());
    years.add(Number(selectedYear));

    return Array.from(years).sort((a, b) => a - b);
  }, [analytics?.commesse, initialDate, selectedYear]);

  const currentCommesse = useMemo(
    () =>
      (analytics?.commesse || [])
        .filter((commessa) => {
          const competenceDate = parseISO(commessa.mese_competenza);
          return (
            competenceDate.getMonth() === selectedDate.getMonth() &&
            competenceDate.getFullYear() === selectedDate.getFullYear()
          );
        })
        .sort((a, b) => (b.valore_fatturabile || 0) - (a.valore_fatturabile || 0)),
    [analytics?.commesse, selectedDate]
  );

  const currentClientsCount = useMemo(
    () => new Set(currentCommesse.map((commessa) => commessa.cliente_id)).size,
    [currentCommesse]
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);

  const openCommessePage = () => {
    navigate("/commesse");
  };

  const openClientePage = (clienteId?: string) => {
    if (!clienteId) return;
    navigate(`/clienti/${clienteId}`);
  };

  const openProgettoPage = (progettoId?: string) => {
    if (!progettoId) return;
    navigate(`/progetti/${progettoId}`);
  };

  const openCommessaDetail = (commessaId: string) => {
    navigate(`/commesse/${commessaId}`);
  };

  const handleNewCommessa = () => {
    setSelectedCommessa(null);
    setIsCommessaDialogOpen(true);
  };

  const handleEditCommessa = (commessa: Commessa) => {
    setSelectedCommessa(commessa);
    setIsCommessaDialogOpen(true);
  };

  const handleClienteAffidabilitaChange = (
    clienteId: string,
    affidabilita: ClienteAffidabilita
  ) => {
    updateClienteAffidabilita.mutate({ id: clienteId, affidabilita });
  };

  const kpis = [
    {
      label: "Fatturabile Mese Selezionato",
      value: formatCurrency(analytics?.kpis.currentMonthFatturabile || 0),
      subValue: `${analytics?.kpis.currentMonthCount || 0} commesse attive | ${analytics?.kpis.selectedMonthClientsCount || 0} clienti`,
      icon: TrendingUp,
      color: "text-purple-400",
    },
    {
      label: "Fatturato Mese Precedente",
      value: formatCurrency(analytics?.kpis.prevMonthFatturato || 0),
      subValue: previousMonthName,
      icon: History,
      color: "text-blue-400",
    },
    {
      label: "Margine Medio Mese",
      value: `${(analytics?.kpis.selectedMonthMargin || 0).toFixed(0)}%`,
      subValue: "Target aziendale > 30%",
      icon: Trophy,
      color: "text-green-400",
    },
    {
      label: "Commesse Aperte",
      value: analytics?.kpis.ongoingProjects || 0,
      subValue: currentMonthShortName,
      icon: Briefcase,
      color: "text-amber-400",
    },
    {
      label: "Costo Struttura",
      value: formatCurrency(analytics?.kpis.costoStruttura || 0),
      subValue: "Fissi mensili",
      icon: Zap,
      color: "text-red-400",
    },
    {
      label: "Margini Sotto Soglia",
      value: analytics?.kpis.marginiSottoSoglia || 0,
      subValue: "A rischio perdita",
      icon: AlertTriangle,
      color: "text-orange-500",
    },
  ];

  const getStatusBadge = (stato: string) => {
    switch (stato) {
      case "FATTURATA":
      case "INCASSATA":
        return (
          <Badge className="border-emerald-500/20 bg-emerald-500/10 px-2 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">
            Fatturata
          </Badge>
        );
      case "PRONTA_CHIUSURA":
        return (
          <Badge className="border-blue-500/20 bg-blue-500/10 px-2 text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:bg-blue-500/20">
            Pronta Chiusura
          </Badge>
        );
      case "APERTA":
      default:
        return (
          <Badge className="border-amber-500/20 bg-amber-500/10 px-2 text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:bg-amber-500/20">
            Aperta
          </Badge>
        );
    }
  };

  return (
    <PageTransition>
      <div className="w-full space-y-8 pb-20">
      <header className="flex items-center justify-between px-1">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-3 text-4xl font-black tracking-tighter text-foreground uppercase italic underline decoration-primary/30 decoration-8 underline-offset-[12px]">
            Dashboard <span className="font-thin text-muted-foreground/30 not-italic">-</span>{" "}
            <span className="capitalize text-primary not-italic">{currentMonthName}</span>
          </h1>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60">
            Panoramica finanziaria e operativa in tempo reale
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-bold"
              >
                {String.fromCharCode(64 + index)}
              </div>
            ))}
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-bold text-primary-foreground">
              +5
            </div>
          </div>

          <div className="mx-2 h-8 w-[1px] bg-border" />

          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-9 w-[150px] border-border/60 bg-card/60">
                <SelectValue placeholder="Mese" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-9 w-[110px] border-border/60 bg-card/60">
                <SelectValue placeholder="Anno" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="rounded-xl p-2 transition-all hover:bg-white/5 group">
                  <Info className="h-5 w-5 text-slate-500 group-hover:text-primary transition-colors" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-border text-white text-[10px] font-bold uppercase tracking-widest px-3 py-2">
                Aiuto & Informazioni Dashboard
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      <div className="grid layout-gap md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <DashboardKpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            subValue={kpi.subValue}
            icon={kpi.icon}
            color={kpi.color}
            loading={isLoading}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 layout-gap lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="flex items-center justify-between px-1">
            <button
              onClick={openCommessePage}
              className="text-left text-xl font-black italic uppercase tracking-tighter text-foreground transition-colors hover:text-primary"
            >
              Commesse {currentMonthShortName}
            </button>

            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                {currentClientsCount} clienti | {currentCommesse.length} commesse
              </span>
              <Button
                type="button"
                onClick={handleNewCommessa}
                className="h-9 rounded-xl bg-primary px-4 text-[10px] font-black uppercase italic tracking-widest text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.2)] hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nuova commessa
              </Button>
              <button
                onClick={openCommessePage}
                className="group flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
              >
                Vedi tutte{" "}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/40 bg-card/30 shadow-2xl">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="py-4 pl-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Cliente
                  </TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Progetti
                  </TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Fatturabile
                  </TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Margine
                  </TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Stato
                  </TableHead>
                  <TableHead className="py-4 pr-6 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Azioni
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      <TableCell className="py-4 pl-6"><div className="h-4 w-32 animate-pulse rounded bg-muted/40" /></TableCell>
                      <TableCell className="py-4"><div className="h-4 w-24 animate-pulse rounded bg-muted/30" /></TableCell>
                      <TableCell className="py-4 text-right"><div className="h-4 w-16 ml-auto animate-pulse rounded bg-muted/20" /></TableCell>
                      <TableCell className="py-4 text-right"><div className="h-4 w-12 ml-auto animate-pulse rounded bg-muted/20" /></TableCell>
                      <TableCell className="py-4 text-right"><div className="h-4 w-20 ml-auto animate-pulse rounded bg-muted/10" /></TableCell>
                      <TableCell className="py-4 pr-6 text-right"><div className="h-8 w-8 ml-auto animate-pulse rounded-full bg-muted/10" /></TableCell>
                    </TableRow>
                  ))
                ) : currentCommesse.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center opacity-50">
                      Nessuna commessa trovata per il mese selezionato
                    </TableCell>
                  </TableRow>
                ) : (
                  currentCommesse.map((commessa) => {
                    const linkedProjects = (commessa.righe_progetto || [])
                      .map((riga) => ({
                        id: riga.progetto?.id || riga.progetto_id,
                        nome: riga.progetto?.nome || "Progetto collegato",
                      }))
                      .filter(
                        (project, index, array) =>
                          !!project.id &&
                          array.findIndex((item) => item.id === project.id) === index
                      );

                    return (
                      <TableRow
                        key={commessa.id}
                        className="group cursor-pointer border-border/30 transition-all hover:bg-muted/30"
                        onClick={() => openCommessaDetail(commessa.id)}
                      >
                        <TableCell className="py-5 pl-6">
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className="w-fit text-left text-xs font-black text-foreground transition-colors hover:underline group-hover:text-primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                openClientePage(commessa.cliente_id);
                              }}
                            >
                              {commessa.cliente?.ragione_sociale}
                            </button>
                            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                              {commessa.cliente?.codice_cliente || "MOD"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-5">
                          <div className="flex flex-col gap-1">
                            {(commessa.righe_progetto || []).length > 0 ? (
                              commessa.righe_progetto.map((riga) => (
                                <button
                                  key={riga.id}
                                  type="button"
                                  className="w-fit text-left text-[10px] font-bold text-muted-foreground transition-colors hover:text-primary hover:underline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openProgettoPage(riga.progetto?.id || riga.progetto_id);
                                  }}
                                >
                                  {riga.progetto?.nome || "Progetto collegato"}
                                </button>
                              ))
                            ) : (
                              <span className="text-[10px] italic text-muted-foreground/40">
                                Nessun progetto
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-5 text-right font-black text-foreground tabular-nums">
                          {formatCurrency(commessa.valore_fatturabile || 0)}
                        </TableCell>

                        <TableCell className="py-5 text-right">
                          <span
                            className={`text-[12px] font-black tabular-nums ${
                              (commessa.margine_percentuale || 0) < 30
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {commessa.margine_percentuale?.toFixed(0)}%
                          </span>
                        </TableCell>

                        <TableCell className="py-5 text-right">
                          {getStatusBadge(commessa.stato)}
                        </TableCell>

                        <TableCell
                          className="py-5 pr-6 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => handleEditCommessa(commessa)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => openCommessaDetail(commessa.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="rounded-3xl border-border/50 bg-card/40 text-foreground shadow-2xl"
                              >
                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                  Azioni commessa
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-border/50" />
                                <DropdownMenuItem
                                  onClick={() => handleEditCommessa(commessa)}
                                  className="cursor-pointer text-xs font-bold focus:bg-muted"
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Modifica commessa
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openClientePage(commessa.cliente_id)}
                                  className="cursor-pointer text-xs font-bold focus:bg-muted"
                                >
                                  <Building2 className="mr-2 h-4 w-4" />
                                  Vai al cliente
                                </DropdownMenuItem>
                                {linkedProjects.length === 1 && (
                                  <DropdownMenuItem
                                    onClick={() => openProgettoPage(linkedProjects[0].id)}
                                    className="cursor-pointer text-xs font-bold focus:bg-muted"
                                  >
                                    <FolderOpen className="mr-2 h-4 w-4" />
                                    Vai al progetto
                                  </DropdownMenuItem>
                                )}
                                {linkedProjects.length > 1 && (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="cursor-pointer text-xs font-bold focus:bg-muted">
                                      <FolderOpen className="mr-2 h-4 w-4" />
                                      Vai al progetto
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="rounded-3xl border-border/50 bg-card/40 text-foreground shadow-2xl">
                                      {linkedProjects.map((project) => (
                                        <DropdownMenuItem
                                          key={project.id}
                                          onClick={() => openProgettoPage(project.id)}
                                          className="cursor-pointer text-xs font-bold focus:bg-muted"
                                        >
                                          {project.nome}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Card className="group relative overflow-hidden border-rose-500/30 bg-card shadow-2xl transition-all hover:border-rose-500/50">
            <div className="absolute top-0 right-0 p-3 opacity-50 group-hover:opacity-100 transition-opacity">
              <AlertTriangle className={cn("h-4 w-4 text-rose-500", (analytics?.kpis.timesheetPendingCount || 0) > 0 && "animate-pulse")} />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                Attenzione
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-black text-foreground uppercase italic tracking-tighter">
                  Attention <span className="text-rose-500 not-italic">Required</span>
                </h3>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">
                    Timesheet da approvare
                  </span>
                  <span className={cn(
                    "text-lg font-black transition-all",
                    (analytics?.kpis.timesheetPendingCount || 0) > 0 ? "text-rose-500 scale-110" : "text-slate-500"
                  )}>
                    {analytics?.kpis.timesheetPendingCount || 0}
                  </span>
                </div>
              </div>

              {(analytics?.kpis.marginiSottoSoglia || 0) > 0 && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                  <Info className="mt-0.5 h-4 w-4 text-rose-500" />
                  <p className="text-[10px] font-bold leading-relaxed text-foreground/80">
                    Rilevate{" "}
                    <span className="font-black text-rose-600 dark:text-rose-500">{analytics?.kpis.marginiSottoSoglia} commesse</span>{" "}
                    con margine critico sotto la soglia del 30%.
                  </p>
                </div>
              )}

              <button
                onClick={() => navigate("/timesheet")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted/50 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-primary hover:text-primary-foreground shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                Vai alla revisione <Clock className="h-3 w-3" />
              </button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h4 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Alert di sistema
            </h4>
            <div className="space-y-2">
              {analytics?.alerts.slice(0, 3).map((alert, index) => (
                <div
                  key={`${alert.title}-${index}`}
                  className="group flex cursor-pointer items-center justify-between rounded-2xl border border-border/30 bg-card/40 p-4 transition-all hover:border-primary/40 hover:bg-card/60"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="max-w-[200px] truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {alert.title}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">
                      {alert.value}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "rounded-xl p-2 transition-transform group-hover:scale-110",
                      alert.severity === "high"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {alert.type === "INVOICE" ? (
                      <Zap className="h-3.5 w-3.5" />
                    ) : (
                      <Briefcase className="h-3.5 w-3.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <ForecastWidget />
      </div>

      <div className="pt-4">
        <ForecastTable
          data={analytics?.forecast || []}
          totals={[
            (analytics?.forecast || []).reduce((acc, item) => acc + (item.months[0] || 0), 0),
            (analytics?.forecast || []).reduce((acc, item) => acc + (item.months[1] || 0), 0),
            (analytics?.forecast || []).reduce((acc, item) => acc + (item.months[2] || 0), 0),
          ]}
          costoMO={analytics?.kpis.monthlyHours ? (analytics.kpis.monthlyHours * 40) / 12 : 1200}
          costoStruttura={analytics?.kpis.costoStruttura || 0}
          loading={isLoading}
          onClienteClick={openClientePage}
          onAffidabilitaChange={handleClienteAffidabilitaChange}
          updatingClienteId={
            updateClienteAffidabilita.isPending
              ? updateClienteAffidabilita.variables?.id || null
              : null
          }
          baseDate={selectedDate}
        />
      </div>

      <CommessaDialog
        open={isCommessaDialogOpen}
        onOpenChange={setIsCommessaDialogOpen}
        commessa={selectedCommessa}
        defaultMeseCompetenza={selectedMonthQuery}
      />
      </div>
    </PageTransition>
  );
}
