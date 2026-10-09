import { formatarMoeda, paraNumero } from "@/lib/format";
import type { PrevidenciaInput, PrevidenciaResultado } from "@/lib/previdencia-calc";
import { juntarSeguradoras, listarSeguradoras } from "@/lib/revisita-opcoes";
import type { RevisitaCobertura, RevisitaDados } from "@/lib/revisita-template";

/** "R$ 1.234,56" com espaço comum (o formatador do navegador usa espaço sem quebra). */
function moedaTexto(v: number): string {
  return formatarMoeda(v).replace(/\s/g, " ");
}

function ehLinhaResgate(titulo: string): boolean {
  return titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes("resgate");
}

export const ROTULO_PREVIDENCIA_NOVA = "Icatu (Previdência)";

/**
 * Preenche a revisita com o estudo de previdência gerado dentro dela:
 * - linha "Resgate": lado novo com a reserva estimada e os textos padrão (mesmos da leitura pela IA);
 * - "Icatu" entra nas seguradoras novas;
 * - o prêmio mensal da previdência entra nos prêmios novos e no total.
 * O lado "atual" da linha de resgate não é alterado (se a linha não existia, nasce marcada como "não possui" no lado atual).
 */
export function aplicarPrevidenciaNaRevisita(dados: RevisitaDados, input: PrevidenciaInput, resultado: PrevidenciaResultado): RevisitaDados {
  const reserva = moedaTexto(resultado.reservaEstimada);
  const contribuicao = resultado.contribuicaoMensalTotal;
  const detalhes = [
    `Sem considerar atualização de inflação, ${reserva} é o valor de resgate aos ${input.idadeAposentadoria} anos.`,
    "Resgate independente da apólice de seguro. Você pode resgatar a qualquer momento SEM CANCELAR a proteção.",
  ];

  const coberturas: RevisitaCobertura[] = [...dados.coberturas];
  const idx = coberturas.findIndex((c) => ehLinhaResgate(c.titulo));
  if (idx >= 0) {
    coberturas[idx] = { ...coberturas[idx], novoSemCobertura: false, novoValor: reserva, novoDetalhes: detalhes };
  } else {
    coberturas.push({ titulo: "Resgate", atualSemCobertura: true, atualValor: "", atualDetalhes: [], novoSemCobertura: false, novoValor: reserva, novoDetalhes: detalhes });
  }

  const novas = listarSeguradoras(dados.seguradoraNova);
  const seguradoraNova = novas.some((s) => s.toLowerCase() === "icatu") ? dados.seguradoraNova : juntarSeguradoras([...novas, "Icatu"]);

  const premiosNovo = [...dados.premiosNovo.filter((p) => !/icatu/i.test(p.seguradora)), { seguradora: ROTULO_PREVIDENCIA_NOVA, valorTexto: moedaTexto(contribuicao) }];
  const total = premiosNovo.reduce((s, p) => s + paraNumero(p.valorTexto), 0);

  return {
    ...dados,
    coberturas,
    seguradoraNova,
    premiosNovo,
    previdenciaValorTexto: moedaTexto(contribuicao),
    totalNovoTexto: moedaTexto(total),
  };
}
