import { useMemo } from "react";
import { useCommesse } from "./useCommesse";
import { useClienti } from "./useClienti";
import { useTasks } from "./useTasks";
import { useFattureAttive, useFatturePassive } from "./useFatture";
import { useTimesheets } from "./useTimesheet";
import { useCostiFissi } from "./useCosti";
import { useProgetti } from "./useProgetti";
import { hydrateCommesseWithClienti } from "@/lib/commessa-clienti";
import {
  subMonths, 
  startOfMonth, 
  format, 
  isWithinInterval, 
  startOfYear, 
  endOfYear,
  isBefore,
  parseISO,
  isSameMonth
} from "date-fns";
import { it } from "date-fns/locale";
import type { Commessa, Cliente, ClienteAffidabilita, Timesheet, FatturaAttiva } from "@/types";
import type { TaskSO } from "@/types/studio";

function deriveAffidabilita(activeMonths: number): ClienteAffidabilita {
  if (activeMonths >= 3) return "ALTA";
  if (activeMonths === 2) return "MEDIA";
  return "BASSA";
}

export function useAnalytics(referenceDate?: Date) {
  const referenceTimestamp = referenceDate ? referenceDate.getTime() : null;
  const now = useMemo(
    () => (referenceTimestamp !== null ? new Date(referenceTimestamp) : new Date()),
    [referenceTimestamp]
  );
  const currentMonthStr = format(now, "yyyy-MM-01");
  
  const { data: commesse = [], isLoading: loadingC } = useCommesse();
  const { data: clienti = [], isLoading: loadingCl } = useClienti();
  const { data: tasks = [], isLoading: loadingT } = useTasks();
  const { data: fatture = [], isLoading: loadingF } = useFattureAttive();
  const { data: fatturePassive = [], isLoading: loadingFp } = useFatturePassive();
  const { data: timesheetsCurrentMonth = [], isLoading: loadingTs } = useTimesheets({ mese: currentMonthStr });
  const { data: allTimesheets = [], isLoading: loadingAllTs } = useTimesheets();
  const { data: costiFissi = [], isLoading: loadingCf } = useCostiFissi();
  const { data: progetti = [], isLoading: loadingP } = useProgetti();

  const analytics = useMemo(() => {
    const prevMonth = subMonths(now, 1);
    
    // Defensive check: ensure data sources are arrays
    const clientiArr = Array.isArray(clienti) ? clienti : [];
    const allTimesheetsArr = Array.isArray(allTimesheets) ? allTimesheets : [];
    const costiFissiArr = Array.isArray(costiFissi) ? costiFissi : [];
    const progettiArr = Array.isArray(progetti) ? progetti : [];
    
    // Enrich commesse with real labor cost from timesheets
    const enrichedCommesse = (Array.isArray(commesse) ? commesse : []).map(c => {
      const commessaTimesheets = allTimesheetsArr.filter(t => t.commessa_id === c.id);
      const manualLaborCost = commessaTimesheets.reduce((acc, t) => acc + (t.costo_lavoro || 0), 0);
      return {
        ...c,
        costo_manodopera_reale: manualLaborCost,
        ore_reali_timesheet: commessaTimesheets.reduce((acc, t) => acc + (t.durata_minuti || 0), 0) / 60
      };
    });

    const commesseArr = hydrateCommesseWithClienti(
      enrichedCommesse,
      clientiArr
    );
    const tasksArr = Array.isArray(tasks) ? tasks : [];
    const fattureArr = Array.isArray(fatture) ? fatture : [];
    const fatturePassiveArr = Array.isArray(fatturePassive) ? fatturePassive : [];
    const timesheetsCurrentMonthArr = Array.isArray(timesheetsCurrentMonth) ? timesheetsCurrentMonth : [];

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
      const total = commesseArr
        .filter((c: Commessa) => {
          if (!c.mese_competenza) return false;
          const cDate = parseISO(c.mese_competenza);
          return cDate.getMonth() === monthStart.getMonth() && cDate.getFullYear() === monthStart.getFullYear();
        })
        .reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0);
      
      return { month: monthLabels[i], revenue: total };
    });

    // 2. GRAFICO MARGINI (Line Chart)
    const marginTrend = last12Months.map((m, i) => {
      const monthStart = parseISO(m);
      const monthCommesse = commesseArr.filter((c: Commessa) => {
        if (!c.mese_competenza) return false;
        const cDate = parseISO(c.mese_competenza);
        return cDate.getMonth() === monthStart.getMonth() && cDate.getFullYear() === monthStart.getFullYear();
      });

      const totalRev = monthCommesse.reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0);
      const totalMargin = monthCommesse.reduce((acc: number, c: Commessa) => acc + (c.margine_euro || 0), 0);
      const avgMarginPercent = totalRev > 0 ? (totalMargin / totalRev) * 100 : 0;

      return { month: monthLabels[i], margin: parseFloat(avgMarginPercent.toFixed(1)) };
    });

    // 3. TOP CLIENTI
    const clientStats = clientiArr.map((cl: Cliente) => {
      const totalRev = commesseArr
        .filter((c: Commessa) => c.cliente_id === cl.id)
        .reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0);
      
      const prevMonthRev = commesseArr
        .filter((c: Commessa) => {
            if (!c.cliente_id || c.cliente_id !== cl.id || !c.mese_competenza) return false;
            const cDate = parseISO(c.mese_competenza);
            return isWithinInterval(cDate, {
                start: subMonths(startOfMonth(now), 1),
                end: subMonths(startOfMonth(now), 1)
            });
        })
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
    const scatterData = clientiArr.map((cl: Cliente) => {
      const clientCommesse = commesseArr.filter((c: Commessa) => c.cliente_id === cl.id);
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
    const ytdCommesse = commesseArr.filter((c: Commessa) => {
        if (!c.mese_competenza) return false;
        return isWithinInterval(parseISO(c.mese_competenza), ytdInterval);
    });
    const selectedMonthCommesse = commesseArr.filter((c: Commessa) => {
      if (!c.mese_competenza) return false;
      return isSameMonth(parseISO(c.mese_competenza), now);
    });
    const selectedMonthActiveCommesse = selectedMonthCommesse.filter(
      (c: Commessa) => c.stato === "APERTA" || c.stato === "PRONTA_CHIUSURA"
    );
    const selectedMonthOpenCommesse = selectedMonthCommesse.filter(
      (c: Commessa) => c.stato === "APERTA"
    );
    const revenueYTD = ytdCommesse.reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0);
    const marginYTD = ytdCommesse.length > 0 ? 
      (ytdCommesse.reduce((acc: number, c: Commessa) => acc + (c.margine_percentuale || 0), 0) / ytdCommesse.length) : 0;
    const selectedMonthMargin = selectedMonthCommesse.length > 0
      ? selectedMonthCommesse.reduce((acc: number, c: Commessa) => acc + (c.margine_percentuale || 0), 0) / selectedMonthCommesse.length
      : 0;
    const selectedMonthClientsCount = new Set(selectedMonthCommesse.map((c: Commessa) => c.cliente_id)).size;

    // 6. ALERTS
    const alerts = [
      ...commesseArr
        .filter((c: Commessa) => {
            if (!c.mese_competenza || (c.margine_percentuale || 0) >= 15) return false;
            return isWithinInterval(parseISO(c.mese_competenza), { start: startOfMonth(now), end: now });
        })
        .map((c: Commessa) => ({ 
          type: "MARGIN", 
          title: `Margine basso: ${c.cliente?.ragione_sociale || "Commessa #" + c.id.substring(0,5)}`, 
          value: c.mese_competenza, 
          severity: "high" 
        })),
      ...fattureArr
        .filter((f: FatturaAttiva) => {
            if (f.stato_pagamento.toLowerCase() !== "attesa" || !f.data_scadenza) return false;
            return isBefore(parseISO(f.data_scadenza), now);
        })
        .map((f: FatturaAttiva) => ({ type: "INVOICE", title: `Scaduta: ${f.numero}`, value: f.data_scadenza || "", severity: "high" })),
      ...tasksArr
        .filter((t: TaskSO) => {
            if (!t.state_id || (t.state_id.includes("PRO") || t.state_id.includes("PUB")) || !t.due_date) return false;
            return isBefore(parseISO(t.due_date), now);
        })
        .map((t: TaskSO) => ({ type: "TASK", title: `Overdue: ${t.title}`, value: t.due_date || "", severity: "medium" })),
      ...commesseArr
        .filter((c: Commessa) => c.ore_contratto > 0 && (c.ore_reali / c.ore_contratto) >= 0.8)
        .map((c: Commessa) => ({ 
          type: "SCOPE", 
          title: `Scope Check: ${c.cliente?.ragione_sociale || "Commessa #" + c.id.substring(0,5)}`, 
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
        selectedMonthMargin,
        selectedMonthClientsCount,
        activeClients: clientiArr.filter((c: Cliente) => c.attivo).length,
        monthlyHours: timesheetsCurrentMonthArr.reduce((acc: number, t: Timesheet) => acc + (t.durata_minuti || 0), 0) / 60,
        monthlyRevenue: commesseArr
          .filter((c: Commessa) => {
              if (!c.mese_competenza) return false;
              return isWithinInterval(parseISO(c.mese_competenza), { start: startOfMonth(now), end: now });
          })
          .reduce((acc: number, c: Commessa) => acc + (c.valore_fatturabile || 0), 0),
        ongoingProjects: selectedMonthOpenCommesse.length,
        
        // V3 NEW KPIS
        currentMonthFatturabile: selectedMonthActiveCommesse
          .reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0),
        currentMonthCount: selectedMonthActiveCommesse.length,
        prevMonthFatturato: commesseArr
          .filter(c => {
              if (!c.mese_competenza) return false;
              return isSameMonth(parseISO(c.mese_competenza), prevMonth) && (c.stato === "CHIUSA" || c.stato === "FATTURATA" || c.stato === "INCASSATA");
          })
          .reduce((acc, c) => acc + (c.valore_fatturabile || 0), 0),
        costoStruttura: costiFissiArr.filter(cf => cf.attivo).reduce((acc, cf) => acc + Number(cf.importo || 0), 0),
        marginiSottoSoglia: selectedMonthCommesse.filter((c: Commessa) => (c.margine_percentuale || 0) < 30).length,
        timesheetPendingCount: allTimesheetsArr.filter(t => t.stato === "PENDING").length
      },
      
      // V3 FORECAST
      forecast: clientiArr
        .map(cl => {
          const clientProgetti = progettiArr.filter(p => p.cliente_id === cl.id && p.tipo === "RETAINER");
          if (clientProgetti.length === 0) return null;

          const last3Months = [subMonths(now, 1), subMonths(now, 2), subMonths(now, 3)];
          const history = last3Months.map(m => {
            const found = commesseArr.find(c => {
                if (!c.mese_competenza || c.cliente_id !== cl.id) return false;
                return isSameMonth(parseISO(c.mese_competenza), m);
            });
            return found?.valore_fatturabile || 0;
          });

          const activeMonths = history.filter(v => v > 0).length;
          const avgRevenue = history.reduce((a, b) => a + b, 0) / (activeMonths || 1);

          if (avgRevenue === 0) return null;

          return {
            clienteId: cl.id,
            cliente: cl.ragione_sociale,
            clienteCode: cl.codice_cliente || cl.ragione_sociale.substring(0, 3).toUpperCase(),
            months: [avgRevenue, avgRevenue, avgRevenue],
            affidabilita: cl.affidabilita || deriveAffidabilita(activeMonths),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),

      alerts,
      commesse: commesseArr,
      clienti: clientiArr,
      fatture: fattureArr,
      fatturePassive: fatturePassiveArr,
      costiFissi: costiFissiArr,
      last12Months,
      allTimesheets: allTimesheetsArr
    };
  }, [commesse, clienti, tasks, fatture, timesheetsCurrentMonth, allTimesheets, costiFissi, progetti, now]);

  return {
    data: analytics,
    isLoading: loadingC || loadingCl || loadingT || loadingF || loadingFp || loadingTs || loadingAllTs || loadingCf || loadingP
  };
}
