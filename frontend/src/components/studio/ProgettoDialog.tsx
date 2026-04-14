import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";

interface ProgettoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProgettoDialog({ open, onOpenChange }: ProgettoDialogProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post("/studio/nodes", {
        nome: data.nome,
        tipo: "project",
        is_private: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-hierarchy"] });
      toast.success("Progetto creato con successo");
      reset();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Errore durante la creazione del progetto");
    }
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card text-white border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Nuovo Progetto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome Progetto</Label>
            <Input
              id="nome"
              placeholder="Esempio: Campagna Marketing Q3"
              className="bg-background border-border focus-visible:ring-primary/30"
              {...register("nome", { required: true })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creazione..." : "Crea Progetto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
