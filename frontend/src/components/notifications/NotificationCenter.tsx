import { 
  Bell, 
  Check, 
  Info, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'URGENTE': return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case 'AVVISO': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'FATTURA': return <Info className="h-4 w-4 text-orange-500" />;
      case 'APPROVAZIONE': return <CheckCircle2 className="h-4 w-4 text-sky-500" />;
      case 'SUCCESS': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'CRITICAL': return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case 'ERROR': return <AlertCircle className="h-4 w-4 text-rose-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative hover:bg-white/5 active:scale-95 transition-all duration-200"
        >
          <Bell className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white ring-2 ring-background animate-in zoom-in duration-300">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0 bg-card border-border shadow-2xl overflow-hidden rounded-xl" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
             <h4 className="font-bold text-sm text-foreground">Notifiche</h4>
             {unreadCount > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-black bg-primary/10 text-primary border-none">{unreadCount} Nuove</Badge>}
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                markAllAsRead();
              }}
              className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
            >
              Lette Tutte
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border/50">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={cn(
                    "p-4 hover:bg-muted/30 transition-all cursor-pointer relative group",
                    !n.is_read && "bg-primary/[0.02]"
                  )}
                  onClick={() => !n.is_read && markAsRead(n.id)}
                >
                  {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
                  <div className="flex gap-3">
                    <div className="mt-0.5">{getIcon(n.type)}</div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-sm leading-none", !n.is_read ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
                          {n.title}
                        </p>
                        <time className="text-[10px] text-muted-foreground whitespace-nowrap opacity-60">
                          {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: it })}
                        </time>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed opacity-80">
                        {n.message}
                      </p>
                      {n.link && (
                        <Link 
                          to={n.link}
                          className="flex items-center gap-1 text-[10px] text-primary font-bold uppercase tracking-wider mt-2 group-hover:underline"
                        >
                          Visualizza <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center border border-border/50 group">
                 <Check className="h-6 w-6 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Tutto pronto!</p>
                <p className="text-xs text-muted-foreground mt-1">Non hai nessuna nuova notifica.</p>
              </div>
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t border-border/50 bg-muted/10">
             <Button variant="ghost" className="w-full h-8 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors">
                Mostra archivio completo
             </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
