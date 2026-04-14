import { useState, useRef, useEffect, useCallback } from "react";
import {
  FilePlus,
  FolderPlus,
  Search,
  X,
  FileText,
  Folder,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/hooks/useDocuments";
import { DocumentTreeNode } from "./DocumentTreeNode";
import type { DocumentNode } from "@/types/document";

// Inline "new item" creation row
interface NewItemRowProps {
  parentId: string | null;
  tipo: "FOLDER" | "FILE";
  depth: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function NewItemRow({ parentId: _parentId, tipo, depth, onConfirm, onCancel }: NewItemRowProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed) onConfirm(trimmed);
    else onCancel();
  };

  return (
    <div
      className="flex items-center gap-1.5 h-[28px] px-1"
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
    >
      {tipo === "FOLDER" ? (
        <Folder size={14} className="shrink-0 text-primary" />
      ) : (
        <FileText size={14} className="shrink-0 text-muted-foreground/70" />
      )}
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={tipo === "FOLDER" ? "Nome cartella..." : "Nome file..."}
        className="flex-1 bg-background border border-primary/60 rounded px-1.5 py-0.5 text-[12px] font-medium outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
      />
    </div>
  );
}

// Flatten tree for search
function flattenTree(nodes: DocumentNode[]): DocumentNode[] {
  const result: DocumentNode[] = [];
  const walk = (ns: DocumentNode[]) => {
    for (const n of ns) {
      result.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return result;
}

interface DocumentExplorerProps {
  selectedId: string | null;
  onSelect: (node: DocumentNode) => void;
  className?: string;
}

interface PendingCreate {
  parentId: string | null;
  tipo: "FOLDER" | "FILE";
  depth: number;
}

export function DocumentExplorer({ selectedId, onSelect, className }: DocumentExplorerProps) {
  const { tree, isLoading, createNode, updateNode, deleteNode } = useDocuments();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);

  // === SEARCH ===
  const allNodes = flattenTree(tree);
  const searchResults = searchQuery.trim()
    ? allNodes.filter((n) =>
        n.nome.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  // === CREATE ===
  const handleCreate = useCallback(
    (parentId: string | null, tipo: "FOLDER" | "FILE") => {
      // Calculate depth
      const findDepth = (nodes: DocumentNode[], targetId: string | null, d = 0): number => {
        if (!targetId) return 0;
        for (const n of nodes) {
          if (n.id === targetId) return d + 1;
          const found = findDepth(n.children, targetId, d + 1);
          if (found > 0) return found;
        }
        return 0;
      };
      const depth = findDepth(tree, parentId);
      setPendingCreate({ parentId, tipo, depth });
    },
    [tree]
  );

  const confirmCreate = async (name: string) => {
    if (!pendingCreate) return;
    await createNode.mutateAsync({
      nome: name,
      tipo: pendingCreate.tipo,
      parent_id: pendingCreate.parentId,
    });
    setPendingCreate(null);
  };

  // === RENAME ===
  const handleRename = (id: string, newName: string) => {
    updateNode.mutate({ id, data: { nome: newName } });
  };

  // === DELETE ===
  const handleDelete = (id: string) => {
    if (window.confirm("Eliminare questo elemento e tutto il suo contenuto?")) {
      deleteNode.mutate(id);
      if (selectedId === id) onSelect(null as any);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-card/5", className)}>
      {/* Header */}
      <div className="px-3 py-3 border-b border-border/20 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/50">
            File
          </span>
          <div className="flex items-center gap-0.5">
            <button
              title="Nuovo file"
              onClick={() => handleCreate(null, "FILE")}
              className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
            >
              <FilePlus size={14} />
            </button>
            <button
              title="Nuova cartella"
              onClick={() => handleCreate(null, "FOLDER")}
              className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
            >
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca file..."
            className="w-full bg-background/40 border border-border/20 rounded-lg pl-7 pr-7 py-1.5 text-[11px] font-medium placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Tree Area */}
      <div className="flex-1 overflow-y-auto py-1 pr-1 custom-scrollbar">
        {isLoading ? (
          <div className="px-3 py-4 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[22px] bg-muted/20 rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
            ))}
          </div>
        ) : searchResults ? (
          /* Search results */
          <div className="px-1 py-1">
            {searchResults.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/40 font-medium italic px-3 py-4 text-center">
                Nessun risultato trovato.
              </p>
            ) : (
              searchResults.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onSelect(node)}
                  className={cn(
                    "w-full flex items-center gap-2 h-[28px] px-3 rounded-md text-[12px] font-medium transition-colors",
                    selectedId === node.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-white/[0.04] text-foreground/70"
                  )}
                >
                  {node.tipo === "FOLDER" ? (
                    <Folder size={13} className="shrink-0 text-primary/70" />
                  ) : (
                    <FileText size={13} className="shrink-0 text-muted-foreground/60" />
                  )}
                  <span className="truncate">{node.nome}</span>
                </button>
              ))
            )}
          </div>
        ) : tree.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center">
              <Folder size={28} className="text-primary/30" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">
                Nessun file ancora
              </p>
              <p className="text-[10px] text-muted-foreground/30 font-medium">
                Crea una cartella o un file per iniziare
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCreate(null, "FOLDER")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                <FolderPlus size={12} /> Cartella
              </button>
              <button
                onClick={() => handleCreate(null, "FILE")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 text-muted-foreground rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                <FilePlus size={12} /> File
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Root-level pending create */}
            {pendingCreate && pendingCreate.parentId === null && (
              <NewItemRow
                parentId={null}
                tipo={pendingCreate.tipo}
                depth={0}
                onConfirm={confirmCreate}
                onCancel={() => setPendingCreate(null)}
              />
            )}

            {tree.map((node) => (
              <DocumentTreeNode
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                onSelect={onSelect}
                onCreate={(parentId, tipo) => {
                  // Show inline create row inside this folder
                  handleCreate(parentId, tipo);
                }}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}

            {/* Nested pending create (shown after the target folder's children) */}
            {pendingCreate && pendingCreate.parentId !== null && (
              <NewItemRow
                parentId={pendingCreate.parentId}
                tipo={pendingCreate.tipo}
                depth={pendingCreate.depth}
                onConfirm={confirmCreate}
                onCancel={() => setPendingCreate(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
