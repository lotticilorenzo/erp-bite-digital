import { Fragment, useEffect, useState } from "react";
import { Search, Plus, UserPlus, Briefcase, ListTodo, HelpCircle, BookOpen } from "lucide-react";
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
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if (e.key === "?") {
        setIsHelpOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getBreadcrumbLabel = (path: string) => {
    switch (path) {
      case "clienti":
        return "Clienti";
      case "projects":
        return "Progetti";
      case "planning":
        return "Execution Hub";
      case "commesse":
        return "Commesse";
      case "timesheet":
        return "Timesheet";
      case "studio-os":
        return "Studio OS";
      case "settings":
        return "Impostazioni";
      case "profile":
        return "Profilo";
      case "account":
        return "Account";
      case "appearance":
        return "Aspetto";
      case "notifications":
        return "Notifiche";
      case "privacy":
        return "Privacy";
      default:
        return path.charAt(0) ? path.charAt(0).toUpperCase() + path.slice(1) : "Home";
    }
  };

  const handleNewTask = () => {
    openNewTask();
    if (!isStudioOS) {
      navigate("/studio-os/list");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-2xl">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="h-8 w-8 rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="text-faint transition-colors hover:text-foreground">
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {pathnames.map((path, i) => (
              <Fragment key={path}>
                <BreadcrumbSeparator className="text-faint/60" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      to={`/${pathnames.slice(0, i + 1).join("/")}`}
                      className={`transition-colors hover:text-foreground ${
                        i === pathnames.length - 1 ? "text-soft font-semibold" : "text-faint"
                      }`}
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
        <div className="relative hidden lg:block group">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint transition-colors group-focus-within:text-primary" />
          <Input placeholder="Cerca..." className="h-8 w-64 pl-9 text-xs" />
          <kbd className="absolute right-2 top-1.5 hidden h-5 select-none items-center rounded border border-border bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-faint opacity-100 sm:flex">
            Ctrl K
          </kbd>
        </div>

        <div className="flex h-8 items-center border-x border-border px-4">
          <TimerWidget />
        </div>

        <div className="flex items-center gap-1">
          <NotificationDropdown />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => navigate("/wiki")}
            title="Wiki Aziendale"
          >
            <BookOpen className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setIsHelpOpen(true)}
            title="Centro Assistenza"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <ThemePanel />

          <div className="mx-2 hidden h-6 w-[1px] bg-muted md:block" />

          <Link to="/settings/profile">
            <UserAvatar
              user={user}
              size="sm"
              className="hidden h-7 w-7 cursor-pointer rounded-lg border border-border shadow-lg transition-colors hover:border-primary/50 md:block"
            />
          </Link>

          {isStudioOS ? (
            <Button
              onClick={handleNewTask}
              className="ml-2 h-8 rounded-lg bg-primary px-4 text-xs font-black uppercase tracking-wide text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.2)] transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-95"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5 stroke-[3]" />
              Nuovo
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="ml-2 h-8 rounded-lg bg-primary px-4 text-xs font-black uppercase tracking-wide text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.2)] transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-95">
                  <Plus className="mr-1.5 h-3.5 w-3.5 stroke-[3]" />
                  Nuovo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-faint">
                  Azioni Rapide
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={handleNewTask}
                  className="cursor-pointer py-2 text-xs font-bold focus:bg-primary/10"
                >
                  <ListTodo className="mr-2 h-4 w-4 text-primary" />
                  Nuovo Task
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/clienti?action=new")}
                  className="cursor-pointer py-2 text-xs font-bold focus:bg-primary/10"
                >
                  <UserPlus className="mr-2 h-4 w-4 text-emerald-500" />
                  Nuovo Cliente
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/commesse?action=new")}
                  className="cursor-pointer py-2 text-xs font-bold focus:bg-primary/10"
                >
                  <Briefcase className="mr-2 h-4 w-4 text-blue-500" />
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
