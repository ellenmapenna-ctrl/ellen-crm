// Motor de cálculo do "Gerador de Estudo de Previdência" — replica fielmente as
// fórmulas da planilha "Gerador de estudo previdência.xlsm" da Icatu (fundo de
// reserva por contribuição mensal + tábua biométrica BR-EMSsb-2021 pra renda
// vitalícia + tabela de contribuições puras de risco). Validado batendo 1:1
// com um estudo real gerado pela planilha (Luciana Gonçalves Ferreira:
// Reserva R$ 37.479,23, Renda Mensal Vitalícia R$ 115,32).
import { QX_FEMININO, QX_MASCULINO, TABELA_RISCO } from "./previdencia-tabelas.js";

export type Sexo = "M" | "F";
export type PrazoPensao = 1 | 5 | 10 | 15 | 20;
export type ProdutoPrevidencia = "Unique Prev" | "Atitude" | "Atitude + Simples";

export interface PrevidenciaInput {
  nomeCliente: string;
  cidade?: string;
  produto: ProdutoPrevidencia;
  idadeAtual: number;
  idadeAposentadoria: number;
  sexo: Sexo;
  contribuicaoMensal: number;
  aporteInicial: number;
  rentabilidadeAnual: number; // ex.: 0.05 = 5%
  rendaInvalidezValor?: number; // renda mensal desejada em caso de invalidez
  peculioMorteValor?: number;
  pensaoPrazoCertoValor?: number; // renda mensal desejada
  pensaoPrazoCertoAnos?: PrazoPensao;
}

export interface PrevidenciaResultado {
  reservaEstimada: number;
  contribuicaoMensalAposentadoria: number;
  contribuicaoMensalCoberturas: number;
  contribuicaoMensalTotal: number;
  rendaMensalVitalicia: number;
  rendaMensalTemporaria15Anos: number; // sempre 0 — mesmo "bug" da planilha original
  rendaMensalVitaliciaPMG5Anos: number; // idem
  contribuicaoRendaInvalidez: number;
  contribuicaoPeculioMorte: number;
  contribuicaoPensaoPrazoCerto: number;
  evolucaoReserva: { ano: number; valor: number }[];
}

/** Valor futuro de um aporte inicial + contribuições mensais, com juros compostos mensais equivalentes à taxa anual informada (mesma fórmula FV do Excel usada na planilha). */
function valorFuturo(aporteInicial: number, contribuicaoMensal: number, rentabilidadeAnual: number, meses: number): number {
  if (meses <= 0) return aporteInicial;
  const taxaMensal = Math.pow(1 + rentabilidadeAnual, 1 / 12) - 1;
  if (taxaMensal === 0) return aporteInicial + contribuicaoMensal * meses;
  const fator = Math.pow(1 + taxaMensal, meses);
  return aporteInicial * fator + contribuicaoMensal * ((fator - 1) / taxaMensal);
}

/**
 * Fator atuarial ä(12)_x (renda vitalícia mensal por R$1 de reserva), calculado
 * a partir da tábua biométrica BR-EMSsb-2021, taxa de juros 0% a.a. na fase de
 * benefício (igual à planilha original — nota de rodapé do estudo Icatu).
 */
function fatorAnuidadeVitalicia(idade: number, sexo: Sexo): number {
  const qx = sexo === "M" ? QX_MASCULINO : QX_FEMININO;
  const idadeMax = qx.length - 1; // 115

  // lx: sobreviventes de uma base de 100.000, ano a ano, a partir da idade 0.
  const lx = new Float64Array(idadeMax + 2);
  lx[0] = 100000;
  for (let a = 0; a <= idadeMax; a++) {
    lx[a + 1] = lx[a] * (1 - qx[a]);
  }
  // Dx = lx (taxa de juros 0% => fator de desconto 1).
  const Dx = lx;
  // Nx[a] = soma de Dx de a até o fim da tábua.
  const Nx = new Float64Array(idadeMax + 3);
  let acumulado = 0;
  for (let a = idadeMax + 1; a >= 0; a--) {
    acumulado += Dx[a] ?? 0;
    Nx[a] = acumulado;
  }
  // ä(12)_x = N(x+1)/D(x) + 11/24 (correção UDD pra renda mensal, igual à planilha).
  return Nx[idade + 1] / Dx[idade] + 11 / 24;
}

function buscarLinhaRisco(idade: number) {
  return TABELA_RISCO.find((l) => l.idade === idade);
}

function contribuicaoRisco(idade: number, valor: number | undefined, campo: "rendaInvalidez" | "peculioMorte"): number {
  if (!valor || idade < 18 || idade > 64) return 0;
  const linha = buscarLinhaRisco(idade);
  if (!linha) return 0;
  const divisor = campo === "rendaInvalidez" ? 1000 : 100000;
  return (valor * linha[campo]) / divisor;
}

function contribuicaoPensao(idade: number, valor: number | undefined, prazo: PrazoPensao | undefined): number {
  if (!valor || !prazo || idade < 18 || idade > 64) return 0;
  const linha = buscarLinhaRisco(idade);
  if (!linha) return 0;
  const campo = (`pensaoPC${prazo}` as const) as keyof typeof linha;
  return (valor * (linha[campo] as number)) / 1000;
}

export function gerarEstudoPrevidencia(input: PrevidenciaInput): PrevidenciaResultado {
  const meses = Math.max(0, (input.idadeAposentadoria - input.idadeAtual) * 12);
  const reservaEstimada = valorFuturo(input.aporteInicial, input.contribuicaoMensal, input.rentabilidadeAnual, meses);

  const fator = fatorAnuidadeVitalicia(input.idadeAposentadoria, input.sexo);
  const rendaMensalVitalicia = reservaEstimada / (fator * 12);

  const contribuicaoRendaInvalidez = contribuicaoRisco(input.idadeAtual, input.rendaInvalidezValor, "rendaInvalidez");
  const contribuicaoPeculioMorte = contribuicaoRisco(input.idadeAtual, input.peculioMorteValor, "peculioMorte");
  const contribuicaoPensaoPrazoCerto = contribuicaoPensao(input.idadeAtual, input.pensaoPrazoCertoValor, input.pensaoPrazoCertoAnos);

  const contribuicaoMensalCoberturas = contribuicaoRendaInvalidez + contribuicaoPeculioMorte + contribuicaoPensaoPrazoCerto;
  const contribuicaoMensalTotal = input.contribuicaoMensal + contribuicaoMensalCoberturas;

  const anos = Math.ceil(meses / 12);
  const evolucaoReserva: { ano: number; valor: number }[] = [];
  for (let ano = 0; ano <= anos; ano++) {
    evolucaoReserva.push({
      ano,
      valor: valorFuturo(input.aporteInicial, input.contribuicaoMensal, input.rentabilidadeAnual, Math.min(ano * 12, meses)),
    });
  }

  return {
    reservaEstimada,
    contribuicaoMensalAposentadoria: input.contribuicaoMensal,
    contribuicaoMensalCoberturas,
    contribuicaoMensalTotal,
    rendaMensalVitalicia,
    rendaMensalTemporaria15Anos: 0,
    rendaMensalVitaliciaPMG5Anos: 0,
    contribuicaoRendaInvalidez,
    contribuicaoPeculioMorte,
    contribuicaoPensaoPrazoCerto,
    evolucaoReserva,
  };
}
