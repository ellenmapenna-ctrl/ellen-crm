import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
  max?: number;
}

/** Nota de 0 a `max` estrelas, clicável (repetir o clique na estrela já marcada limpa a nota). */
export function StarRating({ value, onChange, size = "sm", max = 5 }: Props) {
  const starSize = size === "sm" ? "size-3.5" : "size-4.5";
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n === value ? 0 : n)}
          className={cn(!onChange && "cursor-default", onChange && "cursor-pointer")}
          aria-label={`${n} de ${max} estrelas`}
        >
          <Star
            className={cn(starSize, n <= value ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/40")}
          />
        </button>
      ))}
    </div>
  );
}
