import React from 'react';
import { 
  Activity, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  ChevronUp,
  Timer,
  Euro
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const SmartIndicatorBar: React.FC = () => {
  // Fetch collective data for stats
  const { data: risorse = [] } = useQuery({
    queryKey: ['risorse'],
    queryFn: async () => {
      const res = await api.get('/risorse');
      return res.data;
    }
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['planning-tasks'],
    queryFn: async () => {
      const res = await api.get('/planning/tasks');
      return res.data;
    }
  });

  // Calculate some real-time metrics
  const totalCapacity = risorse.reduce((acc: number, r: any) => acc + Number(r.ore_settimanali), 0);
  const totalAssignedMinutes = tasks.reduce((acc: number, t: any) => acc + (t.stima_minuti || 0), 0);
  const totalAssignedHours = Math.round(totalAssignedMinutes / 60);
  const loadPercentage = totalCapacity > 0 ? Math.round((totalAssignedHours / totalCapacity) * 100) : 0;
  
  const pendingTasks = tasks.filter((t: any) => !t.assegnatario_id).length;
  const overloadedCount = risorse.filter((r: any) => {
    const userTasks = tasks.filter((t: any) => t.assegnatario_id === r.id);
    const userHours = userTasks.reduce((acc: number, t: any) => acc + (t.stima_minuti || 0), 0) / 60;
    return userHours > Number(r.ore_settimanali);
  }).length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-6 py-3 bg-background/80 backdrop-blur-2xl border-t border-border shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-full duration-1000">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-8">
        
        {/* Metric 1: Team Capacity */}
        <div className="flex items-center gap-6 group cursor-default">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#475569] flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-primary animate-pulse" />
                Carico Team
              </span>
              <span className={`text-[10px] font-black ${loadPercentage > 90 ? 'text-destructive' : 'text-primary'}`}>
                {loadPercentage}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={loadPercentage} className="h-1.5 w-32 bg-slate-800/50 [&>div]:bg-primary shadow-sm" />
              <div className="text-[10px] font-bold text-white whitespace-nowrap">
                {totalAssignedHours}h / {totalCapacity}h
              </div>
            </div>
          </div>
          
          <div className="h-8 w-[1px] bg-border mx-2" />
          
          {/* Metric 2: Pending Backlog */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#475569] flex items-center gap-1.5">
              <Timer className="h-3 w-3 text-amber-400" />
              Backlog
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">{pendingTasks}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Task in attesa</span>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-border mx-2" />

          {/* Metric 3: Resource Health */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#475569] flex items-center gap-1.5">
              <Users className="h-3 w-3 text-emerald-400" />
              Stato Risorse
            </span>
            <div className="flex items-center gap-2">
              {overloadedCount > 0 ? (
                <Badge variant="destructive" className="h-5 text-[9px] font-black bg-destructive/10 border-destructive/20 text-destructive uppercase tracking-widest px-1.5">
                  <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                  {overloadedCount} Sovraccarichi
                </Badge>
              ) : (
                <Badge className="h-5 text-[9px] font-black bg-emerald-500/10 border-emerald-500/20 text-emerald-500 uppercase tracking-widest px-1.5">
                  Ottimale
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Global Financial Indicator */}
        <div className="hidden lg:flex items-center gap-6">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#475569]">Budget Burn Rate</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-emerald-400 font-black text-xs">
                <ChevronUp className="h-3 w-3" />
                12.5%
              </div>
              <div className="text-sm font-black text-white flex items-center gap-1.5">
                <Euro className="h-3.5 w-3.5 text-primary" />
                €12,450.00
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5 text-slate-500">
            <TrendingUp className="h-4 w-4" />
          </Button>
        </div>

      </div>
    </div>
  );
};

export { SmartIndicatorBar };
export default SmartIndicatorBar;
