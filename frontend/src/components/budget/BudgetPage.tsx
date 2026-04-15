import React, { useState, useEffect, useRef } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  PieChart as PieChartIcon,
  TrendingUp,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useBudget } from "@/hooks/useBudget";
import { BudgetTable } from "./BudgetTable";
import { CategoryModal } from "./CategoryModal";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { toast } from "sonner";

function useChartSize(height: number): [React.RefObject<HTMLDivElement>, number, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w, height];
}

export default function BudgetPage() {
  const [chart1Ref, chart1W, chart1H] = useChartSize(262);
  const [chart2Ref, chart2W, chart2H] = useChartSize(262);
  const [mese, setMese] = useState(new Date());
  const { consuntivo, copyBudget } = useBudget(mese);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const prevMonth = () => setMese(subMonths(mese, 1));
  const nextMonth = () => setMese(addMonths(mese, 1));

  const handleCopy = async () => {
    try {
      const res = await copyBudget.mutateAsync(format(mese, "yyyy-MM-01"));
      toast.success(`Copiati ${res.clonati} budget dal mese precedente`);
    } catch (error) {
      toast.error("Errore durante la copia dei budget");
    }
  };

  const chartData = consuntivo.data?.map(item => ({
    name: item.categoria_nome,
    value: parseFloat(item.importo_speso.toString()),
    color: item.categoria_colore
  })).filter(i => i.value > 0) || [];

  const barData = consuntivo.data?.map(item => ({
    name: item.categoria_nome,
    budget: parseFloat(item.importo_budget.toString()),
    speso: parseFloat(item.importo_speso.toString())
  })) || [];

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 min-h-screen bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left">
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-xl shadow-primary/5">
              <Target size={32} strokeWidth={3} />
            </div>
            Budget Mensile
          </h1>
          <p className="text-muted-foreground font-medium text-lg ml-1">
            Pianificazione e monitoraggio spese operative
          </p>
        </div>

        <div className="flex items-center gap-3 bg-card border border-border p-2 rounded-2xl shadow-lg">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-xl hover:bg-muted text-white">
            <ChevronLeft size={20} />
          </Button>
          <div className="flex flex-col items-center px-4 w-40">
            <span className="text-sm font-black uppercase tracking-widest text-primary leading-tight">
              {format(mese, "yyyy", { locale: it })}
            </span>
            <span className="text-xl font-bold tracking-tight text-white capitalize">
              {format(mese, "MMMM", { locale: it })}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-xl hover:bg-muted text-white">
            <ChevronRight size={20} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleCopy}
            className="rounded-xl font-bold border-border bg-card hover:bg-muted h-12 px-6 gap-2"
          >
            <Copy size={18} />
            Copia Mese Prec.
          </Button>
          <Button 
            onClick={() => setIsCategoryModalOpen(true)}
            className="rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all h-12 px-6 gap-2"
          >
            <Plus size={18} strokeWidth={3} />
            Nuova Categoria
          </Button>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-2xl">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <PieChartIcon size={20} className="text-primary" />
              Distribuzione Spese Effettive
            </CardTitle>
            <CardDescription className="font-medium">Raggruppamento per categoria di costo</CardDescription>
          </CardHeader>
          <CardContent className="p-6 h-[300px]">
            {chartData.length > 0 ? (
              <div ref={chart1Ref} style={{ width: '100%', height: '262px' }}>
                {chart1W > 0 && (
                  <PieChart width={chart1W} height={chart1H}>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={80} outerRadius={100} paddingAngle={5} dataKey="value">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '15px', border: '1px solid #333', background: '#111' }} itemStyle={{ fontWeight: 'bold' }} />
                    <Legend />
                  </PieChart>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-bold uppercase tracking-widest bg-muted/10 rounded-2xl">
                Nessun dato per il grafico
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-3xl overflow-hidden shadow-2xl">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              Budget vs Speso
            </CardTitle>
            <CardDescription className="font-medium">Confronto per categoria</CardDescription>
          </CardHeader>
          <CardContent className="p-6 h-[300px]">
          {barData.length > 0 ? (
            <div ref={chart2Ref} style={{ width: '100%', height: '262px' }}>
              {chart2W > 0 && (
                <BarChart width={chart2W} height={chart2H} data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}€`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ borderRadius: '15px', border: '1px solid #333', background: '#111' }} />
                  <Legend />
                  <Bar dataKey="budget" fill="#64748b" radius={[4, 4, 0, 0]} name="Pianificato" />
                  <Bar dataKey="speso" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Reale" />
                </BarChart>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-bold uppercase tracking-widest bg-muted/10 rounded-2xl">
               Inizia a inserire i budget
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      {/* Table Section */}
      <BudgetTable 
        mese={mese} 
        data={consuntivo.data || []} 
        isLoading={consuntivo.isLoading} 
      />

      {/* Modals */}
      <CategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => setIsCategoryModalOpen(false)} 
      />
    </div>
  );
}
