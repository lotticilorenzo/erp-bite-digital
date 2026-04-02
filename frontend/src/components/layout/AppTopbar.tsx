import { Fragment } from "react";
import { 
  Bell, 
  Search, 
  SwitchCamera, 
  Timer, 
  Plus
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation, Link } from "react-router-dom";

export function AppTopbar() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  const getBreadcrumbLabel = (path: string) => {
    switch (path) {
      case "clienti": return "Clienti";
      case "progetti": return "Progetti";
      case "commesse": return "Commesse";
      case "timesheet": return "Timesheet";
      case "studio-os": return "Studio OS";
      default: return path.charAt(0) ? path.charAt(0).toUpperCase() + path.slice(1) : "Home";
    }
  };

  return (
    <header className="flex sticky top-0 z-30 h-14 shrink-0 items-center justify-between border-b border-border/50 bg-[#020617]/80 backdrop-blur-xl px-4">
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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Cerca..." 
            className="h-8 w-64 pl-9 bg-white/5 border-border/50 text-xs focus-visible:ring-1 focus-visible:ring-primary/50 placeholder:text-muted-foreground/50 transition-all"
          />
          <kbd className="absolute right-2 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-white/5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        <div className="flex items-center space-x-1 border-x border-border/50 px-2 h-8">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary animate-pulse">
            <Timer className="h-3.5 w-3.5" />
            <span className="text-xs font-bold tabular-nums">00:00:00</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg active:scale-95 transition-all">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg active:scale-95 transition-all">
            <SwitchCamera className="h-4 w-4" />
          </Button>
          <Button 
            className="h-8 px-4 text-xs font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 rounded-lg active:scale-95 transition-all ml-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nuovo Progetto
          </Button>
        </div>
      </div>
    </header>
  );
}
