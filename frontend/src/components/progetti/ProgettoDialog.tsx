import React from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProgetto, useUpdateProgetto } from "@/hooks/useProgetti";
import { useClienti } from "@/hooks/useClienti";
import type { Progetto } from "@/types";
import { Loader2 } from "lucide-react";

const progettoSchema = z.object({
  cliente_id: z.string().min(1, "Cliente obbligatorio"),
  nome: z.string().min(2, "Nome obbligatorio"),
  tipo: z.enum(["RETAINER", "ONE_OFF"]),
  stato: z.enum(["ATTIVO", "CHIUSO"]),
  importo_fisso: z.coerce.number().min(0).default(0),
  importo_variabile: z.coerce.number().min(0).default(0),
  delivery_attesa: z.coerce.number().min(0).default(0),
  note: z.string().optional().default(""),
});

type ProgettoFormValues = z.infer<typeof progettoSchema>;

interface ProgettoDialogProps {
  progetto?: Progetto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProgettoDialog({ progetto, open, onOpenChange }: ProgettoDialogProps) {
  const { data: clienti } = useClienti();
  const createProgetto = useCreateProgetto();
  const updateProgetto = useUpdateProgetto();
  const isEditing = !!progetto;

  const form = useForm<ProgettoFormValues>({
    resolver: zodResolver(progettoSchema) as any,
    defaultValues: {
      cliente_id: "",
      nome: "",
      tipo: "ONE_OFF",
      stato: "ATTIVO",
      importo_fisso: 0,
      importo_variabile: 0,
      delivery_attesa: 0,
      note: "",
    },
  });

  React.useEffect(() => {
    if (progetto) {
      form.reset({
        cliente_id: progetto.cliente_id,
        nome: progetto.nome,
        tipo: progetto.tipo,
        stato: progetto.stato,
        importo_fisso: progetto.importo_fisso,
        importo_variabile: progetto.importo_variabile,
        delivery_attesa: progetto.delivery_attesa,
        note: progetto.note || "",
      });
    } else {
      form.reset({
        cliente_id: "",
        nome: "",
        tipo: "ONE_OFF",
        stato: "ATTIVO",
        importo_fisso: 0,
        importo_variabile: 0,
        delivery_attesa: 0,
        note: "",
      });
    }
  }, [progetto, form]);

  const onSubmit = async (values: ProgettoFormValues) => {
    try {
      if (isEditing && progetto) {
        await updateProgetto.mutateAsync({ id: progetto.id, data: values });
      } else {
        await createProgetto.mutateAsync(values);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Errore durante il salvataggio del progetto:", error);
    }
  };

  const isPending = createProgetto.isPending || updateProgetto.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-[#0f172a] border-[#1e293b] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#f1f5f9]">
            {isEditing ? "Modifica Progetto" : "Nuovo Progetto"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="nome"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-[#94a3b8]">Nome Progetto</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-[#1e293b] border-[#334155] text-white" placeholder="Es. Digital Marketing 2024" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="cliente_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-[#94a3b8]">Cliente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-[#1e293b] border-[#334155] text-white">
                          <SelectValue placeholder="Seleziona un cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#0f172a] border-[#1e293b] text-white">
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
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#94a3b8]">Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-[#1e293b] border-[#334155] text-white">
                          <SelectValue placeholder="Tipo progetto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#0f172a] border-[#1e293b] text-white">
                        <SelectItem value="RETAINER">RETAINER</SelectItem>
                        <SelectItem value="ONE_OFF">ONE_OFF</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="stato"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#94a3b8]">Stato</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-[#1e293b] border-[#334155] text-white">
                          <SelectValue placeholder="Stato progetto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#0f172a] border-[#1e293b] text-white">
                        <SelectItem value="ATTIVO">ATTIVO</SelectItem>
                        <SelectItem value="CHIUSO">CHIUSO</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="importo_fisso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#94a3b8]">Importo Fisso (€)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="bg-[#1e293b] border-[#334155] text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="importo_variabile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#94a3b8]">Importo Variabile (€)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="bg-[#1e293b] border-[#334155] text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-[#94a3b8] hover:text-white">
                Annulla
              </Button>
              <Button type="submit" disabled={isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? "Salva Modifiche" : "Crea Progetto")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
