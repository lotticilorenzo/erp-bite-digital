import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateTimesheetManual, useUpdateTimesheetManual } from "@/hooks/useTimesheet";
import { useCommesse } from "@/hooks/useCommesse";
import { useTasks } from "@/hooks/useTasks";
import { Loader2, Calendar, Edit2, Plus, Briefcase, CheckSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useEffect } from "react";
import type { Timesheet } from "@/types";

const timesheetSchema = z.object({
  commessa_id: z.string().min(1, "Devi selezionare obbligatoriamente un Progetto/Commessa per tracciare i costi"),
  task_id: z.any().optional(),
  servizio: z.any().optional(),
  durata_ore: z.any(),
  durata_minuti: z.any(),
  data_attivita: z.any(),
  note: z.any().optional(),
});

type TimesheetFormValues = z.infer<typeof timesheetSchema>;

interface TimesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timesheet?: Timesheet;
  initialDate?: Date;
  isDuplicate?: boolean;
}

export function TimesheetDialog({ open, onOpenChange, timesheet, initialDate, isDuplicate }: TimesheetDialogProps) {
  const createMutation = useCreateTimesheetManual();
  const updateMutation = useUpdateTimesheetManual();
  
  const { data: commesse, isLoading: loadingCommesse } = useCommesse();

  const form = useForm<TimesheetFormValues>({
    resolver: zodResolver(timesheetSchema) as any,
    defaultValues: {
      commessa_id: "",
      task_id: "",
      servizio: "Sviluppo",
      durata_ore: "0",
      durata_minuti: "30",
      data_attivita: format(new Date(), "yyyy-MM-dd"),
      note: "",
    },
  });

  const selectedCommessaId = form.watch("commessa_id");
  const { data: tasks, isLoading: loadingTasks } = useTasks(
    { commessa_id: selectedCommessaId, parent_only: false }
  );

  useEffect(() => {
    if (timesheet && open) {
      form.reset({
        commessa_id: timesheet.commessa_id || "", 
        task_id: timesheet.task_id || "", 
        servizio: timesheet.servizio || "Sviluppo",
        durata_ore: Math.floor((timesheet.durata_minuti || 0) / 60).toString(),
        durata_minuti: ((timesheet.durata_minuti || 0) % 60).toString(),
        data_attivita: timesheet.data_attivita ? format(parseISO(timesheet.data_attivita), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        note: timesheet.note || "",
      });
    } else if (open) {
      form.reset({
        commessa_id: "",
        task_id: "",
        servizio: "Sviluppo",
        durata_ore: "0",
        durata_minuti: "30",
        data_attivita: initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        note: "",
      });
    }
  }, [timesheet, open, form]);

  const onSubmit = async (values: TimesheetFormValues) => {
    const totaleMinuti = parseInt(values.durata_ore) * 60 + parseInt(values.durata_minuti);
    
    // Find selected task to populate task_display_name
    const selectedTask = tasks?.find(t => t.id === values.task_id);
    
    const payload = {
      commessa_id: values.commessa_id,
      task_id: values.task_id || null,
      task_display_name: selectedTask ? selectedTask.title : null,
      servizio: values.servizio,
      durata_minuti: totaleMinuti,
      data_attivita: values.data_attivita,
      note: values.note,
    };

    if (timesheet && !isDuplicate) {
      await updateMutation.mutateAsync({
        id: timesheet.id,
        payload
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
    
    onOpenChange(false);
  };

  const servizi = [
    "Sviluppo",
    "Design",
    "UX/UI",
    "Project Management",
    "Consulenza",
    "Social Media",
    "Content Creation",
    "System Admin",
    "Copywriting",
    "Meeting/Call"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border shadow-2xl text-white sm:max-w-[480px] rounded-[2rem] overflow-hidden">
        <DialogHeader className="p-3 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
            {isDuplicate ? <Plus className="w-5 h-5 text-purple-400" /> : timesheet ? <Edit2 className="w-5 h-5 text-purple-400" /> : <Calendar className="w-5 h-5 text-purple-400" />}
            {isDuplicate ? "Duplica Ore" : timesheet ? "Modifica Ore Mappate" : "Registra Ore Manualmente"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-5 p-2">
            <FormField
              control={form.control}
              name="commessa_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-black uppercase tracking-widest text-[#475569] flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" /> Commessa / Progetto
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-muted/50 border-border/50 text-white h-11 rounded-xl shadow-inner font-bold focus:ring-purple-500">
                        <SelectValue placeholder="Seleziona la Commessa a cui legare le ore" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card/95 backdrop-blur-xl border-border text-white max-h-[300px]">
                      {loadingCommesse ? (
                        <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-purple-500" /></div>
                      ) : (
                        commesse?.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="font-medium cursor-pointer focus:bg-purple-500/20 py-2.5">
                            <span className="text-purple-400 font-bold mr-2 text-[10px] uppercase tracking-wider">C-{c.id.substring(0,6)}</span>
                            {c.cliente.ragione_sociale} 
                            <span className="text-muted-foreground italic text-xs ml-2">({format(parseISO(c.mese_competenza), "MMM yyyy")})</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-rose-400 text-xs font-bold" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="task_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-black uppercase tracking-widest text-[#475569] flex items-center gap-1.5 opacity-80">
                    <CheckSquare className="w-3.5 h-3.5" /> Task Specifico (Opzionale)
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || undefined}
                    disabled={!selectedCommessaId || loadingTasks}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-muted/30 border-border/30 text-white h-10 rounded-xl">
                        <SelectValue placeholder={
                          !selectedCommessaId 
                            ? "Prima seleziona una commessa" 
                            : loadingTasks 
                              ? "Caricamento task..." 
                              : "Seleziona il task esatto"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card/95 backdrop-blur-xl border-border text-white max-h-[250px]">
                      <SelectItem value="none" className="italic text-muted-foreground">Ometti task, registra su commessa generica</SelectItem>
                      {tasks?.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="cursor-pointer focus:bg-purple-500/10">
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-rose-400" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="data_attivita"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-[#475569] flex items-center gap-1.5">Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="bg-muted/50 border-border/50 text-white h-11 rounded-xl" />
                    </FormControl>
                    <FormMessage className="text-rose-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="servizio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-[#475569] flex items-center gap-1.5">Servizio Erogato</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/50 border-border/50 text-white h-11 rounded-xl">
                          <SelectValue placeholder="Tipo di lavoro" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card/95 backdrop-blur-xl border-border text-white">
                        {servizi.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-rose-400" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-5 p-4 bg-muted/20 border border-border/50 rounded-[1.5rem] mt-2">
              <FormField
                control={form.control}
                name="durata_ore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary text-center block">Ore Registrate</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} className="bg-background border-border h-12 text-center text-xl font-black tabular-nums rounded-xl shadow-inner" />
                    </FormControl>
                    <FormMessage className="text-rose-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="durata_minuti"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary text-center block">Minuti</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="59" step="5" {...field} className="bg-background border-border h-12 text-center text-xl font-black tabular-nums rounded-xl shadow-inner" />
                    </FormControl>
                    <FormMessage className="text-rose-400" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-black uppercase tracking-widest text-[#475569] flex items-center gap-1.5 opacity-80">Note Lavoro</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Descrivi il lavoro svolto per rendicontazione" className="bg-muted/30 border-border/30 text-white h-11 rounded-xl shadow-inner placeholder:opacity-50" />
                  </FormControl>
                  <FormMessage className="text-rose-400" />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 border-t border-border/40 mt-4">
              <Button 
                type="button" 
                onClick={(e) => {
                  e.preventDefault();
                  // The backend fails if task_id is exactly "none", it expects uuid or nothing
                  const values = form.getValues();
                  if (values.task_id === "none") values.task_id = "";
                  onSubmit(values as TimesheetFormValues);
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full bg-primary hover:bg-primary/90 hover:scale-[1.02] shadow-[0_0_20px_hsl(var(--primary)/0.3)] active:scale-95 transition-all text-white font-black h-12 rounded-[1rem] uppercase tracking-widest"
              >
                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (isDuplicate ? "DUPLICA ORE E SALVA" : (timesheet ? "APPLICA MODIFICHE COSTO" : "REGISTRA DEFINITIVAMENTE"))}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
