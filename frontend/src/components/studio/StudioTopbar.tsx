import { 
  ChevronRight, 
  Layout, 
  ListTodo, 
  Calendar as CalendarIcon,
  Settings,
  MoreVertical,
  Filter,
  ArrowUpDown,
  Layers
} from "lucide-react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useStudio } from "@/hooks/useStudio";
import { Button } from "@/components/ui/button";
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

export function StudioTopbar() {
  const { nav, setView, currentFolder, currentList } = useStudio();

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
            
            {currentFolder && (
              <>
                <BreadcrumbSeparator className="text-[#1e293b]">
                  <ChevronRight className="h-3 w-3" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbLink 
                    className="text-xs font-bold text-muted-foreground hover:text-white transition-colors cursor-pointer"
                    onClick={() => {}}
                  >
                    {currentFolder.ragione_sociale}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}

            {currentList && (
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
          </BreadcrumbList>
        </Breadcrumb>

        <div className="h-4 w-[1px] bg-muted" />

        <div className="flex items-center bg-card/80 p-1 rounded-xl border border-border/50 shadow-inner">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("list")}
            className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              nav.view === "list" ? "bg-primary text-white shadow-lg" : "text-[#475569] hover:text-muted-foreground"
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
              nav.view === "kanban" ? "bg-primary text-white shadow-lg" : "text-[#475569] hover:text-muted-foreground"
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
              nav.view === "cal" ? "bg-primary text-white shadow-lg" : "text-[#475569] hover:text-muted-foreground"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            Calendario
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-6 w-[1px] bg-muted mx-2" />

        <NotificationCenter />
        
        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#475569] hover:text-white hover:bg-white/5">
          <Filter className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#475569] hover:text-white hover:bg-white/5">
          <ArrowUpDown className="h-4 w-4" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#475569] hover:text-white hover:bg-white/5">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
            <DropdownMenuItem className="text-xs font-bold text-muted-foreground hover:text-white focus:bg-muted">
              <Settings className="h-3.5 w-3.5 mr-2" />
              Configura Lista
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs font-bold text-muted-foreground hover:text-white focus:bg-muted">
              <Layers className="h-3.5 w-3.5 mr-2" />
              Gestisci Stati
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
