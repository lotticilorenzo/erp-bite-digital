import React, { useEffect } from "react";
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
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { useProgetti } from "@/hooks/useProgetti";
import { Loader2, Plus, Pencil } from "lucide-react";

const taskSchema = z.object({
  titolo: z.string().min(3, "Il titolo deve avere almeno 3 caratteri"),
  progetto_id: z.string().optional(),
  stima_minuti: z.coerce.number().min(0).default(0),
  descrizione: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskPlanningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: any; // Added task prop for editing
}

export function TaskPlanningDialog({ open, onOpenChange, task }: TaskPlanningDialogProps) {
  const { data: progetti } = useProgetti();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const isEdit = !!task;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema) as any,
    defaultValues: {
      titolo: "",
      progetto_id: undefined,
      stima_minuti: 60,
      descrizione: "",
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        titolo: task.titolo || task.title || "",
        progetto_id: task.progetto_id || undefined,
        stima_minuti: task.stima_minuti || 60,
        descrizione: task.descrizione || task.desc || "",
      });
    } else {
      form.reset({
        titolo: "",
        progetto_id: undefined,
        stima_minuti: 60,
        descrizione: "",
      });
    }
  }, [task, open, form]);

  const onSubmit = async (data: TaskFormValues) => {
    const values = data as TaskFormValues;
    try {
      if (isEdit) {
        await updateTask.mutateAsync({ id: task.id, data: values });
      } else {
        await createTask.mutateAsync(values);
      }
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Errore durante il salvataggio del task:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2">
            {isEdit ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
            {isEdit ? "Modifica Task" : "Nuova Task Backlog"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="titolo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Titolo Task</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-muted border-border font-medium" placeholder="Es: Design Homepage" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="progetto_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Progetto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted border-border">
                          <SelectValue placeholder="Opzionale" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border text-white">
                        {progetti?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stima_minuti"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Stima (Minuti)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="bg-muted border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">
                Annulla
              </Button>
              <Button type="submit" disabled={createTask.isPending || updateTask.isPending} className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px]">
                {(createTask.isPending || updateTask.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEdit ? "Salva Modifiche" : "Aggiungi al Backlog")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
