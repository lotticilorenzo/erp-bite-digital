import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useBudget } from "@/hooks/useBudget";
import type { BudgetConsuntivo } from "@/types/budget";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";

interface BudgetTableProps {
  mese: Date;
  data: BudgetConsuntivo[];
  isLoading: boolean;
}

export function BudgetTable({ mese, data, isLoading }: BudgetTableProps) {
  const { upsertBudget } = useBudget(mese);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [valore, setValore] = useState<string>("");

  const handleEdit = (item: BudgetConsuntivo) => {
    setEditingId(item.categoria_id);
    setValore(item.importo_budget.toString());
  };

  const handleSave = async (categoria_id: string) => {
    try {
      await upsertBudget.mutateAsync({
        categoria_id,
        mese_competenza: format(mese, "yyyy-MM-01"),
        importo_budget: parseFloat(valore),
      });
      toast.success("Budget aggiornato");
      setEditingId(null);
    } catch (error) {
      toast.error("Errore durante l'aggiornamento");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Caricamento budget...</div>;
  }

  const totalBudget = data.reduce((acc, curr) => acc + curr.importo_budget, 0);
  const totalSpent = data.reduce((acc, curr) => acc + curr.importo_speso, 0);
  const totalPerc = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPI Riassuntivi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card/50 border border-border p-6 rounded-3xl space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Budget Totale</p>
          <p className="text-3xl font-black text-white">{totalBudget.toLocaleString('it-IT')}€</p>
        </div>
        <div className="bg-card/50 border border-border p-6 rounded-3xl space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Speso Reale</p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-black text-white">{totalSpent.toLocaleString('it-IT')}€</p>
            <span className={`text-sm font-bold flex items-center gap-1 mb-1 ${totalPerc > 100 ? 'text-red-500' : 'text-emerald-500'}`}>
              {totalPerc > 100 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
              {totalPerc.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="bg-card/50 border border-border p-6 rounded-3xl space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Rimanente</p>
          <p className={`text-3xl font-black ${(totalBudget - totalSpent) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {(totalBudget - totalSpent).toLocaleString('it-IT')}€
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground h-12">Categoria</TableHead>
              <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground h-12">Budget</TableHead>
              <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground h-12">Speso</TableHead>
              <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground h-12 w-[300px]">Progresso</TableHead>
              <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground h-12 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => {
              const perc = item.percentuale;
              const isOver = perc >= 100;
              const isWarn = perc >= 80 && perc < 100;

              return (
                <TableRow key={item.categoria_id} className="border-border hover:bg-muted/20 transition-colors">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.categoria_colore }} />
                      <span className="font-bold text-white">{item.categoria_nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingId === item.categoria_id ? (
                      <Input
                        type="number"
                        value={valore}
                        onChange={(e) => setValore(e.target.value)}
                        className="w-32 bg-muted h-9 rounded-lg font-bold"
                        autoFocus
                      />
                    ) : (
                      <span className="font-bold text-white">{item.importo_budget.toLocaleString('it-IT')}€</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-bold">{item.importo_speso.toLocaleString('it-IT')}€</span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Progress 
                        value={Math.min(perc, 100)} 
                        className={`h-2 rounded-full bg-muted overflow-hidden`}
                        style={{ "--progress-foreground": isOver ? "#ef4444" : isWarn ? "#f59e0b" : "var(--primary)" } as React.CSSProperties}
                      />
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
                        <span className={isOver ? "text-red-500" : isWarn ? "text-amber-500" : "text-muted-foreground"}>
                          {perc}% Utilizzato
                        </span>
                        <span className="text-muted-foreground">
                          Residuo: {item.rimanente.toLocaleString('it-IT')}€
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === item.categoria_id ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="h-8 rounded-lg font-bold text-muted-foreground"
                        >
                          Annulla
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSave(item.categoria_id)}
                          className="h-8 rounded-lg font-bold bg-primary text-white"
                        >
                          Salva
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(item)}
                        className="h-8 rounded-lg font-bold text-primary hover:text-primary hover:bg-primary/10"
                      >
                        Modifica
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <AlertCircle size={40} className="opacity-20" />
                    <p className="font-bold">Nessun budget impostato per questo mese</p>
                    <p className="text-sm">Inizia impostando un budget per una categoria o copia dal mese precedente.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
