import { Fragment, useState, useEffect } from "react";
import { 
  Search, 
  Plus,
  UserPlus,
  Briefcase,
  ListTodo,
  HelpCircle,
  BookOpen
} from "lucide-react";
import { ThemePanel } from "../ThemePanel";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TimerWidget } from "./TimerWidget";
import { NotificationDropdown } from "./NotificationDropdown";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/common/UserAvatar";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useStudio } from "@/hooks/useStudio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HelpCenterPanel } from "../common/HelpCenterPanel";

export function AppTopbar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { openNewTask } = useStudio();
  const pathnames = location.pathname.split("/").filter((x) => x);
  const isStudioOS = location.pathname.startsWith("/studio-os");

  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        return;
      }
      
      if (e.key === '?') {
        setIsHelpOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getBreadcrumbLabel = (path: string) => {
    switch (path) {
      case "clienti": return "Clienti";
      case "progetti": return "Progetti";
      case "commesse": return "Commesse";
      case "timesheet": return "Timesheet";
      case "studio-os": return "Studio OS";
      case "settings": return "Impostazioni";
      case "profile": return "Profilo";
      case "account": return "Account";
      case "appearance": return "Aspetto";
      case "notifications": return "Notifiche";
      case "privacy": return "Privacy";
      default: return path.charAt(0) ? path.charAt(0).toUpperCase() + path.slice(1) : "Home";
    }
  };

  const handleNewTask = () => {
    openNewTask();
    if (!isStudioOS) {
      navigate("/studio-os/list");
    }
  };

  return (
    <header className="flex sticky top-0 z-30 h-14 shrink-0 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5 active:scale-95 transition-all" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {pathnames.map((path, i) => (
              <Fragment key={path}>
                <BreadcrumbSeparator className="text-muted-foreground/30" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link 
                      to={`/${pathnames.slice(0, i + 1).join("/")}`}
                      className={`transition-colors hover:text-foreground ${i === pathnames.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                    >
                      {getBreadcrumbLabel(path)}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Search Bar - Minimal Linear Style */}
        <div className="relative hidden lg:block group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#475569] group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Cerca..." 
            className="h-8 w-64 pl-9 bg-card border-border text-xs focus-visible:ring-1 focus-visible:ring-primary/50 placeholder:text-[#475569] text-foreground transition-all"
          />
          <kbd className="absolute right-2 top-1.5 hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        <div className="flex items-center px-4 h-8 border-x border-border">
          <TimerWidget />
        </div>

        <div className="flex items-center gap-1">
          <NotificationDropdown />
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground" 
            onClick={() => navigate("/wiki")}
            title="Wiki Aziendale"
          >
            <BookOpen className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground" 
            onClick={() => setIsHelpOpen(true)}
            title="Centro Assistenza"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <ThemePanel />

          <div className="h-6 w-[1px] bg-muted mx-2 hidden md:block" />

          <Link to="/settings/profile">
            <UserAvatar 
              user={user} 
              size="sm" 
              className="h-7 w-7 rounded-lg border border-border shadow-lg hidden md:block cursor-pointer hover:border-primary/50 transition-colors" 
            />
          </Link>

          {isStudioOS ? (
            <Button 
              onClick={handleNewTask}
              className="h-8 px-4 text-xs font-black bg-primary text-white shadow-[0_0_20px_hsl(var(--primary)/0.2)] hover:bg-primary/90 hover:shadow-primary/30 rounded-lg active:scale-95 transition-all ml-2 uppercase tracking-wide"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5 stroke-[3]" />
              Nuovo
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  className="h-8 px-4 text-xs font-black bg-primary text-white shadow-[0_0_20px_hsl(var(--primary)/0.2)] hover:bg-primary/90 hover:shadow-primary/30 rounded-lg active:scale-95 transition-all ml-2 uppercase tracking-wide"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5 stroke-[3]" />
                  Nuovo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border text-foreground">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1.5">Azioni Rapide</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={handleNewTask} className="text-xs font-bold py-2 focus:bg-primary/10 cursor-pointer">
                  <ListTodo className="h-4 w-4 mr-2 text-primary" />
                  Nuovo Task
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/clienti?action=new")} className="text-xs font-bold py-2 focus:bg-primary/10 cursor-pointer">
                  <UserPlus className="h-4 w-4 mr-2 text-emerald-500" />
                  Nuovo Cliente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/commesse?action=new")} className="text-xs font-bold py-2 focus:bg-primary/10 cursor-pointer">
                  <Briefcase className="h-4 w-4 mr-2 text-blue-500" />
                  Nuova Commessa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <HelpCenterPanel open={isHelpOpen} onOpenChange={setIsHelpOpen} />
    </header>
  );
}
