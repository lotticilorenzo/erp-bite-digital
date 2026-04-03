import React from "react";
import { ClienteTable } from "@/components/clienti/ClienteTable";
import { ClienteDialog } from "@/components/clienti/ClienteDialog";
import { useClienti } from "@/hooks/useClienti";
import type { Cliente } from "@/types";

export default function ClientiPage() {
  const { data: clienti = [], isLoading } = useClienti();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedCliente, setSelectedCliente] = React.useState<Cliente | null>(null);

  const handleEdit = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedCliente(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pt-4 pb-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl font-black tracking-tight text-foreground mb-1">Clienti</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Gestisci il tuo portfolio clienti, i dettagli di fatturazione e i contatti.
        </p>
      </header>

      <ClienteTable 
        clienti={clienti} 
        isLoading={isLoading} 
        onEdit={handleEdit} 
        onNew={handleNew} 
      />

      <ClienteDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        cliente={selectedCliente} 
      />
    </div>
  );
}
