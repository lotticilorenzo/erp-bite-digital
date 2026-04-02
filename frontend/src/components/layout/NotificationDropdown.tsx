import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  FileText, 
  CheckCircle, 
  Info, 
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export function NotificationDropdown() {
  const navigate = useNavigate();
  const { 
    unreadCount, 
    hasUrgent, 
    markAsRead, 
    markAllAsRead,
    allNodes,
    unreadNodes,
    importantNodes 
  } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case "URGENTE": return <AlertTriangle className="h-4 w-4 text-rose-500" />;
      case "AVVISO": return <Clock className="h-4 w-4 text-amber-500" />;
      case "FATTURA": return <FileText className="h-4 w-4 text-orange-500" />;
      case "APPROVAZIONE": return <CheckCircle className="h-4 w-4 text-sky-500" />;
      case "INFO": return <Info className="h-4 w-4 text-emerald-500" />;
      default: return <Bell className="h-4 w-4 text-slate-400" />;
    }
  };

  const handleNotificationClick = (n: any) => {
    markAsRead(n.id);
    navigate(n.link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-white/5 transition-colors group">
          <Bell className={cn(
            "h-5 w-5 text-slate-400 group-hover:text-white transition-colors",
            hasUrgent && "animate-pulse color-rose-500"
          )} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white border-2 border-[#0f172a]">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[380px] bg-[#0f172a] border-[#1e293b] p-0 shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#111827]/50">
          <h3 className="text-sm font-black text-white tracking-widest uppercase italic">Notifiche</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
              className="text-[10px] h-7 px-2 font-black uppercase tracking-wider text-slate-400 hover:text-white"
            >
              Segna tutte come lette
            </Button>
          )}
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-transparent border-b border-[#1e293b] rounded-none h-10 p-0">
            <TabsTrigger value="all" className="data-[state=active]:bg-white/5 data-[state=active]:text-white text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-none">Tutte</TabsTrigger>
            <TabsTrigger value="unread" className="data-[state=active]:bg-white/5 data-[state=active]:text-white text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-none">Non Lette</TabsTrigger>
            <TabsTrigger value="important" className="data-[state=active]:bg-white/5 data-[state=active]:text-white text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-none">Importanti</TabsTrigger>
          </TabsList>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            <TabsContent value="all" className="p-0 m-0">
              <NotificationList nodes={allNodes} onClick={handleNotificationClick} getIcon={getIcon} />
            </TabsContent>
            <TabsContent value="unread" className="p-0 m-0">
              <NotificationList nodes={unreadNodes} onClick={handleNotificationClick} getIcon={getIcon} />
            </TabsContent>
            <TabsContent value="important" className="p-0 m-0">
              <NotificationList nodes={importantNodes} onClick={handleNotificationClick} getIcon={getIcon} />
            </TabsContent>
          </div>
        </Tabs>
        
        <DropdownMenuSeparator className="bg-[#1e293b] m-0" />
        <div className="p-3 bg-[#111827]/30 text-center">
           <Button variant="link" className="text-[10px] h-auto p-0 font-black uppercase tracking-widest text-primary hover:text-primary/80">
             Vedi tutte le attività
           </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationList({ nodes, onClick, getIcon }: { nodes: any[], onClick: (n: any) => void, getIcon: (t: string) => React.ReactNode }) {
  if (nodes.length === 0) {
    return (
      <div className="p-12 text-center">
        <Bell className="h-8 w-8 text-[#1e293b] mx-auto mb-3" />
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nessuna notifica</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {nodes.map((n) => (
        <button
          key={n.id}
          onClick={() => onClick(n)}
          className={cn(
            "w-full text-left p-4 flex gap-4 transition-all hover:bg-white/5 border-b border-[#1e293b]/50 group",
            !n.isRead && "bg-primary/5"
          )}
        >
          <div className={cn(
            "mt-1 p-2 rounded-xl border",
            n.type === "URGENTE" ? "bg-rose-500/10 border-rose-500/20" : "bg-[#1e293b]/50 border-[#334155]"
          )}>
            {getIcon(n.type)}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <p className={cn(
                "text-xs font-black uppercase tracking-tight",
                n.isRead ? "text-slate-200" : "text-white"
              )}>{n.title}</p>
              {!n.isRead && <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(124,58,237,0.5)]" />}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
              {n.description}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 group-hover:text-slate-500">
              {formatDistanceToNow(parseISO(n.timestamp), { addSuffix: true, locale: it })}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
