import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MapPin, Phone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { TagBadge } from "@/components/shared/TagBadge";
import type { ClienteWithRelations } from "@/lib/types";

interface ShellProps {
  cliente: ClienteWithRelations;
  selected: boolean;
  onToggle?: (id: string) => void;
  onNavigate?: (id: string) => void;
  onRemover?: (id: string) => void;
  dragging?: boolean;
  overlay?: boolean;
  className?: string;
}

export function KanbanCardShell({ cliente, selected, onToggle, onNavigate, onRemover, dragging, overlay, className }: ShellProps) {
  const tags = (cliente.cliente_tags ?? []).map((ct) => ct.tag).filter(Boolean);
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-2.5 shadow-soft transition-smooth",
        selected && "ring-2 ring-primary",
        dragging && "opacity-40",
        overlay && "shadow-elegant rotate-2",
        className
      )}
    >
      {onRemover && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemover(cliente.id)}
          className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-smooth hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label={`Remover ${cliente.nome_completo} desta coluna`}
        >
          <X className="size-3.5" />
        </button>
      )}
      <div className="flex items-start gap-2">
        {onToggle && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(cliente.id)}
            className="mt-0.5"
            aria-label={`Selecionar ${cliente.nome_completo}`}
          />
        )}
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-semibold text-primary-foreground">
          {cliente.nome_completo.charAt(0)}
        </span>
        <button
          type="button"
          onClick={() => onNavigate?.(cliente.id)}
          className="flex-1 truncate pr-5 text-left text-sm font-medium leading-tight hover:text-primary"
        >
          {cliente.nome_completo}
        </button>
      </div>
      <div className="mt-1.5 flex flex-col gap-1 pl-8 text-xs text-muted-foreground">
        {cliente.celular && (
          <span className="flex items-center gap-1">
            <Phone className="size-3" />
            {cliente.celular}
          </span>
        )}
        {(cliente.cidade || cliente.uf) && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {[cliente.cidade, cliente.uf].filter(Boolean).join(" - ")}
          </span>
        )}
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 4).map((t) => (
            <TagBadge key={t.id} tag={t} className="text-[10px] px-1.5 py-0" />
          ))}
        </div>
      )}
    </div>
  );
}

export function KanbanCard({ estagioId, ...props }: ShellProps & { estagioId: string | null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
    id: props.cliente.id,
    data: { type: "card", estagioId },
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCardShell {...props} dragging={isDragging} />
    </div>
  );
}
