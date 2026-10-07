import type { ApoliceStatus, CoberturaStatus, CoberturaTipo } from "@/lib/types";

// Taxonomia de negócio de seguros de vida (Prudential/GlobalCRM), usada tanto
// na importação (normalizar nomes/status brutos do Excel) quanto na exibição
// (espelho da apólice e oportunidades de venda na Carteira de Clientes).

function normalizarTextoBusca(valor: string): string {
  return valor.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ---------------------------------------------------------------------------
// Normalização do nome da cobertura (Produto bruto do Excel → rótulo exibido)
// ---------------------------------------------------------------------------

interface RegraTaxonomiaCobertura {
  padrao: RegExp;
  rotulo: string;
  tipo: CoberturaTipo;
}

/** Ordem importa: padrões mais específicos (ex. "Cirurgia Ampliada") vêm antes dos mais genéricos ("Cirurgia"). */
const TAXONOMIA_COBERTURA: RegraTaxonomiaCobertura[] = [
  { padrao: /vida\s*inteira|tempor[aá]ri/i, rotulo: "Morte Qualquer Causa", tipo: "base" },
  { padrao: /cirurgia\s*ampliada/i, rotulo: "Cirurgia Ampliada", tipo: "opcional" },
  { padrao: /cirurgia/i, rotulo: "Cirurgia", tipo: "opcional" },
  { padrao: /quebra\s*de\s*ossos/i, rotulo: "Fraturas", tipo: "opcional" },
  { padrao: /doen[cç]as?\s*graves?|doen[cç]as\s*ampliadas/i, rotulo: "Doenças Graves", tipo: "opcional" },
  { padrao: /invalidez.*parcial/i, rotulo: "Invalidez Parcial", tipo: "opcional" },
  { padrao: /renda\s*hospitalar/i, rotulo: "Renda Hospitalar", tipo: "opcional" },
  { padrao: /perda\s*da?\s*autonomia/i, rotulo: "Perda de Autonomia", tipo: "opcional" },
  { padrao: /funeral/i, rotulo: "Funeral", tipo: "opcional" },
  { padrao: /vida\s*e\s*sa[uú]de/i, rotulo: "Vida e Saúde", tipo: "opcional" },
];

/** Normaliza o nome bruto de uma cobertura (coluna "Produto" do Excel) para o rótulo canônico + tipo. */
export function normalizarNomeCobertura(bruto: string): { rotulo: string; tipo: CoberturaTipo } | null {
  if (!bruto) return null;
  for (const regra of TAXONOMIA_COBERTURA) {
    if (regra.padrao.test(bruto)) return { rotulo: regra.rotulo, tipo: regra.tipo };
  }
  return null;
}

/**
 * Verdadeiro se a cobertura é a básica (morte qualquer causa). Considera o
 * tipo gravado no banco e também o nome, porque importações antigas gravaram
 * "Temporário ..." como opcional.
 */
export function ehCoberturaBase(cobertura: { nome_cobertura: string; tipo: string }): boolean {
  return cobertura.tipo === "base" || normalizarNomeCobertura(cobertura.nome_cobertura)?.tipo === "base";
}

/** Verdadeiro se o nome de cobertura (bruto ou já normalizado) corresponde ao rótulo canônico informado. */
export function coberturaCorrespondeARotulo(nomeCobertura: string, rotulo: string): boolean {
  const match = normalizarNomeCobertura(nomeCobertura);
  if (match) return match.rotulo === rotulo;
  return normalizarTextoBusca(nomeCobertura) === normalizarTextoBusca(rotulo);
}

// ---------------------------------------------------------------------------
// Lista fixa de tipos de cobertura exibida no espelho da apólice
// ---------------------------------------------------------------------------

export interface CoberturaCanonica {
  rotulo: string;
  tipo: CoberturaTipo;
}

/** Riders que nunca têm linha própria no Excel — vêm embutidos quando a cobertura básica é contratada. */
export const RIDERS_INCLUSOS: readonly string[] = ["Morte Acidental", "Doença Terminal", "Invalidez Total"];

/** Lista fixa e ordenada dos 13 tipos de cobertura sempre exibidos no espelho da apólice. */
export const COBERTURAS_CANONICAS: readonly CoberturaCanonica[] = [
  { rotulo: "Morte Qualquer Causa", tipo: "base" },
  { rotulo: "Morte Acidental", tipo: "opcional" },
  { rotulo: "Doença Terminal", tipo: "opcional" },
  { rotulo: "Invalidez Total", tipo: "opcional" },
  { rotulo: "Invalidez Parcial", tipo: "opcional" },
  { rotulo: "Doenças Graves", tipo: "opcional" },
  { rotulo: "Renda Hospitalar", tipo: "opcional" },
  { rotulo: "Cirurgia", tipo: "opcional" },
  { rotulo: "Cirurgia Ampliada", tipo: "opcional" },
  { rotulo: "Fraturas", tipo: "opcional" },
  { rotulo: "Perda de Autonomia", tipo: "opcional" },
  { rotulo: "Funeral", tipo: "opcional" },
  { rotulo: "Vida e Saúde", tipo: "opcional" },
];

// ---------------------------------------------------------------------------
// Normalização de status (Status Apólice / Status Cobertura, bruto do Excel)
// ---------------------------------------------------------------------------

/** Sinal especial: a linha nunca chegou a vigorar (rejeitada ou desistência em período de graça) — deve ser ignorada na importação. */
export const STATUS_REJEITADA = "rejeitada" as const;

export function normalizarStatusApolice(bruto: string): ApoliceStatus | typeof STATUS_REJEITADA | null {
  if (!bruto) return null;
  const v = normalizarTextoBusca(bruto);
  if (/rejeitad|not\s*taken|desistencia/.test(v)) return STATUS_REJEITADA;
  if (/cancelad|lapsed|substitui/.test(v)) return "cancelada";
  if (/suspens/.test(v)) return "suspensa";
  if (/ativ|vigente|pagando/.test(v)) return "ativa";
  return null;
}

export function normalizarStatusCobertura(bruto: string): CoberturaStatus | typeof STATUS_REJEITADA | null {
  if (!bruto) return null;
  const v = normalizarTextoBusca(bruto);
  if (/rejeitad|not\s*taken|desistencia/.test(v)) return STATUS_REJEITADA;
  if (/cancelad|lapsed|substitui/.test(v)) return "cancelada";
  if (/ativ|vigente|pagando/.test(v)) return "ativa";
  return null;
}

// ---------------------------------------------------------------------------
// Normalização do número da apólice
// ---------------------------------------------------------------------------

/**
 * Normaliza um número de apólice bruto do Excel: mantém só os dígitos e
 * remove zeros à esquerda. Sistemas de seguradora costumam preencher o
 * número com zeros à esquerda em alguns exports e sem em outros (ex.:
 * "002071557" vs "2071557") — sem essa normalização, reimportar a mesma
 * apólice de um export com padding diferente cria uma apólice duplicada em
 * vez de reaproveitar a existente.
 */
export function normalizarNumeroApolice(bruto: string): string {
  const digitos = bruto.trim().replace(/\D/g, "");
  if (!digitos) return bruto.trim();
  return digitos.replace(/^0+(?=\d)/, "");
}

// ---------------------------------------------------------------------------
// Classificação do produto da apólice (texto livre já existente em tipo_produto)
// ---------------------------------------------------------------------------

/** Detecta variantes de "Temporário"/"Temporário Decrescente" a partir do texto livre de `apolices.tipo_produto`. */
export function classificarTipoProduto(tipoProdutoBruto: string | null | undefined): {
  temporario: boolean;
  decrescente: boolean;
} {
  if (!tipoProdutoBruto) return { temporario: false, decrescente: false };
  const v = normalizarTextoBusca(tipoProdutoBruto);
  return {
    temporario: /temporari/.test(v),
    decrescente: /decrescente/.test(v),
  };
}
