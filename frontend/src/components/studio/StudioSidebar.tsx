import React, { useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Search,
  Home,
  BarChart3,
  MessageSquare,
  X,
  FolderClosed,
  FolderOpen,
  Hash,
  ListTodo,
  Zap,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStudio } from "@/hooks/useStudio";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { FolderNode } from "./FolderNode";
import { ProgettoDialog } from "./ProgettoDialog";
import type { StudioNode } from "@/types/studio";
import { toast } from "sonner";
import {
  parseStudioDropId,
  ROOT_APPEND_DROP_ID,
} from "./studioTreeDnd";

function filterNodes(nodes: StudioNode[], query: string): StudioNode[] {
  if (!query.trim()) return nodes;
  const q = query.toLowerCase();
  return nodes.reduce<StudioNode[]>((acc, node) => {
    const filteredChildren = filterNodes(node.children, q);
    const nameMatch = node.nome.toLowerCase().includes(q);
    if (nameMatch || filteredChildren.length > 0) {
      acc.push({ ...node, children: filteredChildren });
    }
    return acc;
  }, []);
}

function findNodeById(nodes: StudioNode[], nodeId: string): StudioNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const childMatch = findNodeById(node.children, nodeId);
    if (childMatch) return childMatch;
  }
  return null;
}

function collectSubtreeIds(node: StudioNode | null): Set<string> {
  const ids = new Set<string>();
  if (!node) return ids;

  const stack: StudioNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    ids.add(current.id);
    stack.push(...current.children);
  }

  return ids;
}

