import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { AIAssistant } from "../ai/AIAssistant";
import { TimerBar } from "./TimerBar";
import { StudioTaskModal } from "../studio/StudioTaskModal";
import { SmartIndicatorBar } from "../shared/SmartIndicatorBar";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full overflow-x-hidden bg-background text-foreground font-sans selection:bg-primary/30 antialiased">
        <AppSidebar />
        <SidebarInset className="flex flex-col bg-background relative max-w-full min-w-0 overflow-hidden">
          <AppTopbar />
          <main className={cn(
            "flex-1 min-w-0 relative",
            window.location.pathname.startsWith('/studio-os') 
              ? "overflow-hidden pb-[130px]" 
              : "p-6 md:p-8 overflow-y-auto overflow-x-hidden pb-32"
          )}>
            <div className={cn(
              "animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both",
              window.location.pathname.startsWith('/studio-os') ? "h-full" : ""
            )}>
              <Outlet />
            </div>
          </main>
          <AIAssistant />
          <TimerBar />
          <SmartIndicatorBar />
          <StudioTaskModal />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
