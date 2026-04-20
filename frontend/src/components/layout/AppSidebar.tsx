import React from "react";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ClipboardList,
  Timer,
  Settings,
  ChevronRight,
  LogOut,
  User,
  Zap,
  BarChart3,
  FileText,
  Wallet,
  PieChart,
  ShoppingCart,
  Target,
  BookOpen,
  FolderOpen,
  GripVertical,
  Clapperboard,
  ShieldCheck,
} from "lucide-react";

// ... (other imports)

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Link, useLocation } from "react-router-dom";
import { StudioSidebar } from "@/components/studio/StudioSidebar";

// Ruoli con accesso completo all'ERP
const FULL_ACCESS_ROLES = ["ADMIN", "DEVELOPER", "PM"];
// Ruoli con accesso solo allo Studio OS
const STUDIO_ONLY_ROLES = ["COLLABORATORE", "DIPENDENTE", "FREELANCER"];
const STUDIO_SIDEBAR_WIDTH_KEY = "studio_os_sidebar_width";
const STUDIO_SIDEBAR_DEFAULT_WIDTH = 320;
const STUDIO_SIDEBAR_MIN_WIDTH = 280;
const STUDIO_SIDEBAR_MAX_WIDTH = 440;

const navItems = [
  {
    title: "Generale",
    roles: FULL_ACCESS_ROLES,
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Analytics", url: "/analytics", icon: PieChart },
    ],
  },
  {
    title: "Gestione",
    roles: FULL_ACCESS_ROLES,
    items: [
      { title: "Clienti", url: "/clienti", icon: Users },
      { title: "Progetti", url: "/progetti", icon: FolderOpen },
      { title: "Commesse", url: "/commesse", icon: Briefcase },
      { title: "Preventivi", url: "/preventivi", icon: FileText },
      { title: "CRM", url: "/crm", icon: Target },
    ],
  },
  {
    title: "Execution Hub",
    roles: FULL_ACCESS_ROLES,
    items: [
      { title: "Timesheet", url: "/timesheet", icon: Timer },
      { title: "Planning", url: "/planning", icon: ClipboardList },
      { title: "Contenuti", url: "/contenuti", icon: Clapperboard },
      { title: "Task Templates", url: "/task-templates", icon: Zap },
      { title: "Collaboratori", url: "/collaboratori", icon: Users },
    ],
  },
  {
    title: "Management Console",
    roles: FULL_ACCESS_ROLES,
    items: [
      { title: "Fatture", url: "/fatture", icon: FileText },
      { title: "Fornitori", url: "/fornitori", icon: ShoppingCart },
      { title: "Cassa", url: "/cassa", icon: Wallet },
      { title: "Regole Matching", url: "/cassa/regole", icon: ShieldCheck },
      { title: "Budget", url: "/budget", icon: Target },
    ],
  },
  {
    title: "Documenti",
    roles: FULL_ACCESS_ROLES,
    items: [
      { title: "Report Mensili", url: "/report", icon: BarChart3 },
      { title: "Wiki", url: "/wiki", icon: BookOpen },
    ],
  },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const [studioSidebarWidth, setStudioSidebarWidth] = React.useState<number>(() => {
    if (typeof window === "undefined") return STUDIO_SIDEBAR_DEFAULT_WIDTH;
    const saved = window.localStorage.getItem(STUDIO_SIDEBAR_WIDTH_KEY);
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed)
      ? Math.min(STUDIO_SIDEBAR_MAX_WIDTH, Math.max(STUDIO_SIDEBAR_MIN_WIDTH, parsed))
      : STUDIO_SIDEBAR_DEFAULT_WIDTH;
  });

  const isStudioOS = location.pathname.startsWith("/studio-os");
  const userRole = user?.ruolo?.toUpperCase() ?? "";
  const isStudioOnlyUser = STUDIO_ONLY_ROLES.includes(userRole);
  
  // Filtra i gruppi di navigazione in base al ruolo
  const visibleNavItems = navItems.filter(group => 
    !group.roles || group.roles.includes(userRole)
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STUDIO_SIDEBAR_WIDTH_KEY, String(studioSidebarWidth));
  }, [studioSidebarWidth]);

  const handleSidebarResizeStart = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isStudioOS || state === "collapsed") return;

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = studioSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(
        STUDIO_SIDEBAR_MAX_WIDTH,
        Math.max(STUDIO_SIDEBAR_MIN_WIDTH, startWidth + (moveEvent.clientX - startX))
      );
      setStudioSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [isStudioOS, state, studioSidebarWidth]);
  
  return (
    <Sidebar 
      variant="sidebar" 
      collapsible="icon" 
      style={isStudioOS ? ({ "--sidebar-width": `${studioSidebarWidth}px` } as React.CSSProperties) : undefined}
      className="border-r border-sidebar-border/40 bg-sidebar/80 backdrop-blur-2xl h-full shadow-[20px_0_40px_-15px_rgba(0,0,0,0.5)] transition-all duration-700"
    >
      <SidebarHeader className="pt-6 px-4 pb-4">
        <Link to="/" className="flex items-center gap-3 group cursor-pointer lg:px-1">
          {state === "collapsed" ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-lg border border-primary/20 group-hover:scale-110 transition-transform duration-500">
              <img src="/logo_quadrato.png" className="h-full w-full object-contain" alt="B" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 leading-none animate-in fade-in slide-in-from-left-2 duration-500 overflow-hidden">
              <div className="h-9 flex items-center">
                <img 
                  src="/logo_bite.jpg" 
                  alt="Bite Digital" 
                  className="h-9 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
                <span style={{ display: 'none' }} className="font-black text-base tracking-tight text-foreground uppercase">
                  Bite Digital
                </span>
              </div>
              <div className="px-2 py-0.5 rounded-md bg-muted w-fit">
                <span className="text-[9px] text-primary font-black uppercase tracking-widest whitespace-nowrap">
                  {isStudioOS ? "Project Management" : "Finance & Operations"}
                </span>
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 mt-4 space-y-2">
        {isStudioOS ? (
          <div className="flex-1 overflow-hidden h-full">
            <StudioSidebar />
          </div>
        ) : (
          visibleNavItems.map((group) => (
            <SidebarGroup key={group.title} className="pb-2">
              <SidebarGroupLabel className="px-3 mb-2 text-[10px] uppercase font-black tracking-[0.25em] text-[#475569]">
                {group.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)}
                        tooltip={item.title}
                        className={`
                          transition-all duration-300 h-10 rounded-xl px-3 mb-1.5 group/btn
                          ${(item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url))
                            ? "bg-primary/10 text-white border border-primary/20 shadow-[0_0_15px_rgba(124,58,237,0.15)] ring-1 ring-primary/20"
                            : "text-[#94a3b8] hover:text-white hover:bg-white/5"
                          }
                        `}
                      >
                        <Link to={item.url} className="flex items-center gap-3">
                          <item.icon className={`h-4.5 w-4.5 transition-all duration-300 ${
                            (item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url))
                              ? "text-primary scale-110"
                              : "opacity-70 group-hover/btn:opacity-100 group-hover/btn:scale-110"
                          }`} />
                          <span className={`text-sm tracking-wide ${(item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)) ? "font-black" : "font-bold"}`}>
                            {item.title}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <div className="mt-auto px-4 py-4 space-y-4">
        <div className="px-2">
          <SidebarSeparator className="bg-muted/50 h-[1px]" />
        </div>
        
        {state !== "collapsed" && (
          <div className="p-1 gap-1 flex bg-muted/50 border border-sidebar-border rounded-xl shadow-inner">
            {/* Il bottone ERP è visibile solo agli utenti con accesso completo */}
            {!isStudioOnlyUser && (
              <Link 
                to="/" 
                className={`
                  flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
                  ${!isStudioOS 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }
                `}
              >
                <BarChart3 className={`h-3 w-3 ${!isStudioOS ? "animate-pulse" : ""}`} />
                ERP
              </Link>
            )}
            <Link 
              to="/studio-os" 
              className={`
                flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
                ${isStudioOS 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }
              `}
            >
              <Zap className={`h-3 w-3 ${isStudioOS ? "animate-pulse fill-current" : ""}`} />
              Studio OS
            </Link>
          </div>
        )}

        {state === "collapsed" && (
          <div className="flex flex-col items-center gap-2">
            <Link to="/" className={`p-2 rounded-lg transition-all ${!isStudioOS ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted/50 text-muted-foreground border border-sidebar-border"}`}>
              <BarChart3 className="h-4 w-4" />
            </Link>
            <Link to="/studio-os" className={`p-2 rounded-lg transition-all ${isStudioOS ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted/50 text-muted-foreground border border-sidebar-border"}`}>
              <Zap className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      <SidebarFooter className="p-4 bg-transparent border-t border-sidebar-border/30">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="hover:bg-white/5 transition-all px-1 h-12 rounded-xl border border-transparent hover:border-white/10 group/user">
                  <UserAvatar 
                    user={user} 
                    size="md" 
                    className="h-9 w-9 rounded-lg border border-white/10 shadow-2xl group-hover/user:scale-105 transition-transform" 
                  />
                  <div className="flex flex-col items-start gap-0.5 truncate flex-1 min-w-0 ml-2">
                    <span className="text-sm font-black truncate leading-none text-white group-hover:text-primary transition-colors">
                      {user?.nome} {user?.cognome}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate uppercase tracking-[0.2em] font-black group-hover:text-slate-300 transition-colors">
                      {user?.ruolo}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600 ml-auto mr-1 group-hover/user:translate-x-1 transition-transform" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-[220px] bg-card border-border p-2 shadow-2xl rounded-xl">
                <Link to="/settings/profile">
                  <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-lg focus:bg-muted focus:text-foreground transition-all text-xs font-bold text-muted-foreground">
                    <User className="h-4 w-4" />
                    Profilo
                  </DropdownMenuItem>
                </Link>
                <Link to="/settings">
                  <DropdownMenuItem 
                    className="gap-2.5 cursor-pointer rounded-lg focus:bg-muted focus:text-foreground transition-all text-xs font-bold text-muted-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Impostazioni
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator className="bg-muted" />
                <DropdownMenuItem 
                  onClick={logout} 
                  className="gap-2.5 cursor-pointer rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive transition-all text-xs font-bold"
                >
                  <LogOut className="h-4 w-4" />
                  Esci
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {isStudioOS && state !== "collapsed" && (
        <div
          onMouseDown={handleSidebarResizeStart}
          onDoubleClick={() => setStudioSidebarWidth(STUDIO_SIDEBAR_DEFAULT_WIDTH)}
          className="absolute right-0 top-0 hidden h-full w-4 translate-x-1/2 cursor-col-resize md:flex items-center justify-center z-30 group/sidebar-resize"
          title="Trascina per allargare o restringere"
        >
          <div className="flex h-16 w-2 items-center justify-center rounded-full border border-white/10 bg-background/80 text-muted-foreground/50 shadow-lg backdrop-blur-sm transition-all group-hover/sidebar-resize:h-24 group-hover/sidebar-resize:border-primary/30 group-hover/sidebar-resize:text-primary">
            <GripVertical className="h-4 w-4" />
          </div>
        </div>
      )}
    </Sidebar>
  );
}
