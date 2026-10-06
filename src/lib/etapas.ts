import {
  Building2,
  CreditCard,
  Globe2,
  Heart,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

// Linhas de negócio do cliente (não é o funil de vendas — isso é
// estagio_id/kanban_estagios). Categorias próprias da Ellen.

export interface EtapaOpcao {
  key: string;
  label: string;
  icon: LucideIcon;
  colorClass: string;
}

export const ETAPA_OPCOES: EtapaOpcao[] = [
  { key: "internacional", label: "Internacional", icon: Globe2, colorClass: "text-blue-600" },
  { key: "credito", label: "Crédito", icon: CreditCard, colorClass: "text-emerald-600" },
  { key: "investimentos", label: "Investimentos", icon: TrendingUp, colorClass: "text-indigo-600" },
  { key: "consorcio", label: "Consórcio", icon: Users, colorClass: "text-orange-600" },
  { key: "vida", label: "Vida", icon: Heart, colorClass: "text-rose-600" },
  { key: "imoveis", label: "Imóveis", icon: Building2, colorClass: "text-amber-600" },
];

export function etapaInfo(key: string | null | undefined): EtapaOpcao | null {
  if (!key) return null;
  return ETAPA_OPCOES.find((o) => o.key === key) ?? null;
}
