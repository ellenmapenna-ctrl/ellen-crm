import { paraNumero } from "@/lib/format";
import {
  STATUS_REJEITADA,
  normalizarNomeCobertura,
  normalizarNumeroApolice,
  normalizarStatusCobertura,
} from "@/lib/seguros-taxonomia";

// Atualização do capital segurado das coberturas já importadas, a partir da
// coluna "Valor do Benefício" do relatório da seguradora. Só lê a planilha e
// os dados do banco e devolve um plano; quem grava é a página, depois da
// aprovação do usuário. Nunca cria nem apaga nada.

export interface ApoliceDb {
  id: string;
  numero_apolice: string | null;
  seguradora?: string | null;
}

export interface CoberturaDb {
  id: string;
  apolice_id: string;
  nome_cobertura: string;
  capital_segurado: number | null;
  premio_mensal: number | null;
  status: string;
}

export interface ColunasCapital {
  apolice: string;
  produto: string;
  beneficio: string;
  premio: string | null;
  statusCobertura: string | null;
}

export interface AlteracaoCapital {
  coberturaId: string;
  apoliceNumero: string;
  nome: string;
  de: number;
  para: number;
}

export interface ItemSemCorrespondencia {
  apoliceNumero: string;
  produto: string;
  motivo: string;
}

export interface CoberturaFaltante {
  apoliceId: string;
  apoliceNumero: string;
  produto: string;
  capital: number;
  premio: number;
}

export interface PlanoCapital {
  totalLinhas: number;
  linhasIgnoradas: number;
  alteracoes: AlteracaoCapital[];
  jaCorretas: number;
  /** Capital diferente de zero no banco e um pouco maior no arquivo (até +10%, o reajuste anual pelo IPCA): só entra se o usuário optar. */
  divergentes: AlteracaoCapital[];
  /** Capital diferente de zero no banco e muito diferente do arquivo (mais de +10% ou menor): provável erro de cadastro. */
  muitoDiferentes: AlteracaoCapital[];
  /** Coberturas ativas da Prudential que não existem no sistema (nenhuma cobertura do sistema ficou com elas). */
  faltantes: CoberturaFaltante[];
  /** Capital zerado no banco, mas o prêmio da cobertura mudou desde a importação (provável reajuste): só entra se o usuário optar. */
  premioDiferente: AlteracaoCapital[];
  apolicesNaoEncontradas: string[];
  semCorrespondencia: ItemSemCorrespondencia[];
  /** Apólices que constam no arquivo e estão sem seguradora no banco (para preencher com o nome da seguradora do relatório). */
  apolicesSemSeguradora: { id: string; numero: string }[];
}

