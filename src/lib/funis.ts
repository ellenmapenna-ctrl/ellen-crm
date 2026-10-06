import { HeartPulse, Shield, type LucideIcon } from "lucide-react";

// Funis de venda (kanban_estagios.funil / funil_posicoes.funil). O cliente
// tem uma posição independente em cada funil — pode estar na revisita de Vida
// e como lead de Saúde ao mesmo tempo.

export type FunilKey = "vida_revisitas" | "vida_visitas" | "saude";
export type CategoriaFunilKey = "vida" | "saude";
/** Coluna (kanban_estagios.id) do cliente em cada funil; ausente = fora do funil. */
export type FunisDoCliente = Partial<Record<FunilKey, string>>;

export interface FunilInfo {
  key: FunilKey;
  categoria: CategoriaFunilKey;
  /** Nome curto, usado dentro da categoria (sub-aba). */
  label: string;
  /** Nome completo, usado fora da página do Funil. */
  nomeCompleto: string;
  descricao: string;
}

export interface CategoriaFunil {
  key: CategoriaFunilKey;
  label: string;
  icon: LucideIcon;
  funis: FunilKey[];
}

export const FUNIS: FunilInfo[] = [
  {
    key: "vida_revisitas",
    categoria: "vida",
    label: "Revisitas",
    nomeCompleto: "Vida · Revisitas",
    descricao: "Manutenção da carteira",
  },
  {
    key: "vida_visitas",
    categoria: "vida",
    label: "Visitas",
    nomeCompleto: "Vida · Visitas",
    descricao: "Novos leads",
  },
  {
    key: "saude",
    categoria: "saude",
    label: "Saúde",
    nomeCompleto: "Saúde",
    descricao: "Novos leads",
  },
];

export const CATEGORIAS_FUNIL: CategoriaFunil[] = [
  { key: "vida", label: "Vida", icon: Shield, funis: ["vida_revisitas", "vida_visitas"] },
  { key: "saude", label: "Saúde", icon: HeartPulse, funis: ["saude"] },
];

export const FUNIL_PADRAO: FunilKey = "vida_revisitas";

export function funilInfo(key: string | null | undefined): FunilInfo | null {
  return FUNIS.find((f) => f.key === key) ?? null;
}

export function ehFunilKey(v: string | null | undefined): v is FunilKey {
  return FUNIS.some((f) => f.key === v);
}
