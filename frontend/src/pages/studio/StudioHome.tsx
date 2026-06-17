import {
  Zap,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Play,
  StopCircle,
  ChevronRight,
  TrendingUp,
  Users,
  Timer,
  Clock,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTasks } from "@/hooks/useTasks";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudio } from "@/hooks/useStudio";
import { useAllActiveTimers } from "@/hooks/useTimer";
import { useUserCapacity } from "@/hooks/useML";
import { isTaskDone } from "@/lib/taskStatus";
import { useEffect, useMemo, useState } from "react";
import {
  format,
  isToday,
  isBefore,
  isAfter,
  isTomorrow,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { it } from "date-fns/locale";
import type { TaskSO } from "@/types/studio";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export default function StudioHome() {
  const { data, isLoading } = useTasks({ parent_only: true });
  const { data: utenti = [] } = useUsers();
  const { user } = useAuth();
  const { timer, openNewTask, openTab, setView } = useStudio();
  const { data: allActiveTimers = [] } = useAllActiveTimers();
  const { data: capacity } = useUserCapacity(user?.id ?? null);
  const [now, setNow] = useState(() => Date.now());
  const [viewMode, setViewMode] = useState<"oggi" | "settimana">("oggi");

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Week bounds — stable for the lifetime of the component
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekEnd = useMemo(() => endOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  );

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl bg-muted/20" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-3xl bg-muted/20" />
      </div>
    );
  }

  const allTasks = data || [];
  const myTasks = allTasks.filter((t) => t.assegnatario_id === user?.id);

  // midnight today for date comparisons
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  // ── KPI (always today-based) ──────────────────────────────────────────────
  const taskDiOggi = myTasks.filter((t) => {
    if (!t.due_date) return false;
    const d = parseISO(t.due_date);
    if (isToday(d)) return true;
    // started in the past and due tomorrow
    if (
      isTomorrow(d) &&
      t.data_inizio &&
      !isAfter(parseISO(t.data_inizio), todayMidnight)
    )
      return true;
    return false;
  });

  const scadonoOggiCount = myTasks.filter(
    (t) => t.due_date && isToday(parseISO(t.due_date))
  ).length;

  const oreOggi = taskDiOggi.reduce((s, t) => s + (t.stima_minuti || 0), 0) / 60;
  const oreDisp = capacity?.ore_disponibili_oggi;
  const oreLabel = oreDisp
    ? `${oreOggi.toFixed(1)}h (${Math.round((oreOggi / oreDisp) * 100)}%)`
    : `${oreOggi.toFixed(1)}h`;

  const scadute = myTasks.filter((t) => {
    if (!t.due_date) return false;
    const d = parseISO(t.due_date);
    return isBefore(d, todayMidnight) && !isTaskDone(t.state_id);
  });

  // ── "Le mie task" groups (viewMode-aware) ────────────────────────────────
  const sortByDue = (a: TaskSO, b: TaskSO) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  };

  const groupOggi = myTasks
    .filter((t) => {
      if (isTaskDone(t.state_id) || !t.due_date) return false;
      const d = parseISO(t.due_date);
      return viewMode === "oggi"
        ? isToday(d)
        : !isBefore(d, weekStart) && !isAfter(d, new Date());
    })
    .sort(sortByDue);

  const groupProssime = myTasks
    .filter((t) => {
      if (isTaskDone(t.state_id) || !t.due_date) return false;
      const d = parseISO(t.due_date);
      return viewMode === "oggi"
        ? isAfter(d, new Date()) && !isToday(d)
        : !isBefore(d, new Date()) && !isToday(d) && !isAfter(d, weekEnd);
    })
    .sort(sortByDue);

  const groupScadute = [...scadute].sort(sortByDue);

  const activeTimerTask = timer.active_session
    ? allTasks.find((t) => t.id === timer.active_session!.task_id)
    : null;

  // ── Inline task row renderer ──────────────────────────────────────────────
  const renderTaskRow = (task: TaskSO) => {
    const isActive = timer.active_session?.task_id === task.id;
    const isOverdue =
      task.due_date &&
      isBefore(parseISO(task.due_date), todayMidnight) &&
      !isTaskDone(task.state_id);

    return (
      <div
        key={task.id}
        onClick={() => openTab({ type: "TASK", title: task.title, linkedId: task.id })}
        className={`group flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors hover:bg-accent/70 border-b border-border/20 last:border-0 ${
          isActive ? "bg-primary/5" : ""
        }`}
      >
        <div
          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
            isActive
              ? "bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
              : isTaskDone(task.state_id)
              ? "bg-emerald-500"
              : isOverdue
              ? "bg-red-400"
              : "bg-muted"
          }`}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-[13px] font-bold truncate leading-none mb-1 ${
              isActive ? "text-foreground" : "text-soft group-hover:text-foreground"
            }`}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2">
            {task.due_date && (
              <span
                className={`text-[10px] font-bold flex items-center gap-1 ${
                  isOverdue
                    ? "text-red-400"
                    : isToday(parseISO(task.due_date))
                    ? "text-yellow-400"
                    : "text-faint"
                }`}
              >
                <CalendarIcon className="h-2.5 w-2.5" />
                {format(parseISO(task.due_date), "d MMM", { locale: it })}
                {isOverdue && " · SCADUTA"}
                {isToday(parseISO(task.due_date)) && " · OGGI"}
              </span>
            )}
            {(task.stima_minuti || 0) > 0 && (
              <span className="text-[10px] font-medium text-faint">
                {(task.stima_minuti || 0) >= 60
                  ? `${Math.floor((task.stima_minuti || 0) / 60)}h est.`
                  : `${task.stima_minuti}m est.`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isActive ? (
            <>
              <span className="text-sm font-black text-primary tabular-nums">
                {formatTime(timer.getElapsed(task.id))}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  timer.stop(timer.active_session!.id);
                }}
                className="h-7 w-7 text-red-400 hover:bg-red-500/10 rounded-lg"
              >
                <StopCircle className="h-3.5 w-3.5 fill-current" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                timer.start(task.id);
              }}
              className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </Button>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-faint transition-all group-hover:translate-x-1 group-hover:text-primary" />
      </div>
    );
  };

  const emptyGroup = (label: string) => (
    <div className="flex items-center gap-2 px-6 py-3 opacity-30">
      <CheckCircle2 className="h-4 w-4" />
      <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
    </div>
  );

  return (
    <div className="overflow-auto h-full custom-scrollbar">
      <div className="p-8 pb-16 space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-faint">
              {format(new Date(), "EEEE d MMMM yyyy", { locale: it })}
            </p>
            <h1 className="mb-2 text-4xl font-black tracking-tighter text-foreground">
              {greet()},{" "}
              <span className="text-primary italic">
                {user ? user.nome : "Studio OS"}
              </span>
            </h1>
            <p className="text-muted-foreground font-medium">
              {myTasks.length > 0
                ? `Hai ${myTasks.length} task assegnate${scadute.length > 0 ? `, di cui ${scadute.length} scadute` : ""}.`
                : "Nessuna task assegnata. Buona giornata!"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle Oggi / Settimana */}
            <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-xl border border-border/20">
              {(["oggi", "settimana"] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={viewMode === mode ? "default" : "ghost"}
                  onClick={() => setViewMode(mode)}
                  className={`h-7 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg ${
                    viewMode === mode ? "" : "text-faint hover:text-foreground"
                  }`}
                >
                  {mode === "oggi" ? "Oggi" : "Settimana"}
                </Button>
              ))}
            </div>
            <Button
              size="lg"
              onClick={() => openNewTask()}
              className="rounded-xl font-black uppercase tracking-widest px-8 shadow-[0_0_20px_hsl(var(--primary)/0.2)] hover:scale-105 transition-all"
            >
              <Zap className="h-5 w-5 mr-2" />
              Nuova Task
            </Button>
          </div>
        </header>

        {/* Settimana corrente row */}
        {viewMode === "settimana" && (
          <p className="-mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-primary/70">
            Settimana corrente{" "}
            {format(weekStart, "d MMM", { locale: it })}
            {" – "}
            {format(weekEnd, "d MMM", { locale: it })}
          </p>
        )}

        {/* Active Timer Banner */}
        {activeTimerTask && (
          <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in slide-in-from-top-2 duration-500">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Timer className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">
                Timer attivo
              </p>
              <p className="truncate text-sm font-black text-foreground">
                {activeTimerTask.title}
              </p>
            </div>
            <div className="text-2xl font-black text-primary tabular-nums tracking-tighter">
              {formatTime(timer.getElapsed(activeTimerTask.id))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => timer.stop(timer.active_session!.id)}
              className="h-9 px-4 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 border border-red-500/20"
            >
              <StopCircle className="h-4 w-4 fill-current" /> Ferma
            </Button>
          </div>
        )}

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Task di Oggi",
              value: taskDiOggi.length,
              icon: Zap,
              color: "text-primary",
              bg: "bg-primary/10",
              sub: "Scadenza oggi o domani (già iniziate)",
            },
            {
              title: "Scadono Oggi",
              value: scadonoOggiCount,
              icon: CalendarIcon,
              color: "text-yellow-400",
              bg: "bg-yellow-500/10",
              sub: "Vedi lista →",
            },
            {
              title: "Ore programmate",
              value: oreLabel,
              icon: Clock,
              color: "text-sky-400",
              bg: "bg-sky-500/10",
              sub: oreDisp ? `su ${oreDisp}h disponibili` : "Nessun dato capacità",
            },
            {
              title: "Scadute",
              value: scadute.length,
              icon: AlertCircle,
              color: "text-red-400",
              bg: "bg-red-500/10",
              sub: "Totale storico",
            },
          ].map((stat) => (
            <Card
              key={stat.title}
              onClick={() => setView("list")}
              className="app-panel group relative cursor-pointer overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:border-primary/30 active:scale-[0.99]"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-faint">
                  {stat.title}
                </CardTitle>
                <div className={`h-8 w-8 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="origin-left text-3xl font-black text-foreground transition-transform duration-500 group-hover:scale-110 truncate">
                  {stat.value}
                </div>
                <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-faint transition-colors group-hover:text-primary truncate">
                  {stat.sub}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Le mie task — 3 groups */}
          <div className="lg:col-span-2">
            <Card className="app-panel overflow-hidden rounded-3xl">
              <CardHeader className="border-b border-border/30 px-6 py-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
                    <Target className="h-4 w-4 text-primary" />
                    Le Mie Task
                    <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black">
                      {myTasks.filter((t) => !isTaskDone(t.state_id)).length}
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="link"
                    className="text-[10px] font-black text-primary uppercase tracking-widest"
                    onClick={() => setView("list")}
                  >
                    Vedi Tutte
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {myTasks.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-3 opacity-30">
                    <CheckCircle2 className="h-10 w-10" />
                    <p className="text-xs font-black uppercase tracking-widest">
                      Nessuna task assegnata
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Oggi / Questa settimana */}
                    <div className="px-6 pt-3 pb-1 flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-400/70">
                        {viewMode === "oggi" ? "Oggi" : "Questa settimana (fino ad oggi)"}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[8px] font-black px-1.5 py-0 h-4"
                      >
                        {groupOggi.length}
                      </Badge>
                    </div>
                    {groupOggi.length === 0
                      ? emptyGroup("Nessuna task per oggi")
                      : groupOggi.map(renderTaskRow)}

                    {/* Scadute */}
                    {groupScadute.length > 0 && (
                      <>
                        <div className="px-6 pt-4 pb-1 flex items-center gap-2 border-t border-red-500/10 mt-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-red-400/70">
                            Scadute
                          </span>
                          <Badge className="bg-red-500/10 text-red-400 border-none text-[8px] font-black px-1.5 py-0 h-4">
                            {groupScadute.length}
                          </Badge>
                        </div>
                        {groupScadute.map(renderTaskRow)}
                      </>
                    )}

                    {/* Prossime */}
                    <div className="px-6 pt-4 pb-1 flex items-center gap-2 border-t border-border/20 mt-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.25em] text-faint">
                        {viewMode === "oggi" ? "Prossime" : "Resto della settimana"}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[8px] font-black px-1.5 py-0 h-4"
                      >
                        {groupProssime.length}
                      </Badge>
                    </div>
                    {groupProssime.length === 0
                      ? emptyGroup("Nessuna task in arrivo")
                      : groupProssime.map(renderTaskRow)}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Team Online */}
            <Card className="app-panel overflow-hidden rounded-2xl">
              <CardHeader className="px-5 py-4 border-b border-border/20">
                <CardTitle className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-faint">
                  <Users className="h-3.5 w-3.5" />
                  Team Online
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {utenti.length === 0 ? (
                  <p className="px-5 py-4 text-[10px] font-medium italic text-faint">
                    Nessun collaboratore trovato.
                  </p>
                ) : (
                  utenti.slice(0, 8).map((u) => {
                    const activeTimer = allActiveTimers.find(
                      (te) => te.user_id === u.id
                    );
                    const isTracking = !!activeTimer;
                    return (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 border-b border-border/10 px-5 py-3 transition-colors last:border-0 hover:bg-accent/60"
                      >
                        <div className="relative shrink-0">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                            {u.nome[0]}{u.cognome[0]}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                              isTracking
                                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                                : "bg-muted/60"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="mb-0.5 text-[11px] font-black leading-none text-soft">
                            {u.nome} {u.cognome}
                          </p>
                          {isTracking ? (
                            <p className="text-[9px] font-bold text-emerald-400/80 truncate flex items-center gap-1">
                              <Timer className="h-2.5 w-2.5" />
                              {activeTimer.task_title || "Attività senza titolo"}
                            </p>
                          ) : (
                            <p className="text-[9px] font-bold uppercase tracking-widest text-faint">
                              {u.ruolo}
                            </p>
                          )}
                        </div>
                        {isTracking && (
                          <span className="text-[10px] font-black text-emerald-400 tabular-nums shrink-0">
                            {formatTime(
                              now - new Date(activeTimer.started_at).getTime()
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Focus Card */}
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 backdrop-blur-xl rounded-2xl overflow-hidden p-5 relative group">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                  <TrendingUp className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-black leading-tight text-foreground">
                    Sessioni Oggi
                  </h3>
                  <p className="mt-0.5 text-xs font-medium text-muted-strong">
                    {allTasks.filter((t) => (t.tempo_trascorso_minuti || 0) > 0).length}{" "}
                    task con tempo registrato
                  </p>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black tabular-nums text-foreground">
                    {Math.floor(
                      allTasks.reduce(
                        (sum, t) => sum + (t.tempo_trascorso_minuti || 0),
                        0
                      ) / 60
                    )}
                  </span>
                  <span className="text-sm font-bold text-primary/70 mb-0.5">ore totali</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Weekly Calendar */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="h-3.5 w-3.5 text-faint" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-faint">
              Calendario settimanale
            </h2>
            <span className="text-[10px] text-faint/50">
              — {format(weekStart, "d MMM", { locale: it })} → {format(weekEnd, "d MMM", { locale: it })}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayTasks = myTasks.filter(
                (t) => t.due_date && isSameDay(parseISO(t.due_date), day)
              );
              const isCurrentDay = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`rounded-2xl p-3 min-h-[120px] border transition-colors ${
                    isCurrentDay
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/20 bg-muted/5 hover:bg-muted/10"
                  }`}
                >
                  <p
                    className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${
                      isCurrentDay ? "text-primary" : "text-faint"
                    }`}
                  >
                    {format(day, "EEE", { locale: it })}
                  </p>
                  <p
                    className={`text-lg font-black mb-2 leading-none ${
                      isCurrentDay ? "text-primary" : "text-soft"
                    }`}
                  >
                    {format(day, "d")}
                  </p>
                  <div className="space-y-1">
                    {dayTasks.length === 0 ? (
                      <p className="text-[9px] text-faint/30 italic">—</p>
                    ) : (
                      dayTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() =>
                            openTab({ type: "TASK", title: t.title, linkedId: t.id })
                          }
                          className="cursor-pointer px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors group"
                        >
                          <p className="text-[10px] font-bold text-foreground/80 truncate group-hover:text-foreground leading-tight">
                            {t.title}
                          </p>
                          {t.priorita === "alta" && (
                            <span className="text-[8px] font-black uppercase text-red-400">
                              alta
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
