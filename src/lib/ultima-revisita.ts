// Data da última revisita (Revisão Anual) de cada cliente, para a coluna da lista
// de Clientes e o cabeçalho do perfil.

export interface RevisitaResumo {
  cliente_id: string | null;
  cliente_nome: string;
  created_at: string | null;
}

function semAcento(valor: string): string {
  return valor.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

/** "2026-10-06T14:20:00Z" → "2026-10-06" no fuso local (a data que a Ellen vê). */
function dataLocalIso(timestamp: string): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Última revisita de cada cliente (ISO yyyy-mm-dd). Casa pelo cliente vinculado
 * e, nas revisitas salvas só com o nome digitado, pelo nome igual ao do cadastro.
 */
export function ultimaRevisitaPorCliente(clientes: { id: string; nome_completo: string }[], revisitas: RevisitaResumo[]): Map<string, string> {
  const idPorNome = new Map<string, string>();
  for (const c of clientes) idPorNome.set(semAcento(c.nome_completo), c.id);

  const mapa = new Map<string, string>();
  for (const r of revisitas) {
    if (!r.created_at) continue;
    const id = r.cliente_id ?? idPorNome.get(semAcento(r.cliente_nome));
    if (!id) continue;
    const data = dataLocalIso(r.created_at);
    const atual = mapa.get(id);
    if (!atual || data > atual) mapa.set(id, data);
  }
  return mapa;
}

function hojeIso(): string {
  return dataLocalIso(new Date().toISOString());
}

function diasEntre(deIso: string, ateIso: string): number {
  const [a1, m1, d1] = deIso.split("-").map(Number);
  const [a2, m2, d2] = ateIso.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

/** "hoje", "ontem" ou "há N dias". */
export function haQuantoTempoRevisita(dataIso: string): string {
  const dias = diasEntre(dataIso, hojeIso());
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export const FAIXAS_REVISITA = [
  { key: "7dias", label: "Nos últimos 7 dias" },
  { key: "30dias", label: "Nos últimos 30 dias" },
  { key: "mais30", label: "Há mais de 30 dias" },
  { key: "nunca", label: "Nunca revisitado" },
] as const;

export function revisitaBateFaixa(dataIso: string | null, faixa: string): boolean {
  if (faixa === "nunca") return dataIso === null;
  if (!dataIso) return false;
  const dias = diasEntre(dataIso, hojeIso());
  if (faixa === "7dias") return dias <= 7;
  if (faixa === "30dias") return dias <= 30;
  if (faixa === "mais30") return dias > 30;
  return false;
}
