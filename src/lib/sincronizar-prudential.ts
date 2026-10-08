import { normalizarNumeroApolice, normalizarStatusApolice, STATUS_REJEITADA } from "@/lib/seguros-taxonomia";
import { dataBrParaIso } from "@/lib/vencimentos";
import { detectarColunasCapital, planejarAtualizacaoCapital, type CoberturaDb, type ColunasCapital, type PlanoCapital } from "@/lib/atualizar-capital";
import {
  detectarColunasDetalhes,
  montarDetalhesDasApolices,
  planejarDetalhes,
  type ColunasDetalhes,
  type PlanoDetalhes,
} from "@/lib/apolice-detalhes-import";

// Sincronização do sistema com a exportação completa da Prudential (uma linha por
// cobertura): status das apólices, vencimento do prêmio, atraso, capital das
// coberturas e dados da página "Detalhes da Apólice". Só monta o plano; quem
// grava é a página, depois da aprovação do usuário.

export interface ApoliceSync {
  id: string;
  cliente_id: string;
  numero_apolice: string | null;
  status: string;
  proximo_vencimento_premio: string | null;
  forma_pagamento: string | null;
  responsavel_pagamento: string | null;
  observacao_vencimento: string | null;
}

export interface BancoSync {
  apolices: ApoliceSync[];
  coberturas: CoberturaDb[];
  /** ids das apólices que já têm dados guardados para o PDF reunião */
  jaTemDetalhe: Set<string>;
  /** nome do cliente por id (só para exibir) */
  nomeCliente: Map<string, string>;
}

interface ColunasSync {
  apolice: string;
  statusApolice: string;
  atraso: string | null;
  vencimento: string | null;
  forma: string | null;
  responsavel: string | null;
}

export interface ColunasTodas {
  sync: ColunasSync;
  capital: ColunasCapital;
  detalhes: ColunasDetalhes;
}

function norm(valor: string): string {
  return valor.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.\s]+/g, " ").trim();
}

export function detectarColunasSincronizacao(colunas: string[]): { colunas?: ColunasTodas; faltando: string[] } {
  const achar = (nome: string) => colunas.find((c) => norm(c) === nome) ?? null;
  const apolice = achar("apolice");
  const statusApolice = achar("status apolice");
  const cap = detectarColunasCapital(colunas);
  const det = detectarColunasDetalhes(colunas);
  const faltando = [...new Set([...(apolice ? [] : ["Apólice"]), ...(statusApolice ? [] : ["Status Apólice"]), ...cap.faltando, ...det.faltando])];
  if (!apolice || !statusApolice || !cap.colunas || !det.colunas) return { faltando };
  return {
    colunas: {
      sync: {
        apolice,
        statusApolice,
        atraso: achar("dias atraso"),
        vencimento: achar("vencimento do proximo premio"),
        forma: achar("forma pagto"),
        responsavel: achar("nome ou nome social do resp pagto"),
      },
      capital: cap.colunas,
      detalhes: det.colunas,
    },
    faltando: [],
  };
}

type ClasseArquivo = "ativa" | "cancelada" | "suspensa" | "rejeitada" | "outra";

interface ApoliceArquivo {
  numero: string;
  classe: ClasseArquivo;
  statusBruto: string;
  atrasoDias: number;
  vencimentoIso: string | null;
  forma: string | null;
  responsavel: string | null;
}

function lerApolicasDoArquivo(linhas: Record<string, string>[], c: ColunasSync): Map<string, ApoliceArquivo> {
  const mapa = new Map<string, ApoliceArquivo>();
  const ler = (l: Record<string, string>, col: string | null) => (col ? (l[col] ?? "").trim() : "");
  for (const l of linhas) {
    const numeroBruto = ler(l, c.apolice);
    if (!numeroBruto) continue;
    const chave = normalizarNumeroApolice(numeroBruto);
    const atraso = Number(ler(l, c.atraso)) || 0;
    const existente = mapa.get(chave);
    if (existente) {
      existente.atrasoDias = Math.max(existente.atrasoDias, atraso);
      continue;
    }
    const statusBruto = ler(l, c.statusApolice);
    const n = normalizarStatusApolice(statusBruto);
    const classe: ClasseArquivo = n === STATUS_REJEITADA ? "rejeitada" : n === "ativa" ? "ativa" : n === "cancelada" ? "cancelada" : n === "suspensa" ? "suspensa" : "outra";
    mapa.set(chave, {
      numero: numeroBruto,
      classe,
      statusBruto,
      atrasoDias: atraso,
      vencimentoIso: dataBrParaIso(ler(l, c.vencimento)),
      forma: ler(l, c.forma) || null,
      responsavel: ler(l, c.responsavel) || null,
    });
  }
  return mapa;
}

export interface ItemApolice {
  apoliceId: string;
  numero: string;
  cliente: string;
}

export interface Cancelamento extends ItemApolice {
  statusArquivo: string;
  statusAnterior: string;
  coberturasAtivasAnteriores: string[];
  vencimentoAnterior: string | null;
  observacaoAnterior: string | null;
}

export interface MudancaVencimento extends ItemApolice {
  de: { data: string | null; forma: string | null; responsavel: string | null };
  para: { data: string; forma: string | null; responsavel: string | null };
}

export interface MudancaAtraso extends ItemApolice {
  de: string | null;
  para: string | null;
}

