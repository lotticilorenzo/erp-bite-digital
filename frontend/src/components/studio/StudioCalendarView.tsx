import React from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/hooks/useStudio";
import { useTasks } from "@/hooks/useTasks";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval 
} from "date-fns";
import { it } from "date-fns/locale";

export function StudioCalendarView() {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const { selectTask } = useStudio();
  const { data } = useTasks();

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const tasks = React.useMemo(() => {
    if (!data) return [];
    return data.filter(t => t.due_date); // Only tasks with dates
  }, [data]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#020617]/50">
      <div className="flex items-center justify-between px-8 py-4 border-b border-[#1e293b]/50 bg-[#0f172a]/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-black text-white uppercase tracking-tighter">
            {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 text-[#475569] hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="h-8 px-4 text-[10px] font-black uppercase tracking-widest text-[#475569] hover:text-white" onClick={() => setCurrentMonth(new Date())}>
            Oggi
          </Button>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 text-[#475569] hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-7 border-b border-[#1e293b]/30">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
          <div key={day} className="py-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#475569] border-r border-[#1e293b]/30 last:border-r-0 bg-[#0f172a]/20">
            {day}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
        {calendarDays.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const dayTasks = tasks.filter(t => t.due_date && isSameDay(new Date(t.due_date), day));

          return (
            <div 
              key={i} 
              className={`min-h-[120px] p-2 border-r border-b border-[#1e293b]/10 bg-transparent hover:bg-white/5 transition-colors group relative ${
                !isCurrentMonth ? 'opacity-20' : ''
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className={`text-xs font-black p-1 rounded-md min-w-[24px] text-center ${
                  isToday ? 'bg-primary text-white shadow-[0_0_10px_rgba(124,58,237,0.5)]' : 'text-[#475569]'
                }`}>
                  {format(day, 'd')}
                </span>
                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-[#1e293b] hover:text-primary transition-all">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-1">
                {dayTasks.map(task => (
                  <div 
                    key={task.id}
                    onClick={() => selectTask(task.id)}
                    className="px-2 py-1 bg-primary/10 border border-primary/20 rounded-lg text-[10px] font-bold text-primary truncate hover:bg-primary/20 cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Zap className="h-2 w-2" />
                    {task.title}
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