function semAcento(valor: string): string {
  return valor.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Localiza as colunas necessárias pelo nome do cabeçalho (sem depender de acento ou caixa). */
export function detectarColunasCapital(colunas: string[]): { colunas?: ColunasCapital; faltando: string[] } {
  const achar = (nome: string) => colunas.find((c) => semAcento(c) === nome) ?? null;
  const apolice = achar("apolice");
  const produto = achar("produto");
  const beneficio = achar("valor do beneficio");
  const faltando: string[] = [];
  if (!apolice) faltando.push("Apólice");
  if (!produto) faltando.push("Produto");
  if (!beneficio) faltando.push("Valor do Benefício");
  if (!apolice || !produto || !beneficio) return { faltando };
  return {
    colunas: { apolice, produto, beneficio, premio: achar("premio"), statusCobertura: achar("status cobertura") },
    faltando,
  };
}

/** Chave de comparação do nome da cobertura: rótulo canônico quando reconhecido, senão o texto sem acento. */
function chaveCobertura(nome: string): string {
  return semAcento(normalizarNomeCobertura(nome)?.rotulo ?? nome);
}

const PREMIO_TOLERANCIA = 0.01;

export function planejarAtualizacaoCapital(
  linhas: Record<string, string>[],
  colunas: ColunasCapital,
  apolices: ApoliceDb[],
  coberturas: CoberturaDb[],
): PlanoCapital {
  const apolicasPorNumero = new Map<string, string[]>();
  for (const a of apolices) {
    if (!a.numero_apolice) continue;
    const n = normalizarNumeroApolice(a.numero_apolice);
    apolicasPorNumero.set(n, [...(apolicasPorNumero.get(n) ?? []), a.id]);
  }
  const coberturasPorApolice = new Map<string, CoberturaDb[]>();
  for (const c of coberturas) coberturasPorApolice.set(c.apolice_id, [...(coberturasPorApolice.get(c.apolice_id) ?? []), c]);

  const plano: PlanoCapital = {
    totalLinhas: linhas.length,
    linhasIgnoradas: 0,
    alteracoes: [],
    jaCorretas: 0,
    divergentes: [],
    muitoDiferentes: [],
    faltantes: [],
    premioDiferente: [],
    apolicesNaoEncontradas: [],
    semCorrespondencia: [],
    apolicesSemSeguradora: [],
  };
  const apolicesVistas = new Set<string>();
  const apolicesAusentes = new Set<string>();

  interface LinhaValida {
    numero: string;
    apoliceIds: string[];
    produto: string;
    chave: string;
    novoCapital: number;
    premioArquivo: number;
    ativaNoArquivo: boolean;
  }
  const validas: LinhaValida[] = [];

  for (const linha of linhas) {
    const numeroBruto = (linha[colunas.apolice] ?? "").trim();
    const produto = (linha[colunas.produto] ?? "").trim();
    const beneficioBruto = (linha[colunas.beneficio] ?? "").trim();
    if (!numeroBruto || !produto || !beneficioBruto) {
      plano.linhasIgnoradas++;
      continue;
    }
    // A importação ignorou coberturas rejeitadas/desistidas; aqui também.
    const statusLinha = colunas.statusCobertura ? normalizarStatusCobertura(linha[colunas.statusCobertura] ?? "") : null;
    if (statusLinha === STATUS_REJEITADA) {
      plano.linhasIgnoradas++;
      continue;
    }

    const numero = normalizarNumeroApolice(numeroBruto);
    const apoliceIds = apolicasPorNumero.get(numero);
    if (!apoliceIds) {
      apolicesAusentes.add(numero);
      continue;
    }

    for (const id of apoliceIds) {
      if (apolicesVistas.has(id)) continue;
      apolicesVistas.add(id);
      const a = apolices.find((x) => x.id === id);
      if (a && !a.seguradora?.trim()) plano.apolicesSemSeguradora.push({ id, numero });
    }

    validas.push({
      numero,
      apoliceIds,
      produto,
      chave: chaveCobertura(produto),
      novoCapital: paraNumero(beneficioBruto),
      premioArquivo: colunas.premio ? paraNumero(linha[colunas.premio] ?? "") : 0,
      ativaNoArquivo: statusLinha === "ativa" || statusLinha === null,
    });
  }

  // Casamento linha da planilha × cobertura do sistema: pela proximidade do prêmio dentro de cada grupo
  // (mesma apólice e mesmo nome canônico), para que coberturas com nome parecido, como "Doenças Graves Plus"
  // e "Doenças Ampliadas", não se confundam.
  const grupos = new Map<string, number[]>();
  validas.forEach((v, i) => {
    const k = v.apoliceIds.join(",") + "|" + v.chave;
    grupos.set(k, [...(grupos.get(k) ?? []), i]);
  });
  const atribuida = new Map<number, CoberturaDb>();
  const usadas = new Set<string>();
  for (const indices of grupos.values()) {
    const v0 = validas[indices[0]];
    const candidatas = v0.apoliceIds.flatMap((id) => coberturasPorApolice.get(id) ?? []).filter((c) => chaveCobertura(c.nome_cobertura) === v0.chave);
    const pares: { i: number; c: CoberturaDb; custo: number }[] = [];
    for (const i of indices)
      for (const c of candidatas) {
        const pa = validas[i].premioArquivo;
        const pb = c.premio_mensal ?? 0;
        pares.push({ i, c, custo: pa > 0 && pb > 0 ? Math.abs(pa - pb) : 1e6 });
      }
    pares.sort((x, y) => x.custo - y.custo || x.i - y.i);
    for (const par of pares) {
      if (atribuida.has(par.i) || usadas.has(par.c.id)) continue;
      atribuida.set(par.i, par.c);
      usadas.add(par.c.id);
    }
  }

  validas.forEach((v, i) => {
    const cobertura = atribuida.get(i);
    if (!cobertura) {
      plano.semCorrespondencia.push({ apoliceNumero: v.numero, produto: v.produto, motivo: "cobertura não encontrada no banco" });
      if (v.ativaNoArquivo)
        plano.faltantes.push({ apoliceId: v.apoliceIds[0], apoliceNumero: v.numero, produto: v.produto, capital: v.novoCapital, premio: v.premioArquivo });
      return;
    }
    const premioBanco = cobertura.premio_mensal ?? 0;
    const premioMudou = v.premioArquivo > 0 && premioBanco > 0 && Math.abs(premioBanco - v.premioArquivo) >= PREMIO_TOLERANCIA;
    const atual = cobertura.capital_segurado ?? 0;
    const item: AlteracaoCapital = { coberturaId: cobertura.id, apoliceNumero: v.numero, nome: cobertura.nome_cobertura, de: atual, para: v.novoCapital };
    if (Math.abs(atual - v.novoCapital) < 0.005) plano.jaCorretas++;
    else if (atual === 0) (premioMudou ? plano.premioDiferente : plano.alteracoes).push(item);
    else if (v.novoCapital >= atual && v.novoCapital <= atual * 1.1) plano.divergentes.push(item);
    else plano.muitoDiferentes.push(item);
  });

  plano.apolicesNaoEncontradas = [...apolicesAusentes];
  return plano;
}
