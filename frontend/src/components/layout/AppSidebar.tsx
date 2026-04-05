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

const navItems = [
  {
    title: "Generale",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Analytics", url: "/analytics", icon: PieChart },
      { title: "Timesheet", url: "/timesheet", icon: Timer },
    ],
  },
  {
    title: "Gestione",
    items: [
      { title: "Clienti", url: "/clienti", icon: Users },
      { title: "Gantt", url: "/gantt", icon: LayoutDashboard },
      { title: "Preventivi", url: "/preventivi", icon: FileText },
      { title: "Commesse", url: "/commesse", icon: Briefcase },
      { title: "Planning", url: "/planning", icon: ClipboardList },
    ],
  },
  {
    title: "Documenti",
    items: [
      { title: "Report Mensili", url: "/report", icon: FileText },
      { title: "Wiki", url: "/wiki", icon: BookOpen },
    ],
  },
  {
    title: "Amministrazione",
    items: [
      { title: "Fatture", url: "/fatture", icon: FileText },
      { title: "Fornitori", url: "/fornitori", icon: ShoppingCart },
      { title: "Cassa", url: "/cassa", icon: Wallet },
      { title: "Budget", url: "/budget", icon: Target },
    ],
  },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();

  const isStudioOS = location.pathname.startsWith("/studio-os");

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-r border-sidebar-border bg-sidebar h-full shadow-2xl">
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
          navItems.map((group) => (
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
                        isActive={location.pathname === item.url}
                        tooltip={item.title}
                        className={`
                          transition-all duration-300 h-10 rounded-xl px-3 mb-1.5 group/btn
                          ${location.pathname === item.url 
                            ? "bg-muted text-white border border-border shadow-lg" 
                            : "text-muted-foreground hover:text-white hover:bg-muted/40"
                          }
                        `}
                      >
                        <Link to={item.url} className="flex items-center gap-3">
                          <item.icon className={`h-4.5 w-4.5 transition-all duration-300 ${
                            location.pathname === item.url 
                              ? "text-primary scale-110" 
                              : "opacity-70 group-hover/btn:opacity-100 group-hover/btn:scale-110"
                          }`} />
                          <span className={`text-sm tracking-wide ${location.pathname === item.url ? "font-black" : "font-bold"}`}>
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

      <SidebarFooter className="p-4 bg-sidebar border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="hover:bg-muted transition-colors px-1 h-12 rounded-xl border border-transparent hover:border-border">
                  <UserAvatar 
                    user={user} 
                    size="md" 
                    className="h-9 w-9 rounded-lg border border-border shadow-xl" 
                  />
                  <div className="flex flex-col items-start gap-0.5 truncate flex-1 min-w-0 ml-2">
                    <span className="text-sm font-bold truncate leading-none text-white">
                      {user?.nome} {user?.cognome}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate uppercase tracking-[0.1em] font-black">
                      {user?.ruolo}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#475569] ml-auto mr-1" />
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
    </Sidebar>
  );
}
