import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreVertical, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { hexParaRgb } from "@/lib/cor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KanbanCard } from "./KanbanCard";
import type { ClienteWithRelations, KanbanEstagio } from "@/lib/types";

type DragHandle = React.HTMLAttributes<HTMLElement>;

interface ShellProps {
  /** Coluna real (kanban_estagios.id) ou null para "Sem estágio". */
  estagioId: string | null;
  nome: string;
  cor: string;
  clientes: ClienteWithRelations[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
  onEdit?: () => void;
  onAdicionar?: () => void;
  onRemoverCliente?: (id: string) => void;
  headerDragHandle?: DragHandle;
  setNodeRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  isOver?: boolean;
  isDragging?: boolean;
}

export function KanbanColumnShell({
  estagioId,
  nome,
  cor,
  clientes,
  selected,
  onToggle,
  onNavigate,
  onEdit,
  onAdicionar,
  onRemoverCliente,
  headerDragHandle,
  setNodeRef,
  style,
  isOver,
  isDragging,
}: ShellProps) {
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex h-full max-h-full w-72 shrink-0 flex-col rounded-xl border bg-card shadow-soft",
        isOver && "border-primary ring-2 ring-primary/40",
        isDragging && "opacity-60"
      )}
    >
      <div
        {...(headerDragHandle ?? {})}
        className="flex items-center justify-between gap-2 rounded-t-xl border-b px-3 py-2"
        style={{ backgroundColor: `rgba(${hexParaRgb(cor)}, 0.12)` }}
      >
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: cor }} />
          <span className="truncate text-sm font-semibold">{nome}</span>
          <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
            {clientes.length}
          </span>
        </div>
        {onEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Opções da coluna"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-3.5" />
                Editar coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="scrollbar-thin flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {clientes.map((c) => (
          <KanbanCard
            key={c.id}
            estagioId={estagioId}
            cliente={c}
            selected={selected.has(c.id)}
            onToggle={onToggle}
            onNavigate={onNavigate}
            onRemover={onRemoverCliente}
          />
        ))}
        {clientes.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
            Solte cards aqui
          </div>
        )}
      </div>
      {onAdicionar && (
        <button
          type="button"
          onClick={onAdicionar}
          className="flex items-center gap-1.5 rounded-b-xl border-t px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Adicionar cliente
        </button>
      )}
    </div>
  );
}

interface SortableProps extends Omit<ShellProps, "estagioId" | "nome" | "cor" | "setNodeRef" | "style" | "headerDragHandle" | "isDragging"> {
  estagio: KanbanEstagio;
}

export function SortableColumn({ estagio, ...rest }: SortableProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: estagio.id,
    data: { type: "column" },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <KanbanColumnShell
      {...rest}
      estagioId={estagio.id}
      nome={estagio.nome}
      cor={estagio.cor}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
      headerDragHandle={{ ...attributes, ...listeners } as unknown as DragHandle}
    />
  );
}

interface DroppableProps extends Omit<ShellProps, "estagioId" | "nome" | "cor" | "setNodeRef" | "isOver" | "onEdit"> {
  onEdit?: () => void;
}

export function DroppableColumn({ onEdit, ...rest }: DroppableProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "sem-estagio",
    data: { type: "column" },
  });
  return (
    <KanbanColumnShell
      {...rest}
      estagioId={null}
      nome="Sem estágio"
      cor="#94a3b8"
      setNodeRef={setNodeRef}
      isOver={isOver}
      onEdit={onEdit}
    />
  );
}
