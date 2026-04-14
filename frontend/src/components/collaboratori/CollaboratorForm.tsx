import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Users, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Building, 
  Clock, 
  Euro,
  Loader2,
  X
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";

const collaboratorSchema = z.object({
  nome: z.string().min(2, "Il nome è obbligatorio"),
  cognome: z.string().min(2, "Il cognome è obbligatorio"),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  telefono: z.string().optional(),
  ruolo: z.string().optional(),
  tipo_contratto: z.string().default("DIPENDENTE"),
  ore_settimanali: z.coerce.number().min(0).default(40),
  costo_orario_override: z.coerce.number().optional(),
  piva: z.string().optional(),
  codice_fiscale: z.string().optional(),
  indirizzo: z.string().optional(),
  iban: z.string().optional(),
  banca: z.string().optional(),
  bic_swift: z.string().optional(),
  note: z.string().optional(),
});

type CollaboratorFormValues = z.infer<typeof collaboratorSchema>;

interface CollaboratorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborator?: any; // Risorsa
}

export function CollaboratorForm({ open, onOpenChange, collaborator }: CollaboratorFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!collaborator;

  const form = useForm<CollaboratorFormValues>({
    resolver: zodResolver(collaboratorSchema) as any,
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      telefono: "",
      ruolo: "",
      tipo_contratto: "DIPENDENTE",
      ore_settimanali: 40,
      piva: "",
      codice_fiscale: "",
      indirizzo: "",
      iban: "",
      banca: "",
      bic_swift: "",
      note: "",
    },
  });

  useEffect(() => {
    if (collaborator && open) {
      form.reset({
        nome: collaborator.nome || "",
        cognome: collaborator.cognome || "",
        email: collaborator.email || "",
        telefono: collaborator.telefono || "",
        ruolo: collaborator.ruolo || "",
        tipo_contratto: collaborator.tipo_contratto || "DIPENDENTE",
        ore_settimanali: collaborator.ore_settimanali || 40,
        costo_orario_override: collaborator.costo_orario_override || undefined,
        piva: collaborator.piva || "",
        codice_fiscale: collaborator.codice_fiscale || "",
        indirizzo: collaborator.indirizzo || "",
        iban: collaborator.iban || "",
        banca: collaborator.banca || "",
        bic_swift: collaborator.bic_swift || "",
        note: collaborator.note || "",
      });
    } else if (!collaborator && open) {
      form.reset({
        nome: "",
        cognome: "",
        email: "",
        telefono: "",
        ruolo: "",
        tipo_contratto: "DIPENDENTE",
        ore_settimanali: 40,
        piva: "",
        codice_fiscale: "",
        indirizzo: "",
        iban: "",
        banca: "",
        bic_swift: "",
        note: "",
      });
    }
  }, [collaborator, open, form]);

  const mutation = useMutation({
    mutationFn: async (values: CollaboratorFormValues) => {
      if (isEdit) {
        return api.patch(`/risorse/${collaborator.id}`, values);
      } else {
        return api.post("/risorse", values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risorse-full"] });
      toast.success(isEdit ? "Collaboratore aggiornato" : "Collaboratore creato");
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg = error.response?.data?.detail || "Errore durante il salvataggio";
      toast.error(msg);
    },
  });

  const onSubmit = (values: CollaboratorFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border text-white">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              {isEdit ? "Modifica Collaboratore" : "Nuovo Collaboratore"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {isEdit ? "Aggiorna le informazioni professionali e bancarie." : "Aggiungi un nuovo membro al team."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-8">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Informazioni di Base</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Nome</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-background border-border" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cognome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Cognome</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-background border-border" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                              <Input {...field} className="pl-10 bg-background border-border" placeholder="email@esempio.it" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="telefono"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Telefono</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                              <Input {...field} className="pl-10 bg-background border-border" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ruolo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Ruolo</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-background border-border" placeholder="es. Senior Designer" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tipo_contratto"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Tipo Contratto</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-background border-border" placeholder="DIPENDENTE, P.IVA, etc." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Professional Info */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Informazioni Professionali</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="piva"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Partita IVA</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-background border-border" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="codice_fiscale"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Codice Fiscale</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-background border-border" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="indirizzo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Indirizzo</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                            <Textarea {...field} className="pl-10 bg-background border-border min-h-[80px]" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Capacity & Costs */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Capacità & Costi</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ore_settimanali"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Ore Settimanali</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                              <Input type="number" {...field} className="pl-10 bg-background border-border" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="costo_orario_override"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Costo Orario (€)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                              <Input type="number" step="0.01" {...field} className="pl-10 bg-background border-border" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Banking */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Informazioni Bancarie</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="iban"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">IBAN</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                              <Input {...field} className="pl-10 bg-background border-border" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="banca"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Banca</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                              <Input {...field} className="pl-10 bg-background border-border" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bic_swift"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">BIC/SWIFT</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-background border-border" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-4">
                   <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-[#475569]">Note</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="bg-background border-border" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="pt-4 border-t border-border gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">
                Annulla
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] min-w-[120px]">
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEdit ? "Salva Modifiche" : "Crea Collaboratore")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
