import { useState, useEffect, useRef } from "react";
import { 
  Timer, 
  Play, 
  Pause, 
  StopCircle, 
  ChevronDown,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCommesse } from "@/hooks/useCommesse";
import { useCreateTimesheetManual, useClickUpTasks } from "@/hooks/useTimesheet";
import { format, startOfMonth } from "date-fns";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TimerWidget() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCommessaId, setSelectedCommessaId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [note, setNote] = useState("");
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { data: commesse } = useCommesse({ mese: format(startOfMonth(new Date()), "yyyy-MM-dd") });
  const { data: clickupData } = useClickUpTasks();
  const createMutation = useCreateTimesheetManual();

  // Load state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("bite-timer");
    if (saved) {
      const { seconds: s, isRunning: r, lastUpdate, commessaId } = JSON.parse(saved);
      if (r) {
        const diff = Math.floor((Date.now() - lastUpdate) / 1000);
        setSeconds(s + diff);
        setIsRunning(true);
      } else {
        setSeconds(s);
      }
      setSelectedCommessaId(commessaId);
    }
  }, []);

  // Save state to localStorage
  useEffect(() => {
    const timerData = {
      seconds,
      isRunning,
      lastUpdate: Date.now(),
      commessaId: selectedCommessaId
    };
    localStorage.setItem("bite-timer", JSON.stringify(timerData));
  }, [seconds, isRunning, selectedCommessaId]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (!selectedCommessaId) return;
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    setShowSaveDialog(true);
  };

  const handleSave = async () => {
    const minutes = Math.max(1, Math.round(seconds / 60));
    const commessa = commesse?.find(c => c.id === selectedCommessaId);
    
    await createMutation.mutateAsync({
      cliente_id: commessa?.cliente_id,
      commessa_id: selectedCommessaId,
      durata_minuti: minutes,
      data_attivita: format(new Date(), "yyyy-MM-dd"),
      note: note,
      servizio: "Sviluppo" // Default o dinamico
    });

    setSeconds(0);
    setNote("");
    setShowSaveDialog(false);
    localStorage.removeItem("bite-timer");
  };

  const selectedCommessa = commesse?.find(c => c.id === selectedCommessaId);

  return (
    <>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={isRunning}
              className={`h-8 border-[#334155] bg-[#0f172a] text-xs font-medium transition-all ${isRunning ? 'opacity-50' : 'hover:border-purple-500/50'}`}
            >
              {selectedCommessa ? (
                <span className="truncate max-w-[120px]">{selectedCommessa.cliente?.ragione_sociale}</span>
              ) : (
                "Seleziona Commessa"
              )}
              <ChevronDown className="ml-2 h-3 w-3 text-[#64748b]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#0f172a] border-[#1e293b] text-white w-[250px]">
            <DropdownMenuLabel className="text-[10px] uppercase text-[#64748b]">Commesse Attive</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#1e293b]" />
            {commesse?.map((c) => (
              <DropdownMenuItem 
                key={c.id} 
                className="text-xs hover:bg-[#1e293b] cursor-pointer"
                onClick={() => setSelectedCommessaId(c.id)}
              >
                {c.cliente?.ragione_sociale}
              </DropdownMenuItem>
            ))}
            {!commesse?.length && (
              <div className="p-2 text-center text-[10px] text-[#475569]">Nessuna commessa questo mese</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className={`
          flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500
          ${isRunning 
            ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
            : 'bg-[#1e293b] border-[#334155] text-[#94a3b8]'
          }
        `}>
          <Timer className={`h-3.5 w-3.5 ${isRunning ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-black tabular-nums tracking-tighter">
            {formatTime(seconds)}
          </span>
        </div>

        <div className="flex items-center ml-1">
          {!isRunning ? (
            <Button 
              size="icon" 
              onClick={handleStart}
              disabled={!selectedCommessaId}
              className="h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg active:scale-95 transition-all disabled:opacity-30"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <div className="flex items-center gap-1">
               <Button 
                size="icon" 
                onClick={() => setIsRunning(false)}
                className="h-8 w-8 rounded-full bg-amber-600 hover:bg-amber-500 text-white shadow-lg active:scale-95 transition-all"
              >
                <Pause className="h-3.5 w-3.5 fill-current" />
              </Button>
              <Button 
                size="icon" 
                onClick={handleStop}
                className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg active:scale-95 transition-all"
              >
                <StopCircle className="h-3.5 w-3.5 fill-current" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-[#0f172a] border-[#1e293b] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              Sessione Completata
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-sm text-[#94a3b8] uppercase tracking-widest font-black">Tempo Totale</p>
              <p className="text-4xl font-black text-white mt-1">{formatTime(seconds)}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#64748b]">Cosa hai fatto?</Label>
              <Input 
                value={note} 
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note brevi sull'attività..."
                className="bg-[#1e293b] border-[#334155] text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => { setShowSaveDialog(false); setSeconds(0); }}
              className="text-[#64748b] hover:text-white"
            >
              Scarta
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white font-black"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "SALVA TIMESHEET"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
