import type { ApoliceWithCoberturas } from "@/lib/types";

export const SEM_SEGURADORA = "Seguradora não informada";

export function nomeSeguradora(a: Pick<ApoliceWithCoberturas, "seguradora">): string {
  return a.seguradora?.trim() || SEM_SEGURADORA;
}

/** Apólices em vigor do cliente, agrupadas por seguradora (as canceladas/suspensas não entram na revisita). */
export function agruparApolicesAtivas(apolices: ApoliceWithCoberturas[]): { seguradora: string; apolices: ApoliceWithCoberturas[] }[] {
  const grupos = new Map<string, ApoliceWithCoberturas[]>();
  for (const a of apolices.filter((x) => x.status === "ativa")) {
    const chave = nomeSeguradora(a);
    grupos.set(chave, [...(grupos.get(chave) ?? []), a]);
  }
  return [...grupos.entries()].map(([seguradora, lista]) => ({ seguradora, apolices: lista }));
}
