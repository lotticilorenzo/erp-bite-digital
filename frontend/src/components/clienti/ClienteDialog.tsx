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
import { Loader2, Upload, X } from "lucide-react";
import { ClientAvatar } from "../common/ClientAvatar";
import api from "@/lib/api";

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
  
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    
    // Reset logo states
    setLogoFile(null);
    setPreviewUrl(cliente?.logo_url || null);
  }, [cliente, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File troppo grande. Massimo 2MB.");
        return;
      }
      setLogoFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setPreviewUrl(null);
  };

  const onSubmit = async (values: ClienteFormValues) => {
    // Convert empty strings to undefined for the backend
    const cleanedValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value === "" ? undefined : value])
    ) as Partial<Cliente>;

    try {
      let clienteId = cliente?.id;
      
      if (isEditing && cliente) {
        await updateCliente.mutateAsync({ id: cliente.id, data: cleanedValues });
      } else {
        const newCliente = await createCliente.mutateAsync(cleanedValues);
        clienteId = newCliente.id;
      }
      
      // Gestione Upload/Delete Logo
      if (clienteId) {
        if (logoFile) {
          const formData = new FormData();
          formData.append('file', logoFile);
          await api.post(`/clienti/${clienteId}/logo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } else if (previewUrl === null && cliente?.logo_url) {
          // Logo è stato rimosso
          await api.delete(`/clienti/${clienteId}/logo`);
        }
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
            {/* Logo Section */}
            <div className="flex items-center gap-6 pb-4 border-b border-[#1e293b]">
              <div className="relative group">
                <ClientAvatar 
                  name={form.watch("ragione_sociale") || "C"} 
                  logoUrl={previewUrl} 
                  size="xl" 
                  className="rounded-xl border-2 border-[#334155]"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                >
                  <Upload className="w-6 h-6 text-white" />
                </button>
              </div>
              
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium text-[#f1f5f9]">Logo Aziendale</h4>
                <p className="text-xs text-[#94a3b8]">PNG, JPG o SVG. Max 2MB.</p>
                <div className="flex gap-2 mt-1">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs border-[#334155] bg-transparent text-[#94a3b8] hover:text-white"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Carica nuovo
                  </Button>
                  {previewUrl && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-400/10"
                      onClick={handleRemoveLogo}
                    >
                      <X className="w-3 h-3 mr-1" /> Rimuovi
                    </Button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            </div>

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
