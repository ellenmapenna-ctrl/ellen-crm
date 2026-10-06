import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { contrasteTexto } from "@/lib/cor";
import type { Tag } from "@/lib/types";

export function TagBadge({
  tag,
  onRemove,
  className,
}: {
  tag: Pick<Tag, "nome" | "cor">;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-smooth",
        className
      )}
      style={{ backgroundColor: tag.cor, color: contrasteTexto(tag.cor) }}
    >
      {tag.nome}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-0.5 ml-0.5 rounded-full p-0.5 hover:bg-black/10"
          aria-label={`Remover tag ${tag.nome}`}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
