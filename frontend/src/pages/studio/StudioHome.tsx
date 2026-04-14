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
  Flame,
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
import { format, isToday, isBefore, parseISO } from "date-fns";
import { it } from "date-fns/locale";

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
  const { timer, openNewTask, openTab, setView, selectList } = useStudio();

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
  const inProgress = allTasks.filter((t) => t.state_id === "process" || t.state_id === "IN_CORSO");
  const dueToday = allTasks.filter(
    (t) => t.due_date && isToday(parseISO(t.due_date)) && t.state_id !== "closed" && t.state_id !== "COMPLETATO"
  );
  const overdue = allTasks.filter(
    (t) =>
      t.due_date &&
      isBefore(parseISO(t.due_date), new Date()) &&
      !isToday(parseISO(t.due_date)) &&
      t.state_id !== "closed" &&
      t.state_id !== "COMPLETATO"
  );

  const activeTimerTask = timer.active_session
    ? allTasks.find((t) => t.id === timer.active_session!.task_id)
    : null;

  const getUserInitials = (id?: string | null) => {
    if (!id) return "?";
    const u = utenti.find((u: any) => u.id === id);
    return u ? `${u.nome[0]}${u.cognome[0]}`.toUpperCase() : "?";
  };

  const stats = [
    {
      title: "Task Totali",
      value: allTasks.length,
      icon: Zap,
      color: "text-primary",
      bg: "bg-primary/10",
      onClick: () => setView("list"),
    },
    {
      title: "In Corso",
      value: inProgress.length,
      icon: Flame,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      onClick: () => setView("list"),
    },
    {
      title: "Scadono Oggi",
      value: dueToday.length,
      icon: CalendarIcon,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      onClick: () => setView("list"),
    },
    {
      title: "Scadute",
      value: overdue.length,
      icon: AlertCircle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      onClick: () => setView("list"),
    },
  ];

  return (
    <div className="overflow-auto h-full custom-scrollbar">
      <div className="p-8 pb-16 space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 mb-1">
              {format(new Date(), "EEEE d MMMM yyyy", { locale: it })}
            </p>
            <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
              {greet()},{" "}
              <span className="text-primary italic">
                {user ? `${user.nome}` : "Studio OS"}
              </span>
            </h1>
            <p className="text-muted-foreground font-medium">
              {myTasks.length > 0
                ? `Hai ${myTasks.length} task assegnate${overdue.length > 0 ? `, di cui ${overdue.length} scadute` : ""}.`
                : "Nessuna task assegnata. Buona giornata!"}
            </p>
          </div>
          <div className="flex items-center gap-3">
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
              <p className="text-sm font-black text-white truncate">{activeTimerTask.title}</p>
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.title}
              onClick={stat.onClick}
              className="bg-card/40 border-border/50 backdrop-blur-xl group hover:border-primary/30 transition-all duration-500 overflow-hidden relative cursor-pointer hover:scale-[1.02] active:scale-[0.99]"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                  {stat.title}
                </CardTitle>
                <div className={`h-8 w-8 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="text-4xl font-black text-white group-hover:scale-110 transition-transform origin-left duration-500">
                  {stat.value}
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/20 mt-1 group-hover:text-primary/40 transition-colors">
                  Vedi lista →
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* My Tasks */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-card/40 border-border/50 backdrop-blur-xl rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-border/30 px-6 py-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wider">
                    <Target className="h-4 w-4 text-primary" />
                    Le Mie Task
                    <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black">
                      {myTasks.filter((t) => t.state_id !== "closed" && t.state_id !== "COMPLETATO").length}
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
                    <p className="text-xs font-black uppercase tracking-widest">Nessuna task assegnata</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {myTasks.slice(0, 6).map((task) => {
                      const isActive = timer.active_session?.task_id === task.id;
                      const isOverdue =
                        task.due_date &&
                        isBefore(parseISO(task.due_date), new Date()) &&
                        !isToday(parseISO(task.due_date)) &&
                        task.state_id !== "closed" &&
                        task.state_id !== "COMPLETATO";

                      return (
                        <div
                          key={task.id}
                          onClick={() => openTab({ type: "TASK", title: task.title, linkedId: task.id })}
                          className={`px-6 py-4 flex items-center gap-4 hover:bg-white/[0.03] cursor-pointer transition-colors group ${isActive ? "bg-primary/5" : ""}`}
                        >
                          {/* Status dot */}
                          <div
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                              isActive
                                ? "bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                                : task.state_id === "closed" || task.state_id === "COMPLETATO"
                                ? "bg-emerald-500"
                                : task.state_id === "IN_CORSO" || task.state_id === "process"
                                ? "bg-blue-400"
                                : "bg-muted"
                            }`}
                          />

                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold truncate leading-none mb-1 ${
                                isActive ? "text-white" : "text-foreground/80 group-hover:text-white"
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
                                      : "text-muted-foreground/50"
                                  }`}
                                >
                                  <CalendarIcon className="h-2.5 w-2.5" />
                                  {format(parseISO(task.due_date), "d MMM", { locale: it })}
                                  {isOverdue && " · SCADUTA"}
                                  {isToday(parseISO(task.due_date)) && " · OGGI"}
                                </span>
                              )}
                              {task.stima_minuti && task.stima_minuti > 0 && (
                                <span className="text-[10px] text-muted-foreground/40 font-medium">
                                  {task.stima_minuti >= 60
                                    ? `${Math.floor(task.stima_minuti / 60)}h est.`
                                    : `${task.stima_minuti}m est.`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Timer */}
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

                          <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Overdue Tasks Alert */}
            {overdue.length > 0 && (
              <Card className="bg-red-500/5 border-red-500/20 backdrop-blur-xl rounded-2xl overflow-hidden">
                <CardHeader className="px-6 py-4 border-b border-red-500/10">
                  <CardTitle className="text-xs font-black text-red-400 flex items-center gap-2 uppercase tracking-wider">
                    <AlertCircle className="h-4 w-4" />
                    Task Scadute · {overdue.length}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {overdue.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      onClick={() => openTab({ type: "TASK", title: task.title, linkedId: task.id })}
                      className="px-6 py-3 flex items-center gap-3 hover:bg-red-500/5 cursor-pointer transition-colors border-b border-red-500/10 last:border-0"
                    >
                      <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <p className="text-[13px] font-bold text-red-300/80 flex-1 truncate">{task.title}</p>
                      <span className="text-[10px] font-black text-red-400/70 shrink-0">
                        {format(parseISO(task.due_date!), "d MMM", { locale: it })}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">

            {/* Team in Action — who has timer running */}
            <Card className="bg-card/40 border-border/50 backdrop-blur-xl rounded-2xl overflow-hidden">
              <CardHeader className="px-5 py-4 border-b border-border/20">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  Team Online
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {utenti.length === 0 ? (
                  <p className="px-5 py-4 text-[10px] text-muted-foreground/30 font-medium italic">
                    Nessun collaboratore trovato.
                  </p>
                ) : (
                  utenti.slice(0, 6).map((u: any) => {
                    const uTask = allTasks.find(
                      (t) => t.assegnatario_id === u.id && timer.active_session?.task_id === t.id
                    );
                    const isTracking = !!uTask;

                    return (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 px-5 py-3 border-b border-border/10 last:border-0 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="relative shrink-0">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                            {u.nome[0]}{u.cognome[0]}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                              isTracking ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-muted/60"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-foreground/70 leading-none mb-0.5">
                            {u.nome} {u.cognome}
                          </p>
                          {isTracking ? (
                            <p className="text-[9px] font-bold text-emerald-400/80 truncate flex items-center gap-1">
                              <Timer className="h-2.5 w-2.5" />
                              {uTask!.title}
                            </p>
                          ) : (
                            <p className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                              {u.ruolo}
                            </p>
                          )}
                        </div>
                        {isTracking && (
                          <span className="text-[10px] font-black text-emerald-400 tabular-nums shrink-0">
                            {formatTime(timer.getElapsed(uTask!.id))}
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
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white leading-tight">Sessioni Oggi</h3>
                  <p className="text-xs text-muted-foreground/60 mt-0.5 font-medium">
                    {allTasks.filter((t) => (t.tempo_trascorso_minuti || 0) > 0).length} task con tempo registrato
                  </p>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-white tabular-nums">
                    {Math.floor(
                      allTasks.reduce((sum, t) => sum + (t.tempo_trascorso_minuti || 0), 0) / 60
                    )}
                  </span>
                  <span className="text-sm font-bold text-primary/70 mb-0.5">ore totali</span>
                </div>
              </div>
            </Card>

            {/* Quick access — due today */}
            {dueToday.length > 0 && (
              <Card className="bg-yellow-500/5 border-yellow-500/20 backdrop-blur-xl rounded-2xl overflow-hidden">
                <CardHeader className="px-5 py-4 border-b border-yellow-500/10">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400/70 flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Scadono Oggi · {dueToday.length}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {dueToday.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      onClick={() => openTab({ type: "TASK", title: task.title, linkedId: task.id })}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-yellow-500/5 cursor-pointer transition-colors border-b border-yellow-500/10 last:border-0"
                    >
                      <div className="h-2 w-2 rounded-full bg-yellow-400/60 shrink-0" />
                      <p className="text-[12px] font-bold text-foreground/70 flex-1 truncate">{task.title}</p>
                      {getUserInitials(task.assegnatario_id) !== "?" && (
                        <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary text-[9px] font-black flex items-center justify-center shrink-0">
                          {getUserInitials(task.assegnatario_id)}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
