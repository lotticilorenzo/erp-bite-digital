import { useState } from "react";
import { DocumentExplorer } from "@/components/documents/DocumentExplorer";
import { DocumentEditor } from "@/components/documents/DocumentEditor";
import type { DocumentNode } from "@/types/document";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StudioDocumentsPage() {
  const [selectedNode, setSelectedNode] = useState<DocumentNode | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(true);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Sidebar panel toggle button (mobile/compact) */}
      <button
        onClick={() => setExplorerOpen((v) => !v)}
        className={cn(
          "absolute top-3 z-20 p-1.5 rounded-md border border-border/20 bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all shadow-sm",
          explorerOpen ? "left-[244px]" : "left-2"
        )}
        title={explorerOpen ? "Nascondi file explorer" : "Mostra file explorer"}
      >
        <PanelLeft size={14} />
      </button>

      {/* Explorer Sidebar */}
      <div
        className={cn(
          "shrink-0 border-r border-border/20 transition-all duration-200 overflow-hidden",
          explorerOpen ? "w-60" : "w-0"
        )}
      >
        {explorerOpen && (
          <DocumentExplorer
            selectedId={selectedNode?.id ?? null}
            onSelect={(node) => setSelectedNode(node)}
            className="h-full"
          />
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 relative">
        <DocumentEditor
          node={selectedNode}
          className="h-full"
        />
      </div>
    </div>
  );
}
