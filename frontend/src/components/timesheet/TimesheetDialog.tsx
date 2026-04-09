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
import { useClienti } from "@/hooks/useClienti";
import { Loader2, Calendar, Edit2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useEffect } from "react";
import type { Timesheet } from "@/types";

const timesheetSchema = z.object({
  cliente_id: z.any().optional(),
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
  const { data: clienti, isLoading: loadingClienti } = useClienti();

  const form = useForm<TimesheetFormValues>({
    resolver: zodResolver(timesheetSchema),
    defaultValues: {
      cliente_id: "",
      servizio: "Sviluppo",
      durata_ore: "0",
      durata_minuti: "30",
      data_attivita: format(new Date(), "yyyy-MM-dd"),
      note: "",
    },
  });

  useEffect(() => {
    if (timesheet && open) {
      form.reset({
        cliente_id: timesheet.commessa?.cliente_id || "", 
        servizio: timesheet.servizio || "Sviluppo",
        durata_ore: Math.floor((timesheet.durata_minuti || 0) / 60).toString(),
        durata_minuti: ((timesheet.durata_minuti || 0) % 60).toString(),
        data_attivita: timesheet.data_attivita ? format(parseISO(timesheet.data_attivita), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        note: timesheet.note || "",
      });
    } else if (open) {
      form.reset({
        cliente_id: "",
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
    
    if (timesheet && !isDuplicate) {
      await updateMutation.mutateAsync({
        id: timesheet.id,
        payload: {
          cliente_id: values.cliente_id || null, // Optional if they don't change
          servizio: values.servizio,
          durata_minuti: totaleMinuti,
          data_attivita: values.data_attivita,
          note: values.note,
        }
      });
    } else {
      await createMutation.mutateAsync({
        cliente_id: values.cliente_id,
        servizio: values.servizio,
        durata_minuti: totaleMinuti,
        data_attivita: values.data_attivita,
        note: values.note,
      });
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
      <DialogContent className="bg-card border-border text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDuplicate ? <Plus className="w-5 h-5 text-purple-400" /> : timesheet ? <Edit2 className="w-5 h-5 text-purple-400" /> : <Calendar className="w-5 h-5 text-purple-400" />}
            {isDuplicate ? "Duplica Ore" : timesheet ? "Modifica Ore" : "Registra Ore Manualmente"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="cliente_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-muted border-border text-white">
                        <SelectValue placeholder="Seleziona cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-border text-white">
                      {loadingClienti ? (
                        <div className="p-2 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-purple-500" /></div>
                      ) : (
                        clienti?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.ragione_sociale}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_attivita"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="bg-muted border-border text-white" />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="servizio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Servizio</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted border-border text-white">
                          <SelectValue placeholder="Tipo lavoro" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border text-white">
                        {servizi.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="durata_ore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ore</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} className="bg-muted border-border text-white" />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="durata_minuti"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minuti</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="59" step="5" {...field} className="bg-muted border-border text-white" />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Descrizione attività" className="bg-muted border-border text-white" />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                onClick={(e) => {
                  e.preventDefault();
                  onSubmit(form.getValues() as TimesheetFormValues);
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full bg-primary hover:bg-primary/90 text-white font-black"
              >
                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isDuplicate ? "DUPLICA" : (timesheet ? "SALVA MODIFICHE" : "REGISTRA ORE"))}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
