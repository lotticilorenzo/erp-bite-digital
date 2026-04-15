import { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  GripVertical,
  Hash,
  ListTodo,
  MoreVertical,
  Edit2,
  Trash2,
  FolderPlus,
  Lock,
  Plus,
  Circle,
} from "lucide-react";
import type { StudioNode } from "@/types/studio";
import { useStudio } from "@/hooks/useStudio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTaskMutations } from "@/hooks/useTasks";
import api from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getStudioNodeDropId } from "./studioTreeDnd";

interface FolderNodeProps {
  node: StudioNode;
  depth?: number;
  parentProjectId?: string | null;
  draggedSubtreeIds?: Set<string>;
}

function getCompactNodeLabel(name: string, type: StudioNode["tipo"]): string {
  const trimmed = name.trim();
  if (type !== "folder") return trimmed;

  const patterns = [
    /\bS\.?\s*R\.?\s*L\.?\s*S\.?\b/gi,
    /\bS\.?\s*R\.?\s*L\.?\b/gi,
    /\bS\.?\s*P\.?\s*A\.?\b/gi,
    /\bS\.?\s*N\.?\s*C\.?\b/gi,
    /\bS\.?\s*A\.?\s*S\.?\b/gi,
    /\bSOCIETA['’]?\s+A\s+RESPONSABILITA['’]?\s+LIMITATA\b/gi,
  ];

  let compact = trimmed;
  for (const pattern of patterns) {
    compact = compact.replace(pattern, "");
  }

  compact = compact.replace(/\s{2,}/g, " ").trim();
  return compact || trimmed;
}

