import React, { useEffect } from "react";
import { ClienteTable } from "@/components/clienti/ClienteTable";
import { ClienteDialog } from "@/components/clienti/ClienteDialog";
import { useClienti } from "@/hooks/useClienti";
import type { Cliente } from "@/types";
import { useSearchParams } from "react-router-dom";
import { PageTransition } from "@/components/common/PageTransition";

export default function ClientiPage() {
  const { data: clienti = [], isLoading } = useClienti();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedCliente, setSelectedCliente] = React.useState<Cliente | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const handleEdit = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedCliente(null);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      handleNew();
      // Remove param after triggering
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  return (
    <PageTransition>
      <div className="p-8 space-y-8 pt-4 pb-12">
        <header className="flex flex-col gap-1 px-1">
          <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic underline decoration-primary/30 decoration-8 underline-offset-[12px] mb-4">
            Clienti
          </h1>
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mt-2">
            Gestione integrale del portfolio aziendale e contatti operativi.
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
    </PageTransition>
  );
}
