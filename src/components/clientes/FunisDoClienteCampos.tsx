import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Field } from "@/components/shared/Field";
import { useKanbanEstagios } from "@/hooks/useKanbanEstagios";
import { FUNIS, type FunilKey, type FunisDoCliente } from "@/lib/funis";

const FORA_DO_FUNIL = "__fora__";

interface Props {
  /** Coluna atual do cliente em cada funil (ausente = fora do funil). */
  valores: FunisDoCliente;
  onChange: (funil: FunilKey, estagioId: string | null) => void;
  disabled?: boolean;
}

/** Um seletor de coluna por funil (Vida · Revisitas, Vida · Visitas, Saúde). */
export function FunisDoClienteCampos({ valores, onChange, disabled }: Props) {
  const { data: estagios } = useKanbanEstagios();

  return (
    <>
      {FUNIS.map((f) => {
        const colunas = (estagios ?? []).filter((e) => e.funil === f.key);
        const atual = colunas.find((e) => e.id === valores[f.key]);
        return (
          <Field key={f.key} label={`Funil ${f.nomeCompleto}`} htmlFor={`funil-${f.key}`}>
            <Select
              value={atual?.id ?? FORA_DO_FUNIL}
              onValueChange={(v) => onChange(f.key, v === FORA_DO_FUNIL ? null : v)}
              disabled={disabled}
            >
              <SelectTrigger id={`funil-${f.key}`}>
                <span className="flex items-center gap-2 truncate">
                  {atual && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: atual.cor }} />}
                  {atual?.nome ?? "Fora deste funil"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FORA_DO_FUNIL}>Fora deste funil</SelectItem>
                {colunas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        );
      })}
    </>
  );
}