export function FolderNode({
  node,
  depth = 0,
  parentProjectId = null,
  draggedSubtreeIds = new Set<string>(),
}: FolderNodeProps) {
  const { openTab, activeTabId } = useStudio();
  const queryClient = useQueryClient();
  const { createTask } = useTaskMutations();
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.nome);
  const [createMode, setCreateMode] = useState<"folder" | "task" | null>(null);
  const [newChildName, setNewChildName] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const newChildRef = useRef<HTMLInputElement>(null);

  const projectIdContext =
    node.tipo === "project" ? node.linked_progetto_id ?? null : parentProjectId;

  useEffect(() => {
    if (isRenaming) renameRef.current?.focus();
  }, [isRenaming]);

  useEffect(() => {
    if (createMode) newChildRef.current?.focus();
  }, [createMode]);

  const renameMutation = useMutation({
    mutationFn: (nome: string) => api.patch(`/studio/nodes/${node.id}`, { nome }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-hierarchy"] });
      toast.success("Rinominato");
    },
    onError: () => toast.error("Errore durante la rinomina"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/studio/nodes/${node.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-hierarchy"] });
      toast.success(`"${node.nome}" eliminato`);
    },
    onError: () => toast.error("Errore durante l'eliminazione"),
  });

  const createChildFolderMutation = useMutation({
    mutationFn: (nome: string) =>
      api.post("/studio/nodes", {
        nome,
        tipo: "folder",
        parent_id: node.id,
        order: node.children.length,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-hierarchy"] });
      setCreateMode(null);
      setNewChildName("");
      setIsOpen(true);
      toast.success("Cartella creata");
    },
    onError: () => toast.error("Errore nella creazione"),
  });

  const isFolder = node.tipo === "folder";
  const isDropDisabled = draggedSubtreeIds.has(node.id);

  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: node,
  });

  const { setNodeRef: setInsideDropRef, isOver: isInsideOver } = useDroppable({
    id: getStudioNodeDropId(node.id, "inside"),
    data: { nodeId: node.id, position: "inside" },
    disabled: !isFolder || isDropDisabled || isDragging,
  });

  const style = transform
    ? !isDragging
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100 }
      : undefined
    : undefined;

  const isActive =
    (node.tipo === "project" && activeTabId === `PROJECT-${node.linked_progetto_id}`) ||
    (node.tipo === "task" && activeTabId === `TASK-${node.linked_task_id}`);
  const displayName = getCompactNodeLabel(node.nome, node.tipo);
  const setRowRefs = (element: HTMLDivElement | null) => {
    setNodeRef(element);
    setInsideDropRef(element);
  };

  const handleSelect = () => {
    if (isRenaming) return;
    if (node.tipo === "project" && node.linked_progetto_id) {
      openTab({ type: "PROJECT", title: node.nome, linkedId: node.linked_progetto_id });
    } else if (node.tipo === "task" && node.linked_task_id) {
      openTab({ type: "TASK", title: node.nome, linkedId: node.linked_task_id });
    } else if (isFolder) {
      setIsOpen((prev) => !prev);
    }
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== node.nome) {
      renameMutation.mutate(trimmed);
    }
    setIsRenaming(false);
  };

  const resetCreator = () => {
    setCreateMode(null);
    setNewChildName("");
  };

  const beginCreate = (mode: "folder" | "task") => {
    setCreateMode(mode);
    setNewChildName("");
    setIsOpen(true);
  };

  const commitNewChild = async () => {
    const trimmed = newChildName.trim();
    if (!createMode || !trimmed) {
      resetCreator();
      return;
    }

    if (createMode === "folder") {
      createChildFolderMutation.mutate(trimmed);
      return;
    }

    try {
      const taskResponse = await createTask.mutateAsync({
        titolo: trimmed,
        progetto_id: projectIdContext ?? undefined,
        stato: "DA_FARE",
      });
      const createdTask = taskResponse.data;

      try {
        await api.post("/studio/nodes", {
          nome: createdTask.titolo ?? trimmed,
          tipo: "task",
          parent_id: node.id,
          linked_task_id: createdTask.id,
          order: node.children.length,
        });
        queryClient.invalidateQueries({ queryKey: ["studio-hierarchy"] });
        setIsOpen(true);
        resetCreator();
        toast.success("Task creata");
        openTab({
          type: "TASK",
          title: createdTask.titolo ?? trimmed,
          linkedId: createdTask.id,
        });
      } catch {
        await api.delete(`/tasks/${createdTask.id}`).catch(() => null);
        toast.error("Errore nell'aggancio della task alla struttura");
      }
    } catch {
      toast.error("Errore nella creazione della task");
    }
  };

  const handleDelete = () => {
    if (confirm(`Eliminare "${node.nome}" e tutto il suo contenuto?`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="w-full">
      <NodeDropZone depth={depth} nodeId={node.id} position="before" disabled={isDropDisabled || isDragging} />
      <div
        ref={setRowRefs}
        data-studio-node-row="true"
        data-studio-node-id={node.id}
        data-studio-node-type={node.tipo}
        data-studio-node-name={node.nome}
        data-studio-drop-zone={isFolder ? "true" : undefined}
        data-studio-drop-node-id={isFolder ? node.id : undefined}
        data-studio-drop-position={isFolder ? "inside" : undefined}
        style={{ ...style, paddingLeft: `${depth * 12 + 8}px` }}
        className={`
          flex items-start gap-1 group/node py-1 px-2 rounded-md cursor-pointer transition-all duration-150 select-none
          ${isActive ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-white/5 text-muted-foreground hover:text-white"}
          ${isInsideOver && isFolder ? "bg-primary/20 border border-primary/40 rounded-md shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]" : ""}
          ${isDragging ? "opacity-30 pointer-events-none" : ""}
        `}
        onClick={handleSelect}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          data-studio-drag-handle="true"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 h-6 w-5 shrink-0 rounded-md text-muted-foreground/30 transition-all hover:bg-white/5 hover:text-primary cursor-grab active:cursor-grabbing flex items-center justify-center"
          title="Trascina"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-1.5 flex-1 min-w-0">
          {isFolder && (
            <div className="w-4 flex items-center justify-center shrink-0 pt-0.5">
              {node.children.length > 0
                ? isOpen
                  ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                  : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                : <Circle className="h-1 w-1 text-muted-foreground/20" />}
            </div>
          )}

          <NodeIcon type={node.tipo} isOpen={isOpen} />

          {isRenaming ? (
            <input
              ref={renameRef}
              className="flex-1 bg-card/80 border border-primary/40 rounded px-1.5 text-xs font-bold text-white outline-none min-w-0"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setIsRenaming(false);
                  setRenameValue(node.nome);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              data-studio-node-label="true"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
              }}
              title={node.nome}
              className={`min-w-0 break-words whitespace-normal transition-all duration-300 ${
                isFolder
                  ? "text-[10px] font-black uppercase tracking-[0.1em] leading-[1.2] text-muted-foreground/80 group-hover/node:text-primary"
                  : "text-[11px] font-medium leading-[1.25] text-slate-300 group-hover/node:text-white"
              }`}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {displayName}
            </span>
          )}
        </div>

        {isFolder && node.children.length > 0 && (
          <div className="flex items-center justify-center h-4.5 min-w-[18px] px-1 rounded-md bg-primary/10 border border-primary/20 text-[8px] font-black text-primary/80 mr-1 self-start mt-0.5">
            {node.children.length}
          </div>
        )}

        {node.is_private && <Lock className="h-2.5 w-2.5 text-amber-500/50 mr-1 shrink-0 self-start mt-0.5" />}

        <div className="flex items-center gap-0.5 shrink-0 self-start mt-0.5">
          {isFolder && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="h-6 w-6 rounded-md border border-primary/20 bg-primary/5 text-primary/90 hover:bg-primary/10 transition-all flex items-center justify-center">
                  <Plus className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border text-white w-48 shadow-2xl rounded-xl">
                <DropdownMenuItem
                  className="gap-2 text-xs font-bold cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    beginCreate("folder");
                  }}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Nuova Sottocartella
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-xs font-bold cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    beginCreate("task");
                  }}
                >
                  <ListTodo className="h-3.5 w-3.5 text-emerald-400" />
                  Nuova Task Qui
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="h-6 w-6 rounded-md border border-white/10 bg-white/[0.03] text-muted-foreground hover:text-white hover:bg-white/5 transition-all flex items-center justify-center">
                  <MoreVertical className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border text-white w-44 shadow-2xl rounded-xl">
              {isFolder && (
                <>
                  <DropdownMenuItem
                    className="gap-2 text-[11px] font-bold cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      beginCreate("folder");
                    }}
                  >
                    <FolderPlus className="h-3 w-3 text-primary" />
                    Nuova Sottocartella
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-[11px] font-bold cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      beginCreate("task");
                    }}
                  >
                    <ListTodo className="h-3 w-3 text-emerald-400" />
                    Nuova Task
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/30" />
                </>
              )}
              <DropdownMenuItem
                className="gap-2 text-[11px] font-bold cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRenaming(true);
                  setRenameValue(node.nome);
                }}
              >
                <Edit2 className="h-3 w-3 text-muted-foreground" />
                Modifica
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem
                className="gap-2 text-[11px] font-bold text-destructive cursor-pointer focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
              >
                <Trash2 className="h-3 w-3" />
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isFolder && isOpen && (
        <div className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <FolderNode
              key={child.id}
              node={child}
              depth={depth + 1}
              parentProjectId={projectIdContext}
              draggedSubtreeIds={draggedSubtreeIds}
            />
          ))}

          {createMode && (
            <div
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              className="flex items-center gap-1.5 py-1 px-2"
            >
              {createMode === "folder" ? (
                <FolderPlus className="h-3.5 w-3.5 text-primary/70 shrink-0" />
              ) : (
                <ListTodo className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              )}
              <input
                ref={newChildRef}
                className="flex-1 bg-card/80 border border-primary/40 rounded px-1.5 text-[10px] font-bold text-white outline-none min-w-0"
                placeholder={createMode === "folder" ? "Nome cartella..." : "Nome task..."}
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                onBlur={commitNewChild}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitNewChild();
                  if (e.key === "Escape") resetCreator();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      )}

      <NodeDropZone depth={depth} nodeId={node.id} position="after" disabled={isDropDisabled || isDragging} />
    </div>
  );
}

function NodeDropZone({
  depth,
  nodeId,
  position,
  disabled = false,
}: {
  depth: number;
  nodeId: string;
  position: "before" | "after";
  disabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: getStudioNodeDropId(nodeId, position),
    data: { nodeId, position },
    disabled,
  });

  return (
    <div style={{ paddingLeft: `${depth * 12 + 8}px` }} className="relative h-2.5">
      <div
        ref={setNodeRef}
        data-studio-drop-zone="true"
        data-studio-drop-node-id={nodeId}
        data-studio-drop-position={position}
        className="absolute inset-0 rounded-md"
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 h-px rounded-full bg-transparent transition-all duration-150",
          isOver && "h-0.5 bg-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.22)]"
        )}
      />
    </div>
  );
}

function NodeIcon({ type, isOpen }: { type: string; isOpen?: boolean }) {
  switch (type) {
    case "folder":
      return isOpen
        ? <FolderOpen className="h-3.5 w-3.5 text-primary/70 shrink-0" />
        : <Folder className="h-3.5 w-3.5 text-primary/70 shrink-0" />;
    case "project":
      return <Hash className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    case "task":
      return <ListTodo className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
    default:
      return null;
  }
}
