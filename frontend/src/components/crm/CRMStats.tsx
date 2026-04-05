import { BarChart3, Target, TrendingUp, Users } from "lucide-react";
import type { CRMStats as CRMStatsType } from "@/types/crm";

export function CRMStats({ stats }: { stats: CRMStatsType }) {
  const cards = [
    {
      label: "Valore Pipeline",
      value: `€${stats.valore_totale.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      label: "Lead Attivi",
      value: stats.count_totale.toString(),
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      label: "Conversione Media",
      value: `${stats.probabilita_media}%`,
      icon: Target,
      color: "text-primary",
      bg: "bg-primary/10"
    },
    {
      label: "Valore Ponderato",
      value: `€${stats.valore_ponderato.toLocaleString()}`,
      icon: BarChart3,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
      {cards.map((card, i) => (
        <div key={i} className="bg-card/40 border border-white/5 p-6 rounded-3xl backdrop-blur-sm group hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className={`h-12 w-12 rounded-2xl ${card.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <div className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-1">{card.label}</div>
            <div className="text-2xl font-black text-white tabular-nums">{card.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
