import { CheckCircle2, CircleDashed, Hourglass, PlayCircle, type LucideIcon } from "lucide-react";
import { hojeIso } from "@/lib/sitplan";
import type { Demanda } from "@/lib/types";

export type DemandaStatus = "a_fazer" | "em_andamento" | "aguardando" | "concluida";
export type DemandaPrioridade = "baixa" | "normal" | "alta";
export type DemandaResponsavel = "Ellen" | "Renan";

export const RESPONSAVEIS: DemandaResponsavel[] = ["Ellen", "Renan"];

export interface StatusOpcao {
  key: DemandaStatus;
  label: string;
  icon: LucideIcon;
  colorClass: string;
}

export const STATUS_OPCOES: StatusOpcao[] = [
  { key: "a_fazer", label: "A fazer", icon: CircleDashed, colorClass: "text-slate-600" },
  { key: "em_andamento", label: "Em andamento", icon: PlayCircle, colorClass: "text-blue-600" },
  { key: "aguardando", label: "Aguardando", icon: Hourglass, colorClass: "text-amber-600" },
  { key: "concluida", label: "Concluída", icon: CheckCircle2, colorClass: "text-emerald-600" },
];

export const STATUS_ABERTOS: DemandaStatus[] = ["a_fazer", "em_andamento", "aguardando"];

export const PRIORIDADE_OPCOES: { key: DemandaPrioridade; label: string }[] = [
  { key: "alta", label: "Alta" },
  { key: "normal", label: "Normal" },
  { key: "baixa", label: "Baixa" },
];

export function statusInfo(key: string): StatusOpcao {
  return STATUS_OPCOES.find((o) => o.key === key) ?? STATUS_OPCOES[0];
}

export function estaAberta(d: Pick<Demanda, "status">): boolean {
  return d.status !== "concluida";
}

/** Aberta com prazo anterior a hoje. */
export function estaAtrasada(d: Pick<Demanda, "status" | "prazo">): boolean {
  return estaAberta(d) && !!d.prazo && d.prazo < hojeIso();
}

export function venceHoje(d: Pick<Demanda, "status" | "prazo">): boolean {
  return estaAberta(d) && d.prazo === hojeIso();
}

const PESO_PRIORIDADE: Record<string, number> = { alta: 0, normal: 1, baixa: 2 };

/** Atrasadas primeiro, depois prazo mais próximo (sem prazo por último), prioridade e mais antigas. */
export function compararDemandas(a: Demanda, b: Demanda): number {
  const pa = a.prazo ?? "9999-12-31";
  const pb = b.prazo ?? "9999-12-31";
  if (pa !== pb) return pa < pb ? -1 : 1;
  const prio = (PESO_PRIORIDADE[a.prioridade] ?? 1) - (PESO_PRIORIDADE[b.prioridade] ?? 1);
  if (prio !== 0) return prio;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}

/** "2026-10-07" → "07/10" (o ano só aparece quando não é o atual). */
export function formatarPrazo(prazo: string): string {
  const [y, m, d] = prazo.split("-");
  const anoAtual = String(new Date().getFullYear());
  return y === anoAtual ? `${d}/${m}` : `${d}/${m}/${y}`;
}
