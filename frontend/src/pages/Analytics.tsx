import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell
} from "recharts";
import {
  TrendingUp, 
  Target, 
  Clock, 
  Users, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Download,
  Loader2,
  ArrowLeft,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAnalytics } from "@/hooks/useAnalytics";
import { QuickCalculator } from "@/components/analytics/QuickCalculator";

import { Skeleton } from "@/components/ui/skeleton";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { AnalyticsReportPDF } from "@/components/analytics/AnalyticsReportPDF";
import { PageTransition } from "@/components/common/PageTransition";
import { Progress } from "@/components/ui/progress";
import { useEffect, useRef, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardKpiCard } from "@/components/analytics/DashboardKpiCard";
import {
  format as formatDate,
  isSameMonth,
  isWithinInterval,
  parseISO,
  subMonths,
  startOfMonth,
  addMonths,
  format,
  differenceInDays,
  isBefore,
  endOfMonth,
} from "date-fns";
import { it } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "@/components/common/ClientAvatar";
import { ForecastWidget } from "@/components/analytics/ForecastWidget";
import {
  REPORTING_PERIOD_OPTIONS,
  formatDateInput,
  getComparisonRange,
  getPeriodLabel,
  getRangeForPreset,
  getReferenceDateForPreset,
  getTrendDescription,
  getMonthlyBuckets,
  parseDateInput,
  resolveReportingRange,
  type ReportingDateRange,
  type ReportingPeriodPreset,
} from "@/lib/reporting-period";
import {
  getClienteDisplayName,
  hydrateCommesseWithClienti,
} from "@/lib/commessa-clienti";
import type { Commessa, Cliente } from "@/types";

