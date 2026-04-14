import { X, Hash, ListTodo, LayoutDashboard, Columns2, ExternalLink } from "lucide-react";
import { useStudio } from "@/hooks/useStudio";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function openPopout(type: string, id: string, title: string) {
  const url = `/popout?type=${type}&id=${encodeURIComponent(id)}`;
  const w = window.screen.width / 2;
  const h = window.screen.height;
  const left = window.screen.width / 2;
  window.open(url, `popout-${id}`, `width=${w},height=${h},left=${left},top=0,resizable=yes,scrollbars=yes`);
  document.title = `Bite ERP — ${title}`;
}


export function WorkspaceTabs() {
  const { tabs, activeTabId, splitTabId, selectTab, closeTab, openSplit, closeSplit } = useStudio();

  if (tabs.length === 0) return null;

  return (
    <div className="h-10 border-b border-border/30 bg-background/50 backdrop-blur-sm flex items-center px-4 overflow-hidden">
      <ScrollArea className="w-full">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            const isSplit = splitTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                className={cn(
                  "group relative h-8 px-3 flex items-center gap-2 rounded-t-md cursor-pointer transition-all duration-200 select-none",
                  isActive
                    ? "bg-card text-primary font-bold shadow-[0_-2px_10px_rgba(0,0,0,0.1)] border-t border-x border-border/50"
                    : "text-muted-foreground hover:bg-white/5"
                )}
              >
                <TabIcon type={tab.type} isActive={isActive} />
                <span className="text-[11px] truncate max-w-[130px] uppercase tracking-wider">
                  {tab.title}
                </span>

                {/* Split button — visible on hover (only if tab is NOT the currently split one) */}
                {!isSplit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openSplit(tab.id);
                    }}
                    title="Apri in split view"
                    className={cn(
                      "p-0.5 rounded-md transition-all",
                      "opacity-0 group-hover:opacity-100",
                      "text-muted-foreground/60 hover:text-primary hover:bg-primary/10"
                    )}
                  >
                    <Columns2 className="h-3 w-3" />
                  </button>
                )}

                {/* Active split indicator badge */}
                {isSplit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeSplit();
                    }}
                    title="Chiudi split view"
                    className="p-0.5 rounded-md text-primary/70 hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Columns2 className="h-3 w-3 fill-primary/30" />
                  </button>
                )}

                {/* Open in window button — hover to reveal */}
                {tab.linkedId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPopout(tab.type, tab.linkedId!, tab.title);
                    }}
                    title="Apri in nuova finestra (secondo monitor)"
                    className={cn(
                      "p-0.5 rounded-md transition-all",
                      "opacity-0 group-hover:opacity-100",
                      "text-muted-foreground/60 hover:text-cyan-400 hover:bg-cyan-400/10"
                    )}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}

                {/* Close tab button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "p-0.5 rounded-md hover:bg-slate-800 transition-colors",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                >
                  <X className="h-3 w-3" />
                </button>

                {/* Active underline */}
                {isActive && (
                  <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-primary z-10" />
                )}

                {/* Split indicator dot */}
                {isSplit && (
                  <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary/70 shadow-[0_0_4px_rgba(99,102,241,0.6)]" />
                )}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </div>
  );
}

function TabIcon({ type, isActive }: { type: string; isActive: boolean }) {
  const color = isActive ? "text-primary" : "text-[#475569]";
  switch (type) {
    case "PROJECT":
      return <Hash className={`h-3.5 w-3.5 ${color}`} />;
    case "TASK":
      return <ListTodo className={`h-3.5 w-3.5 ${color}`} />;
    case "DASHBOARD":
      return <LayoutDashboard className={`h-3.5 w-3.5 ${color}`} />;
    default:
      return null;
  }
}
