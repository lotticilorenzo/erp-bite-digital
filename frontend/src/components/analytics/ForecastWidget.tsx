import { useRef, useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { TrendingUp, Target, Banknote, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForecast } from "@/hooks/useForecast";

const formatEuro = (v: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 rounded-xl p-3 shadow-xl text-xs space-y-1.5">
      <p className="font-black text-foreground uppercase tracking-widest text-[10px]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-black text-foreground">{formatEuro(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function ForecastWidget() {
  const { data, isLoading, refetch } = useForecast(3);
  const [chartRef, chartWidth] = useChartWidth();

  const chartData = (data?.mesi || []).map((m) => ({
    mese: format(parseISO(m.mese), "MMM yy", { locale: it }),
    Certi: m.ricavo_certo,
    "Pipeline CRM": m.ricavo_pipeline_crm,
    Storico: m.ricavo_storico,
  }));

  // Aggregate all top leads across months
  const allTopLeads = (data?.mesi || [])
    .flatMap((m) => m.top_lead)
    .sort((a, b) => b.valore_pesato - a.valore_pesato)
    .slice(0, 3);

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              Forecast Ricavi — 3 Mesi
            </CardTitle>
          </div>
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* KPI chips */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Certi</p>
            <p className="text-lg font-black text-emerald-400">
              {isLoading ? "—" : formatEuro(data?.kpi.ricavi_certi ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Pipeline CRM</p>
            <p className="text-lg font-black text-purple-400">
              {isLoading ? "—" : formatEuro(data?.kpi.pipeline_crm ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Totale Previsto</p>
            <p className="text-lg font-black text-foreground">
              {isLoading ? "—" : formatEuro(data?.kpi.totale_previsto ?? 0)}
            </p>
          </div>
        </div>

        {/* Area Chart */}
        <div ref={chartRef} className="w-full">
          {chartWidth > 0 && !isLoading && chartData.length > 0 && (
            <AreaChart width={chartWidth} height={200} data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCerti" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPipeline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradStorico" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="mese"
                tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              <Area
                type="monotone"
                dataKey="Storico"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="url(#gradStorico)"
              />
              <Area
                type="monotone"
                dataKey="Pipeline CRM"
                stroke="#7c3aed"
                strokeWidth={2}
                strokeDasharray="5 3"
                fill="url(#gradPipeline)"
              />
              <Area
                type="monotone"
                dataKey="Certi"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#gradCerti)"
              />
            </AreaChart>
          )}
          {(isLoading || chartData.length === 0) && (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">
              {isLoading ? "Caricamento forecast..." : "Nessun dato disponibile"}
            </div>
          )}
        </div>

        {/* Top CRM Opportunities */}
        {allTopLeads.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3 h-3" />
              Top Opportunità CRM
            </p>
            <div className="space-y-2">
              {allTopLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                      <Banknote className="w-3 h-3 text-purple-400" />
                    </div>
                    <span className="text-xs font-semibold text-foreground truncate">{lead.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[9px] font-black border-purple-500/20 text-purple-400 bg-purple-500/5">
                      {lead.probabilita}%
                    </Badge>
                    <span className="text-xs font-black text-foreground">{formatEuro(lead.valore_pesato)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