const getStatusBadge = (margin: number) => {
  if (margin > 30) return { label: "Profittevole", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
  if (margin >= 10) return { label: "Attenzione", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" };
  return { label: "Perdita", color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" };
};

const formatEuro = (val: number) => 
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);

type TrendPoint = {
  month: string;
  isoMonth: string;
  revenue: number;
  margin: number;
};

function getCommessaDate(commessa: Commessa) {
  return parseISO(commessa.mese_competenza);
}

function getCommessaHours(commessa: Commessa) {
  if (Number(commessa.ore_reali || 0) > 0) {
    return Number(commessa.ore_reali || 0);
  }

  return Number(commessa.costo_manodopera || 0) / 40;
}

function calculateDelta(currentValue: number, previousValue: number) {
  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

function buildTrendData(
  commesse: Commessa[],
  range: ReportingDateRange
): TrendPoint[] {
  return getMonthlyBuckets(range).map((monthDate) => {
    const monthCommesse = commesse.filter((commessa) =>
      isSameMonth(getCommessaDate(commessa), monthDate)
    );
    const revenue = monthCommesse.reduce(
      (total, commessa) => total + Number(commessa.valore_fatturabile || 0),
      0
    );
    const marginEuro = monthCommesse.reduce(
      (total, commessa) => total + Number(commessa.margine_euro || 0),
      0
    );

    return {
      month: formatDate(monthDate, "MMM yy", { locale: it }).toUpperCase(),
      isoMonth: formatDate(monthDate, "yyyy-MM-01"),
      revenue,
      margin: revenue > 0 ? Number(((marginEuro / revenue) * 100).toFixed(1)) : 0,
    };
  });
}

function calculateProfitabilityMetrics(commesse: Commessa[], range: ReportingDateRange, costiFissi: any[], clienti: Cliente[]) {
  const buckets = getMonthlyBuckets(range);
  const monthsCount = buckets.length;
  const monthlyFixedCosts = costiFissi.filter((cf: any) => cf.attivo).reduce((acc: number, cf: any) => acc + Number(cf.importo || 0), 0) || 0;
  const totalStructureCosts = monthlyFixedCosts * monthsCount;

  const totalRevenue = commesse.reduce((acc, c) => acc + Number(c.valore_fatturabile || 0), 0);
  const allocationFactor = totalRevenue > 0 ? totalStructureCosts / totalRevenue : 0;

  const processedCommesse = commesse.map(c => {
    const rev = Number(c.valore_fatturabile || 0);
    const laborCost = (c as any).costo_manodopera_reale || 0;
    const structureCost = rev * allocationFactor;
    const totalCost = laborCost + structureCost;
    const marginEuro = rev - totalCost;
    const marginPct = rev > 0 ? (marginEuro / rev) * 100 : 0;

    const expected = Number(c.ore_contratto || 0);
    const real = (c as any).ore_reali_timesheet || 0;
    const offset = real - expected;
    const hasBudget = expected > 0;
    const offsetPct = hasBudget ? (offset / expected) * 100 : 0;

    const economicImpact = hasBudget && offset > 0 
      ? offset * (rev / expected)
      : 0;

    return {
      ...c,
      laborCost,
      structureCost,
      totalCost,
      marginEuro,
      marginPct,
      expectedHours: expected,
      realHours: real,
      hoursOffset: offset,
      hasBudget,
      offsetPct,
      economicImpact
    };
  });

  const clientMap = new Map<string, any>();
  processedCommesse.forEach(c => {
    const existing = clientMap.get(c.cliente_id) || {
      id: c.cliente_id,
      name: getClienteDisplayName(c.cliente),
      revenue: 0,
      laborCost: 0,
      structureCost: 0,
      totalCost: 0,
      marginEuro: 0,
      logo_url: c.cliente?.logo_url,
      totalScopePct: 0,
      jobsWithBudget: 0,
      monthsActive: new Set<string>()
    };

    existing.revenue += Number(c.valore_fatturabile || 0);
    existing.laborCost += c.laborCost;
    existing.structureCost += c.structureCost;
    existing.totalCost += c.totalCost;
    existing.marginEuro += c.marginEuro;
    
    if (c.hasBudget) {
      existing.totalScopePct += c.offsetPct;
      existing.jobsWithBudget += 1;
    }
    existing.monthsActive.add(c.mese_competenza);
    clientMap.set(c.cliente_id, existing);
  });

  const clientProfitability = Array.from(clientMap.values()).map(cl => {
    const marginPct = cl.revenue > 0 ? (cl.marginEuro / cl.revenue) * 100 : 0;
    const avgOffset = cl.jobsWithBudget > 0 ? cl.totalScopePct / cl.jobsWithBudget : 0;
    
    // Health Score calculation (simpler version or full version if possible)
    const fullClient = (clienti as Cliente[]).find(c => c.id === cl.id);
    const reliabilityMap: Record<string, number> = { ALTA: 100, MEDIA: 60, BASSA: 20 };
    const reliabilityScore = fullClient?.affidabilita ? reliabilityMap[fullClient.affidabilita] : 60;
    const continuityScore = monthsCount < 2 ? 60 : (cl.monthsActive.size / monthsCount) * 100;
    
    let marginScore = 0;
    if (marginPct < 0) marginScore = 0;
    else if (marginPct < 10) marginScore = 20;
    else if (marginPct < 20) marginScore = 50;
    else if (marginPct < 30) marginScore = 80;
    else marginScore = 100;

    const scopeScore = Math.max(0, 100 - (avgOffset * 2));
    const healthScore = (marginScore * 0.35) + (scopeScore * 0.25) + (reliabilityScore * 0.20) + (continuityScore * 0.20);

    let riskReason = "";
    if (healthScore < 70) {
      if (marginScore < 50) riskReason = "Marginalità Critica";
      else if (scopeScore < 50) riskReason = "Scope Creep Elevato";
      else if (continuityScore < 50) riskReason = "Bassa Continuità";
      else if (reliabilityScore < 50) riskReason = "Affidabilità Bassa";
    }

    return {
      ...cl,
      marginPct,
      avgScopePct: avgOffset,
      healthScore,
      reliability: fullClient?.affidabilita || "MEDIA",
      riskReason
    };
  });

  const totalMarginEuro = processedCommesse.reduce((acc, c) => acc + c.marginEuro, 0);
  const avgMarginPct = totalRevenue > 0 ? (totalMarginEuro / totalRevenue) * 100 : 0;
  const totalHours = processedCommesse.reduce((acc, c) => acc + c.realHours, 0);

  return {
    commesseProfitability: processedCommesse,
    clientProfitability,
    totalRevenue,
    totalMarginEuro,
    avgMarginPct,
    totalHours,
    monthsCount,
    totalStructureCosts
  };
}

function useChartSize(height: number): [React.RefObject<HTMLDivElement>, number, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width, height];
}

export default function Analytics() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [chart1Ref, chart1W, chart1H] = useChartSize(240);
  const [chart2Ref, chart2W, chart2H] = useChartSize(290);
  const [chart3Ref, chart3W, chart3H] = useChartSize(290);
  const [chart4Ref, chart4W, chart4H] = useChartSize(316);

  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const initialRange = useMemo(() => getRangeForPreset("CURRENT_YEAR", today), [today]);
  const [periodPreset, setPeriodPreset] = useState<ReportingPeriodPreset>("CURRENT_YEAR");
  const [dateFrom, setDateFrom] = useState(formatDateInput(initialRange.from));
  const [dateTo, setDateTo] = useState(formatDateInput(initialRange.to));
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const periodRange = useMemo(
    () => resolveReportingRange(periodPreset, dateFrom, dateTo, today),
    [dateFrom, dateTo, periodPreset, today]
  );
  const referenceDate = useMemo(() => {
    if (periodPreset === "CUSTOM") {
      return parseDateInput(dateTo, periodRange.to);
    }

    return getReferenceDateForPreset(periodPreset, today);
  }, [dateTo, periodPreset, periodRange.to, today]);
  const { data: analytics, isLoading } = useAnalytics(referenceDate);
  const clienti = analytics?.clienti ?? [];
  const commesse = useMemo(
    () => hydrateCommesseWithClienti((analytics?.commesse ?? []) as Commessa[], (clienti as Cliente[]) ?? []),
    [analytics?.commesse, clienti]
  );
  const comparisonRange = useMemo(
    () => getComparisonRange(periodPreset, periodRange, today),
    [periodPreset, periodRange, today]
  );
  const periodLabel = useMemo(() => getPeriodLabel(periodPreset, periodRange), [periodPreset, periodRange]);

  const filteredCommesse = useMemo(
    () =>
      (commesse as Commessa[]).filter((commessa) =>
        isWithinInterval(getCommessaDate(commessa), { start: periodRange.from, end: periodRange.to })
      ),
    [commesse, periodRange]
  );

  const comparisonCommesse = useMemo(
    () =>
      (commesse as Commessa[]).filter((commessa) =>
        isWithinInterval(getCommessaDate(commessa), {
          start: comparisonRange.from,
          end: comparisonRange.to,
        })
      ),
    [commesse, comparisonRange]
  );

  const trendData = useMemo(() => buildTrendData(filteredCommesse, periodRange), [filteredCommesse, periodRange]);

  const monthCommesse = useMemo(() => {
    if (!selectedMonthKey) return [];
    const selectedMonth = parseISO(selectedMonthKey);
    return filteredCommesse.filter((commessa) => isSameMonth(getCommessaDate(commessa), selectedMonth));
  }, [filteredCommesse, selectedMonthKey]);

  const selectedClient = useMemo(
    () => (selectedClientId ? (clienti as Cliente[]).find((cliente) => cliente.id === selectedClientId) || null : null),
    [clienti, selectedClientId]
  );

  const clientCommesse = useMemo(
    () =>
      selectedClientId
        ? filteredCommesse
            .filter((commessa) => commessa.cliente_id === selectedClientId)
            .sort((a, b) => b.mese_competenza.localeCompare(a.mese_competenza))
        : [],
    [filteredCommesse, selectedClientId]
  );

  const profitabilityData = useMemo(() => {
    const costiFissiArr = (analytics as any)?.costiFissi || [];
    const current = calculateProfitabilityMetrics(filteredCommesse, periodRange, costiFissiArr, clienti as Cliente[]);
    const comparison = calculateProfitabilityMetrics(comparisonCommesse, comparisonRange, costiFissiArr, clienti as Cliente[]);
    
    return { current, comparison };
  }, [filteredCommesse, comparisonCommesse, analytics?.costiFissi, periodRange, comparisonRange, clienti]);

  const kpis = useMemo(() => {
    if (!profitabilityData) return null;
    const { current, comparison } = profitabilityData;

    const metrics = [
      { key: "revenue", current: current.totalRevenue, previous: comparison.totalRevenue },
      { key: "margin", current: current.avgMarginPct, previous: comparison.avgMarginPct },
      { key: "hours", current: current.totalHours, previous: comparison.totalHours },
      { key: "clients", current: new Set(filteredCommesse.map(c => c.cliente_id)).size, previous: new Set(comparisonCommesse.map(c => c.cliente_id)).size }
    ];

    const results: any = {};
    metrics.forEach(m => {
      const delta = calculateDelta(m.current, m.previous);
      results[m.key] = {
        value: m.current,
        previous: m.previous,
        delta,
        trend: delta > 1 ? "up" : delta < -1 ? "down" : "stable"
      };
    });

    return results;
  }, [profitabilityData, filteredCommesse, comparisonCommesse]);

  // BENCHMARK DATA
  const benchmarkData = useMemo(() => {
    if (!profitabilityData.current) return null;
    const { current } = profitabilityData;
    const allTimesheets = (analytics as any)?.allTimesheets || [];

    // 1. Portfolio Averages
    const avgMargin = current.avgMarginPct;
    const avgRevenue = current.totalRevenue / (current.clientProfitability.length || 1);

    // 2. Client Deviations
    const clientPerformance = current.clientProfitability.map(cl => ({
      ...cl,
      marginDeviation: cl.marginPct - avgMargin,
      revenueDeviation: cl.revenue - avgRevenue,
      isTopPerformer: cl.marginPct > avgMargin && cl.revenue > avgRevenue,
      isUnderPerformer: cl.marginPct < avgMargin && cl.revenue < avgRevenue
    })).sort((a, b) => b.marginDeviation - a.marginDeviation);

    // 3. Service Grouping
    const serviceMap = new Map<string, any>();
    allTimesheets.forEach((t: any) => {
      if (!t.commessa_id) return;
      const commessa = current.commesseProfitability.find(c => c.id === t.commessa_id);
      if (!commessa) return;

      const serviceName = t.servizio || "Altro";
      const stats = serviceMap.get(serviceName) || { name: serviceName, hours: 0, laborCost: 0, revenue: 0 };
      
      const durationHours = (t.durata_minuti || 0) / 60;
      stats.hours += durationHours;
      stats.laborCost += (t.costo_lavoro || 0);
      
      // Proportional Revenue allocation by hours
      const commessaTotalHours = commessa.realHours || 1;
      const revenueShare = (durationHours / commessaTotalHours) * (commessa.valore_fatturabile || 0);
      stats.revenue += revenueShare;
      
      serviceMap.set(serviceName, stats);
    });

    const servicePerformance = Array.from(serviceMap.values()).map(s => {
      const marginEuro = s.revenue - s.laborCost;
      const marginPct = s.revenue > 0 ? (marginEuro / s.revenue) * 100 : 0;
      return { ...s, marginEuro, marginPct };
    }).sort((b, a) => a.revenue - b.revenue);

    return {
        avgMargin,
        avgRevenue,
        clientPerformance,
        servicePerformance
    };
  }, [profitabilityData, (analytics as any)?.allTimesheets]);

  const clientStats = useMemo(() => {
    const previousMap = new Map<string, number>();
    comparisonCommesse.forEach((commessa) => {
      previousMap.set(
        commessa.cliente_id,
        (previousMap.get(commessa.cliente_id) ?? 0) + Number(commessa.valore_fatturabile || 0)
      );
    });

    const currentMap = new Map<string, { id: string; name: string; revenue: number; delta: number }>();
    filteredCommesse.forEach((commessa) => {
      const current = currentMap.get(commessa.cliente_id) ?? {
        id: commessa.cliente_id,
        name: getClienteDisplayName(commessa.cliente),
        revenue: 0,
        delta: 0,
      };
      current.revenue += Number(commessa.valore_fatturabile || 0);
      currentMap.set(commessa.cliente_id, current);
    });

    return [...currentMap.values()]
      .map((client) => ({ ...client, delta: calculateDelta(client.revenue, previousMap.get(client.id) ?? 0) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [comparisonCommesse, filteredCommesse]);

  const scatterData = useMemo(() => {
    const currentMap = new Map<string, { id: string; name: string; revenue: number; hours: number; profitability: number }>();
    filteredCommesse.forEach((commessa) => {
      const current = currentMap.get(commessa.cliente_id) ?? {
        id: commessa.cliente_id,
        name: getClienteDisplayName(commessa.cliente),
        revenue: 0,
        hours: 0,
        profitability: 0,
      };
      current.revenue += Number(commessa.valore_fatturabile || 0);
      current.hours += getCommessaHours(commessa);
      currentMap.set(commessa.cliente_id, current);
    });

    return [...currentMap.values()]
      .map((client) => ({ ...client, profitability: client.hours > 0 ? client.revenue / client.hours : 0 }))
      .filter((client) => client.revenue > 0);
  }, [filteredCommesse]);

  const cashFlowData = useMemo(() => {
    if (!analytics?.fatture || !profitabilityData) return null;

    const allInvoices = (analytics.fatture as any[]);
    const passiveInvoices = ((analytics as any).fatturePassive || []) as any[];
    const now = new Date();
    
    // 1. Core KPIs
    const totalPaid = allInvoices.reduce((acc, f) => acc + Number(f.importo_pagato || 0), 0);
    // totalOpen represents the ENTIRE unpaid amount (whether due or overdue)
    const totalOpen = allInvoices.reduce((acc, f) => acc + Number(f.importo_residuo || 0), 0);
    const overdueInvoices = allInvoices.filter(f => f.importo_residuo > 0 && f.data_scadenza && isBefore(parseISO(f.data_scadenza), now));
    const totalOverdue = overdueInvoices.reduce((acc, f) => acc + Number(f.importo_residuo || 0), 0);

    // 2. DSO (Days Sales Outstanding)
    const paidInvoices = allInvoices.filter(f => f.importo_residuo === 0 && f.data_emissione && f.data_ultimo_incasso);
    const dso = paidInvoices.length > 0 
      ? paidInvoices.reduce((acc, f) => acc + differenceInDays(parseISO(f.data_ultimo_incasso), parseISO(f.data_emissione!)), 0) / paidInvoices.length
      : null;

    // 3. Client Risk Mapping
    const clientRiskMap = new Map<string, any>();
    allInvoices.forEach(f => {
      if (!f.cliente_id) return;
      const stats = clientRiskMap.get(f.cliente_id) || { id: f.cliente_id, name: "Cliente Ignoto", totalOpen: 0, totalOverdue: 0, maxDelay: 0 };
      
      const residuo = Number(f.importo_residuo || 0);
      stats.totalOpen += residuo;
      
      if (f.data_scadenza && isBefore(parseISO(f.data_scadenza), now) && residuo > 0) {
        stats.totalOverdue += residuo;
        const delay = differenceInDays(now, parseISO(f.data_scadenza));
        stats.maxDelay = Math.max(stats.maxDelay, delay);
      }
      
      const clientObj = (clienti as Cliente[]).find(c => c.id === f.cliente_id);
      if (clientObj) stats.name = clientObj.ragione_sociale;
      
      clientRiskMap.set(f.cliente_id, stats);
    });

    const clientRiskRanking = Array.from(clientRiskMap.values()).map((cl: any) => {
      const clientProfit = profitabilityData.current.clientProfitability.find((p: any) => p.id === cl.id);
      const relativeWeight = clientProfit ? (cl.totalOverdue / clientProfit.revenue) : 0;
      
      let status: "REGOLARE" | "ATTENZIONE" | "CRITICO" = "REGOLARE";
      if (cl.totalOverdue > 5000 || cl.maxDelay > 30 || relativeWeight > 0.3) status = "CRITICO";
      else if (cl.totalOverdue > 0 || cl.totalOpen > 15000) status = "ATTENZIONE";

      return { ...cl, status, relativeWeight };
    }).sort((a, b) => b.totalOverdue - a.totalOverdue);

    // 4. Liquidity Projection (30/60/90)
    const monthlyFixed = (analytics as any).kpis?.costoStruttura || 0;
    const months = [1, 2, 3];
    
    const projection = months.map(mOffset => {
      const start = startOfMonth(addMonths(now, mOffset));
      const end = endOfMonth(start);
      
      // Entrate: Invoices with expiry in this month + Overdue (if mOffset == 1)
      const invoicesInPeriod = allInvoices.filter((f: any) => {
        if (f.importo_residuo <= 0 || !f.data_scadenza) return false;
        const expiry = parseISO(f.data_scadenza);
        if (mOffset === 1 && isBefore(expiry, start)) return true; // Overdue items go to M1
        return isWithinInterval(expiry, { start, end });
      });
      const expectedInflow = invoicesInPeriod.reduce((acc, f) => acc + Number(f.importo_residuo || 0), 0);

      // Uscite: Fixed Costs + Reliable Passive Invoices
      const reliablePassives = passiveInvoices.filter((f: any) => {
        if (f.importo_residuo <= 0 || !f.data_scadenza) return false;
        return isWithinInterval(parseISO(f.data_scadenza), { start, end });
      });
      const passiveOutflow = reliablePassives.reduce((acc, f) => acc + Number(f.importo_residuo || 0), 0);
      const totalOutflow = monthlyFixed + passiveOutflow;

      return {
        days: mOffset * 30,
        inflow: expectedInflow,
        outflow: totalOutflow,
        net: expectedInflow - totalOutflow,
        reliability: mOffset === 1 ? "ALTA" : mOffset === 2 ? "MEDIA" : "BASSA"
      };
    });

    return {
      totalPaid,
      totalOpen,
      totalOverdue,
      dso,
      clientRiskRanking,
      projection,
      hasPassiveData: passiveInvoices.length > 0
    };
  }, [analytics?.fatture, (analytics as any)?.fatturePassive, profitabilityData, periodRange, clienti, today]);

  const alerts = useMemo(() => {
    const nextAlerts: Array<{ type: "MARGIN" | "SCOPE"; title: string; value: string; severity: "high" | "medium" }> = [];
    
    // 1. Margin Alerts
    profitabilityData.current.commesseProfitability.forEach((c: any) => {
      if (c.marginPct > 0 && c.marginPct < 15) {
        nextAlerts.push({
          type: "MARGIN",
          title: `Margine basso: ${getClienteDisplayName(c.cliente)}`,
          value: `${c.marginPct.toFixed(1)}%`,
          severity: "high",
        });
      }
    });

    // 2. Scope Creep Alerts (Top 3 > 25% with budget)
    profitabilityData.current.commesseProfitability
      .filter((c: any) => c.hasBudget && c.offsetPct > 25)
      .slice(0, 3)
      .forEach((c: any) => {
        nextAlerts.push({
          type: "SCOPE",
          title: `Sforamento: ${getClienteDisplayName(c.cliente)}`,
          value: `${c.offsetPct.toFixed(0)}%`,
          severity: "high"
        });
      });

    // 3. Liquidity Risk Alerts
    if (cashFlowData) {
      if (cashFlowData.totalOverdue > (profitabilityData.current.totalRevenue * 0.2)) {
        nextAlerts.push({
          type: "MARGIN", // Reusing MARGIN icon for cash risk
          title: "Scaduto Critico",
          value: formatEuro(cashFlowData.totalOverdue),
          severity: "high"
        });
      }
      
      cashFlowData.clientRiskRanking.filter((cl: any) => cl.status === "CRITICO").slice(0, 2).forEach((cl: any) => {
        nextAlerts.push({
          type: "SCOPE",
          title: `Rischio Incasso: ${cl.name}`,
          value: formatEuro(cl.totalOverdue),
          severity: "high"
        });
      });
    }

    // 4. Benchmark & Trend Alerts
    if (kpis) {
      if (kpis.margin.delta < -5) {
        nextAlerts.push({
          type: "MARGIN",
          title: "Marginalità in calo",
          value: `${kpis.margin.delta.toFixed(1)}% vs prev`,
          severity: "high"
        });
      }
      if (kpis.revenue.delta > 10) {
        nextAlerts.push({
          type: "MARGIN",
          title: "Crescita Fatturato!",
          value: `+${kpis.revenue.delta.toFixed(0)}% vs prev`,
          severity: "high"
        });
      }
    }

    if (benchmarkData) {
      benchmarkData.clientPerformance.filter((cl: any) => cl.isUnderPerformer).slice(0, 1).forEach((cl: any) => {
        nextAlerts.push({
          type: "SCOPE",
          title: `Benchmark Negativo: ${cl.name}`,
          value: `${cl.marginDeviation.toFixed(1)}% vs avg`,
          severity: "medium"
        });
      });
    }

    return nextAlerts.slice(0, 6);
  }, [profitabilityData, cashFlowData]);

  const forecastData = useMemo(() => {
    if (!analytics?.commesse || !profitabilityData) return null;

    const allCommesse = analytics.commesse as Commessa[];
    const now = new Date();
    const monthsRange = [1, 2, 3];
    
    // 1. Analyze Last 6 Months for Recurring Clients
    const last6Months = Array.from({ length: 6 }, (_, i) => subMonths(startOfMonth(now), i + 1));
    const clientStatsMap = new Map<string, { monthsActive: Set<string>; totalRevenue: number; totalMarginEuro: number }>();
    
    allCommesse.forEach(c => {
      const cDate = parseISO(c.mese_competenza);
      const isHistorical = last6Months.some(m => isSameMonth(m, cDate));
      
      if (isHistorical) {
        const stats = clientStatsMap.get(c.cliente_id) || { monthsActive: new Set(), totalRevenue: 0, totalMarginEuro: 0 };
        stats.monthsActive.add(format(cDate, "yyyy-MM"));
        stats.totalRevenue += Number(c.valore_fatturabile || 0);
        stats.totalMarginEuro += (c as any).marginEuro || 0;
        clientStatsMap.set(c.cliente_id, stats);
      }
    });

    const recurringClients = Array.from(clientStatsMap.entries())
      .filter(([_, stats]) => stats.monthsActive.size >= 4)
      .map(([id, stats]) => ({
        id,
        avgMonthlyRevenue: stats.totalRevenue / 6,
        avgMarginPct: stats.totalRevenue > 0 ? (stats.totalMarginEuro / stats.totalRevenue) : (profitabilityData.current.avgMarginPct / 100)
      }));

    // 2. Forecast for 30, 60, 90 Days
    return monthsRange.map(mOffset => {
      const targetMonth = startOfMonth(addMonths(now, mOffset));
      const targetMonthStr = format(targetMonth, "yyyy-MM");
      
      // A. Pipeline Certa (Planned commesse for target month)
      const pipelineCommesse = allCommesse.filter(c => 
        format(parseISO(c.mese_competenza), "yyyy-MM") === targetMonthStr &&
        ["APERTA", "PRONTA_CHIUSURA"].includes(c.stato)
      );
      
      const pipelineValue = pipelineCommesse.reduce((acc, c) => acc + Number(c.valore_fatturabile || 0), 0);
      const pipelineIds = new Set(pipelineCommesse.map(c => c.cliente_id));

      // B. Recurrent Estimate (Clients active in history but no commessa yet in target month)
      const recurrentPart = recurringClients
        .filter(rc => !pipelineIds.has(rc.id))
        .reduce((acc, rc) => acc + rc.avgMonthlyRevenue, 0);

      // C. Apply Prudence Factor to Recurrent Part
      const discount = mOffset === 1 ? 0 : mOffset === 2 ? 0.1 : 0.2;
      const discountedRecurrent = recurrentPart * (1 - discount);

      const totalRevenue = pipelineValue + discountedRecurrent;
      
      // D. Margin Calculation
      // Se marginEuro non è pre-calcolato, usiamo l'avgMarginPct storico come stima sicura per la pipeline
      const pipelineMargin = pipelineCommesse.reduce((acc, c) => acc + ((c as any).marginEuro || (Number(c.valore_fatturabile || 0) * (profitabilityData.current.avgMarginPct / 100))), 0);
      const recurrentMargin = recurringClients
        .filter(rc => !pipelineIds.has(rc.id))
        .reduce((acc, rc) => acc + (rc.avgMonthlyRevenue * rc.avgMarginPct * (1 - discount)), 0);
      
      const totalMargin = pipelineMargin + recurrentMargin;

      // E. Reliability Logic
      const coverage = totalRevenue > 0 ? pipelineValue / totalRevenue : 0;
      let reliability: "ALTA" | "MEDIA" | "BASSA" = "BASSA";
      let reason = "";

      if (coverage > 0.6) {
        reliability = "ALTA";
        reason = "Pipeline solida e consolidata";
      } else if (coverage > 0.3 || recurringClients.length > 0) {
        reliability = "MEDIA";
        reason = "Mix tra pipeline e ricorrenze storiche";
      } else {
        reliability = "BASSA";
        reason = "Basato su proiezioni incerte";
      }

      const historicalAvg = profitabilityData.current.totalRevenue / (profitabilityData.current.monthsCount || 1);
      const trend = historicalAvg > 0 ? ((totalRevenue - historicalAvg) / historicalAvg) * 100 : 0;

      return {
        days: mOffset * 30,
        revenue: totalRevenue,
        margin: totalMargin,
        reliability,
        reason,
        trend,
        coverage
      };
    });
  }, [analytics?.commesse, profitabilityData]);

  const analyticsPdfData = useMemo(
    () => ({
      kpis: { revenueYTD: kpis.revenue, marginYTD: kpis.averageMargin, monthlyHours: kpis.totalHours },
      clientStats,
      revenueTrend: trendData,
    }),
    [clientStats, kpis, trendData]
  );

  const maxClientRevenue = clientStats[0]?.revenue ?? 0;

  useEffect(() => {
    if (periodPreset === "CUSTOM") {
      return;
    }

    const nextRange = getRangeForPreset(periodPreset, today);
    setDateFrom(formatDateInput(nextRange.from));
    setDateTo(formatDateInput(nextRange.to));
  }, [periodPreset, today]);

  useEffect(() => {
    setSelectedMonthKey(null);
    setSelectedClientId(null);
  }, [periodPreset, periodRange.from, periodRange.to]);

  if (isLoading || !analytics) {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 rounded-xl bg-muted/20" />
          <Skeleton className="h-10 w-48 rounded-xl bg-muted/20" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-3xl bg-muted/10" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-3xl bg-muted/5" />
          <Skeleton className="h-[400px] rounded-3xl bg-muted/5" />
        </div>
      </div>
    );
  }

  if (selectedMonthKey) {
    const selectedMonthLabel = formatDate(parseISO(selectedMonthKey), "MMMM yyyy", { locale: it });
    const monthRevenue = monthCommesse.reduce(
      (acc, commessa) => acc + Number(commessa.valore_fatturabile || 0),
      0
    );
    const monthMarginEuro = monthCommesse.reduce(
      (acc, commessa) => acc + Number(commessa.margine_euro || 0),
      0
    );
    const monthMargin = monthRevenue > 0 ? ((monthMarginEuro / monthRevenue) * 100).toFixed(1) : "0.0";
    return (
      <div className="p-8 space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedMonthKey(null)}
                className="h-10 w-10 bg-card/50 border border-border/50 text-foreground rounded-xl hover:bg-primary/10 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase italic">
                Dettaglio <span className="text-primary not-italic">{selectedMonthLabel}</span>
              </h1>
              <p className="text-[#475569] text-xs font-bold uppercase tracking-[0.2em] mt-1">Analisi commesse del mese selezionato</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <DashboardKpiCard 
              label="Fatturato Mese" 
              value={formatEuro(monthRevenue)} 
              icon={TrendingUp} 
              subValue="Totale fatturabile del periodo"
              color="text-primary"
           />
           <DashboardKpiCard 
              label="Margine Lordo" 
              value={`${monthMargin}%`} 
              icon={Target} 
              subValue="Media ponderata del periodo"
              color="text-emerald-500"
           />
           <DashboardKpiCard 
              label="Numero Commesse" 
              value={monthCommesse.length.toString()} 
              icon={Users} 
              subValue="Gestite in questo mese"
              color="text-blue-500"
           />
        </div>

        <Card className="bg-card border-border/50 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-border/30">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Elenco Commesse</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Stato</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right">Valore</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right">Margine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthCommesse.map((c) => (
                  <TableRow 
                    key={c.id} 
                    className="border-border/30 hover:bg-muted/30 transition-all cursor-pointer group/row"
                    onClick={() => navigate(`/commesse/${c.id}`)}
                  >
                    <TableCell className="py-5 pl-8 font-black">
                      <div className="flex items-center gap-3">
                        <ClientAvatar name={getClienteDisplayName(c.cliente)} logoUrl={c.cliente?.logo_url} size="xs" />
                        <span className="text-foreground group-hover:text-primary transition-colors tracking-tight">{getClienteDisplayName(c.cliente)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-[0.2em] bg-muted/50 border-border/50 text-muted-foreground">
                        {c.stato}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-5 text-right font-black text-foreground tabular-nums">{formatEuro(c.valore_fatturabile || 0)}</TableCell>
                    <TableCell className={`py-5 text-right font-black tabular-nums ${(c.margine_percentuale || 0) < 15 ? "text-rose-500" : "text-emerald-500"}`}>
                      {c.margine_percentuale}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedClientId && selectedClient) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedClientId(null)}
                className="h-10 w-10 bg-card/50 border border-border/50 text-foreground rounded-xl hover:bg-primary/10 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-4">
              <ClientAvatar name={selectedClient.ragione_sociale} logoUrl={selectedClient.logo_url} size="lg" className="rounded-2xl border-primary/20 p-1" />
              <div>
                <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase italic">
                  Profilo <span className="text-primary not-italic">{selectedClient.ragione_sociale}</span>
                </h1>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em] mt-1">Analisi filtrata su {periodLabel}</p>
              </div>
            </div>
          </div>
          <Button 
            className="rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 bg-card/50 border-border border hover:bg-muted/50"
            onClick={() => window.open(`/clienti/${selectedClient.id}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Vai ad Anagrafica
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <DashboardKpiCard 
              label="Fatturato Periodo" 
              value={formatEuro(clientCommesse.reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0))} 
              icon={TrendingUp} 
              subValue="Totale nel periodo selezionato"
              color="text-primary"
           />
           <DashboardKpiCard 
              label="Margine Medio" 
              value={`${(
                (clientCommesse.reduce((acc, c) => acc + Number(c.margine_euro || 0), 0) /
                  Math.max(clientCommesse.reduce((acc, c) => acc + Number(c.valore_fatturabile || 0), 0), 1)) *
                100
              ).toFixed(1)}%`} 
              icon={Target} 
              subValue="Efficienza operativa media"
              color="text-emerald-500"
           />
           <DashboardKpiCard 
              label="Ore Totali" 
              value={`${Math.round(clientCommesse.reduce((acc, c) => acc + getCommessaHours(c), 0))}h`} 
              icon={Clock} 
              subValue="Tempo investito nel periodo"
              color="text-blue-500"
           />
           <DashboardKpiCard 
              label="N. Commesse" 
              value={clientCommesse.length.toString()} 
              icon={Users} 
              subValue="Volume di collaborazioni"
              color="text-amber-500"
           />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 bg-card border-border/50 shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-border/30">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Storico Commesse</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Mese Competenza</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Stato</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right">Valore</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right">Margine %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientCommesse.map((c) => (
                    <TableRow 
                      key={c.id} 
                      className="border-border/30 hover:bg-muted/30 transition-all cursor-pointer group/row"
                      onClick={() => navigate(`/commesse/${c.id}`)}
                    >
                      <TableCell className="py-5 pl-8 font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">
                        {formatDate(parseISO(c.mese_competenza), "MMMM yyyy", { locale: it })}
                      </TableCell>
                      <TableCell className="py-5">
                         <Badge variant="outline" className="text-[9px] font-black uppercase tracking-[0.2em] bg-muted/50 border-border/50 text-muted-foreground">
                          {c.stato}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 text-right font-black text-foreground tabular-nums">{formatEuro(c.valore_fatturabile || 0)}</TableCell>
                      <TableCell className={`py-5 text-right font-black tabular-nums ${(c.margine_percentuale || 0) < 15 ? "text-rose-500" : "text-emerald-500"}`}>
                        {c.margine_percentuale}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-border/30">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Trend Margine</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pt-8 min-h-[300px]">
              <div ref={chart1Ref} style={{ width: '100%', height: '240px' }}>
                {chart1W > 0 && (
                  <LineChart width={chart1W} height={chart1H} data={[...clientCommesse].reverse().map((c) => ({
                      month: formatDate(parseISO(c.mese_competenza), "MMM", { locale: it }).toUpperCase(),
                      margin: Number(c.margine_percentuale || 0)
                    }))}>
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} fontWeight="black" />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} fontWeight="black" unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px", color: "hsl(var(--foreground))" }} />
                      <Line type="monotone" dataKey="margin" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                  </LineChart>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="p-8 space-y-12 bg-background selection:bg-primary/30 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-black tracking-tighter text-foreground uppercase italic underline decoration-primary/30 decoration-8 underline-offset-[12px]">
              Business <span className="font-thin text-muted-foreground/30 not-italic">-</span>{" "}
              <span className="text-primary not-italic">Intelligence</span>
            </h1>
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60">
              Analisi avanzata performance e marginalità | {periodLabel}
            </p>
          </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card/50 p-3 shadow-sm">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {REPORTING_PERIOD_OPTIONS.map((option) => {
                const isActive = option.value === periodPreset;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="ghost"
                    onClick={() => setPeriodPreset(option.value)}
                    className={cn(
                        "h-9 rounded-xl uppercase text-[9px] tracking-widest font-black transition-all",
                        isActive
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                            : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
            {periodPreset === "CUSTOM" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="h-10 rounded-xl border-border bg-muted/30 text-foreground"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="h-10 rounded-xl border-border bg-muted/30 text-foreground"
                />
              </div>
            )}
          </div>
          <PDFDownloadLink 
            document={<AnalyticsReportPDF data={analyticsPdfData} />} 
            fileName={`Bite_BI_Report_${new Date().toISOString().split('T')[0]}.pdf`}
          >
            {({ loading }) => (
              <Button 
                disabled={loading}
                className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_hsl(var(--primary)/0.2)] transition-all"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {loading ? "Generazione..." : "Esporta PDF"}
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardKpiCard 
          label="Fatturato Periodo" 
          value={formatEuro(kpis.revenue.value)} 
          icon={TrendingUp} 
          trend={`${kpis.revenue.delta >= 0 ? "+" : ""}${kpis.revenue.delta.toFixed(1)}%`} 
          trendType={kpis.revenue.trend}
          subValue={periodPreset === "CURRENT_YEAR" ? "Totale anno corrente" : "Totale periodo selezionato"}
          deltaRel={benchmarkData ? (kpis.revenue.value / (benchmarkData.avgRevenue || 1) - 1) * 100 : undefined}
          onClick={() => {
             const start = format(periodRange.from, "yyyy-MM-dd");
             const end = format(periodRange.to, "yyyy-MM-dd");
             if (isSameMonth(periodRange.from, periodRange.to)) {
               navigate(`/commesse?mese=${format(periodRange.from, "yyyy-MM-01")}`);
             } else {
               navigate(`/commesse?from=${start}&to=${end}`);
             }
          }}
        />
        <DashboardKpiCard 
          label="Scaduto Totale" 
          value={formatEuro(cashFlowData?.totalOverdue || 0)} 
          icon={AlertTriangle} 
          color="text-rose-500"
          subValue="Fatture attive scadute"
          onClick={() => navigate("/fatture")}
        />
        <DashboardKpiCard 
          label="Margine Medio %" 
          value={`${kpis.margin.value.toFixed(1)}%`} 
          icon={Target} 
          color="text-emerald-500"
          subValue="Efficienza netta sul periodo"
          trend={`${kpis.margin.delta >= 0 ? "+" : ""}${kpis.margin.delta.toFixed(1)}%`}
          trendType={kpis.margin.trend}
          deltaRel={benchmarkData ? kpis.margin.value - benchmarkData.avgMargin : undefined}
        />
        <DashboardKpiCard 
          label="Ore Lavorate" 
          value={`${Math.round(kpis.hours.value)}h`} 
          icon={Clock} 
          color="text-blue-500"
          trend={`${kpis.hours.delta >= 0 ? "+" : ""}${kpis.hours.delta.toFixed(1)}%`} 
          trendType={kpis.hours.trend}
          subValue="Ore reali caricate"
          onClick={() => {
             const start = format(periodRange.from, "yyyy-MM-dd");
             navigate(`/timesheet?mese=${start}`);
          }}
        />
      </div>

      {/* Cash Flow & Liquidità */}
      <div className="lg:col-span-3 mt-12 bg-card/40 border border-border/50 rounded-[2.5rem] p-10 shadow-xl">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 bg-emerald-500 rounded-full" />
            <h2 className="text-xl font-black uppercase tracking-tighter italic text-foreground">Cash Flow <span className="text-emerald-500 not-italic">& Liquidità</span></h2>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 font-black uppercase text-[10px]">
            Tempo Incasso: {cashFlowData?.dso ? `${Math.round(cashFlowData.dso)} gg` : "N/D"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
           <div className="bg-card border border-border/50 rounded-3xl p-5 group hover:border-emerald-500/30 transition-all">
             <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Incassato Totale</p>
             <p className="text-2xl font-black text-emerald-400">{formatEuro(cashFlowData?.totalPaid || 0)}</p>
           </div>
           <div className="bg-card border border-border/50 rounded-3xl p-5 group hover:border-primary/30 transition-all">
             <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Esposizione Aperta</p>
             <p className="text-2xl font-black text-foreground">{formatEuro(cashFlowData?.totalOpen || 0)}</p>
           </div>
           <div className="bg-card border border-border/50 rounded-3xl p-5 group hover:border-amber-500/30 transition-all">
             <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Di cui a Scadere</p>
             <p className="text-xl font-black text-amber-500">{formatEuro(Math.max(0, (cashFlowData?.totalOpen || 0) - (cashFlowData?.totalOverdue || 0)))}</p>
           </div>
           <div className="bg-card border border-border/50 rounded-3xl p-5 relative overflow-hidden cursor-pointer hover:border-rose-500/50 transition-all group" onClick={() => navigate("/fatture?status=SCADUTO")}>
             <p className="text-[10px] uppercase font-black text-rose-400 mb-1 flex items-center gap-1.5">
               <AlertTriangle size={12} className="group-hover:scale-110 transition-transform" />
               Di cui Scaduto
             </p>
             <p className="text-2xl font-black text-rose-500">{formatEuro(cashFlowData?.totalOverdue || 0)}</p>
             {cashFlowData?.totalOverdue && cashFlowData.totalOverdue > 0 && (
                <div className="absolute bottom-0 left-0 h-1 bg-rose-500 w-full opacity-30" />
             )}
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Classifica Rischio Crediti */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-2 flex items-center justify-between">
              <span>Rischio Crediti (Top 5)</span>
            </h3>
            <div className="bg-card border border-border/50 rounded-[2rem] overflow-hidden shadow-lg">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="py-4 pl-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Cliente</TableHead>
                    <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Scaduto</TableHead>
                    <TableHead className="py-4 pr-6 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashFlowData?.clientRiskRanking.slice(0, 5).map((cl: any) => (
                    <TableRow 
                      key={cl.id} 
                      className="border-border/10 hover:bg-muted/30 transition-all cursor-pointer group/row"
                      onClick={() => navigate(`/clienti/${cl.id}`)}
                    >
                      <TableCell className="py-5 pl-6">
                        <span className="text-foreground font-black group-hover:text-primary transition-colors truncate max-w-[150px] inline-block">{cl.name}</span>
                      </TableCell>
                      <TableCell className="py-5 text-right font-black text-rose-600 dark:text-rose-400">{formatEuro(cl.totalOverdue)}</TableCell>
                      <TableCell className="py-5 pr-6 text-center">
                         <Badge className={cn(
                           "text-[9px] font-black uppercase border",
                           cl.status === "CRITICO" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                           : cl.status === "ATTENZIONE" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                           : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                         )}>
                           {cl.status}
                         </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!cashFlowData || cashFlowData.clientRiskRanking.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-[10px] font-bold text-muted-foreground uppercase italic">
                        Nessuno scoperto identificato
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Proiezione Liquidità Breve */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-2 flex items-center justify-between">
              <span>Proiezione Cassa Netta</span>
            </h3>
            <div className="space-y-4">
              {cashFlowData?.projection.map((p) => (
                <div key={p.days} className="bg-card border border-border/50 rounded-[1.5rem] p-5 group hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between mb-3">
                     <Badge className="bg-muted text-muted-foreground border-border/50 text-[9px] font-black uppercase tracking-tighter">
                       A {p.days} Giorni
                     </Badge>
                  </div>
                  <div className="flex items-end justify-between">
                     <div>
                        <p className={`text-2xl font-black tracking-tighter ${p.net >= 0 ? 'text-foreground' : 'text-rose-400'}`}>
                          {formatEuro(p.net)}
                        </p>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-bold text-emerald-500 uppercase">In: {formatEuro(p.inflow)}</p>
                        <p className="text-[9px] font-bold text-rose-400 uppercase">Out: {formatEuro(p.outflow)}</p>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
        {/* Andamento Fatturato */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
        <div className="flex items-center gap-3 px-1">
          <div className="h-8 w-1.5 bg-primary rounded-full" />
          <h2 className="text-xl font-black uppercase tracking-tighter italic text-foreground">Trend <span className="text-primary not-italic">Storici e Performance</span></h2>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
        <Card className="bg-card border-border/50 shadow-2xl rounded-3xl overflow-hidden hover:border-primary/20 transition-all group">
          <CardHeader className="border-b border-border/30 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Andamento Fatturato</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">{getTrendDescription(periodRange)}</CardDescription>
              </div>
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 h-[350px]">
            <div ref={chart2Ref} style={{ width: '100%', height: '290px' }}>
              {chart2W > 0 && (
                <BarChart
                  width={chart2W} height={chart2H}
                  data={trendData}
                  onClick={(event: any) => {
                    const isoMonth = event?.activePayload?.[0]?.payload?.isoMonth;
                    if (isoMonth) {
                      setSelectedMonthKey(isoMonth);
                      navigate(`/fatture?mese=${isoMonth}`);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    fontWeight="bold"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    fontWeight="bold"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `€${val/1000}k`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px", color: "hsl(var(--foreground))" }}
                    itemStyle={{ fontWeight: "bold" }}
                    cursor={{ fill: "hsl(var(--primary)/0.05)" }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={24} cursor="pointer" />
                </BarChart>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Margin Trend Chart */}
        <Card className="bg-card border-border/50 shadow-2xl rounded-3xl overflow-hidden hover:border-primary/20 transition-all group">
          <CardHeader className="border-b border-border/30 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Trend Margine</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">
                  {trendData.length > 1 ? "Andamento mensile del periodo selezionato" : "Margine del periodo selezionato"}
                </CardDescription>
              </div>
              <div className="p-2 rounded-xl bg-[#ec4899]/10 border border-[#ec4899]/20">
                <Target className="h-4 w-4 text-[#ec4899]" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 h-[350px]">
            <div ref={chart3Ref} style={{ width: '100%', height: '290px' }}>
              {chart3W > 0 && (
                <LineChart
                  width={chart3W} height={chart3H}
                  data={trendData}
                  onClick={(event: any) => {
                    const isoMonth = event?.activePayload?.[0]?.payload?.isoMonth;
                    if (isoMonth) {
                      setSelectedMonthKey(isoMonth);
                      navigate(`/commesse?mese=${isoMonth}`);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    fontWeight="bold"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    fontWeight="bold"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}%`}
                    domain={[0, 60]}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px", color: "hsl(var(--foreground))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="margin"
                    stroke="hsl(var(--primary))"
                    strokeWidth={4}
                    dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--card))" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    cursor="pointer"
                  />
                </LineChart>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table Redditività Clienti */}
        <Card className="lg:col-span-3 bg-card border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden mt-8">
          <CardHeader className="border-b border-border/30 bg-muted/10 p-8">
            <CardTitle className="text-sm font-black italic uppercase tracking-tighter text-foreground">Redditività Clienti</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Dettaglio margini per cliente nel periodo selezionato</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="py-4 pl-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Cliente</TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Fatturato</TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Costi Totali</TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Margine €</TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Margine %</TableHead>
                  <TableHead className="py-4 pr-8 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {profitabilityData.current.clientProfitability.map((cl) => {
                    const status = getStatusBadge(cl.marginPct);
                    return (
                      <TableRow 
                        key={cl.id} 
                        className="border-border/30 hover:bg-muted/30 transition-all cursor-pointer group/row" 
                        onClick={() => navigate(`/clienti/${cl.id}`)}
                      >
                        <TableCell className="py-5 pl-8">
                          <div className="flex items-center gap-3">
                            <ClientAvatar name={cl.name} logoUrl={cl.logo_url} size="xs" />
                            <span className="text-foreground font-black group-hover:text-primary transition-colors tracking-tight">{cl.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 text-right font-black text-foreground">{formatEuro(cl.revenue)}</TableCell>
                        <TableCell className="py-5 text-right font-bold text-muted-foreground/70">{formatEuro(cl.totalCost)}</TableCell>
                        <TableCell className={`py-5 text-right font-black ${cl.marginEuro > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {formatEuro(cl.marginEuro)}
                        </TableCell>
                        <TableCell className={`py-5 text-right font-black ${status.color}`}>
                          {cl.marginPct.toFixed(1)}%
                        </TableCell>
                        <TableCell className="py-5 pr-8 text-center">
                          <Badge className={`${status.bg} ${status.color} ${status.border} text-[9px] font-black uppercase border`}>
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Table Redditività Commesse */}
        <Card className="lg:col-span-3 bg-card border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden mt-8">
          <CardHeader className="border-b border-border/30 bg-muted/10 p-8">
            <CardTitle className="text-sm font-black italic uppercase tracking-tighter text-foreground">Redditività Commesse</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Dettaglio margini per singola commessa/progetto</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="py-4 pl-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Mese / Commessa</TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Fatturato</TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Manodopera</TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Struttura</TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Margine €</TableHead>
                  <TableHead className="py-4 pr-8 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profitabilityData.current.commesseProfitability
                  .sort((a, b) => b.marginEuro - a.marginEuro)
                  .map((c) => {
                    const status = getStatusBadge(c.marginPct);
                    return (
                      <TableRow 
                        key={c.id} 
                        className="border-border/30 hover:bg-muted/30 transition-all cursor-pointer group/row"
                        onClick={() => navigate(`/commesse/${c.id}`)}
                      >
                        <TableCell className="py-5 pl-8">
                          <div className="flex flex-col">
                            <span className="text-foreground font-black group-hover:text-primary transition-colors tracking-tight">{getClienteDisplayName(c.cliente)}</span>
                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">{formatDate(parseISO(c.mese_competenza), "MMMM yyyy", { locale: it })}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 text-right font-black text-foreground">{formatEuro(Number(c.valore_fatturabile || 0))}</TableCell>
                        <TableCell className="py-5 text-right font-bold text-muted-foreground/70">{formatEuro(c.laborCost)}</TableCell>
                        <TableCell className="py-5 text-right font-bold text-muted-foreground/40">{formatEuro(c.structureCost)}</TableCell>
                        <TableCell className={`py-5 text-right font-black ${status.color}`}>
                          <div className="flex flex-col items-end">
                            <span>{formatEuro(c.marginEuro)}</span>
                            <span className="text-[10px] opacity-70 tracking-tighter">{c.marginPct.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 pr-8 text-center">
                          <Badge className={`${status.bg} ${status.color} ${status.border} text-[9px] font-black uppercase border`}>
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Clients */}
        <Card className="bg-card border-border/50 shadow-2xl rounded-3xl">
          <CardHeader>
            <CardTitle className="text-sm font-black italic uppercase tracking-tighter text-foreground">Top 5 Clienti</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Per volume nel periodo selezionato</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {clientStats.map((cl) => {
              const fullClient = (clienti as Cliente[]).find(c => c.id === cl.id);
              const progressValue = maxClientRevenue > 0 ? (cl.revenue / maxClientRevenue) * 100 : 0;
              return (
                <div 
                  key={cl.id} 
                  className="space-y-2 cursor-pointer group/item" 
                  onClick={() => setSelectedClientId(cl.id)}
                >
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tight">
                    <div className="flex items-center gap-2">
                       <ClientAvatar name={cl.name} logoUrl={fullClient?.logo_url} size="xs" />
                       <span className="text-foreground font-black truncate max-w-[150px] group-hover/item:text-primary transition-colors tracking-tight">{cl.name}</span>
                    </div>
                    <span className="text-primary font-black tracking-tighter">{formatEuro(cl.revenue)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={progressValue} className="h-1.5 flex-1" />
                    <span className={`text-[10px] font-black flex items-center gap-0.5 ${cl.delta > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {cl.delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(cl.delta).toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>


        {/* Efficiency Chart */}
        <Card className="lg:col-span-1 bg-card border-border/50 shadow-2xl rounded-3xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black italic uppercase tracking-tighter text-foreground">Efficienza Operativa</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Fatturato vs Ore Lavorate per Cliente</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pt-4 min-h-[350px]">
            <div ref={chart4Ref} style={{ width: '100%', height: '316px' }}>
              {chart4W > 0 && (
                <ScatterChart
                  width={chart4W} height={chart4H}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  onClick={(event: any) => {
                    const clientId = event?.activePayload?.[0]?.payload?.id;
                    if (clientId) setSelectedClientId(clientId);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis
                    type="number"
                    dataKey="hours"
                    name="Ore"
                    unit="h"
                    fontSize={10}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="revenue"
                    name="Fatturato"
                    unit="€"
                    fontSize={10}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <ZAxis type="number" range={[100, 1000]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))"
                    }}
                  />
                  <Scatter
                    name="Clienti"
                    data={scatterData}
                    cursor="pointer"
                    onClick={(event: any) => {
                      const clientId = event?.payload?.id;
                      if (clientId) navigate(`/clienti/${clientId}`);
                    }}
                  >
                    {scatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profitability > 50 ? "#10b981" : "#ef4444"} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Scatter>
                </ScatterChart>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tools & Simulators */}
      <div className="space-y-6 pt-10">
        <div className="flex items-center gap-3 px-1">
          <div className="h-8 w-1.5 bg-primary rounded-full" />
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Simulation <span className="text-primary not-italic">Tools</span></h2>
        </div>
        <QuickCalculator />
      </div>

      {/* Alerts & Critical Items */}
      <div className="space-y-6 pt-10 pb-20">
        <div className="flex items-center gap-3 px-1">
          <div className="h-8 w-1.5 bg-rose-500 rounded-full" />
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Critical <span className="text-rose-500 not-italic">Insights</span></h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert: any) => (
            <div 
              key={alert.title} 
              className="flex items-center gap-4 p-5 rounded-[2rem] bg-card border border-border/50 hover:border-primary/40 transition-all cursor-pointer group active:scale-[0.98] shadow-lg shadow-black/5"
              onClick={() => {
                if (alert.title.includes("Sforamento") || alert.title.includes("Margine basso")) {
                   navigate("/commesse");
                } else if (alert.title.includes("Rischio Incasso") || alert.title.includes("Benchmark Negativo")) {
                   navigate("/clienti");
                } else if (alert.title.includes("Scaduto")) {
                   navigate("/fatture");
                }
              }}
            >
              <div className={`p-3 rounded-2xl ${alert.severity === "high" ? "bg-rose-500/10 text-rose-500" : "bg-orange-500/10 text-orange-500"}`}>
                {alert.type === "MARGIN" ? <ArrowDownRight className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">{alert.type}</p>
                <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors tracking-tight">{alert.title}</p>
              </div>
              <span className="text-sm font-black text-foreground tabular-nums">{alert.value}</span>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center gap-4 bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-border/50">
              <div className="p-5 rounded-full bg-emerald-500/10">
                <Users className="h-10 w-10 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-xs font-black uppercase text-foreground tracking-widest">Nessun alert critico identificato</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">Operatività ottimale del portafoglio</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Previsioni Business (Forecast) */}
      <div className="space-y-6 pt-12">
        <div className="flex items-center gap-3 px-1">
          <div className="h-8 w-1.5 bg-primary rounded-full" />
          <h2 className="text-xl font-black uppercase tracking-tighter italic text-foreground">Forecast Business <span className="text-primary not-italic">(30/60/90g)</span></h2>
        </div>

        <ForecastWidget />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {forecastData?.map((f) => {
            const relColor = f.reliability === "ALTA" ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                           : f.reliability === "MEDIA" ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                           : "text-rose-500 bg-rose-500/10 border-rose-500/20";
            
            return (
                   <Card 
                     key={f.days} 
                     className="bg-card border-border/50 shadow-2xl rounded-[2rem] p-6 relative overflow-hidden group hover:border-primary/30 transition-all cursor-pointer"
                     onClick={() => {
                        const targetMonth = startOfMonth(addMonths(today, f.days / 30));
                        navigate(`/commesse?mese=${format(targetMonth, "yyyy-MM-01")}&status=APERTA`);
                     }}
                   >
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-all">
                  <TrendingUp size={100} />
                </div>
                
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase">
                      {f.days} Giorni
                    </Badge>
                    <Badge className={`${relColor} text-[9px] font-black uppercase border`}>
                      {f.reliability}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Fatturato Previsto</p>
                    <p className="text-3xl font-black text-foreground tracking-tighter">{formatEuro(f.revenue)}</p>
                    
                    <div className="flex items-center gap-2 mt-2">
                       <div className={`flex items-center gap-0.5 text-[10px] font-black ${f.trend >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {f.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(f.trend).toFixed(0)}%
                       </div>
                       <span className="text-[10px] text-muted-foreground font-bold">vs media</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Margine Stimato</span>
                      <span className="text-md font-black text-emerald-400">{formatEuro(f.margin)}</span>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground leading-tight italic">
                      "{f.reason}"
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-4">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase text-muted-foreground">
                      <span>Copertura Pipeline (Lavori Ceri)</span>
                      <span>{(f.coverage * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-1000" 
                        style={{ width: `${f.coverage * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      </div>
    </PageTransition>
  );
}