export function StudioSidebar() {
  const { nav, setView, hierarchy, isLoading, openNewTask } = useStudio();
  const queryClient = useQueryClient();
  const workspaceInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = React.useState("");
  const [isProgettoModalOpen, setIsProgettoModalOpen] = React.useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = React.useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = React.useState("");
  const [isDraggingNode, setIsDraggingNode] = React.useState(false);
  const [activeDragNodeId, setActiveDragNodeId] = React.useState<string | null>(null);

  useEffect(() => {
    if (isCreatingWorkspace) {
      workspaceInputRef.current?.focus();
    }
  }, [isCreatingWorkspace]);

  const createWorkspaceMutation = useMutation({
    mutationFn: async (nome: string) => {
      return api.post("/studio/nodes", {
        nome,
        tipo: "folder",
        parent_id: null,
        order: hierarchy.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-hierarchy"] });
      setIsCreatingWorkspace(false);
      setNewWorkspaceName("");
      toast.success("Workspace creato");
    },
    onError: () => {
      toast.error("Errore durante la creazione del workspace");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const moveMutation = useMutation({
    mutationFn: async ({ itemId, parentId, order }: { itemId: string; parentId: string | null; order?: number }) => {
      return api.post("/studio/nodes/move", { node_id: itemId, parent_id: parentId, order });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-hierarchy"] });
    },
    onError: () => {
      toast.error("Impossibile spostare l'elemento");
    },
  });

  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: ROOT_APPEND_DROP_ID,
    data: { tipo: "root" },
  });

  const startWorkspaceCreation = () => {
    setIsCreatingWorkspace(true);
    setNewWorkspaceName("");
  };

  const handleCreateWorkspace = () => {
    const nome = newWorkspaceName.trim();
    if (!nome) {
      setIsCreatingWorkspace(false);
      return;
    }
    createWorkspaceMutation.mutate(nome);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDraggingNode(false);
    setActiveDragNodeId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const dropTarget = parseStudioDropId(String(over.id));
    if (!dropTarget) return;

    if (dropTarget.kind === "root") {
      moveMutation.mutate({
        itemId: activeId,
        parentId: null,
        order: hierarchy.filter((node) => node.id !== activeId).length,
      });
      return;
    }

    if (dropTarget.nodeId === activeId) return;

    const overNode = findNodeById(hierarchy, dropTarget.nodeId);
    if (!overNode) return;

    if (dropTarget.position === "inside") {
      if (overNode.tipo !== "folder") return;
      moveMutation.mutate({
        itemId: activeId,
        parentId: overNode.id,
        order: overNode.children.filter((child) => child.id !== activeId).length,
      });
      return;
    }

    const siblings = overNode.parent_id
      ? findNodeById(hierarchy, overNode.parent_id)?.children ?? []
      : hierarchy;
    const siblingsWithoutActive = siblings.filter((node) => node.id !== activeId);
    const targetIndex = siblingsWithoutActive.findIndex((node) => node.id === overNode.id);
    if (targetIndex === -1) return;
    const targetOrder = dropTarget.position === "after" ? targetIndex + 1 : targetIndex;

    moveMutation.mutate({
      itemId: activeId,
      parentId: overNode.parent_id ?? null,
      order: targetOrder,
    });
  };

  const filteredHierarchy = useMemo(() => filterNodes(hierarchy, search), [hierarchy, search]);
  const activeDragNode = useMemo(
    () => (activeDragNodeId ? findNodeById(hierarchy, activeDragNodeId) : null),
    [activeDragNodeId, hierarchy]
  );
  const draggedSubtreeIds = useMemo(
    () => collectSubtreeIds(activeDragNodeId ? findNodeById(hierarchy, activeDragNodeId) : null),
    [activeDragNodeId, hierarchy]
  );

  const navItem = (view: typeof nav.view, Icon: React.ElementType, label: string) => (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={nav.view === view}
        onClick={() => setView(view)}
        className={`h-9 px-3 rounded-lg transition-all ${
          nav.view === view
            ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
            : "text-muted-foreground hover:text-white"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="font-bold text-xs uppercase tracking-wider">{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <div className="flex flex-col h-full bg-transparent border-r border-border/30">
      <div className="p-4 space-y-4 border-b border-border/20">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Cerca cartelle o task..."
            className="pl-9 pr-8 h-8 bg-card/50 border-border/50 text-xs focus-visible:ring-primary/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <SidebarMenu className="gap-1">
          {navItem("home", Home, "Home")}
          {navItem("carico-lavoro", BarChart3, "Carico Lavoro")}
          {navItem("chat", MessageSquare, "Chat")}
        </SidebarMenu>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={(event) => {
          setIsDraggingNode(true);
          setActiveDragNodeId(String(event.active.id));
        }}
        onDragCancel={() => {
          setIsDraggingNode(false);
          setActiveDragNodeId(null);
        }}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="flex-1 px-3 pb-4">
          <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between px-2 mb-2 group/header">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
                  {search ? `Risultati (${filteredHierarchy.length})` : "Struttura Studio"}
                </h4>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-8 w-8 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all flex items-center justify-center" title="Aggiungi elemento">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 bg-card border-border rounded-xl shadow-2xl" side="bottom" align="end">
                  <DropdownMenuItem
                    className="cursor-pointer text-xs font-bold"
                    onClick={() => {
                      startWorkspaceCreation();
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-2 text-primary" />
                    Nuovo Workspace
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-xs font-bold" onClick={() => setIsProgettoModalOpen(true)}>
                    <FolderClosed className="h-3.5 w-3.5 mr-2" />
                    Nuovo Progetto
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-xs font-bold" onClick={() => openNewTask()}>
                    <Zap className="h-3.5 w-3.5 mr-2 text-primary" />
                    Nuova Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1">
              {isLoading ? (
                <div className="px-3 py-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 w-full bg-slate-800/50 animate-pulse rounded" />
                  ))}
                </div>
              ) : filteredHierarchy.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                    {search ? "Nessun risultato" : "Nessun elemento ancora"}
                  </p>
                </div>
              ) : (
                filteredHierarchy.map((node) => (
                  <FolderNode key={node.id} node={node} draggedSubtreeIds={draggedSubtreeIds} />
                ))
              )}
            </div>

            <div
              ref={setRootDropRef}
              onClick={() => {
                if (!isDraggingNode) {
                  startWorkspaceCreation();
                }
              }}
              className={`rounded-xl border border-dashed px-3 py-3 transition-all cursor-pointer ${
                isRootOver
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/[0.02] text-muted-foreground/70 hover:border-primary/30 hover:text-primary"
              }`}
            >
              {isCreatingWorkspace ? (
                <form
                  className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-150"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateWorkspace();
                  }}
                >
                  <Input
                    ref={workspaceInputRef}
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Nome workspace..."
                    className="h-9 bg-card/70 border-border/60 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsCreatingWorkspace(false);
                        setNewWorkspaceName("");
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="submit"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    disabled={createWorkspaceMutation.isPending}
                    className="h-9 shrink-0 rounded-lg bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    Crea
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide">
                  <Plus className="h-3.5 w-3.5" />
                  Nuovo workspace
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        <DragOverlay>
          {activeDragNode ? <StudioDragPreview node={activeDragNode} /> : null}
        </DragOverlay>
      </DndContext>

      <ProgettoDialog open={isProgettoModalOpen} onOpenChange={setIsProgettoModalOpen} />
    </div>
  );
}

function StudioDragPreview({ node }: { node: StudioNode }) {
  return (
    <div className="min-w-[220px] max-w-[320px] rounded-xl border border-primary/30 bg-card/95 px-3 py-2 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <DragPreviewIcon type={node.tipo} />
        <span className="truncate text-xs font-bold uppercase tracking-[0.12em] text-white/90">
          {node.nome}
        </span>
      </div>
    </div>
  );
}

function DragPreviewIcon({ type }: { type: StudioNode["tipo"] }) {
  switch (type) {
    case "folder":
      return <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />;
    case "project":
      return <Hash className="h-3.5 w-3.5 shrink-0 text-blue-400" />;
    case "task":
      return <ListTodo className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
    default:
      return <FolderClosed className="h-3.5 w-3.5 shrink-0 text-primary" />;
  }
}
