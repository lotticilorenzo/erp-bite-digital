import React from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateProgetto, useUpdateProgetto, type ProgettoPayload } from "@/hooks/useProgetti";
import { useClienti } from "@/hooks/useClienti";
import { useUsers } from "@/hooks/useUsers";
import type { Progetto } from "@/types";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";

const progettoSchema = z.object({
  cliente_id: z.string().min(1, "Cliente obbligatorio"),
  nome: z.string().min(2, "Nome obbligatorio"),
  tipo: z.enum(["RETAINER", "ONE_OFF"]),
  stato: z.enum(["ATTIVO", "CHIUSO"]),
  importo_fisso: z.coerce.number().min(0).default(0),
  importo_variabile: z.coerce.number().min(0).default(0),
  delivery_attesa: z.coerce.number().min(0).default(0),
  note: z.string().optional().default(""),
  data_inizio: z.string().optional().nullable(),
  data_fine: z.string().optional().nullable(),
  team: z.array(z.object({
    user_id: z.string().min(1, "Collaboratore obbligatorio"),
    ruolo_progetto: z.string().optional().default(""),
    ore_previste: z.coerce.number().min(0).default(0),
    note: z.string().optional().default(""),
  })).default([]),
});

type ProgettoFormValues = z.infer<typeof progettoSchema>;

interface ProgettoDialogProps {
  progetto?: Progetto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (progetto: Progetto) => void;
}

