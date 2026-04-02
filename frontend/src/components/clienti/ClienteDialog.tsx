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
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateCliente, useUpdateCliente } from "@/hooks/useClienti";
import type { Cliente } from "@/types";
import { Loader2 } from "lucide-react";

const clienteSchema = z.object({
  ragione_sociale: z.string().min(2, "Ragione sociale obbligatoria"),
  piva: z.string().optional().default(""),
  codice_fiscale: z.string().optional().default(""),
  email: z.string().email("Email non valida").optional().or(z.string().length(0)).default(""),
  telefono: z.string().optional().default(""),
  referente: z.string().optional().default(""),
  indirizzo: z.string().optional().default(""),
  comune: z.string().optional().default(""),
  cap: z.string().optional().default(""),
  provincia: z.string().optional().default(""),
  paese: z.string().default("Italia"),
  attivo: z.boolean().default(true),
  note: z.string().optional().default(""),
});

type ClienteFormValues = z.infer<typeof clienteSchema>;

interface ClienteDialogProps {
  cliente?: Cliente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClienteDialog({ cliente, open, onOpenChange }: ClienteDialogProps) {
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente();
  const isEditing = !!cliente;

  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema) as any,
    defaultValues: {
      ragione_sociale: "",
      piva: "",
      codice_fiscale: "",
      email: "",
      telefono: "",
      referente: "",
      indirizzo: "",
      comune: "",
      cap: "",
      provincia: "",
      paese: "Italia",
      attivo: true,
      note: "",
    },
  });

  React.useEffect(() => {
    if (cliente) {
      form.reset({
        ragione_sociale: cliente.ragione_sociale || "",
        piva: cliente.piva || "",
        codice_fiscale: cliente.codice_fiscale || "",
        email: cliente.email || "",
        telefono: cliente.telefono || "",
        referente: cliente.referente || "",
        indirizzo: cliente.indirizzo || "",
        comune: cliente.comune || "",
        cap: cliente.cap || "",
        provincia: cliente.provincia || "",
        paese: cliente.paese || "Italia",
        attivo: cliente.attivo,
        note: cliente.note || "",
      });
    } else {
      form.reset({
        ragione_sociale: "",
        piva: "",
        codice_fiscale: "",
        email: "",
        telefono: "",
        referente: "",
        indirizzo: "",
        comune: "",
        cap: "",
        provincia: "",
        paese: "Italia",
        attivo: true,
        note: "",
      });
    }
  }, [cliente, form]);

  const onSubmit = async (values: ClienteFormValues) => {
    // Convert empty strings to undefined for the backend
    const cleanedValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value === "" ? undefined : value])
    ) as Partial<Cliente>;

    try {
      if (isEditing && cliente) {
        await updateCliente.mutateAsync({ id: cliente.id, data: cleanedValues });
      } else {
        await createCliente.mutateAsync(cleanedValues);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Errore durante il salvataggio del cliente:", error);
    }
  };

  const isPending = createCliente.isPending || updateCliente.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-[#0f172a] border-[#1e293b] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#f1f5f9]">
            {isEditing ? "Modifica Cliente" : "Nuovo Cliente"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="ragione_sociale"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-[#94a3b8]">Ragione Sociale</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-[#1e293b] border-[#334155] text-white focus:ring-primary" placeholder="Nome Azienda Srl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="piva"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#94a3b8]">Partita IVA</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-[#1e293b] border-[#334155] text-white" placeholder="IT01234567890" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#94a3b8]">Email</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-[#1e293b] border-[#334155] text-white" placeholder="email@esempio.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#94a3b8]">Telefono</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-[#1e293b] border-[#334155] text-white" placeholder="+39 012 3456789" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="referente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#94a3b8]">Referente</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-[#1e293b] border-[#334155] text-white" placeholder="Mario Rossi" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="attivo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border border-[#334155] bg-[#1e293b]/30 p-4 col-span-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="border-primary data-[state=checked]:bg-primary"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-[#f1f5f9]">Cliente Attivo</FormLabel>
                      <p className="text-[11px] text-[#64748b]">
                        I clienti inattivi non verranno mostrati nelle liste di selezione progetti.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-[#94a3b8] hover:text-white hover:bg-[#1e293b]">
                Annulla
              </Button>
              <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 text-white min-w-[100px]">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? "Salva Modifiche" : "Crea Cliente")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
