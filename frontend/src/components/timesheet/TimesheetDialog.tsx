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
import { useCreateTimesheetManual } from "@/hooks/useTimesheet";
import { useClienti } from "@/hooks/useClienti";
import { Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";

const timesheetSchema = z.object({
  cliente_id: z.string().min(1, "Cliente obbligatorio"),
  servizio: z.string().min(1, "Servizio obbligatorio"),
  durata_ore: z.string().min(1, "Ore obbligatorie"),
  durata_minuti: z.string().min(1, "Minuti obbligatori"),
  data_attivita: z.string().min(1, "Data obbligatoria"),
  note: z.string().optional(),
});

type TimesheetFormValues = z.infer<typeof timesheetSchema>;

interface TimesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimesheetDialog({ open, onOpenChange }: TimesheetDialogProps) {
  const createMutation = useCreateTimesheetManual();
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

  const onSubmit = async (values: TimesheetFormValues) => {
    const totaleMinuti = parseInt(values.durata_ore) * 60 + parseInt(values.durata_minuti);
    
    await createMutation.mutateAsync({
      cliente_id: values.cliente_id,
      servizio: values.servizio,
      durata_minuti: totaleMinuti,
      data_attivita: values.data_attivita,
      note: values.note,
    });
    
    onOpenChange(false);
    form.reset();
  };

  const servizi = [
    "Sviluppo",
    "Design",
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
      <DialogContent className="bg-[#0f172a] border-[#1e293b] text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Registra Ore Manualmente
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="cliente_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-[#1e293b] border-[#334155] text-white">
                        <SelectValue placeholder="Seleziona cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-[#0f172a] border-[#1e293b] text-white">
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
                      <Input type="date" {...field} className="bg-[#1e293b] border-[#334155] text-white" />
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
                        <SelectTrigger className="bg-[#1e293b] border-[#334155] text-white">
                          <SelectValue placeholder="Tipo lavoro" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#0f172a] border-[#1e293b] text-white">
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
                      <Input type="number" min="0" {...field} className="bg-[#1e293b] border-[#334155] text-white" />
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
                      <Input type="number" min="0" max="59" step="5" {...field} className="bg-[#1e293b] border-[#334155] text-white" />
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
                    <Input {...field} placeholder="Descrizione attività" className="bg-[#1e293b] border-[#334155] text-white" />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-6">
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "REGISTRA ORE"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
