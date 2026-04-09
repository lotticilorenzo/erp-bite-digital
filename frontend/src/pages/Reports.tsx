import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarRange,
  Download,
  Eye,
  FileText,
  Filter,
  LineChart,
  RotateCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  differenceInCalendarMonths,
  format,
  isValid,
  isWithinInterval,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfMonth,
} from "date-fns";
import { it } from "date-fns/locale";
import { PDFDownloadLink, PDFViewer } from "@/lib/react-pdf";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCommesse } from "@/hooks/useCommesse";
import { useClienti } from "@/hooks/useClienti";
import { useFattureAttive } from "@/hooks/useFatture";
import { useCostiFissi, type CostoFisso } from "@/hooks/useCosti";
import { useTimesheets } from "@/hooks/useTimesheet";
import { CommessaReportPDF } from "@/components/commesse/CommessaReportPDF";
import { ClienteReportPDF } from "@/components/reports/ClienteReportPDF";
import {
  REPORTING_PERIOD_OPTIONS,
  formatDateInput,
  getPeriodLabel,
  getRangeForPreset,
  resolveReportingRange,
  type ReportingDateRange,
  type ReportingPeriodPreset,
} from "@/lib/reporting-period";
import {
  buildClientById,
  getClienteDisplayName,
  hydrateCommesseWithClienti,
  resolveCommessaCliente,
} from "@/lib/commessa-clienti";
import type { Cliente, Commessa, FatturaAttiva, CommessaStatus } from "@/types";

const formatEuro = (value = 0) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

function getCommessaProjectsLabel(commessa: Commessa) {
  const names = commessa.righe_progetto
    .map((row) => row.progetto?.nome)
    .filter(Boolean) as string[];

  if (names.length === 0) {
    return "Nessun progetto collegato";
  }

  return names.join(", ");
}

function getStatusBadgeClasses(status: CommessaStatus) {
  switch (status) {
    case "INCASSATA":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "FATTURATA":
      return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    case "CHIUSA":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "PRONTA_CHIUSURA":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "APERTA":
    default:
      return "bg-white/5 text-white border-border/50";
  }
}

function normalizePeriodicity(periodicita?: string) {
  const value = (periodicita || "").trim().toLowerCase();

  if (value.includes("semes")) {
    return "SEMESTER";
  }

  if (value.includes("annual")) {
    return "YEAR";
  }

  return "MONTH";
}

function getAllocatedStructureCost(cost: CostoFisso, range: ReportingDateRange) {
  if (!cost.attivo && !cost.data_inizio && !cost.data_fine) {
    return 0;
  }

  if (!cost.attivo && !cost.data_fine) {
    return 0;
  }

  const costStart = cost.data_inizio ? parseISO(cost.data_inizio) : range.from;
  const costEnd = cost.data_fine ? parseISO(cost.data_fine) : range.to;

  if (!isValid(costStart) || !isValid(costEnd)) {
    return 0;
  }

  const overlapStart = maxDate([startOfMonth(costStart), startOfMonth(range.from)]);
  const overlapEnd = minDate([startOfMonth(costEnd), startOfMonth(range.to)]);

  if (overlapStart > overlapEnd) {
    return 0;
  }

  const monthCount = differenceInCalendarMonths(overlapEnd, overlapStart) + 1;
  const amount = Number(cost.importo || 0);

  switch (normalizePeriodicity(cost.periodicita)) {
    case "SEMESTER":
      return (amount / 6) * monthCount;
    case "YEAR":
      return (amount / 12) * monthCount;
    case "MONTH":
    default:
      return amount * monthCount;
  }
}

