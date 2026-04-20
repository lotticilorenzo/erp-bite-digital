import { useEffect, useMemo, useState, type ReactNode } from "react";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  LineChart as LineChartIcon,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useBudget, useBudgetTrend, useBudgetVariance } from "@/hooks/useBudget";
import { BudgetTable } from "./BudgetTable";
import { CategoryModal } from "./CategoryModal";

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function compactEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

export default function BudgetPage() {
  const [mese, setMese] = useState(new Date());
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const { copyBudget } = useBudget(mese);
  const variance = useBudgetVariance(mese);
  const trend = useBudgetTrend(6, mese);

  const prevMonth = () => setMese((current) => subMonths(current, 1));
  const nextMonth = () => setMese((current) => addMonths(current, 1));

  useEffect(() => {
    if (!trend.data?.series?.length) return;
    const stillExists = trend.data.series.some((serie) => serie.categoria_id === selectedCategoryId);
    if (!selectedCategoryId || !stillExists) {
      setSelectedCategoryId(trend.data.series[0].categoria_id);
    }
  }, [selectedCategoryId, trend.data]);

  async function handleCopy() {
    try {
      const res = await copyBudget.mutateAsync(format(mese, "yyyy-MM-01"));
      toast.success(`Copiati ${res.clonati} budget dal mese precedente`);
    } catch {
      toast.error("Errore durante la copia dei budget");
    }
  }

  const varianceRows = variance.data ?? [];
  const alertCount = varianceRows.filter((item) => item.status === "over").length;
  const warningCount = varianceRows.filter((item) => item.status === "warning").length;

  const selectedSeries = useMemo(
    () => trend.data?.series.find((serie) => serie.categoria_id === selectedCategoryId) ?? trend.data?.series[0],
    [selectedCategoryId, trend.data]
  );

  const trendChartData = useMemo(
    () =>
      (selectedSeries?.data ?? []).map((point) => ({
        mese: format(parseISO(`${point.mese}-01`), "MMM yy", { locale: it }),
        budget: Number(point.budget),
        speso: Number(point.speso),
        varianza: Number(point.varianza),
        percentuale: Number(point.percentuale_utilizzo),
      })),
    [selectedSeries]
  );

  const latestTrendPoint = selectedSeries?.data?.[selectedSeries.data.length - 1];

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 min-h-screen bg-background">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
            <Target className="h-3.5 w-3.5" />
            Budget vs Actual
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white">Controllo spesa mensile</h1>
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">
              Confronta budget pianificato, speso reale e trend storico per intervenire prima che una categoria vada fuori soglia.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 shadow-lg">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-xl hover:bg-muted text-white">
              <ChevronLeft size={20} />
            </Button>
            <div className="min-w-[180px] px-5 text-center">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                {format(mese, "yyyy", { locale: it })}
              </span>
              <p className="text-2xl font-black capitalize tracking-tight text-white">
                {format(mese, "MMMM", { locale: it })}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-xl hover:bg-muted text-white">
              <ChevronRight size={20} />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button
              variant="outline"
              onClick={handleCopy}
              className="rounded-xl font-bold border-border bg-card hover:bg-muted h-11 px-5 gap-2"
            >
              <Copy size={16} />
              Copia Mese Prec.
            </Button>
            <Button
              onClick={() => setIsCategoryModalOpen(true)}
              className="rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 h-11 px-5 gap-2"
            >
              <Plus size={16} strokeWidth={3} />
              Nuova Categoria
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <HighlightCard
          title="Categorie in Over"
          value={String(alertCount)}
          subtitle={alertCount > 0 ? "Richiedono intervento immediato" : "Nessuna categoria oltre budget"}
          tone={alertCount > 0 ? "danger" : "success"}
        />
        <HighlightCard
          title="Categorie in Warning"
          value={String(warningCount)}
          subtitle={warningCount > 0 ? "Sopra l'80% del budget" : "Nessuna categoria in warning"}
          tone={warningCount > 0 ? "warning" : "neutral"}
        />
        <HighlightCard
          title="Serie Storiche"
          value={String(trend.data?.series.length ?? 0)}
          subtitle="Categorie con trend disponibile sugli ultimi mesi"
          tone="neutral"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-12 rounded-2xl border border-border bg-card/60 p-1">
          <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
            Overview
          </TabsTrigger>
          <TabsTrigger value="trend" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
            Trend
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="m-0 space-y-6">
          {(alertCount > 0 || warningCount > 0) && (
            <div className="flex flex-wrap items-center gap-3 rounded-[28px] border border-amber-500/30 bg-amber-500/10 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white">Attenzione sulle categorie a rischio</p>
                <p className="text-sm text-amber-100/70">
                  {alertCount > 0
                    ? `${alertCount} categorie hanno superato il budget mensile.`
                    : `${warningCount} categorie stanno entrando nella zona critica.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {alertCount > 0 && (
                  <Badge className="border border-rose-500/30 bg-rose-500/10 text-rose-400">
                    {alertCount} over
                  </Badge>
                )}
                {warningCount > 0 && (
                  <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    {warningCount} warning
                  </Badge>
                )}
              </div>
            </div>
          )}

          <BudgetTable mese={mese} data={varianceRows} isLoading={variance.isLoading} />
        </TabsContent>

        <TabsContent value="trend" className="m-0">
          <Card className="rounded-[32px] border border-border bg-card/70 shadow-2xl">
            <CardHeader className="flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-black text-white">
                  <LineChartIcon className="h-5 w-5 text-primary" />
                  Trend Budget vs Speso
                </CardTitle>
                <CardDescription className="mt-2 text-sm text-muted-foreground">
                  Ultimi 6 mesi per categoria, allineati al mese che stai osservando.
                </CardDescription>
              </div>

              <div className="w-full lg:w-[280px]">
                <Select value={selectedSeries?.categoria_id ?? ""} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger className="h-11 rounded-2xl bg-background/60">
                    <SelectValue placeholder="Seleziona categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {(trend.data?.series ?? []).map((serie) => (
                      <SelectItem key={serie.categoria_id} value={serie.categoria_id}>
                        {serie.categoria_nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-6">
              {trend.isLoading ? (
                <div className="h-[360px] animate-pulse rounded-[28px] bg-muted/20" />
              ) : !selectedSeries || trendChartData.length === 0 ? (
                <div className="flex h-[360px] items-center justify-center rounded-[28px] border border-dashed border-border bg-background/20 text-sm font-bold text-muted-foreground">
                  Nessun trend disponibile per la categoria selezionata.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <MiniMetric
                      title="Budget Ultimo Mese"
                      value={euro(Number(latestTrendPoint?.budget ?? 0))}
                      icon={<Target className="h-4 w-4 text-primary" />}
                    />
                    <MiniMetric
                      title="Speso Ultimo Mese"
                      value={euro(Number(latestTrendPoint?.speso ?? 0))}
                      icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
                    />
                    <MiniMetric
                      title="Varianza Ultimo Mese"
                      value={`${Number(latestTrendPoint?.varianza ?? 0) > 0 ? "+" : "-"}${euro(Math.abs(Number(latestTrendPoint?.varianza ?? 0)))}`}
                      icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
                    />
                  </div>

                  <div className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendChartData} margin={{ left: 8, right: 16, top: 20, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" />
                        <XAxis
                          dataKey="mese"
                          stroke="#94a3b8"
                          tickLine={false}
                          axisLine={false}
                          fontSize={11}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          tickLine={false}
                          axisLine={false}
                          fontSize={11}
                          tickFormatter={(value) => compactEuro(Number(value))}
                        />
                        <Tooltip
                          formatter={(value: any, name: any) => [euro(Number(value)), name === "budget" ? "Budget" : "Speso"]}
                          contentStyle={{
                            borderRadius: 18,
                            background: "rgba(15, 23, 42, 0.96)",
                            border: "1px solid rgba(148, 163, 184, 0.2)",
                          }}
                          labelStyle={{ color: "#e2e8f0", fontWeight: 800 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="budget"
                          name="budget"
                          stroke="#94a3b8"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="speso"
                          name="speso"
                          stroke={selectedSeries.categoria_colore}
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CategoryModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} />
    </div>
  );
}

function HighlightCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-500/20 bg-rose-500/10"
      : tone === "warning"
        ? "border-amber-500/20 bg-amber-500/10"
        : tone === "success"
          ? "border-emerald-500/20 bg-emerald-500/10"
          : "border-border bg-card/50";

  const valueClass =
    tone === "danger"
      ? "text-rose-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "success"
          ? "text-emerald-400"
          : "text-white";

  return (
    <div className={`rounded-[28px] border p-5 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className={`mt-3 text-4xl font-black ${valueClass}`}>{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function MiniMetric({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-background/30 p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {title}
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
