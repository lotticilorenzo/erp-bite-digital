import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO, addWeeks, subWeeks } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Briefcase, CheckCircle2, User as UserIcon, ChevronLeft, ChevronRight, LayoutGrid, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Timesheet } from "@/types";
import { Badge } from "@/components/ui/badge";

interface TimesheetCalendarProps {
  timesheets: Timesheet[];
  currentMonth: Date;
  onView: (t: Timesheet) => void;
  onAdd: (date: Date) => void;
}

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export function TimesheetCalendar({ timesheets, currentMonth, onView, onAdd }: TimesheetCalendarProps) {
  const [viewType, setViewType] = useState<"month" | "week">("month");
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(currentMonth, { weekStartsOn: 1 }));

  // Keep currentWeek in sync if currentMonth changes from parent
  useEffect(() => {
    if (viewType === "week" && !isSameMonth(currentWeek, currentMonth)) {
      setCurrentWeek(startOfWeek(currentMonth, { weekStartsOn: 1 }));
    }
  }, [currentMonth, viewType]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  
  const getCalendarDays = () => {
    if (viewType === "month") {
      return eachDayOfInterval({
        start: startOfWeek(monthStart, { weekStartsOn: 1 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
      });
    } else {
      return eachDayOfInterval({
        start: currentWeek,
        end: endOfWeek(currentWeek, { weekStartsOn: 1 }),
      });
    }
  };

  const calendarDays = getCalendarDays();

  const handlePrevWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const handleNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const handleTodayWeek = () => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="flex flex-col h-full bg-background/50 rounded-xl overflow-hidden">
      {/* Calendar Header Tools */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/40 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex bg-muted/30 border border-border/50 rounded-lg p-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewType("month")}
              className={`h-7 px-3 text-xs ${viewType === "month" ? "bg-muted text-white shadow-sm" : "text-muted-foreground hover:text-white"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Mese
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewType("week")}
              className={`h-7 px-3 text-xs ${viewType === "week" ? "bg-muted text-white shadow-sm" : "text-muted-foreground hover:text-white"}`}
            >
              <LayoutList className="w-3.5 h-3.5 mr-1.5" /> Settimana
            </Button>
          </div>
          
          {viewType === "week" && (
            <div className="flex items-center gap-1 border border-border/30 rounded-lg p-0.5 bg-black/20">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white" onClick={handlePrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-3 text-[10px] uppercase font-bold text-muted-foreground hover:text-white tracking-widest" onClick={handleTodayWeek}>
                Oggi
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        
        {viewType === "week" && (
          <div className="text-xs font-black uppercase text-purple-400 tracking-wider">
            Settimana {format(calendarDays[0], "d MMM", {locale: it})} - {format(calendarDays[6], "d MMM", {locale: it})}
          </div>
        )}
      </div>

      {/* Week Days Header */}
      <div className="grid grid-cols-7 border-b border-border/50 bg-card/60 backdrop-blur-md sticky top-[53px] z-10 shadow-sm">
        {calendarDays.slice(0, 7).map((day, i) => (
          <div key={day.toISOString()} className={`py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] border-r border-border/30 last:border-r-0 ${
            isSameDay(day, new Date()) ? 'text-primary bg-primary/5' : 'text-[#475569] bg-transparent'
          } ${i >= 5 ? 'bg-muted/10' : ''}`}>
            {format(day, 'EEEE', { locale: it })}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={`flex-1 grid grid-cols-7 overflow-y-auto ${viewType === "month" ? "auto-rows-fr" : "h-full"}`}>
        {calendarDays.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          
          const dayTimesheets = timesheets.filter(t => t.data_attivita && isSameDay(parseISO(t.data_attivita), day));
          const dailyMinutes = dayTimesheets.reduce((acc, t) => acc + t.durata_minuti, 0);

          return (
            <div 
              key={i} 
              className={`p-2 border-r border-b border-border/20 transition-colors group relative flex flex-col ${
                viewType === "month" ? 'min-h-[140px]' : 'min-h-[500px]'
              } ${
                viewType === "month" && !isCurrentMonth ? 'opacity-30 bg-muted/5' : 'bg-transparent hover:bg-white/5'
              } ${i % 7 >= 5 ? 'bg-muted/5' : ''} ${isToday ? 'bg-primary/[0.02]' : ''}`}
            >
              <div className="flex justify-between items-start mb-3 sticky top-0 bg-transparent z-10 backdrop-blur-[2px] pb-1">
                <span className={`text-sm font-black w-7 h-7 flex items-center justify-center rounded-md ${
                  isToday ? 'bg-primary text-white shadow-[0_0_10px_hsl(var(--primary)/0.2)]' : 'text-muted-foreground'
                }`}>
                  {format(day, 'd')}
                </span>
                
                <div className="flex gap-1 items-center">
                  {dailyMinutes > 0 && (
                    <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${
                      isToday ? 'border-primary/30 text-primary bg-primary/10' : 'border-purple-500/30 text-purple-400 bg-purple-500/10'
                    }`}>
                      {formatDuration(dailyMinutes)}
                    </Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-white hover:bg-primary/20 transition-all rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(day);
                    }}
                    title="Aggiungi ore"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className={`flex-1 space-y-2 pr-1 custom-scrollbar ${viewType === "month" ? 'overflow-y-auto' : 'overflow-visible'}`}>
                {dayTimesheets.map(t => (
                  <div 
                    key={t.id}
                    onClick={() => onView(t)}
                    className={`p-2 rounded-lg border text-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group/item flex flex-col gap-1.5 shadow-sm ${
                      t.stato === 'APPROVATO' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 shadow-[0_4px_12px_hsl(var(--emerald-500)/0.05)]' 
                      : t.stato === 'PENDING'
                      ? 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40 shadow-[0_4px_12px_hsl(var(--blue-500)/0.05)]'
                      : 'bg-primary/10 border-primary/20 hover:bg-primary/20 shadow-[0_4px_12px_hsl(var(--primary)/0.05)]'
                    }`}
                    title={t.servizio || t.task_display_name || 'Lavoro'}
                  >
                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                      <div className="flex items-center gap-1.5 truncate">
                        {t.stato === 'APPROVATO' ? (
                           <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                        ) : (
                           <Briefcase className={`h-3 w-3 shrink-0 ${t.stato === 'PENDING' ? 'text-blue-400' : 'text-primary'}`} />
                        )}
                        <span className={`font-bold truncate ${
                           t.stato === 'APPROVATO' ? 'text-emerald-300' : t.stato === 'PENDING' ? 'text-blue-300' : 'text-white'
                        }`}>
                          {t.task_display_name || t.servizio || "Attività"}
                        </span>
                      </div>
                      <span className="font-black tracking-tighter shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-white shadow-inner">
                        {formatDuration(t.durata_minuti)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-[#94a3b8] text-[10px] font-medium truncate uppercase tracking-wider">
                      <UserIcon className="h-2.5 w-2.5 shrink-0 opacity-70" />
                      <span className="truncate">{t.user?.nome} {t.user?.cognome}</span>
                    </div>

                    {viewType === "week" && (t.servizio || t.note) && (
                      <div className="mt-1 text-[10px] italic text-[#64748b] truncate">
                        {t.servizio || t.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
