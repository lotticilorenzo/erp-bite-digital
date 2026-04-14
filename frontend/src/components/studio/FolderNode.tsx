import { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";

interface FolderNodeProps {
  node: StudioNode;
  depth?: number;
}

export function FolderNode({ node, depth = 0 }: FolderNodeProps) {
  const { openTab, activeTabId } = useStudio();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.nome);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const newChildRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) renameRef.current?.focus();
  }, [isRenaming]);

  useEffect(() => {
    if (isCreatingChild) newChildRef.current?.focus();
  }, [isCreatingChild]);

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

  const createChildMutation = useMutation({
    mutationFn: (nome: string) =>
      api.post("/studio/nodes", { nome, tipo: "folder", parent_id: node.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-hierarchy"] });
      setIsCreatingChild(false);
      setNewChildName("");
      setIsOpen(true);
      toast.success("Sottocartella creata");
    },
    onError: () => toast.error("Errore nella creazione"),
  });

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: node,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    data: node,
    disabled: node.tipo !== "folder",
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100 }
    : undefined;

  const isFolder = node.tipo === "folder";
  const isActive =
    (node.tipo === "project" && activeTabId === `PROJECT-${node.linked_progetto_id}`) ||
    (node.tipo === "task" && activeTabId === `TASK-${node.linked_task_id}`);

  const handleSelect = () => {
    if (isRenaming) return;
    if (node.tipo === "project" && node.linked_progetto_id) {
      openTab({ type: "PROJECT", title: node.nome, linkedId: node.linked_progetto_id });
    } else if (node.tipo === "task" && node.linked_task_id) {
      openTab({ type: "TASK", title: node.nome, linkedId: node.linked_task_id });
    } else if (isFolder) {
      setIsOpen(prev => !prev);
    }
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== node.nome) {
      renameMutation.mutate(trimmed);
    }
    setIsRenaming(false);
  };

  const commitNewChild = () => {
    const trimmed = newChildName.trim();
    if (trimmed) createChildMutation.mutate(trimmed);
    else setIsCreatingChild(false);
  };

  const handleDelete = () => {
    if (confirm(`Eliminare "${node.nome}" e tutto il suo contenuto?`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="w-full" ref={setDropRef}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={{ ...style, paddingLeft: `${depth * 12 + 8}px` }}
        className={`
          flex items-center group/node py-1 px-2 rounded-md cursor-pointer transition-all duration-150 select-none
          ${isActive ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-white/5 text-muted-foreground hover:text-white"}
          ${isOver && isFolder ? "bg-primary/20 border border-primary/40 rounded-md" : ""}
          ${isDragging ? "opacity-30" : ""}
        `}
        onClick={handleSelect}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* Expand chevron for folders */}
          {isFolder && (
            <div className="w-4 flex items-center justify-center shrink-0">
              {node.children.length > 0
                ? isOpen
                  ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                  : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                : <Circle className="h-1 w-1 text-muted-foreground/20" />
              }
            </div>
          )}

          {/* Icon */}
          <NodeIcon type={node.tipo} isOpen={isOpen} />

          {/* Name — inline rename on double-click */}
          {isRenaming ? (
            <input
              ref={renameRef}
              className="flex-1 bg-card/80 border border-primary/40 rounded px-1.5 text-xs font-bold text-white outline-none min-w-0"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") { setIsRenaming(false); setRenameValue(node.nome); }
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={e => { e.stopPropagation(); setIsRenaming(true); }}
              className={`truncate transition-all duration-300 ${
                isFolder
                  ? "text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/80 group-hover/node:text-primary"
                  : "text-[11.5px] font-medium text-slate-300 group-hover/node:text-white"
              }`}
            >
              {node.nome}
            </span>
          )}
        </div>

        {/* Count Badge (only if children > 0) */}
        {isFolder && node.children.length > 0 && !isOpen && (
          <div className="flex items-center justify-center h-4.5 min-w-[18px] px-1 rounded-md bg-white/5 border border-white/5 text-[9px] font-black text-muted-foreground/60 mr-1 animate-in fade-in zoom-in duration-300">
            {node.children.length}
          </div>
        )}

        {node.is_private && <Lock className="h-2.5 w-2.5 text-amber-500/50 mr-1 shrink-0" />}

        <div className="flex items-center gap-0.5 opacity-0 group-hover/node:opacity-100 transition-all duration-300 translate-x-1 group-hover/node:translate-x-0">
          {/* Quick Add Button for Folders */}
          {isFolder && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <button className="p-1 hover:text-primary hover:bg-white/5 rounded-md transition-all">
                  <Plus className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border text-white w-48 shadow-2xl rounded-xl">
                <DropdownMenuItem
                  className="gap-2 text-xs font-bold cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    setIsCreatingChild(true);
                    setIsOpen(true);
                  }}
                >
                  <FolderPlus className="h-3.5 w-3.5" /> Nuova Sottocartella
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-xs font-bold cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    toast.info("Aggiunta progetto in arrivo...");
                  }}
                >
                  <Hash className="h-3.5 w-3.5 text-blue-400" /> Collega Progetto
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-xs font-bold cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    toast.info("Aggiunta cliente in arrivo...");
                  }}
                >
                  <Folder className="h-3.5 w-3.5 text-primary" /> Collega Cliente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Context menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <button className="p-1 hover:text-white hover:bg-white/5 rounded-md transition-all">
                <MoreVertical className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border text-white w-44 shadow-2xl rounded-xl">
              <DropdownMenuItem
                className="gap-2 text-[11px] font-bold cursor-pointer"
                onClick={e => { e.stopPropagation(); setIsRenaming(true); setRenameValue(node.nome); }}
              >
                <Edit2 className="h-3 w-3 text-muted-foreground" /> Rinomina
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem
                className="gap-2 text-[11px] font-bold text-destructive cursor-pointer focus:text-destructive"
                onClick={e => { e.stopPropagation(); handleDelete(); }}
              >
                <Trash2 className="h-3 w-3" /> Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children */}
      {isFolder && isOpen && (
        <div className="mt-0.5 space-y-0.5">
          {node.children.map(child => (
            <FolderNode key={child.id} node={child} depth={depth + 1} />
          ))}

          {/* Inline new subfolder row */}
          {isCreatingChild && (
            <div
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              className="flex items-center gap-1.5 py-1 px-2"
            >
              <FolderPlus className="h-3.5 w-3.5 text-primary/70 shrink-0" />
              <input
                ref={newChildRef}
                className="flex-1 bg-card/80 border border-primary/40 rounded px-1.5 text-[10px] font-bold text-white outline-none uppercase tracking-widest"
                placeholder="Nome cartella..."
                value={newChildName}
                onChange={e => setNewChildName(e.target.value)}
                onBlur={commitNewChild}
                onKeyDown={e => {
                  if (e.key === "Enter") commitNewChild();
                  if (e.key === "Escape") { setIsCreatingChild(false); setNewChildName(""); }
                }}
              />
            </div>
          )}
        </div>
      )}
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
