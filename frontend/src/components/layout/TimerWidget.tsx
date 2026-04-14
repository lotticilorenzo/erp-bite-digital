import { useState } from "react";
import { useStudio } from "@/hooks/useStudio";
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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
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
          <span className="text-[9px] text-muted-foreground leading-none">
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
        <DialogContent className="bg-card border-border shadow-2xl text-white sm:max-w-[400px] rounded-[2rem] overflow-hidden p-0">
          <DialogHeader className="p-5 border-b border-border/50">
            <DialogTitle className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-lg">
              <CheckCircle2 className="w-5 h-5" />
              Sessione Completata
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-6">
            <div className="p-6 rounded-[1.5rem] bg-emerald-500/10 border border-emerald-500/20 text-center shadow-inner">
              <p className="text-xs text-emerald-400/80 uppercase tracking-[0.2em] font-black">Tempo Registrato</p>
              <p className="text-5xl font-black text-emerald-400 mt-2 tracking-tighter drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">{formatTime(seconds)}</p>
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-[#475569] flex items-center gap-1.5 opacity-80">Note Rapide Lavoro</Label>
              <Input 
                value={note} 
                onChange={(e) => setNote(e.target.value)}
                placeholder="Es. Sviluppo UI componenti..."
                className="bg-muted/50 border-border/50 text-white h-12 rounded-xl shadow-inner placeholder:italic focus:ring-emerald-500"
              />
            </div>
          </div>
          <DialogFooter className="p-5 border-t border-border/40 bg-card/40 flex-row justify-end space-x-3">
            <Button 
              variant="ghost" 
              onClick={() => { setShowSaveDialog(false); setLastStoppedSessionId(null); }}
              className="text-muted-foreground hover:text-white rounded-xl h-12 px-6 font-bold uppercase text-[10px] tracking-widest"
            >
              Annulla
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 hover:scale-[1.02] shadow-[0_0_20px_rgba(52,211,153,0.3)] active:scale-95 transition-all text-white font-black h-12 rounded-[1rem] uppercase tracking-widest text-xs"
            >
              {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "SALVA NEL TIMESHEET"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
