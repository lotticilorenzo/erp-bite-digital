import { useState, useMemo } from "react";
import { useTasks } from "@/hooks/useTasks";
import { useStudio } from "@/hooks/useStudio";
import { GanttChart } from "@/components/gantt/GanttChart";
import { StudioTaskModal } from "@/components/studio/StudioTaskModal";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Calendar, 
  User as UserIcon, 
  FolderSearch,
  Maximize2,
  Settings2
} from "lucide-react";
import { useClienti } from "@/hooks/useClienti";
import { useUsers } from "@/hooks/useUsers";

export default function GanttPage() {
  const { selectTask } = useStudio();
  const { data: tasks = [], isLoading } = useTasks({ parent_only: false });
  const { data: clienti = [] } = useClienti();
  const { data: utenti = [] } = useUsers();

  const [filters, setFilters] = useState({
    cliente_id: "all",
    assegnatario_id: "all",
    period: "month" as "week" | "month" | "quarter",
    showCompleted: false,
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filters.cliente_id !== "all" && t.folder_id !== filters.cliente_id) return false;
      if (filters.assegnatario_id !== "all" && t.assegnatario_id !== filters.assegnatario_id) return false;
      if (!filters.showCompleted && (t.state_id === "COMPLETATO" || t.state_id === "done")) return false;
      return true;
    });
  }, [tasks, filters]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0c10]" style={{ width: "100%", overflowX: "hidden" }}>
      {/* Premium Header */}
      <div className="shrink-0 p-4 md:p-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-gradient-to-b from-[#11141d] to-transparent w-full">
        <div className="space-y-1">
           <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20">
                 <Maximize2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Gantt Timeline</h1>
                <p className="text-[10px] font-bold text-[#475569] uppercase tracking-widest mt-0.5">
                  Visualizzazione cronologica e carichi di lavoro
                </p>
              </div>
           </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-4 bg-card/20 backdrop-blur-md p-2 rounded-2xl border border-white/5 shadow-2xl w-full xl:w-auto">
           <div className="flex items-center gap-2 px-2 md:px-3 border-r border-white/10 shrink-0">
              <FolderSearch className="h-4 w-4 text-slate-500" />
              <Select value={filters.cliente_id} onValueChange={(v) => setFilters(f => ({...f, cliente_id: v}))}>
                <SelectTrigger className="w-32 md:w-40 bg-transparent border-none text-[10px] md:text-xs font-black text-white hover:text-primary transition-colors focus:ring-0 px-0 md:px-3">
                  <SelectValue placeholder="Tutti i Clienti" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">Tutti i Clienti</SelectItem>
                  {clienti.map(c => <SelectItem key={c.id} value={c.id}>{c.ragione_sociale}</SelectItem>)}
                </SelectContent>
              </Select>
           </div>

           <div className="flex items-center gap-2 px-2 md:px-3 border-r border-white/10 shrink-0">
              <UserIcon className="h-4 w-4 text-slate-500" />
              <Select value={filters.assegnatario_id} onValueChange={(v) => setFilters(f => ({...f, assegnatario_id: v}))}>
                <SelectTrigger className="w-32 md:w-40 bg-transparent border-none text-[10px] md:text-xs font-black text-white hover:text-primary transition-colors focus:ring-0 px-0 md:px-3">
                  <SelectValue placeholder="Tutti gli Utenti" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">Tutti gli Utenti</SelectItem>
                  {utenti.map(u => <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>)}
                </SelectContent>
              </Select>
           </div>

           <div className="flex items-center gap-2 px-2 md:px-3 border-r md:border-r-0 xl:border-r border-white/10 shrink-0">
              <Calendar className="h-4 w-4 text-slate-500" />
              <Select value={filters.period} onValueChange={(v: any) => setFilters(f => ({...f, period: v}))}>
                <SelectTrigger className="w-24 md:w-40 bg-transparent border-none text-[10px] md:text-xs font-black text-white hover:text-primary transition-colors focus:ring-0 px-0 md:px-3">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="week">Settimana</SelectItem>
                  <SelectItem value="month">Mese</SelectItem>
                  <SelectItem value="quarter">Trimestre</SelectItem>
                </SelectContent>
              </Select>
           </div>

           <div className="flex items-center gap-4 md:gap-6 px-2 md:px-4 shrink-0">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="show-completed" 
                  checked={filters.showCompleted} 
                  onCheckedChange={(c) => setFilters(f => ({...f, showCompleted: !!c}))}
                  className="border-primary data-[state=checked]:bg-primary rounded-md"
                />
                <Label 
                  htmlFor="show-completed"
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer"
                >
                  Chiuse
                </Label>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white transition-colors">
                 <Settings2 className="h-4 w-4" />
              </Button>
           </div>
        </div>
      </div>

      {/* Gantt Container - FULL WIDTH */}
      <div className="flex-1 w-full overflow-hidden min-w-0 min-h-0 flex flex-col px-8 pb-8">
        {isLoading ? (
           <div className="w-full h-[600px] flex flex-col items-center justify-center space-y-4 bg-card/10 rounded-3xl border border-white/5">
             <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
             <p className="text-xs font-black uppercase tracking-widest text-[#475569]">Caricamento Timeline...</p>
           </div>
        ) : (
          <GanttChart 
            tasks={filteredTasks} 
            period={filters.period} 
            onTaskClick={(id) => selectTask(id)}
          />
        )}
      </div>

      <StudioTaskModal />
    </div>
  );
}
