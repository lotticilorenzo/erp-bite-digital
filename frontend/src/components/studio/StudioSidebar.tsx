import React, { useMemo } from "react";
import {
  Plus,
  Search,
  Home,
  BarChart3,
  MessageSquare,
  MoreVertical,
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Zap, FolderClosed } from "lucide-react";
import { useStudio } from "@/hooks/useStudio";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { FolderNode } from "./FolderNode";
import { ProgettoDialog } from "./ProgettoDialog";
import type { StudioNode } from "@/types/studio";

// ─── Recursive search filter ────────────────────────────────────────────────
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

export function StudioSidebar() {
  const { nav, setView, hierarchy, isLoading, openNewTask } = useStudio();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [isProgettoModalOpen, setIsProgettoModalOpen] = React.useState(false);

  const createWorkspaceMutation = useMutation({
    mutationFn: async (nome: string) => {
      return api.post("/studio/nodes", { nome, tipo: "folder", parent_id: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-hierarchy"] });
    },
  });

  const handleCreateWorkspace = () => {
    const nome = prompt("Nome del nuovo workspace:");
    if (nome) createWorkspaceMutation.mutate(nome);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const moveMutation = useMutation({
    mutationFn: async ({ itemId, parentId }: { itemId: string; parentId: string | null }) => {
      return api.post("/studio/nodes/move", { node_id: itemId, parent_id: parentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-hierarchy"] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overNode = over.data.current;
    if (active.id !== over.id && overNode?.tipo === "folder") {
      moveMutation.mutate({ itemId: active.id as string, parentId: over.id as string });
    } else if (active.id !== over.id && !over.id) {
      moveMutation.mutate({ itemId: active.id as string, parentId: null });
    }
  };

  // Filter hierarchy by search query
  const filteredHierarchy = useMemo(() => filterNodes(hierarchy, search), [hierarchy, search]);

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
      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Cerca progetti..."
            className="pl-9 pr-8 h-8 bg-card/50 border-border/50 text-xs focus-visible:ring-primary/30"
            value={search}
            onChange={e => setSearch(e.target.value)}
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

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <ScrollArea className="flex-1 px-3 pb-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 mb-2 group/header">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
                  {search ? `Risultati (${filteredHierarchy.length})` : "Clienti"}
                </h4>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleCreateWorkspace}
                  className="p-1.5 text-muted-foreground hover:text-primary transition-all hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10" 
                  title="Nuova Sezione / Workspace"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 text-muted-foreground hover:text-primary transition-all hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10" title="Altro">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48 bg-card border-border rounded-xl shadow-2xl" side="bottom" align="end">
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
            </div>

            <div className="space-y-1">
              {isLoading ? (
                <div className="px-3 py-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-4 w-full bg-slate-800/50 animate-pulse rounded" />
                  ))}
                </div>
              ) : filteredHierarchy.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                    {search ? "Nessun risultato" : "Nessun progetto"}
                  </p>
                </div>
              ) : (
                filteredHierarchy.map(node => (
                  <FolderNode key={node.id} node={node} />
                ))
              )}
            </div>

            {/* Nuovo Workspace Button */}
            <div className="px-1 pt-4">
              <button
                onClick={handleCreateWorkspace}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-white/10 text-muted-foreground/60 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all group"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 border border-white/10 group-hover:border-primary/30 group-hover:bg-primary/10 transition-all">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-bold tracking-wide">Nuovo workspace</span>
              </button>
            </div>
          </div>
        </ScrollArea>
      </DndContext>

      <ProgettoDialog open={isProgettoModalOpen} onOpenChange={setIsProgettoModalOpen} />
    </div>
  );
}
