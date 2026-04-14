import React, { useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreatePianificazione, useUpdatePianificazione } from "@/hooks/usePianificazioni";
import { useClienti } from "@/hooks/useClienti";
import { useUsers } from "@/hooks/useUsers";
import type { Pianificazione } from "@/types";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Target, 
  Euro, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Info,
  Calculator
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const planningSchema = z.object({
  cliente_id: z.string().min(1, "Cliente obbligatorio"),
  budget: z.coerce.number().min(1, "Il budget deve essere maggiore di zero"),
  note: z.string().optional().default(""),
  stato: z.enum(["PENDING", "ACCEPTED", "CONVERTED"]).default("PENDING"),
  lavorazioni: z.array(z.object({
    tipo_lavorazione: z.string().min(1, "Obbligatorio"),
    user_id: z.string().min(1, "Obbligatorio"),
    ore_previste: z.coerce.number().min(0.5, "Min 0.5h"),
  })).default([]),
});

type PlanningFormValues = z.infer<typeof planningSchema>;

interface PlanningDialogProps {
  plan?: Pianificazione | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlanningDialog({
  plan,
  open,
  onOpenChange,
}: PlanningDialogProps) {
  const { data: clienti } = useClienti();
  const { data: users = [] } = useUsers(true);
  const createPlan = useCreatePianificazione();
  const updatePlan = useUpdatePianificazione();
  const isEditing = !!plan;

  const form = useForm<PlanningFormValues>({
    resolver: zodResolver(planningSchema) as any,
    defaultValues: {
      cliente_id: "",
      budget: 0,
      note: "",
      stato: "PENDING",
      lavorazioni: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lavorazioni"
  });

  // Keep form in sync when 'plan' prop changes
  React.useEffect(() => {
    if (plan) {
      form.reset({
        cliente_id: plan.cliente_id,
        budget: plan.budget,
        note: plan.note || "",
        stato: plan.stato,
        lavorazioni: plan.lavorazioni.map(l => ({
          tipo_lavorazione: l.tipo_lavorazione,
          user_id: l.user_id,
          ore_previste: l.ore_previste,
        })),
      });
    } else {
      form.reset({
        cliente_id: "",
        budget: 0,
        note: "",
        stato: "PENDING",
        lavorazioni: [],
      });
    }
  }, [plan, form]);

  // Live Calculation Logic
  const watchedValues = useWatch({ control: form.control });
  const budget = watchedValues.budget || 0;
  const lavorazioni = watchedValues.lavorazioni || [];

  const metrics = useMemo(() => {
    let totCosti = 0;
    lavorazioni.forEach(lav => {
      if (!lav || !lav.user_id) return;
      const user = users.find(u => u.id === lav.user_id);
      const rate = user?.costo_orario || 0;
      totCosti += (lav.ore_previste || 0) * rate;
    });

    const margineEuro = budget - totCosti;
    const marginePct = budget > 0 ? (margineEuro / budget) * 100 : 0;

    return {
      totCosti,
      margineEuro,
      marginePct
    };
  }, [budget, lavorazioni, users]);

  const onSubmit = async (values: PlanningFormValues) => {
    try {
      if (isEditing && plan) {
        await updatePlan.mutateAsync({ id: plan.id, data: values });
      } else {
        await createPlan.mutateAsync(values);
      }
      onOpenChange(false);
    } catch (error) {
      // toast is handled in hooks
    }
  };

  const isPending = createPlan.isPending || updatePlan.isPending;

  // UI Helpers
  const getMarginColor = (pct: number) => {
    if (pct >= 50) return "text-emerald-400";
    if (pct >= 30) return "text-amber-400";
    return "text-red-400";
  };

  const getMarginBg = (pct: number) => {
    if (pct >= 50) return "bg-emerald-500";
    if (pct >= 30) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-card border-border text-white overflow-hidden p-0">
        {/* Animated Background Header Blur */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none" />

        <div className="p-6 space-y-6 relative">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-2">
                <Calculator className="w-6 h-6 text-purple-400" />
                {isEditing ? "Modifica Pianificazione" : "Preventivatore Studio OS"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-bold">Analisi Finanziaria Preventiva</p>
            </div>
            
            <div className="text-right">
               <div className={`text-3xl font-black tracking-tighter ${getMarginColor(metrics.marginePct)} transition-colors duration-500`}>
                 {metrics.marginePct.toFixed(1)}%
               </div>
               <div className="text-[9px] text-muted-foreground uppercase font-black">Margine Stimato</div>
            </div>
          </DialogHeader>

          {/* Real-time Dashboard */}
          <div className="grid grid-cols-3 gap-4 p-4 rounded-2xl bg-muted/30 border border-white/5 shadow-inner">
             <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-bold uppercase">
                  <Euro className="w-3 h-3" /> Budget
                </div>
                <div className="text-xl font-bold text-white">€{budget.toLocaleString()}</div>
             </div>
             <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-bold uppercase">
                  <TrendingDown className="w-3 h-3" /> Costi Personale
                </div>
                <div className="text-xl font-bold text-red-100/80">€{metrics.totCosti.toLocaleString()}</div>
             </div>
             <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-bold uppercase">
                  <Target className="w-3 h-3" /> Margine Netto
                </div>
                <div className={`text-xl font-bold ${getMarginColor(metrics.marginePct)}`}>€{metrics.margineEuro.toLocaleString()}</div>
             </div>
             
             <div className="col-span-3 pt-2">
                <Progress value={Math.min(100, Math.max(0, metrics.marginePct))} className={`h-1.5 ${getMarginBg(metrics.marginePct)} bg-muted`} />
             </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control as any}
                  name="cliente_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase text-muted-foreground">Cliente</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted border-border text-white h-11 rounded-xl">
                            <SelectValue placeholder="Seleziona un cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border-border text-white">
                          {clienti?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.ragione_sociale}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase text-muted-foreground">Valore Preventivo (€)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          className="bg-muted border-border text-white h-11 rounded-xl font-bold text-lg" 
                          placeholder="es. 1500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Lavorazioni Section */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between border-b border-border pb-2">
                   <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                     <Clock className="w-4 h-4 text-purple-400" />
                     Task & Figure Coinvolte
                   </h3>
                   <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => append({ tipo_lavorazione: "", user_id: "", ore_previste: 1 })}
                    className="h-8 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-white rounded-lg font-bold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Aggiungi Figura
                  </Button>
                 </div>

                 <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                    {fields.map((field, index) => {
                      const selectedUserId = lavorazioni[index]?.user_id;
                      const user = users.find(u => u.id === selectedUserId);
                      const costSnapshot = user?.costo_orario || 0;
                      const lineCost = (lavorazioni[index]?.ore_previste || 0) * costSnapshot;

                      return (
                        <div key={field.id} className="p-4 rounded-2xl bg-muted/40 border border-white/5 grid grid-cols-12 gap-4 items-end relative group hover:bg-muted/60 transition-colors">
                           <div className="col-span-4">
                              <label className="text-[9px] uppercase font-black text-muted-foreground mb-1.5 block">Tipo Lavorazione</label>
                              <Select 
                                onValueChange={(val) => form.setValue(`lavorazioni.${index}.tipo_lavorazione` as any, val)} 
                                value={lavorazioni[index]?.tipo_lavorazione || ""}
                              >
                                <SelectTrigger className="h-9 bg-card border-border text-xs rounded-lg">
                                   <SelectValue placeholder="Tipo di task..." />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-white">
                                  <SelectItem value="Scripting">Scripting</SelectItem>
                                  <SelectItem value="Montaggio Video">Montaggio Video</SelectItem>
                                  <SelectItem value="Copywriting">Copywriting</SelectItem>
                                  <SelectItem value="Strategia">Strategia</SelectItem>
                                  <SelectItem value="Gestione Social">Gestione Social</SelectItem>
                                  <SelectItem value="Graphic Design">Graphic Design</SelectItem>
                                  <SelectItem value="Altro">Altro...</SelectItem>
                                </SelectContent>
                              </Select>
                           </div>
                           
                           <div className="col-span-4">
                             <label className="text-[9px] uppercase font-black text-muted-foreground mb-1.5 block">Collaboratore</label>
                             <Select 
                              onValueChange={(val) => form.setValue(`lavorazioni.${index}.user_id` as any, val)} 
                              value={lavorazioni[index]?.user_id || ""}
                             >
                                <SelectTrigger className="h-9 bg-card border-border text-xs rounded-lg">
                                   <SelectValue placeholder="Chi farà il lavoro?" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-white">
                                  {users.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                                  ))}
                                </SelectContent>
                             </Select>
                           </div>

                           <div className="col-span-2">
                              <label className="text-[9px] uppercase font-black text-muted-foreground mb-1.5 block">Ore</label>
                              <Input 
                                type="number"
                                step="0.5"
                                {...form.register(`lavorazioni.${index}.ore_previste` as const)}
                                className="h-9 bg-card border-border text-xs rounded-lg text-center font-bold"
                              />
                           </div>

                           <div className="col-span-2 text-right">
                              <div className="text-[9px] uppercase font-black text-muted-foreground mb-1.5">Costo</div>
                              <div className="h-9 flex items-center justify-end font-bold text-red-200/50 text-xs">
                                €{lineCost.toLocaleString()}
                              </div>
                           </div>

                           <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => remove(index)}
                              className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                           </Button>
                        </div>
                      );
                    })}

                    {fields.length === 0 && (
                      <div className="py-10 text-center border border-dashed border-border rounded-2xl">
                         <Info className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                         <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/50">Inserisci le figure per calcolare i costi</p>
                      </div>
                    )}
                 </div>
              </div>

              <FormField
                control={form.control as any}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase text-muted-foreground">Brief / Note Interne</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        className="bg-muted border-border text-white min-h-[80px] rounded-xl resize-none" 
                        placeholder="Dettagli sulla negoziazione o vincoli particolari..." 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white">
                  Chiudi
                </Button>
                <Button 
                  type="submit" 
                  disabled={isPending} 
                  className="bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-xs px-8 shadow-[0_0_20px_hsl(var(--purple-600)/0.3)]"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? "Salva Aggiornamenti" : "Salva Pianificazione")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

