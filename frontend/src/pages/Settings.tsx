import { 
  User, 
  Settings as SettingsIcon, 
  Palette, 
  Bell, 
  Shield, 
  History,
  ChevronRight 
} from "lucide-react";
import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const sidebarItems = [
  {
    title: "Profilo",
    icon: User,
    href: "/settings/profile",
    description: "Gestisci le tue informazioni personali e la bio."
  },
  {
    title: "Account",
    icon: SettingsIcon,
    href: "/settings/account",
    description: "Sicurezza, password e preferenze regionali."
  },
  {
    title: "Aspetto",
    icon: Palette,
    href: "/settings/appearance",
    description: "Personalizza il tema, i colori e il layout."
  },
  {
    title: "Notifiche",
    icon: Bell,
    href: "/settings/notifications",
    description: "Scegli come e quando ricevere avvisi."
  },
  {
    title: "Privacy",
    icon: Shield,
    href: "/settings/privacy",
    description: "Gestisci le sessioni attive e i tuoi dati."
  },
  {
    title: "Audit Trail",
    icon: History,
    href: "/settings/audit",
    description: "Storico modifiche e diff delle entità critiche.",
    roles: ["ADMIN", "DEVELOPER"],
  },
];

export default function SettingsLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const userRole = user?.ruolo?.toUpperCase() ?? "";

  const visibleSidebarItems = sidebarItems.filter((item) => !item.roles || item.roles.includes(userRole));

  if (location.pathname === "/settings") {
    return <Navigate to="/settings/profile" replace />;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-12rem)]">
      {/* Sidebar Sinistra */}
      <aside className="w-full lg:w-[280px] shrink-0">
        <div className="sticky top-8 space-y-1">
          <div className="px-3 mb-6">
            <h1 className="text-2xl font-black uppercase tracking-tight text-white italic">
              Impostazioni
            </h1>
            <p className="text-[10px] uppercase font-black tracking-widest text-[#475569] mt-1">
              Centro di Controllo Personale
            </p>
          </div>

          <nav className="space-y-1">
            {visibleSidebarItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 border border-transparent",
                    isActive 
                      ? "bg-muted text-white border-border shadow-lg" 
                      : "text-muted-foreground hover:text-white hover:bg-muted/40"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg transition-all duration-300",
                    isActive ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted/50 group-hover:bg-muted group-hover:text-white"
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-bold leading-none",
                      isActive ? "text-white" : "text-muted-foreground group-hover:text-white"
                    )}>
                      {item.title}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform duration-300",
                    isActive ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 text-slate-600"
                  )} />
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Contenuto Principale */}
      <main className="flex-1 min-w-0">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
