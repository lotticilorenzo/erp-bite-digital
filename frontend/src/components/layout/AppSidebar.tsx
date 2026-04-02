import {
  LayoutDashboard,
  Users,
  Briefcase,
  ClipboardList,
  Timer,
  Terminal,
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
  {
    title: "Sviluppo",
    items: [
      { title: "Studio OS", url: "/studio-os", icon: Terminal },
    ],
  },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-r border-border/50 bg-[#020617]">
      <SidebarHeader className="pt-4 px-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20 border border-primary/20">
            <Zap className="h-5 w-5" />
          </div>
          {state !== "collapsed" && (
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-bold text-sm tracking-tight text-foreground/90">Bite Digital</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-70">ERP v4</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 mt-4">
        {navItems.map((group) => (
          <SidebarGroup key={group.title} className="pb-4">
            <SidebarGroupLabel className="px-2 mb-1.5 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
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
                      className="hover:bg-primary/10 hover:text-primary transition-all duration-200 h-9"
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50 bg-white/5 backdrop-blur-sm">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="hover:bg-white/5 transition-colors px-1 h-12 rounded-xl border border-transparent hover:border-border/50">
                  <Avatar className="h-8 w-8 rounded-lg border border-border/50 shadow-sm">
                    <AvatarImage src={`https://avatar.vercel.sh/${user?.email}.png`} />
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary uppercase text-xs font-bold">
                      {user?.nome?.[0]}{user?.cognome?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start gap-0.5 truncate flex-1 min-w-0 ml-1">
                    <span className="text-sm font-bold truncate leading-none text-foreground/90">
                      {user?.nome} {user?.cognome}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate uppercase tracking-widest font-bold opacity-70">
                      {user?.ruolo}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-[200px] bg-[#020617]/95 backdrop-blur-xl border-border/50 p-1.5 shadow-2xl">
                <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-md focus:bg-primary/10 focus:text-primary transition-colors text-xs font-medium">
                  <User className="h-4 w-4" />
                  Profilo
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-md focus:bg-primary/10 focus:text-primary transition-colors text-xs font-medium">
                  <Settings className="h-4 w-4" />
                  Impostazioni
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem 
                  onClick={logout} 
                  className="gap-2.5 cursor-pointer rounded-md text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors text-xs font-medium"
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
