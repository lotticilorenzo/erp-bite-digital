import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
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
  Filter,
  Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

const formatEuro = (val: number) => 
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);

export default function Analytics() {
  const { data: analytics, isLoading } = useAnalytics();

  if (isLoading || !analytics) {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 rounded-xl bg-[#1e293b]/20" />
          <Skeleton className="h-10 w-32 rounded-xl bg-[#1e293b]/20" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-3xl bg-[#1e293b]/10" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-3xl bg-[#1e293b]/5" />
          <Skeleton className="h-[400px] rounded-3xl bg-[#1e293b]/5" />
        </div>
      </div>
    );
  }

  const { kpis, revenueTrend, marginTrend, clientStats, scatterData, alerts } = analytics;

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
            Business <span className="text-primary not-italic">Intelligence</span>
          </h1>
          <p className="text-[#475569] text-xs font-bold uppercase tracking-[0.2em] mt-1">Analisi avanzata performance e marginalità</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 bg-[#0f172a]/50 border-[#1e293b] text-[#94a3b8] hover:text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest transition-all">
            <Filter className="h-4 w-4" />
            Anno Corrente
          </Button>
          <Button className="h-10 bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all">
            <Download className="h-4 w-4" />
            Esporta PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Fatturato YTD" 
          value={formatEuro(kpis.revenueYTD)} 
          icon={TrendingUp} 
          trend="+12.5%" 
          trendType="up"
          description="Totale anno corrente"
        />
        <KpiCard 
          title="Margine Medio" 
          value={`${kpis.marginYTD.toFixed(1)}%`} 
          icon={Target} 
          trend="+2.1%" 
          trendType="up"
          description="Media su tutte le commesse"
        />
        <KpiCard 
          title="Ore Lavorate" 
          value={`${Math.round(kpis.monthlyHours)}h`} 
          icon={Clock} 
          trend="-4%" 
          trendType="down"
          description="Efficienza mese corrente"
        />
        <KpiCard 
          title="Clienti Attivi" 
          value={kpis.activeClients.toString()} 
          icon={Users} 
          description="Partner con gestioni aperte"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Trend Chart */}
        <Card className="bg-[#0f172a] border-[#1e293b]/50 shadow-2xl rounded-3xl overflow-hidden hover:border-primary/20 transition-all group">
          <CardHeader className="border-b border-[#1e293b]/30 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-[#94a3b8]">Andamento Fatturato</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-[#475569]">Ultimi 12 mesi di competenza</CardDescription>
              </div>
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#475569" 
                  fontSize={10} 
                  fontWeight="bold" 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={10} 
                  fontWeight="bold" 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `€${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", fontSize: "12px" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "rgba(124, 58, 237, 0.05)" }}
                />
                <Bar dataKey="revenue" fill="#7c3aed" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Margin Trend Chart */}
        <Card className="bg-[#0f172a] border-[#1e293b]/50 shadow-2xl rounded-3xl overflow-hidden hover:border-primary/20 transition-all group">
          <CardHeader className="border-b border-[#1e293b]/30 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-[#94a3b8]">Stabilità Margine</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-[#475569]">Percentuale di profitto media</CardDescription>
              </div>
              <div className="p-2 rounded-xl bg-[#ec4899]/10 border border-[#ec4899]/20">
                <Target className="h-4 w-4 text-[#ec4899]" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#475569" 
                  fontSize={10} 
                  fontWeight="bold" 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={10} 
                  fontWeight="bold" 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                  domain={[0, 60]}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", fontSize: "12px" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="margin" 
                  stroke="#7c3aed" 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: "#7c3aed", strokeWidth: 2, stroke: "#0f172a" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Clients */}
        <Card className="bg-[#0f172a] border-[#1e293b]/50 shadow-2xl rounded-3xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-white">Top 5 Clienti</CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-[#475569]">Per volume di fatturato totale</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {clientStats.map((cl) => (
              <div key={cl.name} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-white truncate max-w-[150px]">{cl.name}</span>
                  <span className="text-primary">{formatEuro(cl.revenue)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={(cl.revenue / clientStats[0].revenue) * 100} className="h-1.5 flex-1" />
                  <span className={`text-[10px] font-black flex items-center gap-0.5 ${cl.delta > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {cl.delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(cl.delta).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Efficiency Chart */}
        <Card className="lg:col-span-2 bg-[#0f172a] border-[#1e293b]/50 shadow-2xl rounded-3xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-white">Efficienza Operativa</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-[#475569]">Fatturato vs Ore Lavorate per Cliente</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" /> Profittevole
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-rose-500" /> Critico
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis 
                  type="number" 
                  dataKey="hours" 
                  name="Ore" 
                  unit="h" 
                  stroke="#475569" 
                  fontSize={10} 
                  fontWeight="bold" 
                />
                <YAxis 
                  type="number" 
                  dataKey="revenue" 
                  name="Fatturato" 
                  unit="€" 
                  stroke="#475569" 
                  fontSize={10} 
                  fontWeight="bold" 
                />
                <ZAxis type="number" range={[100, 1000]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", fontSize: "12px" }} />
                <Scatter name="Clienti" data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.profitability > 50 ? "#10b981" : "#ef4444"} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Critical Items */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Critical Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert) => (
            <div key={alert.title} className="flex items-center gap-4 p-4 rounded-2xl bg-[#1e293b]/20 border border-[#1e293b] hover:border-primary/30 transition-all cursor-pointer group">
              <div className={`p-3 rounded-xl ${alert.severity === "high" ? "bg-rose-500/10 text-rose-500" : "bg-orange-500/10 text-orange-500"}`}>
                {alert.type === "MARGIN" ? <ArrowDownRight className="h-5 w-5" /> : 
                 alert.type === "INVOICE" ? <AlertTriangle className="h-5 w-5" /> : 
                 <Clock className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-[#475569] uppercase tracking-widest">{alert.type}</p>
                <p className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">{alert.title}</p>
              </div>
              <span className="text-sm font-black text-white">{alert.value}</span>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center gap-3 bg-[#0f172a]/40 rounded-3xl border-2 border-dashed border-[#1e293b]">
              <div className="p-4 rounded-full bg-emerald-500/10">
                <Users className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-xs font-black uppercase text-[#475569] tracking-widest text-center">Nessun alert critico identificato.<br/><span className="text-emerald-500">Operatività ottimale.</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, trend, trendType, description }: any) {
  return (
    <Card className="bg-[#0f172a] border-[#1e293b]/50 shadow-2xl rounded-3xl p-6 hover:border-primary/30 transition-all group overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
        <Icon size={120} />
      </div>
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Icon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
          </div>
          {trend && (
            <div className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 ${trendType === "up" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
              {trendType === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend}
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase font-black tracking-widest text-[#475569] mb-1">{title}</p>
          <p className="text-2xl font-black text-white tracking-tighter">{value}</p>
          <p className="text-[10px] font-bold text-[#475569] mt-2 group-hover:text-[#94a3b8] transition-colors">{description}</p>
        </div>
      </div>
    </Card>
  );
}
