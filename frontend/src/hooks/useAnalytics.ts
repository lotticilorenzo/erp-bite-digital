import { useMemo } from "react";
import { useCommesse } from "./useCommesse";
import { useClienti } from "./useClienti";
import { useTasks } from "./useTasks";
import { useFattureAttive } from "./useFatture";
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

export function useAnalytics() {
  const { data: commesse = [], isLoading: loadingC } = useCommesse();
  const { data: clienti = [], isLoading: loadingCl } = useClienti();
  const { data: tasks = [], isLoading: loadingT } = useTasks();
  const { data: fatture = [], isLoading: loadingF } = useFattureAttive();

  const analytics = useMemo(() => {
    const now = new Date();
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
        .filter(c => {
          const cDate = parseISO(c.mese_competenza);
          return cDate.getMonth() === monthStart.getMonth() && cDate.getFullYear() === monthStart.getFullYear();
        })
        .reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0);
      
      return { month: monthLabels[i], revenue: total };
    });

    // 2. GRAFICO MARGINI (Line Chart)
    const marginTrend = last12Months.map((m, i) => {
      const monthStart = parseISO(m);
      const monthCommesse = commesse.filter(c => {
        const cDate = parseISO(c.mese_competenza);
        return cDate.getMonth() === monthStart.getMonth() && cDate.getFullYear() === monthStart.getFullYear();
      });

      const totalRev = monthCommesse.reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0);
      const totalMargin = monthCommesse.reduce((acc, c) => acc + (c.margine_euro || 0), 0);
      const avgMarginPercent = totalRev > 0 ? (totalMargin / totalRev) * 100 : 0;

      return { month: monthLabels[i], margin: parseFloat(avgMarginPercent.toFixed(1)) };
    });

    // 3. TOP CLIENTI
    const clientStats = clienti.map(cl => {
      const totalRev = commesse
        .filter(c => c.cliente_id === cl.id)
        .reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0);
      
      const prevMonthRev = commesse
        .filter(c => c.cliente_id === cl.id && isWithinInterval(parseISO(c.mese_competenza), {
          start: subMonths(startOfMonth(now), 1),
          end: subMonths(startOfMonth(now), 1)
        }))
        .reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0);

      return { 
        name: cl.ragione_sociale, 
        revenue: totalRev,
        delta: totalRev > 0 ? ((totalRev - prevMonthRev) / totalRev) * 100 : 0
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

    // 4. ORE vs FATTURATO (Scatter)
    const scatterData = clienti.map(cl => {
      const clientCommesse = commesse.filter(c => c.cliente_id === cl.id);
      const totalRev = clientCommesse.reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0);
      const totalHours = clientCommesse.reduce((acc, c) => acc + (c.costo_manodopera || 0) / 40, 0); // Mocking hours from cost if not direct

      return { 
        name: cl.ragione_sociale, 
        revenue: totalRev, 
        hours: totalHours,
        profitability: totalHours > 0 ? totalRev / totalHours : 0
      };
    }).filter(d => d.revenue > 0);

    // 5. KPI CARDS
    const ytdInterval = { start: startOfYear(now), end: endOfYear(now) };
    const ytdCommesse = commesse.filter(c => isWithinInterval(parseISO(c.mese_competenza), ytdInterval));
    const revenueYTD = ytdCommesse.reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0);
    const marginYTD = ytdCommesse.length > 0 ? 
      (ytdCommesse.reduce((acc, c) => acc + (c.margine_percentuale || 0), 0) / ytdCommesse.length) : 0;

    // 6. ALERTS
    const alerts = [
      ...commesse
        .filter(c => (c.margine_percentuale || 0) < 15 && isWithinInterval(parseISO(c.mese_competenza), { start: startOfMonth(now), end: now }))
        .map(c => ({ type: "MARGIN", title: `Margine basso: ${c.cliente?.ragione_sociale}`, value: `${c.margine_percentuale}%`, severity: "high" })),
      ...fatture
        .filter(f => f.stato_pagamento.toLowerCase() === "attesa" && isBefore(parseISO(f.data_scadenza || ""), now))
        .map(f => ({ type: "INVOICE", title: `Scaduta: ${f.numero}`, value: `€${f.importo_residuo}`, severity: "high" })),
      ...tasks
        .filter(t => !t.state_id.includes("PRO") && !t.state_id.includes("PUB") && t.due_date && isBefore(parseISO(t.due_date), now))
        .map(t => ({ type: "TASK", title: `Overdue: ${t.title}`, value: t.due_date, severity: "medium" }))
    ];

    return {
      revenueTrend,
      marginTrend,
      clientStats,
      scatterData,
      kpis: {
        revenueYTD,
        marginYTD,
        activeClients: clienti.filter(c => c.attivo).length,
        monthlyHours: commesse
          .filter(c => isWithinInterval(parseISO(c.mese_competenza), { start: startOfMonth(now), end: now }))
          .reduce((acc, c) => acc + (c.costo_manodopera || 0) / 40, 0),
        monthlyRevenue: commesse
          .filter(c => isWithinInterval(parseISO(c.mese_competenza), { start: startOfMonth(now), end: now }))
          .reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0),
        ongoingProjects: commesse.filter(c => c.stato === "APERTA").length
      },
      alerts
    };
  }, [commesse, clienti, tasks, fatture]);

  return {
    data: analytics,
    isLoading: loadingC || loadingCl || loadingT || loadingF
  };
}
