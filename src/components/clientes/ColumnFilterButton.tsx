import { ArrowDown, ArrowUp, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Faixa {
  key: string;
  label: string;
}

interface Props {
  faixas: Faixa[];
  selecionadas: Set<string>;
  onToggleFaixa: (key: string) => void;
  onLimpar: () => void;
  contarFaixa: (key: string) => number;
  direcao: "asc" | "desc" | null;
  onOrdenar: (direcao: "asc" | "desc" | null) => void;
  labelMaior: string;
  labelMenor: string;
}

/** Botão de filtro/ordenação por coluna numérica: ordena crescente/decrescente e filtra por faixas de valor pré-definidas, com contagem ao vivo. */
export function ColumnFilterButton({
  faixas,
  selecionadas,
  onToggleFaixa,
  onLimpar,
  contarFaixa,
  direcao,
  onOrdenar,
  labelMaior,
  labelMenor,
}: Props) {
  const ativo = selecionadas.size > 0 || direcao !== null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-5 items-center justify-center rounded transition-colors",
            ativo ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
          )}
          aria-label="Filtrar/ordenar"
        >
          <ListFilter className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="mb-3 flex gap-1.5">
          <Button
            size="sm"
            variant={direcao === "desc" ? "default" : "outline"}
            className="h-8 flex-1 text-xs"
            onClick={() => onOrdenar(direcao === "desc" ? null : "desc")}
          >
            <ArrowDown className="size-3.5" />
            {labelMaior}
          </Button>
          <Button
            size="sm"
            variant={direcao === "asc" ? "default" : "outline"}
            className="h-8 flex-1 text-xs"
            onClick={() => onOrdenar(direcao === "asc" ? null : "asc")}
          >
            <ArrowUp className="size-3.5" />
            {labelMenor}
          </Button>
        </div>

        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filtrar valores</p>
          {selecionadas.size > 0 && (
            <button type="button" className="text-xs text-primary hover:underline" onClick={onLimpar}>
              Limpar
            </button>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          {faixas.map((f) => (
            <label
              key={f.key}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent"
            >
              <span className="flex items-center gap-2">
                <Checkbox checked={selecionadas.has(f.key)} onCheckedChange={() => onToggleFaixa(f.key)} />
                {f.label}
              </span>
              <span className="text-xs text-muted-foreground">{contarFaixa(f.key)}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
