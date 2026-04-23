import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Target, Banknote, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForecast } from "@/hooks/useForecast";

const formatEuro = (value: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  return [ref, width] as const;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="app-panel-strong space-y-1.5 rounded-xl p-3 text-xs">
      <p className="text-[10px] font-black uppercase tracking-widest text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-strong">{entry.name}</span>
          </div>
          <span className="font-black text-foreground">{formatEuro(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function ForecastWidget() {
  const { data, isLoading, refetch } = useForecast(3);
  const [chartRef, chartWidth] = useChartWidth();

  const chartData = (data?.mesi || []).map((month) => ({
    mese: format(parseISO(month.mese), "MMM yy", { locale: it }),
    Certi: month.ricavo_certo,
    "Pipeline CRM": month.ricavo_pipeline_crm,
    Storico: month.ricavo_storico,
  }));

  const allTopLeads = (data?.mesi || [])
    .flatMap((month) => month.top_lead)
    .sort((a, b) => b.valore_pesato - a.valore_pesato)
    .slice(0, 3);

  return (
    <Card className="app-panel overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-soft">
            Forecast Ricavi - 3 Mesi
          </CardTitle>
          <button
            onClick={() => refetch()}
            className="rounded-lg p-1.5 text-muted-strong transition-colors hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-500/24 bg-emerald-500/8 p-3 text-center shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)]">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-faint">Certi</p>
            <p className="text-lg font-black text-emerald-400">
              {isLoading ? "--" : formatEuro(data?.kpi.ricavi_certi ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/24 bg-purple-500/8 p-3 text-center shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)]">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-faint">
              Pipeline CRM
            </p>
            <p className="text-lg font-black text-purple-400">
              {isLoading ? "--" : formatEuro(data?.kpi.pipeline_crm ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border/90 bg-muted/36 p-3 text-center shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)]">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-faint">
              Totale Previsto
            </p>
            <p className="text-lg font-black text-foreground">
              {isLoading ? "--" : formatEuro(data?.kpi.totale_previsto ?? 0)}
            </p>
          </div>
        </div>

        <div ref={chartRef} className="w-full">
          {chartWidth > 0 && !isLoading && chartData.length > 0 && (
            <AreaChart
              width={chartWidth}
              height={200}
              data={chartData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
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
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border) / 0.55)"
                vertical={false}
              />
              <XAxis
                dataKey="mese"
                tick={{ fill: "hsl(var(--foreground-faint))", fontSize: 10, fontWeight: 800 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{
                  fill: "hsl(var(--foreground-faint))",
                  fontSize: 10,
                  fontWeight: 700,
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `EUR ${(value / 1000).toFixed(0)}k`}
                width={58}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 10, fontWeight: 800, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-faint">{value}</span>}
              />
              <Area
                type="monotone"
                dataKey="Storico"
                stroke="#94a3b8"
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
            <div className="flex h-[200px] items-center justify-center text-xs text-muted-strong">
              {isLoading ? "Caricamento forecast..." : "Nessun dato disponibile"}
            </div>
          )}
        </div>

        {allTopLeads.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-faint">
              <Target className="h-3 w-3" />
              Top Opportunita CRM
            </p>
            <div className="space-y-2">
              {allTopLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/32 p-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-purple-500/24 bg-purple-500/12">
                      <Banknote className="h-3 w-3 text-purple-400" />
                    </div>
                    <span className="truncate text-xs font-semibold text-foreground">{lead.nome}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-purple-500/24 bg-purple-500/8 text-[9px] font-black text-purple-400"
                    >
                      {lead.probabilita}%
                    </Badge>
                    <span className="text-xs font-black text-foreground">
                      {formatEuro(lead.valore_pesato)}
                    </span>
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
