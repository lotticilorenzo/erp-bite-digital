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
import { useClienti, useCreateCliente } from "@/hooks/useClienti";
import type { Commessa } from "@/types";
import { Loader2, Plus, Trash2, Layers, UserPlus } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";
import { useProgetti, useCreateProgetto } from "@/hooks/useProgetti";
import { useFieldArray } from "react-hook-form";
import { Badge } from "@/components/ui/badge";

const commessaSchema = z.object({
  cliente_id: z.string().min(1, "Cliente obbligatorio"),
  mese_competenza: z.string().min(1, "Mese obbligatorio"),
  stato: z.enum(["APERTA", "PRONTA_CHIUSURA", "CHIUSA", "FATTURATA", "INCASSATA"]),
  costo_manodopera: z.coerce.number().min(0).default(0),
  costi_diretti: z.coerce.number().min(0).default(0),
  ore_contratto: z.coerce.number().min(0).default(0),
  note: z.string().optional().default(""),
  righe_progetto: z.array(z.object({
    progetto_id: z.string(),
    importo_fisso: z.coerce.number().min(0),
    importo_variabile: z.coerce.number().min(0),
    delivery_attesa: z.coerce.number().min(0),
    delivery_consuntiva: z.coerce.number().min(0).default(0),
  })).default([]),
});

type CommessaFormValues = z.infer<typeof commessaSchema>;

interface CommessaDialogProps {
  commessa?: Commessa | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMeseCompetenza?: string;
}

