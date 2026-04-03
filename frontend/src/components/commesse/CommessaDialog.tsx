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
import { useCreateCommessa, useUpdateCommessa } from "@/hooks/useCommesse";
import { useClienti } from "@/hooks/useClienti";
import type { Commessa } from "@/types";
import { Loader2 } from "lucide-react";
import { format, startOfMonth } from "date-fns";

const commessaSchema = z.object({
  cliente_id: z.string().min(1, "Cliente obbligatorio"),
  mese_competenza: z.string().min(1, "Mese obbligatorio"),
  stato: z.enum(["APERTA", "PRONTA_CHIUSURA", "CHIUSA", "FATTURATA", "INCASSATA"]),
  costo_manodopera: z.coerce.number().min(0).default(0),
  costi_diretti: z.coerce.number().min(0).default(0),
  note: z.string().optional().default(""),
});

type CommessaFormValues = z.infer<typeof commessaSchema>;

interface CommessaDialogProps {
  commessa?: Commessa | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommessaDialog({ commessa, open, onOpenChange }: CommessaDialogProps) {
  const { data: clienti } = useClienti();
  const createCommessa = useCreateCommessa();
  const updateCommessa = useUpdateCommessa();
  const isEditing = !!commessa;

  const form = useForm<CommessaFormValues>({
    resolver: zodResolver(commessaSchema) as any,
    defaultValues: {
      cliente_id: "",
      mese_competenza: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      stato: "APERTA",
      costo_manodopera: 0,
      costi_diretti: 0,
      note: "",
    },
  });

  React.useEffect(() => {
    if (commessa) {
      form.reset({
        cliente_id: commessa.cliente_id,
        mese_competenza: commessa.mese_competenza,
        stato: commessa.stato,
        costo_manodopera: commessa.costo_manodopera,
        costi_diretti: commessa.costi_diretti,
        note: commessa.note || "",
      });
    } else {
      form.reset({
        cliente_id: "",
        mese_competenza: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        stato: "APERTA",
        costo_manodopera: 0,
        costi_diretti: 0,
        note: "",
      });
    }
  }, [commessa, form]);

  const onSubmit = async (values: CommessaFormValues) => {
    try {
      if (isEditing && commessa) {
        await updateCommessa.mutateAsync({ id: commessa.id, data: values });
      } else {
        await createCommessa.mutateAsync(values);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Errore durante il salvataggio della commessa:", error);
    }
  };

  const isPending = createCommessa.isPending || updateCommessa.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-card border-border text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {isEditing ? "Modifica Commessa" : "Nuova Commessa"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control as any}
              name="cliente_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Cliente</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                    <FormControl>
                      <SelectTrigger className="bg-muted border-border text-white">
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="mese_competenza"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Mese competenza</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="bg-muted border-border text-white" disabled={isEditing} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="stato"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Stato</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted border-border text-white">
                          <SelectValue placeholder="Stato commessa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border text-white">
                        <SelectItem value="APERTA">IN CORSO</SelectItem>
                        <SelectItem value="PRONTA_CHIUSURA">DA FATTURARE</SelectItem>
                        <SelectItem value="CHIUSA">CHIUSA</SelectItem>
                        <SelectItem value="FATTURATA">FATTURATA</SelectItem>
                        <SelectItem value="INCASSATA">INCASSATA</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="costo_manodopera"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Costo Manodopera (€)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="bg-muted border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="costi_diretti"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Costi Diretti (€)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="bg-muted border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control as any}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Note</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-muted border-border text-white" placeholder="Eventuali annotazioni..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white">
                Annulla
              </Button>
              <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_10px_hsl(var(--primary)/0.2)]">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? "Salva Modifiche" : "Apri Commessa")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
