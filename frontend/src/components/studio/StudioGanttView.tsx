import React from "react";
import {
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GanttChart } from "@/components/gantt/GanttChart";
import { useAssenze } from "@/hooks/useAssenze";
import { useStudio } from "@/hooks/useStudio";
import { useTaskMutations, useTasks } from "@/hooks/useTasks";
import { useUsers } from "@/hooks/useUsers";

export function StudioGanttView() {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [period, setPeriod] = React.useState<"week" | "month">("month");
  const { nav, currentFolder, currentList, openNewTask, openTab } = useStudio();
  const { updateTask } = useTaskMutations();

  const taskFilters = React.useMemo(() => {
    if (nav.selectedListId) {
      return { progetto_id: nav.selectedListId };
    }
    if (nav.selectedFolderId) {
      return { commessa_id: nav.selectedFolderId };
    }
    return undefined;
  }, [nav.selectedFolderId, nav.selectedListId]);

  const { data: tasks = [] } = useTasks(taskFilters);
  const { data: users = [] } = useUsers();

  const rangeStart = React.useMemo(
    () =>
      format(
        period === "week"
          ? startOfWeek(currentDate, { weekStartsOn: 1 })
          : startOfMonth(currentDate),
        "yyyy-MM-dd"
      ),
    [currentDate, period]
  );

  const rangeEnd = React.useMemo(
    () =>
      format(
        period === "week"
          ? endOfWeek(currentDate, { weekStartsOn: 1 })
          : endOfMonth(currentDate),
        "yyyy-MM-dd"
      ),
    [currentDate, period]
  );

  const { assenze = [] } = useAssenze({
    start_date: rangeStart,
    end_date: rangeEnd,
  });

  const ganttTasks = React.useMemo(
    () => tasks.filter((task) => task.data_inizio && task.due_date),
    [tasks]
  );

  const activeAssenze = React.useMemo(
    () => assenze.filter((item) => item.stato !== "RIFIUTATA"),
    [assenze]
  );

  const groupedUsers = React.useMemo(() => {
    const ids = new Set(ganttTasks.map((task) => task.assegnatario_id).filter(Boolean));
    return users.filter((user) => ids.has(user.id));
  }, [ganttTasks, users]);

  const scopeLabel =
    currentList?.nome ||
    currentFolder?.ragione_sociale ||
    "Portfolio completo";

  const handlePrevious = () => {
    setCurrentDate((prev) =>
      period === "week" ? subWeeks(prev, 1) : subMonths(prev, 1)
    );
  };

  const handleNext = () => {
    setCurrentDate((prev) =>
      period === "week" ? addWeeks(prev, 1) : addMonths(prev, 1)
    );
  };

  const handleTaskClick = (taskId: string) => {
    const task = ganttTasks.find((item) => item.id === taskId);
    if (!task) return;
    openTab({ type: "TASK", title: task.title, linkedId: task.id });
  };

  const handleTaskDateChange = async (taskId: string, newStart: string, newEnd: string) => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        data: {
          data_inizio: newStart,
          data_scadenza: newEnd,
        },
      });
      toast.success("Timeline aggiornata");
    } catch {
      toast.error("Errore durante l'aggiornamento della timeline");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/50">
      <div className="border-b border-border/40 bg-card/40 px-8 py-5 backdrop-blur-md">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <CalendarRange className="h-4 w-4 text-primary" />
              <h2 className="text-base font-black uppercase tracking-tight text-white">
                Studio Gantt
              </h2>
              <Badge className="border-primary/20 bg-primary/10 font-black text-primary">
                {scopeLabel}
              </Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Timeline per risorsa con task schedulati, assenze e drag diretto sulle date.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center rounded-xl border border-border bg-background/30 p-1">
              <Button
                variant={period === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPeriod("week")}
                className="h-8 text-[10px] font-black uppercase tracking-widest"
              >
                Settimana
              </Button>
              <Button
                variant={period === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPeriod("month")}
                className="h-8 text-[10px] font-black uppercase tracking-widest"
              >
                Mese
              </Button>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/30 p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                className="h-8 w-8 text-muted-foreground hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[190px] px-3 text-center text-xs font-black uppercase tracking-widest text-white">
                {period === "week"
                  ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "dd MMM", { locale: it })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "dd MMM", { locale: it })}`
                  : format(currentDate, "MMMM yyyy", { locale: it })}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="h-8 w-8 text-muted-foreground hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={() => openNewTask(nav.selectedFolderId, nav.selectedListId)}
              className="h-9 gap-2 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuovo Task
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          <Card className="border-border bg-card/50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Task in timeline
            </p>
            <p className="mt-2 text-3xl font-black text-white">{ganttTasks.length}</p>
          </Card>
          <Card className="border-border bg-card/50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Risorse coinvolte
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <p className="text-3xl font-black text-white">{groupedUsers.length}</p>
            </div>
          </Card>
          <Card className="border-border bg-card/50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Assenze in vista
            </p>
            <p className="mt-2 text-3xl font-black text-white">{activeAssenze.length}</p>
          </Card>
        </div>

        {ganttTasks.length > 0 ? (
          <GanttChart
            tasks={ganttTasks}
            users={users}
            assenze={activeAssenze}
            groupBy="assignee"
            period={period}
            anchorDate={currentDate}
            onTaskClick={handleTaskClick}
            onTaskDateChange={handleTaskDateChange}
          />
        ) : (
          <Card className="border-dashed border-border/60 bg-card/30 p-10 text-center">
            <p className="text-sm font-black uppercase tracking-widest text-white">
              Nessun task con date pianificate
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
              Il Gantt si popola appena i task hanno sia data inizio sia data fine. Puoi crearne uno nuovo o completare la pianificazione dai dettagli task.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
