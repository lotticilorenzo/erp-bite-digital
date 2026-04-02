import { Fragment } from "react";
import { 
  Search, 
  SwitchCamera, 
  Plus
} from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, Link } from "react-router-dom";

export function AppTopbar() {
  const { user } = useAuth();
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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#475569] group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Cerca..." 
            className="h-8 w-64 pl-9 bg-[#0f172a] border-[#334155] text-xs focus-visible:ring-1 focus-visible:ring-primary/50 placeholder:text-[#475569] text-white transition-all"
          />
          <kbd className="absolute right-2 top-1.5 hidden h-5 select-none items-center gap-1 rounded border border-[#334155] bg-[#1e293b] px-1.5 font-mono text-[10px] font-medium text-[#94a3b8] opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        <div className="flex items-center px-4 h-8 border-x border-[#1e293b]">
          <TimerWidget />
        </div>

        <div className="flex items-center gap-1">
          <NotificationDropdown />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#94a3b8] hover:text-white hover:bg-[#1e293b] rounded-lg active:scale-95 transition-all">
            <SwitchCamera className="h-4 w-4" />
          </Button>

          <div className="h-6 w-[1px] bg-[#1e293b] mx-2 hidden md:block" />

          <Avatar className="h-7 w-7 rounded-lg border border-[#334155] shadow-lg hidden md:block cursor-pointer hover:border-primary/50 transition-colors">
            <AvatarImage src={`https://avatar.vercel.sh/${user?.email}.png`} />
            <AvatarFallback className="rounded-lg bg-primary/20 text-white text-[10px] font-black">
              {user?.nome?.[0]}
            </AvatarFallback>
          </Avatar>

          <Button 
            className="h-8 px-4 text-xs font-black bg-primary text-white shadow-[0_0_20px_rgba(124,58,237,0.2)] hover:bg-primary/90 hover:shadow-primary/30 rounded-lg active:scale-95 transition-all ml-2 uppercase tracking-wide"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5 stroke-[3]" />
            Nuovo
          </Button>
        </div>
      </div>
    </header>
  );
}
