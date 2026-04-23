import React from "react";
import { Activity, TrendingUp, Users, AlertTriangle, ChevronUp, Timer, Euro } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SmartIndicatorBar: React.FC = () => {
  const { data: risorse = [] } = useQuery({
    queryKey: ["risorse"],
    queryFn: async () => {
      const response = await api.get("/risorse");
      return response.data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["planning-tasks"],
    queryFn: async () => {
      const response = await api.get("/planning/tasks");
      return response.data;
    },
  });

  const totalCapacity = risorse.reduce((acc: number, resource: any) => acc + Number(resource.ore_settimanali), 0);
  const totalAssignedMinutes = tasks.reduce((acc: number, task: any) => acc + (task.stima_minuti || 0), 0);
  const totalAssignedHours = Math.round(totalAssignedMinutes / 60);
  const loadPercentage = totalCapacity > 0 ? Math.round((totalAssignedHours / totalCapacity) * 100) : 0;

  const pendingTasks = tasks.filter((task: any) => !task.assegnatario_id).length;
  const overloadedCount = risorse.filter((resource: any) => {
    const userTasks = tasks.filter((task: any) => task.assegnatario_id === resource.id);
    const userHours = userTasks.reduce((acc: number, task: any) => acc + (task.stima_minuti || 0), 0) / 60;
    return userHours > Number(resource.ore_settimanali);
  }).length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/90 bg-background/95 px-6 py-3 shadow-[0_-18px_48px_-24px_hsl(var(--shadow-color)/0.75)] backdrop-blur-2xl animate-in slide-in-from-bottom-full duration-1000">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-8">
        <div className="group flex cursor-default items-center gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-faint">
                <Activity className="h-3 w-3 animate-pulse text-primary" />
                Carico Team
              </span>
              <span
                className={`text-[10px] font-black ${
                  loadPercentage > 90 ? "text-destructive" : "text-primary"
                }`}
              >
                {loadPercentage}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={loadPercentage} className="h-1.5 w-32 bg-muted/70 [&>div]:bg-primary shadow-sm" />
              <div className="whitespace-nowrap text-[10px] font-bold text-foreground">
                {totalAssignedHours}h / {totalCapacity}h
              </div>
            </div>
          </div>

          <div className="mx-2 h-8 w-[1px] bg-border" />

          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-faint">
              <Timer className="h-3 w-3 text-amber-400" />
              Backlog
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-foreground">{pendingTasks}</span>
              <span className="text-[10px] font-bold uppercase text-muted-strong">Task in attesa</span>
            </div>
          </div>

          <div className="mx-2 h-8 w-[1px] bg-border" />

          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-faint">
              <Users className="h-3 w-3 text-emerald-400" />
              Stato Risorse
            </span>
            <div className="flex items-center gap-2">
              {overloadedCount > 0 ? (
                <Badge
                  variant="destructive"
                  className="h-5 border-destructive/20 bg-destructive/10 px-1.5 text-[9px] font-black uppercase tracking-widest text-destructive"
                >
                  <AlertTriangle className="mr-1 h-2.5 w-2.5" />
                  {overloadedCount} Sovraccarichi
                </Badge>
              ) : (
                <Badge className="h-5 border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-500">
                  Ottimale
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-6 lg:flex">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-faint">
              Budget Burn Rate
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs font-black text-emerald-400">
                <ChevronUp className="h-3 w-3" />
                12.5%
              </div>
              <div className="flex items-center gap-1.5 text-sm font-black text-foreground">
                <Euro className="h-3.5 w-3.5 text-primary" />
                EUR 12,450.00
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-faint hover:bg-accent hover:text-foreground"
          >
            <TrendingUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export { SmartIndicatorBar };
export default SmartIndicatorBar;