export default function Reports() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const currentMonthRange = useMemo(() => getRangeForPreset("CURRENT_MONTH", today), [today]);

  const [periodPreset, setPeriodPreset] = useState<ReportingPeriodPreset>("CURRENT_MONTH");
  const [dateFrom, setDateFrom] = useState(formatDateInput(currentMonthRange.from));
  const [dateTo, setDateTo] = useState(formatDateInput(currentMonthRange.to));
  const [selectedClientId, setSelectedClientId] = useState("ALL");
  const [previewCommessa, setPreviewCommessa] = useState<Commessa | null>(null);

  const { data: commesse = [], isLoading: loadingCommesse } = useCommesse();
  const { data: clienti = [], isLoading: loadingClienti } = useClienti();
  const { data: fattureAttive = [], isLoading: loadingFatture } = useFattureAttive();
  const { data: costiFissi = [], isLoading: loadingCosti } = useCostiFissi();
  const { data: previewTimesheets = [] } = useTimesheets({
    commessa_id: previewCommessa?.id,
  });
  const commesseList = Array.isArray(commesse) ? commesse : [];
  const clientiList = Array.isArray(clienti) ? clienti : [];
  const fattureAttiveList = Array.isArray(fattureAttive) ? fattureAttive : [];
  const costiFissiList = Array.isArray(costiFissi) ? costiFissi : [];
  const previewTimesheetsList = Array.isArray(previewTimesheets) ? previewTimesheets : [];
  const clientById = useMemo(() => buildClientById(clientiList), [clientiList]);
  const commesseWithClienti = useMemo(
    () => hydrateCommesseWithClienti(commesseList, clientiList),
    [commesseList, clientiList]
  );

  useEffect(() => {
    if (periodPreset === "CUSTOM") {
      return;
    }

    const nextRange = getRangeForPreset(periodPreset, today);
    setDateFrom(formatDateInput(nextRange.from));
    setDateTo(formatDateInput(nextRange.to));
  }, [periodPreset, today]);

  const range = useMemo(() => {
    return resolveReportingRange(periodPreset, dateFrom, dateTo, today);
  }, [dateFrom, dateTo, periodPreset, today]);

  const selectedClient = useMemo(
    () => clientiList.find((cliente) => cliente.id === selectedClientId) ?? null,
    [clientiList, selectedClientId]
  );

  const filteredCommesse = useMemo(() => {
    return commesseWithClienti.filter((commessa) => {
      if (!commessa.mese_competenza) {
        return false;
      }

      const commessaDate = parseISO(commessa.mese_competenza);
      if (!isValid(commessaDate)) {
        return false;
      }

      const matchesClient = selectedClientId === "ALL" || commessa.cliente_id === selectedClientId;
      return matchesClient && isWithinInterval(commessaDate, { start: range.from, end: range.to });
    });
  }, [commesseWithClienti, range, selectedClientId]);

  const sortedCommesse = useMemo(() => {
    return [...filteredCommesse].sort((a, b) => {
      if (a.mese_competenza === b.mese_competenza) {
        return b.created_at.localeCompare(a.created_at);
      }
      return b.mese_competenza.localeCompare(a.mese_competenza);
    });
  }, [filteredCommesse]);

  const filteredFattureAttive = useMemo(() => {
    return fattureAttiveList.filter((fattura) => {
      if (!fattura.data_emissione) {
        return false;
      }

      const invoiceDate = parseISO(fattura.data_emissione);
      if (!isValid(invoiceDate)) {
        return false;
      }

      const matchesClient = selectedClientId === "ALL" || fattura.cliente_id === selectedClientId;
      return matchesClient && isWithinInterval(invoiceDate, { start: range.from, end: range.to });
    });
  }, [fattureAttiveList, range, selectedClientId]);

  const kpis = useMemo(() => {
    const fatturato = sortedCommesse.reduce(
      (total, commessa) => total + Number(commessa.valore_fatturabile || 0),
      0
    );
    const margineLordo = sortedCommesse.reduce(
      (total, commessa) => total + Number(commessa.margine_euro || 0),
      0
    );
    const costiStruttura = costiFissiList.reduce(
      (total, cost) => total + getAllocatedStructureCost(cost, range),
      0
    );

    return {
      fatturato,
      margineLordo,
      costiStruttura,
      margineNetto: margineLordo - costiStruttura,
    };
  }, [costiFissiList, range, sortedCommesse]);

  const reportMeta = useMemo(() => {
    const clientiCoinvolti = new Set(sortedCommesse.map((commessa) => commessa.cliente_id)).size;
    const commesseCount = sortedCommesse.length;
    const fattureAttiveCount = filteredFattureAttive.length;
    const incassato = filteredFattureAttive.reduce(
      (total, fattura) => total + Number(fattura.importo_pagato || 0),
      0
    );

    return {
      clientiCoinvolti,
      commesseCount,
      fattureAttiveCount,
      incassato,
    };
  }, [filteredFattureAttive, sortedCommesse]);

  const clientAggregates = useMemo(() => {
    const map = new Map<
      string,
      {
        cliente: Cliente | undefined;
        clienteId: string;
        ragioneSociale: string;
        commesseCount: number;
        activeMonths: Set<string>;
        fatturato: number;
        margineLordo: number;
        incassato: number;
      }
    >();

    sortedCommesse.forEach((commessa) => {
      const existing = map.get(commessa.cliente_id);
      const cliente = resolveCommessaCliente(commessa, clientById);
      const nextValue = existing ?? {
        cliente,
        clienteId: commessa.cliente_id,
        ragioneSociale: getClienteDisplayName(cliente),
        commesseCount: 0,
        activeMonths: new Set<string>(),
        fatturato: 0,
        margineLordo: 0,
        incassato: 0,
      };

      nextValue.commesseCount += 1;
      nextValue.activeMonths.add(commessa.mese_competenza);
      nextValue.fatturato += Number(commessa.valore_fatturabile || 0);
      nextValue.margineLordo += Number(commessa.margine_euro || 0);
      map.set(commessa.cliente_id, nextValue);
    });

    filteredFattureAttive.forEach((fattura: FatturaAttiva) => {
      if (!fattura.cliente_id || !map.has(fattura.cliente_id)) {
        return;
      }

      const current = map.get(fattura.cliente_id);
      if (!current) {
        return;
      }

      current.incassato += Number(fattura.importo_pagato || 0);
    });

    return [...map.values()]
      .map((entry) => ({
        ...entry,
        activeMonthsCount: entry.activeMonths.size,
      }))
      .sort((a, b) => b.fatturato - a.fatturato);
  }, [clientById, filteredFattureAttive, sortedCommesse]);

  const isLoading = loadingCommesse || loadingClienti || loadingFatture || loadingCosti;
  const isClientReport = !!selectedClient && selectedClientId !== "ALL";
  const periodLabel = getPeriodLabel(periodPreset, range);

  const handleResetFilters = () => {
    const nextRange = getRangeForPreset("CURRENT_MONTH", today);
    setPeriodPreset("CURRENT_MONTH");
    setDateFrom(formatDateInput(nextRange.from));
    setDateTo(formatDateInput(nextRange.to));
    setSelectedClientId("ALL");
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-72 rounded-2xl bg-muted/20" />
          <Skeleton className="h-4 w-96 rounded-xl bg-muted/10" />
        </div>
        <Card className="bg-card border-border rounded-3xl">
          <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item} className="h-12 rounded-xl bg-muted/20" />
            ))}
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-36 rounded-3xl bg-muted/10" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-3xl bg-muted/5" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge className="rounded-full border border-primary/20 bg-primary/10 text-primary uppercase tracking-[0.22em] text-[10px] font-black px-3 py-1">
              Report & Analisi
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-border/60 bg-card/40 text-muted-foreground uppercase tracking-[0.18em] text-[10px] font-black px-3 py-1"
            >
              {isClientReport ? "Report cliente" : "Report generale"}
            </Badge>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
              Modulo <span className="text-primary not-italic">Report</span>
            </h1>
            <p className="text-[#475569] text-xs font-bold uppercase tracking-[0.2em] mt-1">
              {isClientReport
                ? `${selectedClient?.ragione_sociale} | ${periodLabel}`
                : `Panoramica aziendale | ${periodLabel}`}
            </p>
          </div>
        </div>

        <Card className="bg-card/40 border-border/50 rounded-3xl min-w-[320px]">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Export
                </p>
                <p className="text-sm font-bold text-white">
                  {isClientReport ? "Consolidato cliente" : "Archivio commesse"}
                </p>
              </div>
              <FileText className="h-5 w-5 text-primary" />
            </div>

            {isClientReport && selectedClient ? (
              <PDFDownloadLink
                document={
                  <ClienteReportPDF
                    cliente={selectedClient}
                    commesse={sortedCommesse}
                    periodo={periodLabel}
                  />
                }
                fileName={`Consolidato_${selectedClient.ragione_sociale.replace(/\s+/g, "_")}_${format(range.from, "yyyyMMdd")}_${format(range.to, "yyyyMMdd")}.pdf`}
              >
                {({ loading }) => (
                  <Button
                    disabled={loading || sortedCommesse.length === 0}
                    className="w-full rounded-xl bg-primary hover:bg-primary/90 text-white uppercase tracking-widest text-[10px] font-black gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {loading ? "Generazione..." : "Scarica consolidato"}
                  </Button>
                )}
              </PDFDownloadLink>
            ) : (
              <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  Gli export PDF esistenti per singola commessa restano disponibili nella tabella qui sotto.
                </p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Seleziona un cliente per riusare anche il consolidato PDF esistente.
                </p>
              </div>
            )}

            {isClientReport && selectedClient && (
              <Button
                variant="outline"
                className="w-full rounded-xl border-border/60 bg-muted/20 hover:bg-muted/40 uppercase tracking-widest text-[10px] font-black"
                onClick={() => navigate(`/clienti/${selectedClient.id}`)}
              >
                Apri Scheda Cliente
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Filtri Report
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Preset periodo
              </label>
              <select
                value={periodPreset}
                onChange={(event) => setPeriodPreset(event.target.value as ReportingPeriodPreset)}
                className="w-full h-11 bg-muted/50 border border-border text-white rounded-xl px-4 appearance-none focus:outline-none focus:border-primary transition-all text-sm font-medium"
              >
                {REPORTING_PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Data da
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setPeriodPreset("CUSTOM");
                  setDateFrom(event.target.value);
                }}
                className="h-11 bg-muted/50 border-border rounded-xl text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Data a
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setPeriodPreset("CUSTOM");
                  setDateTo(event.target.value);
                }}
                className="h-11 bg-muted/50 border-border rounded-xl text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Cliente
              </label>
              <select
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
                className="w-full h-11 bg-muted/50 border border-border text-white rounded-xl px-4 appearance-none focus:outline-none focus:border-primary transition-all text-sm font-medium"
              >
                <option value="ALL">Tutti i clienti</option>
                {clientiList.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.ragione_sociale}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Azioni
              </label>
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl border-border bg-muted/20 hover:bg-muted/40 text-white uppercase tracking-widest text-[10px] font-black gap-2"
                onClick={handleResetFilters}
              >
                <RotateCcw className="h-4 w-4" />
                Reset filtri
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Modalità
              </p>
              <p className="text-sm font-bold text-white mt-1">
                {isClientReport ? `Cliente · ${selectedClient?.ragione_sociale}` : "Generale aziendale"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Periodo applicato
              </p>
              <p className="text-sm font-bold text-white mt-1">{periodLabel}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Copertura
              </p>
              <p className="text-sm font-bold text-white mt-1">
                {reportMeta.commesseCount} commesse · {reportMeta.clientiCoinvolti} clienti
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <ReportKpiCard
          title="Fatturato"
          value={formatEuro(kpis.fatturato)}
          subtitle={`${reportMeta.commesseCount} commesse nel periodo`}
          icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
        />
        <ReportKpiCard
          title="Margine Lordo"
          value={formatEuro(kpis.margineLordo)}
          subtitle={
            reportMeta.commesseCount > 0
              ? `${((kpis.margineLordo / Math.max(kpis.fatturato, 1)) * 100).toFixed(1)}% sul fatturato`
              : "Nessuna commessa nel periodo"
          }
          icon={<LineChart className="h-5 w-5 text-sky-400" />}
        />
        <ReportKpiCard
          title="Costi Struttura"
          value={formatEuro(kpis.costiStruttura)}
          subtitle={`${costiFissiList.length} voci costo considerate`}
          icon={<Wallet className="h-5 w-5 text-amber-400" />}
        />
        <ReportKpiCard
          title="Margine Netto"
          value={formatEuro(kpis.margineNetto)}
          subtitle={kpis.margineNetto >= 0 ? "Periodo in utile" : "Periodo sotto soglia"}
          icon={<Building2 className="h-5 w-5 text-primary" />}
          accentClass={kpis.margineNetto >= 0 ? "text-white" : "text-rose-400"}
        />
      </div>

      {isClientReport && selectedClient && (
        <Card className="bg-card border-border shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Focus Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Cliente selezionato
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/clienti/${selectedClient.id}`)}
                  className="text-left group"
                >
                  <h2 className="text-2xl font-black text-white group-hover:text-primary transition-colors">
                    {selectedClient.ragione_sociale}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Apri la scheda cliente esistente per approfondire commesse, preventivi e salute del rapporto.
                  </p>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Fatture attive
                  </p>
                  <p className="text-lg font-black text-white mt-2">
                    {reportMeta.fattureAttiveCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Incassato
                  </p>
                  <p className="text-lg font-black text-white mt-2">
                    {formatEuro(reportMeta.incassato)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isClientReport && (
        <Card className="bg-card border-border shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              Clienti Nel Periodo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {clientAggregates.length === 0 ? (
              <EmptyState
                title="Nessun cliente trovato nel periodo selezionato"
                description="Prova a cambiare preset, ampliare l'intervallo o rimuovere il filtro cliente."
              />
            ) : (
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="pl-8 h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Cliente
                    </TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Commesse
                    </TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Mesi attivi
                    </TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
                      Fatturato
                    </TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
                      Margine lordo
                    </TableHead>
                    <TableHead className="pr-8 h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
                      Incassato
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientAggregates.map((entry) => (
                    <TableRow key={entry.clienteId} className="border-border/50 hover:bg-muted/20 transition-colors">
                      <TableCell className="pl-8 py-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/clienti/${entry.clienteId}`)}
                          className="text-left group"
                        >
                          <p className="font-bold text-white group-hover:text-primary transition-colors">
                            {entry.ragioneSociale}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] mt-1">
                            Apri scheda cliente
                          </p>
                        </button>
                      </TableCell>
                      <TableCell className="py-4 text-sm font-bold text-white">
                        {entry.commesseCount}
                      </TableCell>
                      <TableCell className="py-4 text-sm font-bold text-white">
                        {entry.activeMonthsCount}
                      </TableCell>
                      <TableCell className="py-4 text-right text-sm font-black text-white">
                        {formatEuro(entry.fatturato)}
                      </TableCell>
                      <TableCell className="py-4 text-right text-sm font-black text-white">
                        {formatEuro(entry.margineLordo)}
                      </TableCell>
                      <TableCell className="pr-8 py-4 text-right text-sm font-black text-white">
                        {formatEuro(entry.incassato)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {isClientReport ? "Commesse del cliente" : "Commesse nel periodo"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedCommesse.length === 0 ? (
            <EmptyState
              title="Nessuna commessa disponibile"
              description="Non ci sono commesse coerenti con i filtri attivi. Cambia periodo o cliente per vedere i dati."
            />
          ) : (
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow className="border-border/50 hover:bg-transparent">
                  {!isClientReport && (
                    <TableHead className="pl-8 h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Cliente
                    </TableHead>
                  )}
                  <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Progetti
                  </TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Competenza
                  </TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Stato
                  </TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
                    Fatturabile
                  </TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
                    Margine
                  </TableHead>
                  <TableHead className="pr-8 h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
                    Azioni
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCommesse.map((commessa) => (
                  <TableRow key={commessa.id} className="border-border/50 hover:bg-muted/20 transition-colors">
                    {!isClientReport && (
                      <TableCell className="pl-8 py-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/clienti/${commessa.cliente_id}`)}
                          className="text-left group"
                        >
                          <p className="font-bold text-white group-hover:text-primary transition-colors">
                            {getClienteDisplayName(commessa.cliente)}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] mt-1">
                            Vai al cliente
                          </p>
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white">
                          {getCommessaProjectsLabel(commessa)}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                          Commessa {commessa.id.substring(0, 8)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm font-medium text-white uppercase">
                      {format(parseISO(commessa.mese_competenza), "MMM yyyy", { locale: it })}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        variant="outline"
                        className={`rounded-lg font-black text-[9px] uppercase tracking-widest ${getStatusBadgeClasses(commessa.stato)}`}
                      >
                        {commessa.stato.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-right text-sm font-black text-white">
                      {formatEuro(Number(commessa.valore_fatturabile || 0))}
                    </TableCell>
                    <TableCell
                      className={`py-4 text-right text-sm font-black ${
                        Number(commessa.margine_percentuale || 0) >= 20 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {Number(commessa.margine_percentuale || 0).toFixed(1)}%
                    </TableCell>
                    <TableCell className="pr-8 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-xl bg-muted/30 text-muted-foreground hover:text-white hover:bg-primary/10"
                          onClick={() => setPreviewCommessa(commessa)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <ReportDownloadButton commessa={commessa} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewCommessa} onOpenChange={() => setPreviewCommessa(null)}>
        <DialogContent className="max-w-5xl h-[90vh] bg-card border-border p-0 flex flex-col overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 border-b border-border/50">
            <DialogTitle className="text-xl font-black text-white uppercase italic">
              Anteprima <span className="text-primary not-italic">Report</span>
            </DialogTitle>
            {previewCommessa && (
              <p className="text-xs text-[#475569] font-bold uppercase tracking-widest mt-2">
                {getClienteDisplayName(previewCommessa.cliente)} ·{" "}
                {format(parseISO(previewCommessa.mese_competenza), "MMMM yyyy", {
                  locale: it,
                })}
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 bg-white">
            {previewCommessa && (
              <PDFViewer width="100%" height="100%" showToolbar={false} style={{ border: "none" }}>
                <CommessaReportPDF commessa={previewCommessa} timesheets={previewTimesheetsList} />
              </PDFViewer>
            )}
          </div>
          <div className="p-4 border-t border-border/50 flex justify-end gap-3 bg-card">
            <Button
              variant="ghost"
              onClick={() => setPreviewCommessa(null)}
              className="rounded-xl text-muted-foreground hover:text-white"
            >
              Chiudi
            </Button>
            {previewCommessa && <ReportDownloadButton commessa={previewCommessa} big />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportKpiCard({
  title,
  value,
  subtitle,
  icon,
  accentClass = "text-white",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accentClass?: string;
}) {
  return (
    <Card className="bg-card border-border shadow-2xl rounded-3xl overflow-hidden">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </p>
          </div>
          <div className="h-11 w-11 rounded-2xl border border-border/50 bg-muted/20 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div className="space-y-2">
          <p className={`text-3xl font-black tracking-tight ${accentClass}`}>{value}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-8 py-14 text-center">
      <p className="text-lg font-bold text-white">{title}</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">{description}</p>
    </div>
  );
}

function ReportDownloadButton({
  commessa,
  big = false,
}: {
  commessa: Commessa;
  big?: boolean;
}) {
  const { data: timesheets = [] } = useTimesheets({
    commessa_id: commessa.id,
  });

  return (
    <PDFDownloadLink
      document={<CommessaReportPDF commessa={commessa} timesheets={timesheets} />}
      fileName={`Report_${getClienteDisplayName(commessa.cliente).replace(/\s+/g, "_")}_${commessa.mese_competenza}.pdf`}
    >
      {({ loading }) => (
        <Button
          disabled={loading}
          size={big ? "default" : "sm"}
          className={`bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest transition-all ${
            big ? "h-11 px-6" : "h-9 w-9 p-0"
          }`}
        >
          <Download className="h-4 w-4" />
          {big && (loading ? "Generazione..." : "Scarica PDF")}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