export function ProgettoDialog({ progetto, open, onOpenChange, onSuccess }: ProgettoDialogProps) {
  const { data: clienti } = useClienti();
  const { data: collaborators } = useUsers();
  const createProgetto = useCreateProgetto();
  const updateProgetto = useUpdateProgetto();
  const isEditing = !!(progetto && progetto.id);

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
      data_inizio: null,
      data_fine: null,
      team: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "team"
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
        data_inizio: progetto.data_inizio || null,
        data_fine: progetto.data_fine || null,
        team: progetto.team?.map(t => ({
          user_id: t.user_id,
          ruolo_progetto: t.ruolo_progetto || "",
          ore_previste: t.ore_previste || 0,
          note: t.note || "",
        })) || [],
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
        data_inizio: null,
        data_fine: null,
        team: [],
      });
    }
  }, [progetto, form]);

  const navigate = useNavigate();
  const onSubmit = async (values: ProgettoFormValues) => {
    if (isPending) return;

    const payload: ProgettoPayload = {
      ...values,
      data_inizio: values.data_inizio ?? undefined,
      data_fine: values.data_fine ?? undefined,
    };

    try {
      let result;
      if (isEditing && progetto) {
        result = await updateProgetto.mutateAsync({ id: progetto.id, data: payload });
      } else {
        result = await createProgetto.mutateAsync(payload);
        // Navigate to the new project detail page
        if (result?.id) {
          navigate(`/progetti/${result.id}`);
        }
      }
      if (onSuccess) onSuccess(result);
      onOpenChange(false);
    } catch (error) {
      console.error("Errore durante il salvataggio del progetto:", error);
    }
  };

  const isPending = createProgetto.isPending || updateProgetto.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {isEditing ? "Modifica Progetto" : "Nuovo Progetto"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configura i dettagli del progetto, il cliente associato e il budget previsto.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="nome"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-muted-foreground">Nome Progetto</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-muted border-border text-white" placeholder="Es. Digital Marketing 2024" />
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
                    <FormLabel className="text-muted-foreground">Cliente</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between bg-muted border-border text-white hover:bg-muted/80",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? clienti?.find((c) => c.id === field.value)?.ragione_sociale
                              : "Seleziona un cliente..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0 bg-card border-border text-white">
                        <Command>
                          <CommandInput placeholder="Cerca cliente..." className="text-white" />
                          <CommandList>
                            <CommandEmpty>Nessun cliente trovato.</CommandEmpty>
                            <CommandGroup>
                              {clienti?.map((c) => (
                                <CommandItem
                                  value={c.ragione_sociale}
                                  key={c.id}
                                  onSelect={() => {
                                    form.setValue("cliente_id", c.id);
                                  }}
                                  className="text-white hover:bg-muted cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      c.id === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {c.ragione_sociale}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted border-border text-white">
                          <SelectValue placeholder="Tipo progetto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border text-white">
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
                    <FormLabel className="text-muted-foreground">Stato</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted border-border text-white">
                          <SelectValue placeholder="Stato progetto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border text-white">
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
                name="data_inizio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Data Inizio</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} className="bg-muted border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="data_fine"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Data Fine</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} className="bg-muted border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="importo_fisso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Valore Fisso (Ricavo)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="number" {...field} className="bg-muted border-border text-white pl-7" placeholder="0" />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                      </div>
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
                    <FormLabel className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Valore Variabile (Extra)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="number" {...field} className="bg-muted border-border text-white pl-7" placeholder="0" />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                      </div>
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
                  <FormLabel className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Note Operative</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      className="bg-muted border-border text-white min-h-[80px] rounded-xl text-xs" 
                      placeholder="Descrivi gli obiettivi o i dettagli del progetto..." 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Team Assegnato</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => append({ user_id: "", ruolo_progetto: "", ore_previste: 0, note: "" })}
                  className="h-8 border-dashed"
                >
                  <Plus className="w-4 h-4 mr-1" /> Aggiungi Membro
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="space-y-2 bg-muted/20 p-3 rounded-2xl border border-border/30 relative group transition-all hover:bg-muted/40">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <FormField
                        control={form.control as any}
                        name={`team.${index}.user_id`}
                        render={({ field }) => (
                          <FormItem>
                            <Select 
                              onValueChange={(val) => {
                                field.onChange(val);
                                const user = collaborators?.find(u => u.id === val);
                                if (user) {
                                  form.setValue(`team.${index}.ruolo_progetto`, user.ruolo || "");
                                }
                              }} 
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-muted border-border text-[11px] font-bold h-9 rounded-xl">
                                  <SelectValue placeholder="Seleziona..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-card border-border">
                                {collaborators?.map(u => (
                                  <SelectItem key={u.id} value={u.id} className="text-xs">
                                    <div className="flex items-center justify-between w-full gap-8">
                                      <span>{u.nome} {u.cognome}</span>
                                      <span className="text-[10px] opacity-50 font-black">€{u.costo_orario || 0}/h</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-4">
                      <FormField
                        control={form.control as any}
                        name={`team.${index}.ruolo_progetto`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="space-y-1">
                                <Input {...field} placeholder="Ruolo" className="bg-muted border-border text-[11px] h-9 rounded-xl font-medium" />
                                {(() => {
                                  const userId = form.getValues(`team.${index}.user_id`);
                                  const user = collaborators?.find(u => u.id === userId);
                                  if (user) {
                                    return <p className="text-[9px] text-muted-foreground ml-1 font-bold">COSTO: €{user.costo_orario || 0}/h</p>
                                  }
                                  return null;
                                })()}
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-3">
                      <FormField
                        control={form.control as any}
                        name={`team.${index}.ore_previste`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="relative">
                                <Input type="number" {...field} placeholder="0" className="bg-muted border-border text-[11px] h-9 rounded-xl font-bold pr-7" />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-muted-foreground uppercase pointer-events-none">h</span>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <FormField
                        control={form.control as any}
                        name={`team.${index}.note`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="Compiti specifici o note per il collaboratore..." className="bg-muted/50 border-border/50 text-[10px] h-8 rounded-lg italic" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => remove(index)}
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {fields.length === 0 && (
                <div className="text-center py-4 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
                  Nessun membro del team assegnato.
                </div>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white">
                Annulla
              </Button>
              <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 text-white">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? "Salva Modifiche" : "Crea Progetto")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
