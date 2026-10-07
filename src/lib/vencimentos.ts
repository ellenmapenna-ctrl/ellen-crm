import { normalizarNumeroApolice } from "@/lib/seguros-taxonomia";

// Próximo vencimento do prêmio: leitura do relatório "Próximos a vencer" da
// Prudential e utilitários de exibição na lista de clientes.

export interface ApoliceVencimentoDb {
  id: string;
  numero_apolice: string | null;
  status: string;
  proximo_vencimento_premio?: string | null;
}

export interface ColunasVencimento {
  apolice: string;
  vencimento: string;
  segurado: string | null;
  responsavel: string | null;
  forma: string | null;
}

export interface AtualizacaoVencimento {
  apoliceId: string;
  numero: string;
  segurado: string;
  vencimento: string;
  forma: string | null;
  responsavel: string | null;
  anterior: string | null;
}

export interface PlanoVencimentos {
  totalLinhas: number;
  atualizacoes: AtualizacaoVencimento[];
  apolicesNaoEncontradas: { numero: string; segurado: string }[];
  dataInvalida: { numero: string; segurado: string; valor: string }[];
  /** Apólices ativas no banco que não constam no arquivo e hoje têm um vencimento gravado (ficariam sem informação, evitando data velha). */
  paraLimpar: { apoliceId: string; numero: string }[];
  /** Apólices ativas no banco que não constam no arquivo (com ou sem data gravada). */
  ativasForaDoArquivo: number;
}

function norm(valor: string): string {
  return valor.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.\s]+/g, " ").trim();
}

export function detectarColunasVencimento(colunas: string[]): { colunas?: ColunasVencimento; faltando: string[] } {
  const achar = (nome: string) => colunas.find((c) => norm(c) === nome) ?? null;
  const apolice = achar("apolice");
  const vencimento = achar("vencimento do proximo premio");
  const faltando: string[] = [];
  if (!apolice) faltando.push("Apólice");
  if (!vencimento) faltando.push("Vencimento do Próximo Prêmio");
  if (!apolice || !vencimento) return { faltando };
  return {
    colunas: { apolice, vencimento, segurado: achar("segurado"), responsavel: achar("resp pagto"), forma: achar("forma pagto") },
    faltando,
  };
}

/** "07/10/2026" → "2026-10-07"; null se não for uma data válida. */
export function dataBrParaIso(valor: string): string | null {
  const m = valor.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const data = new Date(Number(a), Number(mes) - 1, Number(d));
  if (data.getFullYear() !== Number(a) || data.getMonth() !== Number(mes) - 1 || data.getDate() !== Number(d)) return null;
  return `${a}-${mes}-${d}`;
}

export function planejarVencimentos(linhas: Record<string, string>[], colunas: ColunasVencimento, apolices: ApoliceVencimentoDb[]): PlanoVencimentos {
  const porNumero = new Map<string, ApoliceVencimentoDb[]>();
  for (const a of apolices) {
    if (!a.numero_apolice) continue;
    const n = normalizarNumeroApolice(a.numero_apolice);
    porNumero.set(n, [...(porNumero.get(n) ?? []), a]);
  }

  const plano: PlanoVencimentos = {
    totalLinhas: linhas.length,
    atualizacoes: [],
    apolicesNaoEncontradas: [],
    dataInvalida: [],
    paraLimpar: [],
    ativasForaDoArquivo: 0,
  };
  const noArquivo = new Set<string>();

  for (const linha of linhas) {
    const numeroBruto = (linha[colunas.apolice] ?? "").trim();
    if (!numeroBruto) continue;
    const numero = normalizarNumeroApolice(numeroBruto);
    const segurado = colunas.segurado ? (linha[colunas.segurado] ?? "").trim() : "";
    const venc = dataBrParaIso(linha[colunas.vencimento] ?? "");
    if (!venc) {
      plano.dataInvalida.push({ numero, segurado, valor: linha[colunas.vencimento] ?? "" });
      continue;
    }
    const encontradas = porNumero.get(numero);
    if (!encontradas) {
      plano.apolicesNaoEncontradas.push({ numero, segurado });
      continue;
    }
    for (const a of encontradas) {
      noArquivo.add(a.id);
      plano.atualizacoes.push({
        apoliceId: a.id,
        numero,
        segurado,
        vencimento: venc,
        forma: colunas.forma ? (linha[colunas.forma] ?? "").trim() || null : null,
        responsavel: colunas.responsavel ? (linha[colunas.responsavel] ?? "").trim() || null : null,
        anterior: a.proximo_vencimento_premio ?? null,
      });
    }
  }

  for (const a of apolices) {
    if (a.status !== "ativa" || noArquivo.has(a.id)) continue;
    plano.ativasForaDoArquivo++;
    if (a.proximo_vencimento_premio) plano.paraLimpar.push({ apoliceId: a.id, numero: a.numero_apolice ?? "" });
  }
  return plano;
}

