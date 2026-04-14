import React, { useState } from "react";
import { 
  Calculator, 
  Users, 
  TrendingUp, 
  Euro, 
  Clock, 
  ArrowRight,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function QuickCalculator() {
  // Simulator 1: Collaborator Cost
  const [collabHours, setCollabHours] = useState<number>(40);
  const [collabHourlyRate, setCollabHourlyRate] = useState<number>(25);
  const [overheads, setOverheads] = useState<number>(10); // in percentage

  // Simulator 2: Project Margin
  const [projectRevenue, setProjectRevenue] = useState<number>(5000);
  const [estimatedHours, setEstimatedHours] = useState<number>(100);
  const [avgHourlyCost, setAvgHourlyCost] = useState<number>(30);

  const totalCollabCost = collabHours * collabHourlyRate * (1 + overheads / 100);
  
  const estimatedTotalCost = estimatedHours * avgHourlyCost;
  const projectMarginEuro = projectRevenue - estimatedTotalCost;
  const projectMarginPct = projectRevenue > 0 ? (projectMarginEuro / projectRevenue) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {/* Collaborator Cost Calculator */}
      <Card className="bg-card/40 border-border/50 rounded-3xl overflow-hidden relative group hover:border-primary/30 transition-all">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/50 to-transparent" />
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Costo Collaboratore
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground mt-1">Stima lordo + costi gestione</CardDescription>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground/40 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="bg-popover border-border text-xs max-w-[200px]">
                  Calcola il costo totale di un collaboratore includendo la quota di costi fissi/gestione (overheads).
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Ore Lavorate</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  type="number" 
                  value={collabHours} 
                  onChange={(e) => setCollabHours(Number(e.target.value))}
                  className="pl-9 h-10 bg-background/50 border-border/50 text-xs font-bold focus-visible:ring-primary/30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Lordo Orario (€)</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  type="number" 
                  value={collabHourlyRate} 
                  onChange={(e) => setCollabHourlyRate(Number(e.target.value))}
                  className="pl-9 h-10 bg-background/50 border-border/50 text-xs font-bold focus-visible:ring-primary/30"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Costi Indiretti / Overheads (%)</Label>
              <Badge variant="outline" className="text-[10px] font-black border-primary/20 bg-primary/5 text-primary">
                {overheads}%
              </Badge>
            </div>
            <Input 
              type="range" 
              min="0" 
              max="50" 
              step="1"
              value={overheads} 
              onChange={(e) => setOverheads(Number(e.target.value))}
              className="h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
          
          <Separator className="bg-border/30 my-4" />
          
          <div className="flex items-end justify-between bg-primary/5 p-4 rounded-2xl border border-primary/10">
            <div>
              <p className="text-[9px] font-black uppercase text-primary tracking-widest mb-1">Costo Totale Stimato</p>
              <p className="text-2xl font-black text-white tracking-tighter">
                {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(totalCollabCost)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-bold text-muted-foreground uppercase">Quota Overheads</p>
              <p className="text-xs font-black text-primary/60">
                +{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(totalCollabCost - (collabHours * collabHourlyRate))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Margin Simulator */}
      <Card className="bg-card/40 border-border/50 rounded-3xl overflow-hidden relative group hover:border-[#ec4899]/30 transition-all">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#ec4899]/50 to-transparent" />
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#ec4899]" />
                Simulatore Margine
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground mt-1">Stima redditività progetto</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Fatturato Previsto (€)</Label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                type="number" 
                value={projectRevenue} 
                onChange={(e) => setProjectRevenue(Number(e.target.value))}
                className="pl-9 h-10 bg-background/50 border-border/50 text-xs font-bold focus-visible:ring-[#ec4899]/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Ore Marcare</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  type="number" 
                  value={estimatedHours} 
                  onChange={(e) => setEstimatedHours(Number(e.target.value))}
                  className="pl-9 h-10 bg-background/50 border-border/50 text-xs font-bold focus-visible:ring-[#ec4899]/30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Costo Orario Medio</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  type="number" 
                  value={avgHourlyCost} 
                  onChange={(e) => setAvgHourlyCost(Number(e.target.value))}
                  className="pl-9 h-10 bg-background/50 border-border/50 text-xs font-bold focus-visible:ring-[#ec4899]/30"
                />
              </div>
            </div>
          </div>

          <Separator className="bg-border/30 my-4" />
          
          <div className={`flex items-end justify-between ${projectMarginEuro > 0 ? 'bg-[#ec4899]/5 border-[#ec4899]/10' : 'bg-rose-500/5 border-rose-500/10'} p-4 rounded-2xl border transition-colors`}>
            <div>
              <p className="text-[9px] font-black uppercase text-[#ec4899] tracking-widest mb-1">Margine Stimato</p>
              <p className={`text-2xl font-black ${projectMarginEuro > 0 ? 'text-white' : 'text-rose-400'} tracking-tighter`}>
                {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(projectMarginEuro)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-bold text-muted-foreground uppercase">Margine %</p>
              <p className={`text-xs font-black ${projectMarginPct > 30 ? 'text-emerald-400' : projectMarginPct > 15 ? 'text-amber-400' : 'text-rose-400'}`}>
                {projectMarginPct.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
