// Catálogo de textos fixos de detalhe por seguradora+cobertura, no mesmo
// espírito do "comparative_catalog" do Platoris: a Claude/Gemini lê o PDF e
// calcula os VALORES (que variam por cliente — capital, prêmio, idade de
// redução), mas o texto descritivo de cada cobertura (nº de patologias,
// franquias, idade de término padrão etc.) é sempre o mesmo produto — então
// fixamos aqui pra garantir consistência entre revisitas, em vez de deixar a
// IA reparafrasear a cada geração.
import type { RevisitaCobertura, RevisitaDados } from "./revisita-template";

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

interface EntradaCatalogo {
  seguradora: (s: string) => boolean;
  cobertura: (c: string) => boolean;
  detalhes: string[];
}

const CATALOGO: EntradaCatalogo[] = [
  // Rider "Modular" (código DDMRG) — só quando o título da IA disser
  // "Modular" explicitamente. Mesmo padrão de encerramento (75 anos), mas
  // com nº de patologias diferente do padrão (28, não 13).
  {
    seguradora: (s) => normalizar(s).includes("prudential"),
    cobertura: (c) => normalizar(c).includes("doencas graves") && normalizar(c).includes("modular"),
    detalhes: ["(28 patologias cobertas)", "(Cobre câncer, AVC e infarto no estágio grave)", "(Encerra aos 75 anos)"],
  },
  // Padrão da Prudential é o "Plus" (13 patologias) — vale tanto quando a IA
  // escreve "Plus" explicitamente quanto quando só escreve "Diagnóstico de
  // doenças graves" genérico (a IA nem sempre inclui o qualificador no
  // título, mas o produto-padrão é sempre o Plus, nunca o Modular).
  // A data "Seguro válido até" que aparece na apólice pra esse rider (ex.:
  // 19/09/2030) NÃO é o fim real da cobertura — é só o ciclo de renovação do
  // prêmio; o rider continua até os 75 anos.
  {
    seguradora: (s) => normalizar(s).includes("prudential"),
    cobertura: (c) => normalizar(c).includes("doencas graves") && !normalizar(c).includes("modular") && !normalizar(c).includes("cancer"),
    detalhes: ["(13 patologias cobertas)", "(Cobre câncer, AVC e infarto no estágio grave)", "(Encerra aos 75 anos)"],
  },
  {
    seguradora: (s) => normalizar(s).includes("prudential"),
    cobertura: (c) => normalizar(c).includes("funeral"),
    detalhes: ["(Vitalícia)"],
  },
  {
    seguradora: (s) => normalizar(s).includes("prudential"),
    cobertura: (c) => normalizar(c).includes("diaria") && normalizar(c).includes("hospital"),
    detalhes: ["(Franquia de 5 dias)", "(UTI Duplicada)", "(Encerra aos 75 anos)"],
  },
  {
    seguradora: (s) => normalizar(s).includes("prudential"),
    cobertura: (c) => normalizar(c).includes("cirurgia") && normalizar(c).includes("ampliada"),
    detalhes: [
      "São 165 procedimentos que pagam 50% do capital segurado e 35 procedimentos que pagam a totalidade. Total de 200 procedimentos cobertos.",
      "Não há necessidade de tempo minímo internado.",
      "(Encerra aos 75 anos)",
    ],
  },
  {
    seguradora: (s) => normalizar(s).includes("prudential"),
    cobertura: (c) => normalizar(c).includes("cirurgia") && !normalizar(c).includes("ampliada"),
    detalhes: ["(Necessário ficar 40 hs internado p/ acionar a cobertura)", "(Encerra aos 75 anos)"],
  },
  {
    seguradora: (s) => normalizar(s).includes("prudential"),
    cobertura: (c) => normalizar(c).includes("quebra") && normalizar(c).includes("ossos"),
    detalhes: ["(33 ossos do corpo humano cobertos)", "(SEM Cobertura para ruptura de tendões e ligamentos)"],
  },
  {
    seguradora: (s) => normalizar(s).includes("prudential"),
    cobertura: (c) => normalizar(c).includes("invalidez"),
    detalhes: ["(Encerra aos 75 anos)"],
  },
  // Azos tem uma única cobertura de cirurgias — repete nas duas linhas
  // (Cirurgias e Cirurgias ampliada) quando comparada com a Prudential, que separa em duas.
  {
    seguradora: (s) => normalizar(s).includes("azos"),
    cobertura: (c) => normalizar(c).includes("cirurgia"),
    detalhes: [
      "(652 procedimentos cobertos)",
      "(Sem necessidade de tempo mínimo de internação)",
      "(Valores de 10 - 20 - 50 e 100% do CS)",
      "(Encerra aos 70 anos)",
    ],
  },
  {
    seguradora: (s) => normalizar(s).includes("azos"),
    cobertura: (c) => normalizar(c).includes("diaria") && normalizar(c).includes("hospital"),
    detalhes: ["(Franquia de 72 hrs)", "(UTI triplicada)", "(Encerra aos 75 anos)"],
  },
  {
    seguradora: (s) => normalizar(s).includes("azos"),
    cobertura: (c) => normalizar(c).includes("doencas graves"),
    detalhes: [
      "(30 patlogias cobertas)",
      "(Câncer coberto nos estágios leve, moderado e grave)",
      "(Cobre infarto e AVC estágio I e II)",
      "(Encerra aos 75 anos)",
    ],
  },
  {
    seguradora: (s) => normalizar(s).includes("azos"),
    cobertura: (c) => normalizar(c).includes("morte"),
    detalhes: ["(Vitalício)"],
  },
  {
    seguradora: (s) => normalizar(s).includes("azos"),
    cobertura: (c) => normalizar(c).includes("invalidez"),
    detalhes: ["(Vitalício)", "(Cobertura majorada com indenização de 100% para perda de órgãos e membros fundamentais)"],
  },
  {
    seguradora: (s) => normalizar(s).includes("azos"),
    cobertura: (c) => normalizar(c).includes("quebra") && normalizar(c).includes("ossos"),
    detalhes: ["(85% dos ossos do corpo humano cobertos)", "(COM Cobertura para ruptura de tendões e ligamentos)"],
  },
  // MAG "Doenças Graves Plus/base" — rider genérico, linha principal.
  {
    seguradora: (s) => normalizar(s).includes("mag"),
    cobertura: (c) => normalizar(c).includes("doencas graves") && !normalizar(c).includes("cancer"),
    detalhes: [
      "(27 patologias cobertas)",
      "(Câncer coberto nos estágios leve, moderado e grave)",
      "(Cobre infarto e AVC estágio I e II)",
      "(Encerra aos 80 anos)",
    ],
  },
  // MAG "Doenças Graves Vital" — rider adicional só pra câncer, condicionado
  // ao rider base de doenças graves (vira linha separada, ver SYSTEM_PROMPT).
  {
    seguradora: (s) => normalizar(s).includes("mag"),
    cobertura: (c) => normalizar(c).includes("cancer"),
    detalhes: [
      "(43 patologias cobertas)",
      "(Produto diferenciado e exclusivo para câncer)",
      "(Possibilidade de uso de 4 módulos)",
      "(Câncer coberto nos estágios leve, moderado e grave)",
      "(Cobre infarto e AVC estágio I e II)",
      "(Encerra aos 80 anos)",
    ],
  },
  {
    seguradora: (s) => normalizar(s).includes("mag"),
    cobertura: (c) => normalizar(c).includes("funeral"),
    detalhes: ["(Vitalício)", "(Familiar)"],
  },
];

