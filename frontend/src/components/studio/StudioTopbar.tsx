import React from "react";
import {
  ChevronRight,
  Layout,
  ListTodo,
  Calendar as CalendarIcon,
  CalendarRange,
  Settings,
  MoreVertical,
  Filter,
  ArrowUpDown,
  Layers,
  Users,
  LayoutDashboard,
  StopCircle,
  Timer,
} from "lucide-react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useStudio } from "@/hooks/useStudio";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/hooks/useTasks";
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from "@/components/ui/breadcrumb";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

function useTimerDisplay() {
  const { timer } = useStudio();
  const { data: tasks = [] } = useTasks({ parent_only: false });
  const [, forceRender] = React.useState(0);

  React.useEffect(() => {
    if (!timer.active_session) return;
    const id = setInterval(() => forceRender(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [timer.active_session]);

  if (!timer.active_session) return null;

  const task = tasks.find(t => t.id === timer.active_session?.task_id);
  const elapsed = timer.getElapsed(timer.active_session.task_id);
  const totalSeconds = Math.floor(elapsed / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const timeStr = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return { session: timer.active_session, task, timeStr, stop: timer.stop };
}

export function StudioTopbar() {
  const { nav, setView, currentFolder, currentList, selectList } = useStudio();
  const timerInfo = useTimerDisplay();

  return (
    <div className="h-14 border-b border-border/30 bg-background/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink 
                className="text-[10px] uppercase font-black tracking-widest text-[#475569] hover:text-primary transition-colors cursor-pointer"
                onClick={() => setView("home")}
              >
                STUDIO OS
              </BreadcrumbLink>
            </BreadcrumbItem>
            
            {currentFolder && nav.view !== "chat" && (
              <>
                <BreadcrumbSeparator className="text-[#1e293b]">
                  <ChevronRight className="h-3 w-3" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbLink 
                    className="text-xs font-bold text-muted-foreground hover:text-white transition-colors cursor-pointer"
                    onClick={() => {
                      if (currentList) {
                        selectList(null);
                      }
                      setView("overview");
                    }}
                  >
                    {currentFolder.ragione_sociale}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}

            {currentList && nav.view !== "chat" && (
              <>
                <BreadcrumbSeparator className="text-[#1e293b]">
                  <ChevronRight className="h-3 w-3" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-black text-white flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.2)]" />
                    {currentList.nome}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}

            {nav.view === "chat" && (
              <>
                <BreadcrumbSeparator className="text-[#1e293b]">
                  <ChevronRight className="h-3 w-3" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest">
                    <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.2)]" />
                    Chat Hub
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="h-4 w-[1px] bg-muted" />

        <div className="flex items-center bg-card/80 p-1 rounded-xl border border-border/50 shadow-inner">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("overview")}
            className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              nav.view === "overview" ? "bg-primary text-white shadow-lg" : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
            Overview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("list")}
            className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              nav.view === "list" ? "bg-primary text-white shadow-lg" : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            <ListTodo className="h-3.5 w-3.5 mr-1.5" />
            Lista
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("kanban")}
            className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              nav.view === "kanban" ? "bg-primary text-white shadow-lg" : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            <Layout className="h-3.5 w-3.5 mr-1.5" />
            Board
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("cal")}
            className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              nav.view === "cal" ? "bg-primary text-white shadow-lg" : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            Calendario
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("gantt")}
            className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              nav.view === "gantt" ? "bg-primary text-white shadow-lg" : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            <CalendarRange className="h-3.5 w-3.5 mr-1.5" />
            Gantt
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("team")}
            className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              nav.view === "team" ? "bg-primary text-white shadow-lg" : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Team
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Active timer pill */}
        {timerInfo && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 shadow-[0_0_12px_hsl(var(--primary)/0.2)]">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <Timer className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-black text-primary tabular-nums uppercase tracking-widest">{timerInfo.timeStr}</span>
            {timerInfo.task && (
              <span className="text-[10px] text-primary/70 font-medium max-w-[120px] truncate">
                {timerInfo.task.title}
              </span>
            )}
            <button
              onClick={() => timerInfo.stop(timerInfo.session.id)}
              className="ml-1 text-primary/70 hover:text-primary transition-colors"
            >
              <StopCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="h-6 w-[1px] bg-muted mx-2" />

        <NotificationCenter />
      </div>
    </div>
  );
}
