import { useState } from "react";
import { useStudio } from "@/context/StudioContext";
import { useTask } from "@/hooks/useTasks";
import { useSaveTimerToTimesheet } from "@/hooks/useTimer";

import { 
  Timer, 
  StopCircle, 
  Loader2,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const { timer } = useStudio();
  const { active_session, stop, getElapsed } = timer;
  const { data: activeTask } = useTask(active_session?.task_id || null);
  const saveMutation = useSaveTimerToTimesheet();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [lastStoppedSessionId, setLastStoppedSessionId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const elapsedMs = getElapsed(active_session?.task_id || "");
  const seconds = Math.floor(elapsedMs / 1000);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStop = () => {
    if (active_session) {
      setLastStoppedSessionId(active_session.id);
      stop(active_session.id);
      setShowSaveDialog(true);
    }
  };

  const handleSave = async () => {
    if (lastStoppedSessionId) {
      await saveMutation.mutateAsync({
        session_ids: [lastStoppedSessionId],
        commessa_id: activeTask?.commessa_id,
        note: note
      });
      setShowSaveDialog(false);
      setNote("");
      setLastStoppedSessionId(null);
    }
  };

  if (!active_session && !showSaveDialog) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#64748b]">
        <Clock className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wider">Nessun task attivo</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end mr-2">
          <span className="text-[10px] font-black text-purple-400 uppercase tracking-tighter truncate max-w-[150px]">
            {activeTask?.title || "Caricamento task..."}
          </span>
          <span className="text-[9px] text-[#64748b] leading-none">
            In corso
          </span>
        </div>

        <div className={`
          flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500
          bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.1)]
        `}>
          <Timer className="h-3.5 w-3.5 animate-pulse" />
          <span className="text-xs font-black tabular-nums tracking-tighter">
            {formatTime(seconds)}
          </span>
        </div>

        <div className="flex items-center ml-1">
          <Button 
            size="icon" 
            onClick={handleStop}
            className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg active:scale-95 transition-all"
          >
            <StopCircle className="h-3.5 w-3.5 fill-current" />
          </Button>
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
              onClick={() => { setShowSaveDialog(false); setLastStoppedSessionId(null); }}
              className="text-[#64748b] hover:text-white"
            >
              Annulla
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white font-black"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "SALVA NEL TIMESHEET"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
