import React, { useRef, useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";

function useChartSize(height: number): [React.RefObject<HTMLDivElement>, number, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width, height];
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface CassaDashboardProps {
  movimenti: any[];
}

const COLORS = ["hsl(var(--primary))", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#ec4899"];

export function CassaDashboard({ movimenti }: CassaDashboardProps) {
  const [chart1Ref, chart1W, chart1H] = useChartSize(280);
  const [chart2Ref, chart2W, chart2H] = useChartSize(230);
  const chartData = React.useMemo(() => {
    // Raggruppa per data e calcola saldo progressivo
    const daily = movimenti.reduce((acc: any, m) => {
      const date = m.data_valuta;
      if (!acc[date]) acc[date] = 0;
      acc[date] += Number(m.importo);
      return acc;
    }, {});

    let balance = 0;
    return Object.keys(daily).sort().map(date => {
      balance += daily[date];
      return { date, balance, amount: daily[date] };
    });
  }, [movimenti]);

  const categoryData = React.useMemo(() => {
    const cats = movimenti.reduce((acc: any, m) => {
      const cat = m.categoria || "Altro";
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += Math.abs(Number(m.importo));
      return acc;
    }, {});

    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [movimenti]);

  const totalIn = movimenti.filter(m => Number(m.importo) > 0).reduce((acc, m) => acc + Number(m.importo), 0);
  const totalOut = movimenti.filter(m => Number(m.importo) < 0).reduce((acc, m) => acc + Math.abs(Number(m.importo)), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card/30 border-border/50 rounded-[2rem] overflow-hidden backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              Saldo Attuale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(totalIn - totalOut)}
            </div>
            <p className="text-[10px] font-bold text-[#475569] uppercase mt-1">Disponibilità liquida totale</p>
          </CardContent>
        </Card>

        <Card className="bg-card/30 border-border/50 rounded-[2rem] overflow-hidden backdrop-blur-xl transition-all hover:border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
              Entrate (Mese)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-500 tabular-nums tracking-tighter">
              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(totalIn)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/30 border-border/50 rounded-[2rem] overflow-hidden backdrop-blur-xl transition-all hover:border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
              <ArrowDownLeft className="h-3.5 w-3.5 text-red-500" />
              Uscite (Mese)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-red-500 tabular-nums tracking-tighter">
              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(totalOut)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card/30 border-border/50 rounded-[2rem] p-8 backdrop-blur-xl overflow-hidden relative">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-8 px-1">Andamento Cashflow</h3>
          <div ref={chart1Ref} style={{ width: '100%', height: '280px' }}>
            {chart1W > 0 && (
              <AreaChart width={chart1W} height={chart1H} data={chartData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#475569"
                  fontSize={10}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                />
                <YAxis stroke="#475569" fontSize={10} tickFormatter={(val) => `${val/1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="balance" stroke="#7c3aed" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            )}
          </div>
        </Card>

        <Card className="bg-card/30 border-border/50 rounded-[2rem] p-8 backdrop-blur-xl overflow-hidden">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-8 px-1">Analisi Categorie</h3>
          <div ref={chart2Ref} style={{ width: '100%', height: '230px' }}>
            {chart2W > 0 && (
              <PieChart width={chart2W} height={chart2H}>
                <Pie
                  data={categoryData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            )}
          </div>
          <div className="mt-4 space-y-2">
             {categoryData.slice(0, 4).map((c, i) => (
               <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{c.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-white tabular-nums">{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(c.value))}</span>
               </div>
             ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
