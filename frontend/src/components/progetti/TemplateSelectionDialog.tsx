import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProgettoTemplates, useApplyTemplate } from "@/hooks/useProgetti";
import { Loader2, Zap, Layout } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TemplateSelectionDialogProps {
  progettoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateSelectionDialog({ progettoId, open, onOpenChange }: TemplateSelectionDialogProps) {
  const { data: templates, isLoading } = useProgettoTemplates();
  const applyTemplate = useApplyTemplate();
  const [selectedTemplate, setSelectedTemplate] = React.useState<string | null>(null);

  const handleApply = async () => {
    if (!selectedTemplate) return;
    try {
      await applyTemplate.mutateAsync({ progettoId, templateId: selectedTemplate });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Applica Template Progetto
          </DialogTitle>
          <DialogDescription>
            Seleziona un template per generare automaticamente milestone e task.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : templates?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground italic">
                Nessun template trovato.
              </div>
            ) : (
              templates?.map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3",
                    selectedTemplate === t.id
                      ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]"
                      : "bg-muted/30 border-border hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "mt-0.5 p-2 rounded-lg",
                    selectedTemplate === t.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <Layout className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">{t.nome}</h4>
                    {t.descrizione && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {t.descrizione}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t border-border">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">
            Annulla
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={!selectedTemplate || applyTemplate.isPending}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
          >
            {applyTemplate.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Applica Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