// ---------------------------------------------------------------------------
// Exibição na lista de clientes
// ---------------------------------------------------------------------------

/** Data de hoje em ISO (yyyy-mm-dd), no fuso local. */
function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diasEntreIso(deIso: string, ateIso: string): number {
  const [a1, m1, d1] = deIso.split("-").map(Number);
  const [a2, m2, d2] = ateIso.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

/** O vencimento mais próximo entre as apólices ativas do cliente (ISO), ou null se nenhuma tiver data. */
export function proximoVencimentoDoCliente(apolices: { status: string; proximo_vencimento_premio?: string | null }[]): string | null {
  const datas = apolices
    .filter((a) => a.status === "ativa" && a.proximo_vencimento_premio)
    .map((a) => a.proximo_vencimento_premio as string)
    .sort();
  return datas[0] ?? null;
}

/** Observações manuais (ex.: "EM ATRASO") das apólices ativas do cliente, sem repetir, ou null. */
export function observacaoVencimentoDoCliente(apolices: { status: string; observacao_vencimento?: string | null }[]): string | null {
  const obs = [...new Set(apolices.filter((a) => a.status === "ativa").map((a) => (a.observacao_vencimento ?? "").trim()).filter(Boolean))];
  return obs.length > 0 ? obs.join(" · ") : null;
}

export type SituacaoVencimento = "vencido" | "hoje" | "breve" | "futuro";

/** Quantos dias faltam (negativo = já passou) e a situação para colorir o destaque. */
export function situacaoVencimento(vencimentoIso: string): { dias: number; situacao: SituacaoVencimento; texto: string } {
  const dias = diasEntreIso(hojeIso(), vencimentoIso);
  if (dias < 0) return { dias, situacao: "vencido", texto: dias === -1 ? "venceu ontem" : `venceu há ${-dias} dias` };
  if (dias === 0) return { dias, situacao: "hoje", texto: "vence hoje" };
  if (dias <= 7) return { dias, situacao: "breve", texto: dias === 1 ? "vence amanhã" : `vence em ${dias} dias` };
  return { dias, situacao: "futuro", texto: `em ${dias} dias` };
}

export const FAIXAS_VENCIMENTO = [
  { key: "vencido", label: "Já venceu" },
  { key: "hoje", label: "Vence hoje" },
  { key: "7dias", label: "Próximos 7 dias" },
  { key: "30dias", label: "Próximos 30 dias" },
  { key: "obs", label: "Com observação (ex.: em atraso)" },
  { key: "sem", label: "Sem vencimento informado" },
] as const;

export function vencimentoBateFaixa(vencimentoIso: string | null, faixa: string, observacao: string | null = null): boolean {
  if (faixa === "obs") return !!observacao;
  if (faixa === "sem") return vencimentoIso === null && !observacao;
  if (!vencimentoIso) return false;
  const dias = diasEntreIso(hojeIso(), vencimentoIso);
  if (faixa === "vencido") return dias < 0;
  if (faixa === "hoje") return dias === 0;
  if (faixa === "7dias") return dias >= 0 && dias <= 7;
  if (faixa === "30dias") return dias >= 0 && dias <= 30;
  return false;
}
