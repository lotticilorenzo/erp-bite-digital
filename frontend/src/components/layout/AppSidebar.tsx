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
} from "lucide-react";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "react-router-dom";
import { BarChart3 } from "lucide-react";

const navItems = [
  {
    title: "Generale",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Timesheet", url: "/timesheet", icon: Timer },
    ],
  },
  {
    title: "Gestione",
    items: [
      { title: "Clienti", url: "/clienti", icon: Users },
      { title: "Progetti", url: "/progetti", icon: Briefcase },
      { title: "Commesse", url: "/commesse", icon: ClipboardList },
    ],
  },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();

  const isStudioOS = location.pathname.startsWith("/studio-os");

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-r border-[#1e293b]/50 bg-[#020617] h-full shadow-2xl">
      <SidebarHeader className="pt-6 px-4 pb-4">
        <div className="flex items-center gap-3 group cursor-pointer lg:px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] border border-primary/20 group-hover:scale-110 transition-transform duration-500">
            <Zap className="h-5 w-5 fill-current" />
          </div>
          {state !== "collapsed" && (
            <div className="flex flex-col gap-1 leading-none animate-in fade-in slide-in-from-left-2 duration-500 overflow-hidden">
              <span className="font-black text-base tracking-tight text-[#f1f5f9] uppercase">Bite Digital</span>
              <div className="px-2 py-0.5 rounded-md bg-[#1e293b] w-fit">
                <span className="text-[9px] text-[#7c3aed] font-black uppercase tracking-widest whitespace-nowrap">
                  {isStudioOS ? "Project Management" : "Finance & Operations"}
                </span>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 mt-4 space-y-2">
        {navItems.map((group) => (
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
                          ? "bg-[#1e293b] text-white border border-[#334155] shadow-lg" 
                          : "text-[#94a3b8] hover:text-white hover:bg-[#1e293b]/40"
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
        ))}
      </SidebarContent>

      <div className="mt-auto px-4 py-4 space-y-4">
        <div className="px-2">
          <SidebarSeparator className="bg-[#1e293b]/50 h-[1px]" />
        </div>
        
        {state !== "collapsed" && (
          <div className="p-1 gap-1 flex bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-inner">
            <Link 
              to="/" 
              className={`
                flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
                ${!isStudioOS 
                  ? "bg-[#7c3aed] text-white shadow-lg" 
                  : "text-[#475569] hover:text-[#94a3b8] hover:bg-white/5"
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
                  ? "bg-[#7c3aed] text-white shadow-lg" 
                  : "text-[#475569] hover:text-[#94a3b8] hover:bg-white/5"
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
            <Link to="/" className={`p-2 rounded-lg transition-all ${!isStudioOS ? "bg-[#7c3aed] text-white shadow-lg" : "bg-[#0f172a] text-[#475569] border border-[#1e293b]"}`}>
              <BarChart3 className="h-4 w-4" />
            </Link>
            <Link to="/studio-os" className={`p-2 rounded-lg transition-all ${isStudioOS ? "bg-[#7c3aed] text-white shadow-lg" : "bg-[#0f172a] text-[#475569] border border-[#1e293b]"}`}>
              <Zap className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      <SidebarFooter className="p-4 bg-[#020617] border-t border-[#1e293b]/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="hover:bg-[#1e293b] transition-colors px-1 h-12 rounded-xl border border-transparent hover:border-[#334155]">
                  <Avatar className="h-9 w-9 rounded-lg border border-[#1e293b] shadow-xl">
                    <AvatarImage src={`https://avatar.vercel.sh/${user?.email}.png`} />
                    <AvatarFallback className="rounded-lg bg-primary/20 text-white uppercase text-xs font-black">
                      {user?.nome?.[0]}{user?.cognome?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start gap-0.5 truncate flex-1 min-w-0 ml-2">
                    <span className="text-sm font-bold truncate leading-none text-white">
                      {user?.nome} {user?.cognome}
                    </span>
                    <span className="text-[10px] text-[#94a3b8] truncate uppercase tracking-[0.1em] font-black">
                      {user?.ruolo}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#475569] ml-auto mr-1" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-[220px] bg-[#0f172a] border-[#1e293b] p-2 shadow-2xl rounded-xl">
                <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-lg focus:bg-[#1e293b] focus:text-white transition-all text-xs font-bold text-[#94a3b8]">
                  <User className="h-4 w-4" />
                  Profilo
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-lg focus:bg-[#1e293b] focus:text-white transition-all text-xs font-bold text-[#94a3b8]">
                  <Settings className="h-4 w-4" />
                  Impostazioni
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#1e293b]" />
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
