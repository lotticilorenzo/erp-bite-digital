import { useStudio } from "@/hooks/useStudio";
import { StudioTopbar } from "@/components/studio/StudioTopbar";
import StudioHome from "@/pages/studio/StudioHome";
import { StudioListView } from "@/components/studio/StudioListView";
import { StudioKanbanView } from "@/components/studio/StudioKanbanView";
import { StudioCalendarView } from "@/components/studio/StudioCalendarView";
import { StudioTeamView } from "@/components/studio/StudioTeamView";
import CaricoLavoroPage from "@/pages/studio/CaricoLavoroPage";
import StudioOverviewPage from "@/pages/studio/StudioOverviewPage";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function StudioPage() {
  const { nav, setView } = useStudio();
  const location = useLocation();
  const navigate = useNavigate();

  // Sync URL to state
  useEffect(() => {
    const path = location.pathname;
    if (path === "/studio-os/carico-lavoro" && nav.view !== "carico-lavoro") {
      setView("carico-lavoro");
    } else if (path === "/studio-os" && nav.view === "carico-lavoro") {
       // If we are at root but view is carico-lavoro (maybe from sidebar), we stay or redirect
       // For now, let the state drive the URL if it's a "menu" action
    }
  }, [location.pathname, nav.view, setView]);

  // Sync state to URL
  useEffect(() => {
    if (nav.view === "carico-lavoro" && location.pathname !== "/studio-os/carico-lavoro") {
      navigate("/studio-os/carico-lavoro");
    } else if (nav.view !== "carico-lavoro" && location.pathname === "/studio-os/carico-lavoro") {
      // Handled by the first effect usually
    }
  }, [nav.view, navigate, location.pathname]);

  const renderView = () => {
    switch (nav.view) {
      case "home":
        return <StudioHome />;
      case "list":
        return <StudioListView />;
      case "kanban":
        return <StudioKanbanView />;
      case "cal":
        return <StudioCalendarView />;
      case "team":
        return <StudioTeamView />;
      case "carico-lavoro":
        return <CaricoLavoroPage />;
      case "overview":
        return <StudioOverviewPage />;
      case "dash":
        // For now "dash" (folder selected) also shows list or a custom dashboard
        // Let's default to list for now if a folder/list is selected
        return <StudioListView />;
      default:
        return <StudioHome />;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <StudioTopbar />
      <main className="flex-1 overflow-hidden relative">
        {renderView()}
      </main>
    </div>
  );
}
