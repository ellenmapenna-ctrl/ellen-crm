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

export interface PlanoCapital {
  totalLinhas: number;
  linhasIgnoradas: number;
  alteracoes: AlteracaoCapital[];
  jaCorretas: number;
  /** Cobertura com capital diferente de zero no banco e diferente do arquivo: nunca é sobrescrita. */
  divergentes: AlteracaoCapital[];
  /** Capital zerado no banco, mas o prêmio da cobertura mudou desde a importação (provável reajuste): só entra se o usuário optar. */
  premioDiferente: AlteracaoCapital[];
  apolicesNaoEncontradas: string[];
  semCorrespondencia: ItemSemCorrespondencia[];
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
    premioDiferente: [],
    apolicesNaoEncontradas: [],
    semCorrespondencia: [],
  };
  const usadas = new Set<string>();
  const apolicesAusentes = new Set<string>();

  for (const linha of linhas) {
    const numeroBruto = (linha[colunas.apolice] ?? "").trim();
    const produto = (linha[colunas.produto] ?? "").trim();
    const beneficioBruto = (linha[colunas.beneficio] ?? "").trim();
    if (!numeroBruto || !produto || !beneficioBruto) {
      plano.linhasIgnoradas++;
      continue;
    }
    // A importação ignorou coberturas rejeitadas/desistidas; aqui também.
    if (colunas.statusCobertura && normalizarStatusCobertura(linha[colunas.statusCobertura] ?? "") === STATUS_REJEITADA) {
      plano.linhasIgnoradas++;
      continue;
    }

    const numero = normalizarNumeroApolice(numeroBruto);
    const apoliceIds = apolicasPorNumero.get(numero);
    if (!apoliceIds) {
      apolicesAusentes.add(numero);
      continue;
    }

    const novoCapital = paraNumero(beneficioBruto);
    const chave = chaveCobertura(produto);
    let candidatas = apoliceIds
      .flatMap((id) => coberturasPorApolice.get(id) ?? [])
      .filter((c) => !usadas.has(c.id) && chaveCobertura(c.nome_cobertura) === chave);

    const premioArquivo = colunas.premio ? paraNumero(linha[colunas.premio] ?? "") : 0;
    if (candidatas.length > 1 && premioArquivo > 0) {
      const porPremio = candidatas.filter((c) => Math.abs((c.premio_mensal ?? 0) - premioArquivo) < PREMIO_TOLERANCIA);
      if (porPremio.length >= 1) candidatas = porPremio;
    }

    if (candidatas.length === 0) {
      plano.semCorrespondencia.push({ apoliceNumero: numero, produto, motivo: "cobertura não encontrada no banco" });
      continue;
    }
    if (candidatas.length > 1) {
      plano.semCorrespondencia.push({ apoliceNumero: numero, produto, motivo: "mais de uma cobertura parecida no banco" });
      continue;
    }

    const cobertura = candidatas[0];
    const premioBanco = cobertura.premio_mensal ?? 0;
    const premioMudou = premioArquivo > 0 && premioBanco > 0 && Math.abs(premioBanco - premioArquivo) >= PREMIO_TOLERANCIA;

    usadas.add(cobertura.id);
    const atual = cobertura.capital_segurado ?? 0;
    const item: AlteracaoCapital = { coberturaId: cobertura.id, apoliceNumero: numero, nome: cobertura.nome_cobertura, de: atual, para: novoCapital };
    if (Math.abs(atual - novoCapital) < 0.005) plano.jaCorretas++;
    else if (atual === 0) (premioMudou ? plano.premioDiferente : plano.alteracoes).push(item);
    else plano.divergentes.push(item);
  }

  plano.apolicesNaoEncontradas = [...apolicesAusentes];
  return plano;
}