function buscarDetalhes(seguradora: string, cobertura: string): string[] | null {
  const entrada = CATALOGO.find((e) => e.seguradora(seguradora) && e.cobertura(cobertura));
  return entrada ? entrada.detalhes : null;
}

/** Versão exportada pra telas de edição manual: ao escolher seguradora + cobertura, sugere os detalhes fixos do catálogo (igual o Platoris faz ao vivo). */
export function buscarDetalhesCatalogo(seguradora: string, cobertura: string): string[] | null {
  return buscarDetalhes(seguradora, cobertura);
}

/**
 * Mantém qualquer frase dinâmica que a IA tenha gerado (ex.: "Aos 54 anos a
 * cobertura diminui para R$ 70.000,00.") — que não começa com "(" — e troca
 * as demais linhas (características fixas do produto) pelas do catálogo,
 * quando existir uma entrada pra essa seguradora+cobertura.
 */
function aplicarNoLado(detalhesIA: string[], seguradora: string, cobertura: string): string[] {
  const fixos = buscarDetalhes(seguradora, cobertura);
  if (!fixos) return detalhesIA;
  const dinamicos = detalhesIA.filter((d) => !d.trim().startsWith("("));
  return [...dinamicos, ...fixos];
}

function ehCirurgiaSimples(titulo: string): boolean {
  const t = normalizar(titulo);
  return t.includes("cirurgia") && !t.includes("ampliada");
}
function ehCirurgiaAmpliada(titulo: string): boolean {
  const t = normalizar(titulo);
  return t.includes("cirurgia") && t.includes("ampliada");
}

/**
 * A Azos tem uma única cobertura de cirurgias (cobre tudo), enquanto a
 * Prudential separa em "Cirurgias" e "Cirurgias ampliada" — quando a IA marca
 * a linha "Cirurgias" simples como "a Azos não possui" (porque só viu uma
 * cobertura de cirurgia na proposta), copia os dados do lado Azos da linha
 * "Cirurgias ampliada" pra ela também, já que é a mesma cobertura na prática.
 */
function espalharCirurgiaAzos(coberturas: RevisitaCobertura[]): RevisitaCobertura[] {
  const ampliada = coberturas.find((c) => ehCirurgiaAmpliada(c.titulo) && !c.novoSemCobertura);
  if (!ampliada) return coberturas;
  return coberturas.map((c) => {
    if (ehCirurgiaSimples(c.titulo) && c.novoSemCobertura) {
      return { ...c, novoSemCobertura: false, novoValor: ampliada.novoValor, novoDetalhes: ampliada.novoDetalhes };
    }
    return c;
  });
}

export function aplicarCatalogo(dados: RevisitaDados): RevisitaDados {
  let coberturas: RevisitaCobertura[] = dados.coberturas.map((c) => ({
    ...c,
    atualDetalhes: c.atualSemCobertura ? c.atualDetalhes : aplicarNoLado(c.atualDetalhes, dados.seguradoraAtual, c.titulo),
    novoDetalhes: c.novoSemCobertura ? c.novoDetalhes : aplicarNoLado(c.novoDetalhes, dados.seguradoraNova, c.titulo),
  }));
  coberturas = espalharCirurgiaAzos(coberturas);
  return { ...dados, coberturas };
}
