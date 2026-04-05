import React, { useState } from "react";
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
import { useBudget } from "@/hooks/useBudget";
import { toast } from "sonner";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategoryModal({ isOpen, onClose }: CategoryModalProps) {
  const [nome, setNome] = useState("");
  const [colore, setColore] = useState("#7c3aed");
  const { createCategory } = useBudget();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    try {
      await createCategory.mutateAsync({ nome, colore });
      toast.success("Categoria creata con successo");
      setNome("");
      onClose();
    } catch (error) {
      toast.error("Errore durante la creazione della categoria");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border shadow-2xl rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16"/><path d="M5 6v14"/><path d="M19 6v14"/><path d="M3 6h18"/><path d="M11 6V3a1 1 0 0 1 2 0v3"/></svg>
            </div>
            Nuova Categoria Budget
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6 mt-4">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="nome" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                Nome Categoria
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="es. Marketing, Software..."
                className="bg-muted/50 border-border focus:ring-primary h-11 rounded-xl text-white font-medium"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="colore" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                Colore Identificativo
              </Label>
              <div className="flex gap-3 items-center">
                <Input
                  id="colore"
                  type="color"
                  value={colore}
                  onChange={(e) => setColore(e.target.value)}
                  className="w-16 h-11 p-1 bg-muted/50 border-border rounded-xl cursor-pointer"
                />
                <Input
                  value={colore}
                  onChange={(e) => setColore(e.target.value)}
                  className="bg-muted/50 border-border focus:ring-primary h-11 rounded-xl text-white font-mono uppercase"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl font-bold border-border hover:bg-muted"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              className="rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all"
              disabled={createCategory.isPending}
            >
              {createCategory.isPending ? "Salvataggio..." : "Crea Categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
