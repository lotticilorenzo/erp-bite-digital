import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { StudioProvider } from "@/context/StudioContext";
import { TaskDetailView } from "@/components/studio/TaskDetailView";
import { ExternalLink } from "lucide-react";

/** Standalone popout shell — no sidebar, no topbar — just the content. */
function PopoutContent() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "TASK";
  const id   = searchParams.get("id")   || "";

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <ExternalLink className="w-12 h-12 opacity-20" />
        <p className="text-sm font-black uppercase tracking-widest">Parametri mancanti</p>
      </div>
    );
  }

  if (type === "TASK") {
    return <TaskDetailView taskId={id} onClose={() => window.close()} />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <p className="text-sm font-black uppercase tracking-widest">Tipo non supportato: {type}</p>
    </div>
  );
}

export default function PopoutPage() {
  useEffect(() => {
    document.title = "Bite ERP — Pop-out";
  }, []);

  return (
    <StudioProvider>
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        <PopoutContent />
      </div>
    </StudioProvider>
  );
}
