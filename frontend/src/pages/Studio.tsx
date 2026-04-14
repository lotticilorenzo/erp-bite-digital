import React, { useRef, useState, useCallback } from "react";
import { useStudio } from "@/hooks/useStudio";
import { StudioTopbar } from "@/components/studio/StudioTopbar";
import StudioHome from "@/pages/studio/StudioHome";
import { StudioListView } from "@/components/studio/StudioListView";
import { StudioKanbanView } from "@/components/studio/StudioKanbanView";
import { StudioCalendarView } from "@/components/studio/StudioCalendarView";
import { StudioTeamView } from "@/components/studio/StudioTeamView";
import CaricoLavoroPage from "@/pages/studio/CaricoLavoroPage";
import StudioOverviewPage from "@/pages/studio/StudioOverviewPage";
import StudioDocumentsPage from "@/pages/studio/StudioDocumentsPage";
import { WorkspaceTabs } from "@/components/studio/WorkspaceTabs";
import { TaskDetailView } from "@/components/studio/TaskDetailView";
import ChatHub from "@/components/chat/ChatHub";
import { PageTransition } from "@/components/common/PageTransition";
import { X } from "lucide-react";
import type { TabItem } from "@/types/studio";

// ─── Render a single panel's content ─────────────────────────────────────────
function PanelContent({ tab, view }: { tab: TabItem | null; view: string }) {
  if (!tab) {
    switch (view) {
      case "home":          return <StudioHome />;
      case "carico-lavoro": return <CaricoLavoroPage />;
      case "chat":          return <ChatHub />;
      case "files":         return <StudioDocumentsPage />;
      case "overview":      return <StudioOverviewPage />;
      case "cal":           return <StudioCalendarView />;
      case "team":          return <StudioTeamView />;
      default:              return <StudioHome />;
    }
  }

  switch (tab.type) {
    case "PROJECT":
      switch (view) {
        case "kanban":   return <StudioKanbanView key={tab.id} />;
        case "cal":      return <StudioCalendarView key={tab.id} />;
        case "team":     return <StudioTeamView key={tab.id} />;
        case "overview": return <StudioOverviewPage key={tab.id} />;
        default:         return <StudioListView key={tab.id} />;
      }
    case "TASK":
      return <TaskDetailView key={tab.id} taskId={tab.linkedId!} />;
    case "DASHBOARD":
      return <StudioOverviewPage />;
    case "CHAT":
      return <ChatHub />;
    default:
      return <StudioHome />;
  }
}

// ─── Resizable split divider ──────────────────────────────────────────────────
function useSplitDrag(leftPct: number, setLeftPct: (v: number) => void, containerRef: React.RefObject<HTMLDivElement>) {
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(75, Math.max(25, pct)));
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [containerRef, setLeftPct]);

  return onMouseDown;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StudioPage() {
  const { nav, tabs, activeTabId, splitTabId, closeSplit } = useStudio();
  const [leftPct, setLeftPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const onDividerMouseDown = useSplitDrag(leftPct, setLeftPct, containerRef);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;
  const splitTab  = tabs.find(t => t.id === splitTabId)  ?? null;

  const isSplit = !!splitTabId;

  return (
    <PageTransition>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background relative selection:bg-primary/30">
        <StudioTopbar />
        <WorkspaceTabs />

        <main
          ref={containerRef}
          className="flex-1 overflow-hidden relative flex"
        >
          {/* ── Left / main panel ── */}
          <div
            className="flex-1 flex flex-col overflow-hidden relative w-full"
            style={{ width: isSplit ? `${leftPct}%` : "100%" }}
          >
            <PanelContent tab={activeTab} view={nav.view} />
          </div>

          {/* ── Drag divider ── */}
          {isSplit && (
            <div
              onMouseDown={onDividerMouseDown}
              className="w-1 shrink-0 bg-border/40 hover:bg-primary/50 active:bg-primary transition-colors cursor-col-resize z-20 relative group"
            >
              {/* drag handle dots */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="h-1 w-1 rounded-full bg-primary/80" />
                ))}
              </div>
            </div>
          )}

          {/* ── Right / split panel ── */}
          {isSplit && (
            <div
              className="flex-1 flex flex-col overflow-hidden border-l border-border/30 relative"
              style={{ width: `${100 - leftPct - 0.25}%` }}
            >
              {/* Split panel header */}
              <div className="h-9 flex items-center justify-between px-3 bg-card/40 border-b border-border/30 shrink-0 backdrop-blur-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 truncate">
                    {splitTab?.title ?? "Split"}
                  </span>
                </div>
                <button
                  onClick={closeSplit}
                  className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-white hover:bg-white/10 transition-all shrink-0"
                  title="Chiudi split"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Split content */}
              <div className="flex-1 overflow-hidden">
                <PanelContent tab={splitTab} view={nav.view} />
              </div>
            </div>
          )}
        </main>
      </div>
    </PageTransition>
  );
}
