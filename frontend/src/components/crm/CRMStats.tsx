import { BarChart3, Target, TrendingUp, Users } from "lucide-react";
import type { CRMStats as CRMStatsType } from "@/types/crm";

export function CRMStats({ stats }: { stats: CRMStatsType }) {
  const cards = [
    {
      label: "Valore Pipeline",
      value: `€${stats.valore_totale_pipeline.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      label: "Lead Attivi",
      value: stats.numero_lead_attivi.toString(),
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      label: "Conversione Media",
      value: `${stats.tasso_conversione}%`,
      icon: Target,
      color: "text-primary",
      bg: "bg-primary/10"
    },
    {
      label: "Valore Ponderato",
      value: `€${stats.previsione_ricavi.toLocaleString()}`,
      icon: BarChart3,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
      {cards.map((card, i) => (
        <div key={i} className="bg-card/40 border border-white/5 p-6 rounded-[32px] backdrop-blur-xl group hover:border-primary/30 transition-all shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className={`h-14 w-14 rounded-2xl ${card.bg} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform border border-white/5 shadow-inner`}>
              <card.icon className={`h-7 w-7 ${card.color}`} />
            </div>
          </div>

          <div className="relative z-10">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">{card.label}</div>
            <div className="text-3xl font-black text-white tabular-nums tracking-tighter group-hover:text-primary transition-colors">{card.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
