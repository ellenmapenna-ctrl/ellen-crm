import { cn } from "@/lib/utils";
import { CATEGORIAS_FUNIL, FUNIS, funilInfo, type FunilKey } from "@/lib/funis";

interface Props {
  funil: FunilKey;
  onChange: (funil: FunilKey) => void;
  /** Quantidade de clientes posicionados em cada funil. */
  contagem: Map<FunilKey, number>;
}

/** Categoria (Vida / Saúde) e, dentro de Vida, Revisitas x Visitas. */
export function FunilSelector({ funil, onChange, contagem }: Props) {
  const atual = funilInfo(funil);
  const categoria = CATEGORIAS_FUNIL.find((c) => c.key === atual?.categoria) ?? CATEGORIAS_FUNIL[0];
  const subFunis = FUNIS.filter((f) => categoria.funis.includes(f.key));

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="inline-flex w-fit rounded-lg border bg-muted p-1">
        {CATEGORIAS_FUNIL.map((c) => {
          const Icon = c.icon;
          const ativa = c.key === categoria.key;
          const total = c.funis.reduce((s, f) => s + (contagem.get(f) ?? 0), 0);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => !ativa && onChange(c.funis[0])}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold transition-smooth",
                ativa ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {c.label}
              <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">{total}</span>
            </button>
          );
        })}
      </div>

      {subFunis.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {subFunis.map((f) => {
            const ativo = f.key === funil;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onChange(f.key)}
                className={cn(
                  "flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-smooth",
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                )}
              >
                {f.label}
                <span className={cn("font-normal", ativo ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {f.descricao} · {contagem.get(f.key) ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">{atual?.descricao}</span>
      )}
    </div>
  );
}
