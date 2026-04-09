import { useState, useEffect } from "react";
import { Square, Timer, ChevronUp } from "lucide-react";
import { useActiveTimer, useStopTimer, useStartTimer } from "@/hooks/useTimer";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TimerBar() {
  const { user } = useAuth();
  const { data: activeTimer } = useActiveTimer();
  const { mutate: stopTimer } = useStopTimer();
  const { mutate: startTimer } = useStartTimer();
  
  // Fetch tasks assigned to the current user for switching
  const { data: tasks } = useTasks({ assegnatario_id: user?.id });

  const [elapsed, setElapsed] = useState<string>("00:00:00");

  useEffect(() => {
    if (!activeTimer?.started_at) return;

    const interval = setInterval(() => {
      const start = new Date(activeTimer.started_at).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, now - start);

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      const pad = (n: number) => n.toString().padStart(2, "0");
      setElapsed(`${pad(h)}:${pad(m)}:${pad(s)}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer?.started_at]);

  if (!activeTimer) return null;

  const handleStop = () => {
    stopTimer({ sessionId: activeTimer.id });
  };

  const handleSwitch = (taskId: string) => {
    if (taskId === activeTimer.task_id) return;
    startTimer(taskId);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-[#121216]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] px-4 py-2.5 flex items-center gap-6 min-w-[400px]">
        {/* Active Task Info */}
        <div className="flex items-center gap-3 border-r border-white/10 pr-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Timer className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div className="flex flex-col min-w-0 max-w-[150px]">
            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-none mb-0.5 opacity-50">
              In registrazione
            </span>
            <span className="text-xs text-white font-bold truncate">
              {activeTimer.task_title || "Task generico"}
            </span>
          </div>
        </div>

        {/* Timer Display */}
        <div className="flex items-center gap-4">
          <div className="text-xl font-black text-white tabular-nums tracking-tighter w-24">
            {elapsed}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="h-9 px-4 bg-primary hover:bg-primary/90 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20"
              onClick={handleStop}
            >
              <Square className="w-3.5 h-3.5 fill-current mr-2" />
              Stop
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10 text-muted-foreground"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" sideOffset={12} className="w-64 bg-[#121216] border-white/10 text-gray-200 rounded-xl shadow-2xl p-2">
                <DropdownMenuLabel className="text-[9px] font-black tracking-widest uppercase opacity-50 px-2 py-1.5">
                  Switch rapido
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  {tasks?.filter(t => t.id !== activeTimer.task_id).map((task) => (
                    <DropdownMenuItem
                      key={task.id}
                      className="gap-3 cursor-pointer rounded-lg focus:bg-primary/10 focus:text-primary p-2 group"
                      onClick={() => handleSwitch(task.id)}
                    >
                      <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold group-focus:bg-primary group-focus:text-white transition-colors">
                        {task.title.substring(0, 1).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold truncate">{task.title}</span>
                        <span className="text-[10px] text-muted-foreground opacity-50">Riprendi attività</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {(!tasks || tasks.length <= 1) && (
                    <div className="p-4 text-center text-[10px] text-muted-foreground italic">
                      Nessun altro task disponibile
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
