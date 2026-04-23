import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardKpiCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  color?: string;
  loading?: boolean;
  trend?: string;
  trendType?: "up" | "down" | "stable";
  deltaRel?: number;
  onClick?: () => void;
}

export function DashboardKpiCard({ 
  label, 
  value, 
  subValue, 
  icon: Icon, 
  color = "text-primary",
  loading = false,
  trend,
  trendType,
  deltaRel,
  onClick
}: DashboardKpiCardProps) {
  return (
    <Card 
      onClick={onClick}
      className={cn(
        "app-panel overflow-hidden group relative transition-all duration-500",
        onClick ? "cursor-pointer active:scale-[0.98] hover:border-primary/25 hover:shadow-[0_18px_45px_-28px_hsl(var(--primary)/0.45)]" : "hover:border-border"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 pt-5 px-5">
        <CardTitle className="app-kicker group-hover:text-muted-strong transition-colors">
          {label}
        </CardTitle>
        {Icon && (
          <div className="rounded-2xl border border-border bg-accent/60 p-2.5 shadow-inner transition-all duration-500 group-hover:border-primary/20 group-hover:bg-primary/10">
            <Icon className={cn("h-4 w-4", color, "group-hover:scale-110 transition-transform duration-500")} />
          </div>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-1">
        <div className="flex flex-col gap-1">
          <div className="relative">
            <div className="absolute -left-4 top-0 w-12 h-12 bg-primary/10 blur-[30px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10 text-2xl font-black tracking-tighter text-foreground">
              {loading ? (
                <div className="flex flex-col gap-2 py-1">
                  <div className="h-8 w-24 animate-pulse rounded-lg bg-white/5" />
                </div>
              ) : (
                value
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between min-h-[1.25rem]">
            {loading ? (
              <div className="h-3 w-32 animate-pulse rounded bg-muted/40" />
            ) : subValue && (
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-strong">
                {subValue}
              </div>
            )}
            
            {(trend || deltaRel !== undefined) && (
              <div className="flex items-center gap-2">
                {trend && (
                  <div className={cn(
                    "px-1.5 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-0.5",
                    trendType === "up" ? "bg-emerald-500/10 text-emerald-500" : 
                    trendType === "down" ? "bg-rose-500/10 text-rose-500" : 
                    "bg-muted text-faint"
                  )}>
                    {trendType === "up" ? <ArrowUpRight className="h-2.5 w-2.5" /> : 
                     trendType === "down" ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
                    {trend}
                  </div>
                )}
                {deltaRel !== undefined && (
                  <span className={cn(
                    "text-[9px] font-black",
                    deltaRel >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {deltaRel >= 0 ? "↑" : "↓"} {Math.abs(deltaRel).toFixed(0)}% avg
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      {/* Interaction decoration */}
      <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-primary group-hover:w-full transition-all duration-700 ease-out" />
    </Card>
  );
}
