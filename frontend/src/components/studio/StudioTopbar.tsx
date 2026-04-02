import { 
  ChevronRight, 
  Layout, 
  ListTodo, 
  Calendar as CalendarIcon,
  Settings,
  MoreVertical,
  Activity,
  Filter,
  ArrowUpDown,
  Layers
} from "lucide-react";
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
    <div className="h-14 border-b border-[#1e293b]/30 bg-[#020617]/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
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
                    className="text-xs font-bold text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
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
                    <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
                    {currentList.nome}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="h-4 w-[1px] bg-[#1e293b]" />

        <div className="flex items-center bg-[#0f172a]/80 p-1 rounded-xl border border-[#1e293b]/50 shadow-inner">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("list")}
            className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              nav.view === "list" ? "bg-primary text-white shadow-lg" : "text-[#475569] hover:text-[#94a3b8]"
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
              nav.view === "kanban" ? "bg-primary text-white shadow-lg" : "text-[#475569] hover:text-[#94a3b8]"
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
              nav.view === "cal" ? "bg-primary text-white shadow-lg" : "text-[#475569] hover:text-[#94a3b8]"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            Calendario
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f172a]/50 border border-[#1e293b]/50">
          <Activity className="h-3.5 w-3.5 text-[#10b981] animate-pulse" />
          <span className="text-[10px] font-black text-[#94a3b8] uppercase tracking-tighter">Live Sync</span>
        </div>

        <div className="h-6 w-[1px] bg-[#1e293b] mx-2" />

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
          <DropdownMenuContent align="end" className="w-48 bg-[#0f172a] border-[#1e293b]">
            <DropdownMenuItem className="text-xs font-bold text-[#94a3b8] hover:text-white focus:bg-[#1e293b]">
              <Settings className="h-3.5 w-3.5 mr-2" />
              Configura Lista
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs font-bold text-[#94a3b8] hover:text-white focus:bg-[#1e293b]">
              <Layers className="h-3.5 w-3.5 mr-2" />
              Gestisci Stati
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
