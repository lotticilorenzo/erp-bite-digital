import { useStudio } from "@/hooks/useStudio";
import { StudioTopbar } from "@/components/studio/StudioTopbar";
import StudioHome from "@/pages/studio/StudioHome";
import { StudioListView } from "@/components/studio/StudioListView";
import { StudioKanbanView } from "@/components/studio/StudioKanbanView";
import { StudioCalendarView } from "@/components/studio/StudioCalendarView";
import { StudioTaskModal } from "@/components/studio/StudioTaskModal";

export default function StudioPage() {
  const { nav } = useStudio();

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
      case "dash":
        // For now "dash" (folder selected) also shows list or a custom dashboard
        // Let's default to list for now if a folder/list is selected
        return <StudioListView />;
      default:
        return <StudioHome />;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#020617]">
      <StudioTopbar />
      <main className="flex-1 overflow-hidden relative">
        {renderView()}
      </main>
      <StudioTaskModal />
    </div>
  );
}
