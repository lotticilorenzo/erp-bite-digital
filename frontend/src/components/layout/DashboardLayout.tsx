import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { AIAssistant } from "../ai/AIAssistant";
import { TimerBar } from "./TimerBar";
import { StudioTaskModal } from "../studio/StudioTaskModal";

export function DashboardLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full overflow-x-hidden bg-background text-foreground font-sans selection:bg-primary/30 antialiased">
        <AppSidebar />
        <SidebarInset className="flex flex-col bg-background relative max-w-full min-w-0 overflow-hidden">
          <AppTopbar />
          <main className="flex-1 p-6 md:p-8 overflow-y-auto overflow-x-hidden pb-20 min-w-0">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
              <Outlet />
            </div>
          </main>
          <AIAssistant />
          <TimerBar />
          <StudioTaskModal />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