export interface PlanoSincronizacao {
  totalApolicesArquivo: number;
  cancelamentos: Cancelamento[];
  vencimentos: MudancaVencimento[];
  vencimentosInalterados: number;
  atrasos: MudancaAtraso[];
  /** em atraso, mas já têm uma observação manual diferente: não são alteradas */
  atrasosComObservacaoManual: ItemApolice[];
  capital: PlanoCapital;
  detalhes: PlanoDetalhes;
  informativos: {
    /** ativas no sistema que não constam no arquivo (não são alteradas) */
    ativasForaDoArquivo: ItemApolice[];
    /** canceladas/suspensas no sistema que a Prudential mostra como ativas (não são alteradas) */
    reativadasNoArquivo: ItemApolice[];
  };
}

const REGEX_ATRASO_AUTOMATICO = /^EM ATRASO/i;

function textoAtraso(dias: number): string {
  return `EM ATRASO (${dias} ${dias === 1 ? "dia" : "dias"})`;
}

export function planejarSincronizacao(linhas: Record<string, string>[], colunas: ColunasTodas, banco: BancoSync): PlanoSincronizacao {
  const arquivo = lerApolicasDoArquivo(linhas, colunas.sync);
  const nome = (a: ApoliceSync) => banco.nomeCliente.get(a.cliente_id) ?? "—";
  const item = (a: ApoliceSync): ItemApolice => ({ apoliceId: a.id, numero: a.numero_apolice ?? "", cliente: nome(a) });

  const cancelamentos: Cancelamento[] = [];
  const vencimentos: MudancaVencimento[] = [];
  const atrasos: MudancaAtraso[] = [];
  const atrasosComObservacaoManual: ItemApolice[] = [];
  const ativasForaDoArquivo: ItemApolice[] = [];
  const reativadasNoArquivo: ItemApolice[] = [];
  let vencimentosInalterados = 0;
  const vaiCancelar = new Set<string>();

  for (const a of banco.apolices) {
    if (!a.numero_apolice) continue;
    const f = arquivo.get(normalizarNumeroApolice(a.numero_apolice));
    if (!f) {
      if (a.status === "ativa") ativasForaDoArquivo.push(item(a));
      continue;
    }
    if (a.status === "ativa" && f.classe === "cancelada") {
      vaiCancelar.add(a.id);
      cancelamentos.push({
        ...item(a),
        statusArquivo: f.statusBruto,
        statusAnterior: a.status,
        coberturasAtivasAnteriores: banco.coberturas.filter((c) => c.apolice_id === a.id && c.status === "ativa").map((c) => c.id),
        vencimentoAnterior: a.proximo_vencimento_premio,
        observacaoAnterior: a.observacao_vencimento,
      });
      continue;
    }
    if (a.status !== "ativa") {
      if (f.classe === "ativa") reativadasNoArquivo.push(item(a));
      continue;
    }
    if (f.classe !== "ativa") continue;

    // Vencimento, forma de pagamento e responsável pelo pagamento
    if (f.vencimentoIso) {
      const mudou = a.proximo_vencimento_premio !== f.vencimentoIso || (f.forma ?? null) !== (a.forma_pagamento ?? null) || (f.responsavel ?? null) !== (a.responsavel_pagamento ?? null);
      if (mudou) {
        vencimentos.push({
          ...item(a),
          de: { data: a.proximo_vencimento_premio, forma: a.forma_pagamento, responsavel: a.responsavel_pagamento },
          para: { data: f.vencimentoIso, forma: f.forma, responsavel: f.responsavel },
        });
      } else vencimentosInalterados++;
    }

    // Atraso: escreve "EM ATRASO (N dias)" e tira quando regulariza; observação manual de outro tipo nunca é sobrescrita
    const obsAtual = (a.observacao_vencimento ?? "").trim();
    if (f.atrasoDias > 0) {
      const alvo = textoAtraso(f.atrasoDias);
      if (obsAtual === alvo) continue;
      if (obsAtual === "" || REGEX_ATRASO_AUTOMATICO.test(obsAtual)) atrasos.push({ ...item(a), de: obsAtual || null, para: alvo });
      else atrasosComObservacaoManual.push(item(a));
    } else if (REGEX_ATRASO_AUTOMATICO.test(obsAtual)) {
      atrasos.push({ ...item(a), de: obsAtual, para: null });
    }
  }

  // Capital e dados do PDF só para o que continua ativo (as que serão canceladas ficam de fora)
  const apolicesAtivas = banco.apolices.filter((a) => a.status === "ativa" && !vaiCancelar.has(a.id));
  const idsAtivos = new Set(apolicesAtivas.map((a) => a.id));
  const capital = planejarAtualizacaoCapital(
    linhas,
    colunas.capital,
    apolicesAtivas.map((a) => ({ id: a.id, numero_apolice: a.numero_apolice })),
    banco.coberturas.filter((c) => idsAtivos.has(c.apolice_id)),
  );
  const detalhes = planejarDetalhes(
    montarDetalhesDasApolices(linhas, colunas.detalhes),
    apolicesAtivas.map((a) => ({ id: a.id, numero_apolice: a.numero_apolice, status: a.status })),
    banco.jaTemDetalhe,
  );

  return {
    totalApolicesArquivo: arquivo.size,
    cancelamentos,
    vencimentos,
    vencimentosInalterados,
    atrasos,
    atrasosComObservacaoManual,
    capital,
    detalhes,
    informativos: { ativasForaDoArquivo, reativadasNoArquivo },
  };
}
