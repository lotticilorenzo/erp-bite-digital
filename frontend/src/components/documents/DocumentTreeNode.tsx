import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Trash2,
  Pencil,
  FolderPlus,
  FilePlus,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentNode } from "@/types/document";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DocumentTreeNodeProps {
  node: DocumentNode;
  depth?: number;
  selectedId: string | null;
  onSelect: (node: DocumentNode) => void;
  onCreate: (parentId: string, tipo: "FOLDER" | "FILE") => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

export function DocumentTreeNode({
  node,
  depth = 0,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: DocumentTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.nome);
  const [showActions, setShowActions] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  const isFolder = node.tipo === "FOLDER";
  const isSelected = selectedId === node.id;

  // Auto-focus rename input
  useEffect(() => {
    if (isRenaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [isRenaming]);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== node.nome) {
      onRename(node.id, trimmed);
    } else {
      setRenameValue(node.nome);
    }
    setIsRenaming(false);
  }, [renameValue, node.nome, node.id, onRename]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") {
      setRenameValue(node.nome);
      setIsRenaming(false);
    }
    e.stopPropagation();
  };

  const handleRowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) setIsOpen((v) => !v);
    onSelect(node);
  };

  const handleRowDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
    setRenameValue(node.nome);
  };

  // File/folder icon with emoji override
  const renderIcon = () => {
    if (node.icona) {
      return <span className="text-base leading-none">{node.icona}</span>;
    }
    if (isFolder) {
      return isOpen ? (
        <FolderOpen
          size={15}
          className="shrink-0"
          style={{ color: node.colore || "hsl(var(--primary))" }}
        />
      ) : (
        <Folder
          size={15}
          className="shrink-0"
          style={{ color: node.colore || "hsl(var(--primary))" }}
        />
      );
    }
    return <FileText size={14} className="shrink-0 text-muted-foreground/70" />;
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "group/row flex items-center gap-0.5 h-[28px] px-1 rounded-md cursor-pointer transition-colors relative",
          isSelected
            ? "bg-primary/10 text-primary"
            : "hover:bg-white/[0.04] text-foreground/75 hover:text-foreground"
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={handleRowClick}
        onDoubleClick={handleRowDoubleClick}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Chevron (folders only) */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {isFolder && (
            <ChevronRight
              size={12}
              className={cn(
                "transition-transform duration-150 text-muted-foreground/50",
                isOpen && "rotate-90"
              )}
            />
          )}
        </span>

        {/* Icon */}
        <span className="flex items-center justify-center w-5 shrink-0">
          {renderIcon()}
        </span>

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-background border border-primary/60 rounded px-1.5 py-0.5 text-[12px] font-medium outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
          />
        ) : (
          <span className="flex-1 text-[12px] font-medium truncate leading-none">
            {node.nome}
          </span>
        )}

        {/* Action buttons (appear on hover) */}
        {!isRenaming && (showActions || isSelected) && (
          <div
            className="flex items-center gap-0.5 ml-auto shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {isFolder && (
              <>
                <button
                  title="Nuovo file"
                  className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(true);
                    onCreate(node.id, "FILE");
                  }}
                >
                  <FilePlus size={12} />
                </button>
                <button
                  title="Nuova cartella"
                  className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(true);
                    onCreate(node.id, "FOLDER");
                  }}
                >
                  <FolderPlus size={12} />
                </button>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title="Altro"
                  className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MoreHorizontal size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="bg-card border-border rounded-xl shadow-2xl w-44"
                align="start"
              >
                <DropdownMenuItem
                  className="text-[11px] font-bold cursor-pointer gap-2"
                  onClick={() => { setIsRenaming(true); setRenameValue(node.nome); }}
                >
                  <Pencil size={12} /> Rinomina
                </DropdownMenuItem>
                {isFolder && (
                  <>
                    <DropdownMenuItem
                      className="text-[11px] font-bold cursor-pointer gap-2"
                      onClick={() => { setIsOpen(true); onCreate(node.id, "FILE"); }}
                    >
                      <FilePlus size={12} /> Nuovo File
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-[11px] font-bold cursor-pointer gap-2"
                      onClick={() => { setIsOpen(true); onCreate(node.id, "FOLDER"); }}
                    >
                      <FolderPlus size={12} /> Nuova Cartella
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[11px] font-bold cursor-pointer gap-2 text-destructive focus:text-destructive"
                  onClick={() => onDelete(node.id)}
                >
                  <Trash2 size={12} /> Elimina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Children */}
      {isFolder && isOpen && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <DocumentTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Empty folder hint */}
      {isFolder && isOpen && node.children.length === 0 && (
        <div
          className="text-[10px] text-muted-foreground/30 font-medium italic px-2 py-1"
          style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
        >
          Cartella vuota
        </div>
      )}
    </div>
  );
}
