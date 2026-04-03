import { useState, useEffect } from "react";
import { Square, Timer, ChevronUp, RefreshCw, CheckCircle2 } from "lucide-react";
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
    <div className="fixed bottom-0 left-0 right-0 h-[48px] bg-[#0f172a] border-t border-purple-500/30 flex items-center px-4 z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.3)]">
      <div className="container mx-auto flex items-center justify-between gap-4">
        {/* Left: Active Task Info */}
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center animate-pulse">
            <Timer className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-purple-400 font-medium uppercase tracking-wider leading-none">
              In corso
            </span>
            <span className="text-sm text-gray-100 font-medium truncate">
              {activeTimer.task_title || "Task senza titolo"}
            </span>
          </div>
        </div>

        {/* Center: Timer Display */}
        <div className="flex items-center gap-6">
          <div className="text-xl font-mono text-white tabular-nums tracking-wider leading-none">
            {elapsed}
          </div>
          <div className="h-4 w-[1px] bg-gray-700 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-8 px-3 gap-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 transition-all duration-200"
              onClick={handleStop}
            >
              <Square className="w-3 h-3 fill-current" />
              <span className="hidden sm:inline">Ferma</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 gap-2 bg-white/5 hover:bg-white/10 text-gray-300 border-white/10"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span className="hidden sm:inline">Switch</span>
                  <ChevronUp className="w-3 h-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-[#1e293b] border-gray-700 text-gray-200">
                <DropdownMenuLabel className="text-xs font-semibold text-gray-400">
                  I tuoi task attivi
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                <div className="max-h-[300px] overflow-y-auto">
                  {tasks?.filter(t => t.id !== activeTimer.task_id).map((task) => (
                    <DropdownMenuItem
                      key={task.id}
                      className="gap-2 cursor-pointer focus:bg-white/5 focus:text-purple-400 py-2"
                      onClick={() => handleSwitch(task.id)}
                    >
                      <CheckCircle2 className="w-4 h-4 text-gray-500" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{task.title}</span>
                        <span className="text-[10px] text-gray-400">Clicca per iniziare</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {(!tasks || tasks.length <= 1) && (
                    <div className="p-4 text-center text-xs text-gray-500">
                      Nessun altro task assegnato disponibile per lo switch rapido.
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