export function CommessaDialog({
  commessa,
  open,
  onOpenChange,
  defaultMeseCompetenza,
}: CommessaDialogProps) {
  const { data: clienti } = useClienti();
  const createCommessa = useCreateCommessa();
  const updateCommessa = useUpdateCommessa();
  const createProgetto = useCreateProgetto();
  const createCliente = useCreateCliente();
  const isEditing = !!commessa;
  const fallbackMonth = defaultMeseCompetenza || format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [isCreatingProject, setIsCreatingProject] = React.useState(false);
  const [newProjectName, setNewProjectName] = React.useState("");
  const [isCreatingClient, setIsCreatingClient] = React.useState(false);
  const [newClientName, setNewClientName] = React.useState("");

  const form = useForm<CommessaFormValues>({
    resolver: zodResolver(commessaSchema) as any,
    defaultValues: {
      cliente_id: "",
      mese_competenza: fallbackMonth,
      stato: "APERTA",
      costo_manodopera: 0,
      costi_diretti: 0,
      ore_contratto: 0,
      note: "",
      righe_progetto: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "righe_progetto"
  });

  const cliente_id = form.watch("cliente_id");
  const { data: progettiCliente } = useProgetti(cliente_id);

  React.useEffect(() => {
    if (commessa) {
      form.reset({
        cliente_id: commessa.cliente_id,
        mese_competenza: commessa.mese_competenza,
        stato: commessa.stato,
        costo_manodopera: commessa.costo_manodopera,
        costi_diretti: commessa.costi_diretti,
        ore_contratto: commessa.ore_contratto,
        note: commessa.note || "",
        righe_progetto: commessa.righe_progetto?.map(r => ({
          progetto_id: r.progetto_id,
          importo_fisso: r.importo_fisso,
          importo_variabile: r.importo_variabile,
          delivery_attesa: r.delivery_attesa,
          delivery_consuntiva: r.delivery_consuntiva,
        })) || [],
      });
    } else {
      form.reset({
        cliente_id: "",
        mese_competenza: fallbackMonth,
        stato: "APERTA",
        costo_manodopera: 0,
        costi_diretti: 0,
        ore_contratto: 0,
        note: "",
        righe_progetto: [],
      });
    }
  }, [commessa, fallbackMonth, form]);

  const handleAddProject = (progettoId: string) => {
    if (fields.some(f => f.progetto_id === progettoId)) {
      toast.error("Progetto già aggiunto");
      return;
    }
    const progetto = progettiCliente?.find(p => p.id === progettoId);
    append({
      progetto_id: progettoId,
      importo_fisso: progetto?.importo_fisso || 0,
      importo_variabile: progetto?.importo_variabile || 0,
      delivery_attesa: progetto?.delivery_attesa || 0,
      delivery_consuntiva: 0
    });
  };

  const handleInlineCreateProject = async () => {
    if (!newProjectName || !cliente_id) return;
    try {
      const p = await createProgetto.mutateAsync({
        nome: newProjectName,
        cliente_id: cliente_id,
        tipo: "RETAINER",
        importo_fisso: 0,
        importo_variabile: 0,
        delivery_attesa: 0
      });
      toast.success("Progetto creato");
      append({
        progetto_id: p.id,
        importo_fisso: 0,
        importo_variabile: 0,
        delivery_attesa: 0,
        delivery_consuntiva: 0
      });
      setIsCreatingProject(false);
      setNewProjectName("");
    } catch (e) {
      console.error(e);
      toast.error("Errore creazione progetto");
    }
  };

  const handleInlineCreateClient = async () => {
    if (!newClientName) return;
    try {
      const c = await createCliente.mutateAsync({
        ragione_sociale: newClientName,
        attivo: true
      });
      form.setValue("cliente_id", c.id);
      setIsCreatingClient(false);
      setNewClientName("");
      toast.success("Cliente creato e selezionato");
    } catch (e) {
      toast.error("Errore creazione cliente");
    }
  };

  const onSubmit = async (values: CommessaFormValues) => {
    try {
      if (isEditing && commessa) {
        await updateCommessa.mutateAsync({ id: commessa.id, data: values });
        toast.success("Commessa aggiornata con successo");
      } else {
        await createCommessa.mutateAsync(values);
        toast.success("Commessa creata con successo");
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error("Errore durante il salvataggio della commessa:", error);
      
      let message = "Errore durante il salvataggio";
      
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 409) {
          message = "Esiste già una commessa per questo cliente in questo mese";
        } else if (error.response.data?.detail) {
          message = error.response.data.detail;
        }
      }
      
      toast.error(message);
    }
  };

  const isPending = createCommessa.isPending || updateCommessa.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col bg-card border-border text-white p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold text-foreground">
            {isEditing ? "Modifica Commessa" : "Nuova Commessa"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control as any}
                name="cliente_id"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-muted-foreground">Cliente</FormLabel>
                      {!isEditing && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setIsCreatingClient(!isCreatingClient)}
                          className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-lg uppercase tracking-tight"
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          {isCreatingClient ? "Seleziona Esistente" : "Nuovo Cliente"}
                        </Button>
                      )}
                    </div>
                    {isCreatingClient && !isEditing ? (
                      <div className="flex gap-2 animate-in slide-in-from-top-2">
                         <Input 
                          placeholder="Nome della nuova azienda / cliente..." 
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          className="bg-muted border-border text-white h-10"
                        />
                        <Button 
                          type="button" 
                          size="sm" 
                          onClick={handleInlineCreateClient}
                          disabled={createCliente.isPending}
                          className="h-10 px-4 bg-primary text-white rounded-xl font-bold"
                        >
                           {createCliente.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crea"}
                        </Button>
                      </div>
                    ) : (
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
                    )}
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control as any}
                  name="ore_contratto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Ore a Contratto (Budget)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="bg-muted border-border text-white" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end pb-2">
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Definisci lo scope mensile per questo cliente.
                  </p>
                </div>
              </div>

              <FormField
                control={form.control as any}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Note Interne</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        className="bg-muted border-border text-white min-h-[80px] resize-none" 
                        placeholder="Annotazioni..." 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 pt-4 border-t border-border/50">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                       <Layers className="w-4 h-4 text-purple-400" />
                       Progetti Inclusi
                    </h3>
                    {cliente_id && (
                      <div className="flex items-center gap-2">
                          <Select onValueChange={handleAddProject}>
                             <SelectTrigger className="w-[200px] h-8 bg-muted border-border text-[10px] font-bold uppercase tracking-widest">
                                <SelectValue placeholder="AGGIUNGI PROGETTO" />
                             </SelectTrigger>
                             <SelectContent className="bg-card border-border text-white">
                                {progettiCliente?.filter(p => !fields.some(f => f.progetto_id === p.id)).map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                ))}
                                {progettiCliente?.filter(p => !fields.some(f => f.progetto_id === p.id)).length === 0 && (
                                  <div className="p-2 text-[10px] text-muted-foreground uppercase text-center">Tutti i progetti aggiunti</div>
                                )}
                             </SelectContent>
                          </Select>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setIsCreatingProject(!isCreatingProject)}
                            className="h-8 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 rounded-lg"
                          >
                             <Plus className="w-3.5 h-3.5" />
                          </Button>
                      </div>
                    )}
                 </div>

                 {isCreatingProject && (
                   <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2">
                      <Input 
                        placeholder="Nome nuovo progetto..." 
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="bg-muted border-border text-white h-9"
                      />
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={handleInlineCreateProject}
                        disabled={createProgetto.isPending}
                        className="h-9 rounded-lg px-4"
                      >
                         {createProgetto.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crea"}
                      </Button>
                   </div>
                 )}

                 <div className="space-y-3">
                    {fields.map((field, index) => {
                      const progetto = progettiCliente?.find(p => p.id === field.progetto_id);
                      return (
                        <div key={field.id} className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-4 relative group hover:bg-muted/40 transition-colors">
                           <div className="flex justify-between items-center pr-8">
                              <span className="text-xs font-black text-white uppercase tracking-wider">{progetto?.nome || "Progetto"}</span>
                              <Badge variant="outline" className="text-[9px] font-black opacity-50 uppercase tracking-widest">{progetto?.tipo}</Badge>
                           </div>
                           
                           <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => remove(index)}
                              className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-red-400 group-hover:bg-red-500/10 rounded-full"
                           >
                              <Trash2 className="w-3.5 h-3.5" />
                           </Button>

                           <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-1">
                                 <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Fisso (€)</label>
                                 <Input 
                                    type="number" 
                                    {...form.register(`righe_progetto.${index}.importo_fisso` as const)}
                                    className="h-9 text-xs bg-muted border-border font-bold text-white rounded-lg focus:ring-primary/20"
                                  />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Var. (€)</label>
                                 <Input 
                                    type="number" 
                                    {...form.register(`righe_progetto.${index}.importo_variabile` as const)}
                                    className="h-9 text-xs bg-muted border-border font-bold text-white rounded-lg focus:ring-primary/20"
                                  />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Delivery (h)</label>
                                 <Input 
                                    type="number" 
                                    {...form.register(`righe_progetto.${index}.delivery_attesa` as const)}
                                    className="h-9 text-xs bg-muted border-border font-bold text-white rounded-lg focus:ring-primary/20"
                                  />
                              </div>
                           </div>
                        </div>
                      );
                    })}
                    {fields.length === 0 && (
                      <div className="text-center py-10 border-2 border-dashed border-border/50 rounded-2xl text-muted-foreground text-[10px] uppercase font-black tracking-[0.2em] opacity-40">
                         Nessun progetto incluso
                      </div>
                    )}
                 </div>
              </div>

              <div className="h-4" /> {/* Spacer */}
            </form>
          </Form>
        </div>

        <DialogFooter className="p-6 pt-2 border-t border-border/50 bg-muted/10">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white font-bold text-xs">
            Annulla
          </Button>
          <Button 
            onClick={form.handleSubmit(onSubmit)} 
            disabled={isPending} 
            className="bg-primary hover:bg-primary/90 text-white font-black uppercase italic tracking-widest px-8 shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? "Salva Modifiche" : "Apri Commessa")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  );
}
