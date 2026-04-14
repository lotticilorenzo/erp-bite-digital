import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calculator, 
  Users, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  ArrowRight,
  Info,
  RefreshCcw,
  Percent
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useRisorse } from "@/hooks/useRisorse";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export function CollaboratorCostCalculator() {
  const { data: risorse, isLoading } = useRisorse();
  const [selectedRisorsaId, setSelectedRisorsaId] = useState<string>("");
  const [hours, setHours] = useState<number>(8);
  const [margin, setMargin] = useState<number>(30);
  const [customHourlyRate, setCustomHourlyRate] = useState<number>(50);

  const selectedRisorsa = useMemo(() => 
    risorse?.find(r => r.id === selectedRisorsaId), 
    [risorse, selectedRisorsaId]
  );

  const hourlyRate = selectedRisorsa ? selectedRisorsa.costo_orario_effettivo : customHourlyRate;
  
  const results = useMemo(() => {
    const cost = hourlyRate * hours;
    const price = cost / (1 - margin / 100);
    const profit = price - cost;
    
    return {
      totalCost: cost,
      suggestedPrice: price,
      profit: profit,
      hourlyRate
    };
  }, [hourlyRate, hours, margin]);

  const handleReset = () => {
    setSelectedRisorsaId("");
    setHours(8);
    setMargin(30);
    setCustomHourlyRate(50);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);

  return (
    <Card className="border-none bg-gradient-to-br from-background/40 to-background/10 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
      {/* Decorative gradients */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-500" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors duration-500" />
      
      <CardHeader className="relative z-10 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Calculator className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Price & Margin Calculator</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground/80">
              Calcola il preventivo ideale basato sul costo reale dei tuoi collaboratori.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={handleReset} className="hover:bg-white/5">
            <RefreshCcw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Input Section */}
          <div className="space-y-8">
            <div className="space-y-4">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Collaboratore
              </Label>
              <Select value={selectedRisorsaId} onValueChange={setSelectedRisorsaId}>
                <SelectTrigger className="h-12 bg-white/5 border-white/10 text-lg">
                  <SelectValue placeholder="Seleziona un collaboratore..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="manual" className="cursor-pointer">Rate Manuale</SelectItem>
                  {risorse?.filter(r => r.attivo).map(r => (
                    <SelectItem key={r.id} value={r.id} className="cursor-pointer">
                      {r.nome} {r.cognome} <span className="text-xs text-muted-foreground ml-2">({r.ruolo})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(!selectedRisorsaId || selectedRisorsaId === "manual") && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-4"
              >
                <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Costo Orario Lordo (€/h)
                </Label>
                <div className="flex gap-4 items-center">
                  <Input 
                    type="number" 
                    value={customHourlyRate} 
                    onChange={(e) => setCustomHourlyRate(Number(e.target.value))}
                    className="h-12 bg-white/5 border-white/10 text-xl font-medium"
                  />
                  <span className="text-muted-foreground">€/ora</span>
                </div>
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Ore Stimate
                </Label>
                <span className="text-xl font-bold text-primary">{hours}h</span>
              </div>
              <Slider 
                value={[hours]} 
                onValueChange={([val]: number[]) => setHours(val)} 
                max={200} 
                step={0.5}
                className="py-4"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Margine Desiderato (%)
                </Label>
                <Badge variant={margin >= 30 ? "default" : "secondary"} className={`text-sm ${margin >= 30 ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}>
                  {margin >= 30 ? "Alta Redditività" : "Margine Standard"}
                </Badge>
              </div>
              <div className="flex gap-6 items-center">
                <Slider 
                  value={[margin]} 
                  onValueChange={([val]: number[]) => setMargin(val)} 
                  max={90} 
                  min={1} 
                  step={1}
                  className="flex-1 py-4"
                />
                <div className="w-20 relative">
                  <Input 
                    type="number" 
                    value={margin} 
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="h-10 bg-white/5 border-white/10 text-right pr-6 font-bold"
                  />
                  <Percent className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div 
                key={`${selectedRisorsaId}-${hours}-${margin}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="p-8 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden group/result">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/result:opacity-20 transition-opacity">
                    <TrendingUp className="w-24 h-24" />
                  </div>
                  
                  <div className="space-y-6 relative z-10">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest mb-1">Prezzo Suggerito</p>
                      <h2 className="text-6xl font-black text-white tracking-tighter">
                        {formatCurrency(results.suggestedPrice)}
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 p-4 rounded-2xl bg-white/5 border border-white/5">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Costo Totale</p>
                        <p className="text-xl font-bold text-rose-400">{formatCurrency(results.totalCost)}</p>
                      </div>
                      <div className="space-y-1 p-4 rounded-2xl bg-white/5 border border-white/5">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Utile Previsto</p>
                        <p className="text-xl font-bold text-emerald-400">+{formatCurrency(results.profit)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors">
                            <Info className="w-4 h-4" /> 
                            <span>Logic Details</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs space-y-2 p-4">
                            <p className="font-bold">Come calcoliamo i costi?</p>
                            <p className="text-xs opacity-80">
                              Il costo orario utilizzato ({formatCurrency(results.hourlyRate)}/h) include RAL, contributi INPS/INAIL, TFR e una quota overhead del 30% per i costi di struttura.
                            </p>
                            <p className="text-xs opacity-80 pt-2 border-t border-white/10">
                              Formula: <code className="bg-white/10 p-0.5 rounded">Costo / (1 - Margine%)</code>
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <Badge className="bg-amber-500/20 text-amber-500 border-none">Pro Tip</Badge>
                  <p className="text-sm text-amber-200/80 leading-relaxed italic">
                    Per questo tipo di {selectedRisorsa?.ruolo || "lavoro"}, un margine del 35% è consigliato per coprire imprevisti e variazioni di scope.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
