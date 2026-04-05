import { useMemo } from "react";
import { useCommesse } from "./useCommesse";
import { useClienti } from "./useClienti";
import { useTasks } from "./useTasks";
import { useFattureAttive } from "./useFatture";
import { useTimesheets } from "./useTimesheet";
import { 
  subMonths, 
  startOfMonth, 
  format, 
  isWithinInterval, 
  startOfYear, 
  endOfYear,
  isBefore,
  parseISO
} from "date-fns";
import { it } from "date-fns/locale";
import type { Commessa, Cliente, Timesheet, FatturaAttiva } from "@/types";
import type { TaskSO } from "@/types/studio";

export function useAnalytics() {
  const now = new Date();
  const currentMonthStr = format(now, "yyyy-MM-01");
  
  const { data: commesse = [], isLoading: loadingC } = useCommesse();
  const { data: clienti = [], isLoading: loadingCl } = useClienti();
  const { data: tasks = [], isLoading: loadingT } = useTasks();
  const { data: fatture = [], isLoading: loadingF } = useFattureAttive();
  const { data: timesheetsCurrentMonth = [], isLoading: loadingTs } = useTimesheets({ mese: currentMonthStr });

  const analytics = useMemo(() => {
    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(startOfMonth(now), 11 - i);
      return format(d, "yyyy-MM-dd");
    });

    const monthLabels = last12Months.map(m => 
      format(parseISO(m), "MMM yy", { locale: it }).toUpperCase()
    );

    // 1. GRAFICO FATTURATO (Bar Chart)
    const revenueTrend = last12Months.map((m, i) => {
      const monthStart = parseISO(m);
      const total = commesse
        .filter((c: Commessa) => {
          const cDate = parseISO(c.mese_competenza);
          return cDate.getMonth() === monthStart.getMonth() && cDate.getFullYear() === monthStart.getFullYear();
        })
        .reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0);
      
      return { month: monthLabels[i], revenue: total };
    });

    // 2. GRAFICO MARGINI (Line Chart)
    const marginTrend = last12Months.map((m, i) => {
      const monthStart = parseISO(m);
      const monthCommesse = commesse.filter((c: Commessa) => {
        const cDate = parseISO(c.mese_competenza);
        return cDate.getMonth() === monthStart.getMonth() && cDate.getFullYear() === monthStart.getFullYear();
      });

      const totalRev = monthCommesse.reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0);
      const totalMargin = monthCommesse.reduce((acc: number, c: Commessa) => acc + (c.margine_euro || 0), 0);
      const avgMarginPercent = totalRev > 0 ? (totalMargin / totalRev) * 100 : 0;

      return { month: monthLabels[i], margin: parseFloat(avgMarginPercent.toFixed(1)) };
    });

    // 3. TOP CLIENTI
    const clientStats = clienti.map((cl: Cliente) => {
      const totalRev = commesse
        .filter((c: Commessa) => c.cliente_id === cl.id)
        .reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0);
      
      const prevMonthRev = commesse
        .filter((c: Commessa) => c.cliente_id === cl.id && isWithinInterval(parseISO(c.mese_competenza), {
          start: subMonths(startOfMonth(now), 1),
          end: subMonths(startOfMonth(now), 1)
        }))
        .reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0);

      return { 
        name: cl.ragione_sociale, 
        revenue: totalRev,
        delta: totalRev > 0 ? ((totalRev - prevMonthRev) / totalRev) * 100 : 0
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

    // 4. ORE vs FATTURATO (Scatter)
    const scatterData = clienti.map((cl: Cliente) => {
      const clientCommesse = commesse.filter((c: Commessa) => c.cliente_id === cl.id);
      const totalRev = clientCommesse.reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0);
      const totalHours = clientCommesse.reduce((acc: number, c: Commessa) => acc + (c.costo_manodopera || 0) / 40, 0); 

      return { 
        name: cl.ragione_sociale, 
        revenue: totalRev, 
        hours: totalHours,
        profitability: totalHours > 0 ? totalRev / totalHours : 0
      };
    }).filter(d => d.revenue > 0);

    // 5. KPI CARDS
    const ytdInterval = { start: startOfYear(now), end: endOfYear(now) };
    const ytdCommesse = commesse.filter((c: Commessa) => isWithinInterval(parseISO(c.mese_competenza), ytdInterval));
    const revenueYTD = ytdCommesse.reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0);
    const marginYTD = ytdCommesse.length > 0 ? 
      (ytdCommesse.reduce((acc: number, c: Commessa) => acc + (c.margine_percentuale || 0), 0) / ytdCommesse.length) : 0;

    // 6. ALERTS
    const alerts = [
      ...commesse
        .filter((c: Commessa) => (c.margine_percentuale || 0) < 15 && isWithinInterval(parseISO(c.mese_competenza), { start: startOfMonth(now), end: now }))
        .map((c: Commessa) => ({ type: "MARGIN", title: `Margine basso: ${c.cliente?.ragione_sociale}`, value: c.mese_competenza, severity: "high" })),
      ...fatture
        .filter((f: FatturaAttiva) => f.stato_pagamento.toLowerCase() === "attesa" && isBefore(parseISO(f.data_scadenza || ""), now))
        .map((f: FatturaAttiva) => ({ type: "INVOICE", title: `Scaduta: ${f.numero}`, value: f.data_scadenza || "", severity: "high" })),
      ...tasks
        .filter((t: TaskSO) => !t.state_id.includes("PRO") && !t.state_id.includes("PUB") && t.due_date && isBefore(parseISO(t.due_date), now))
        .map((t: TaskSO) => ({ type: "TASK", title: `Overdue: ${t.title}`, value: t.due_date || "", severity: "medium" })),
      ...commesse
        .filter((c: Commessa) => c.ore_contratto > 0 && (c.ore_reali / c.ore_contratto) >= 0.8)
        .map((c: Commessa) => ({ 
          type: "SCOPE", 
          title: `Scope Check: ${c.cliente?.ragione_sociale}`, 
          value: `${((c.ore_reali / c.ore_contratto)*100).toFixed(0)}%`, 
          severity: (c.ore_reali / c.ore_contratto) >= 1 ? "high" : "medium" 
        }))
    ];

    return {
      revenueTrend,
      marginTrend,
      clientStats,
      scatterData,
      kpis: {
        revenueYTD,
        marginYTD,
        activeClients: clienti.filter((c: Cliente) => c.attivo).length,
        monthlyHours: timesheetsCurrentMonth.reduce((acc: number, t: Timesheet) => acc + (t.durata_minuti || 0), 0) / 60,
        monthlyRevenue: commesse
          .filter((c: Commessa) => isWithinInterval(parseISO(c.mese_competenza), { start: startOfMonth(now), end: now }))
          .reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0),
        ongoingProjects: commesse.filter((c: Commessa) => c.stato === "APERTA").length
      },
      alerts,
      commesse, // Expose raw commesse for drill-down
      clienti,  // Expose raw clienti for drill-down
      last12Months // Expose months list for reference
    };
  }, [commesse, clienti, tasks, fatture, timesheetsCurrentMonth, now]);

  return {
    data: analytics,
    isLoading: loadingC || loadingCl || loadingT || loadingF || loadingTs
  };
}
