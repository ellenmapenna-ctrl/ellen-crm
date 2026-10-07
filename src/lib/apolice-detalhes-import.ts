import { paraNumero } from "@/lib/format";
import { normalizarNumeroApolice, normalizarStatusApolice, normalizarStatusCobertura, STATUS_REJEITADA } from "@/lib/seguros-taxonomia";
import type { ApolicePrudentialDados, CoberturaApolice, PessoaApolice } from "@/lib/apolice-prudential-template";

// Leitura da exportação completa da Prudential ("arquivo (n).xls", uma linha por
// cobertura) e montagem dos dados da página "Detalhes da Apólice" de cada apólice.

const CAMPOS = {
  apolice: "apolice",
  proposta: "proposta",
  emissao: "emissao",
  inicio: "data inicio vigencia apolice",
  statusApolice: "status apolice",
  cliente: "nome ou nome social do cliente",
  cpf: "cpf",
  nascimento: "data de nascimento",
  idadeEmissao: "idade na emissao",
  sexo: "sexo",
  endereco: "endereco",
  bairro: "bairro",
  cidade: "cidade",
  estado: "estado",
  cep: "cep",
  telefone: "telefone",
  celular: "celular",
  email: "e-mail",
  resp: "nome ou nome social do resp pagto",
  respCpf: "cpf / cnpj resp pagto",
  respEndereco: "endereco resp pagto",
  respBairro: "bairro resp pagto",
  respCidade: "cidade resp pagto",
  respEstado: "estado resp pagto",
  respCep: "cep resp pagto",
  respTelefone: "telefone resp pagto",
  respCelular: "celular resp pagto",
  respEmail: "e-mail resp pagto",
  respIdade: "idade na emissao do resp pagto",
  periodicidade: "periodicidade pagto",
  forma: "forma pagto",
  cartao: "numero cartao credito do resp pagto",
  dia: "dia escolhido para pagamento",
  produto: "produto",
  statusCobertura: "status cobertura",
  beneficio: "valor do beneficio",
  premioLiquido: "premio liquido",
  iof: "iof",
  premio: "premio",
} as const;

type ChaveCampo = keyof typeof CAMPOS;
export type ColunasDetalhes = Record<ChaveCampo, string | null>;

/** Campos sem os quais não dá para montar o documento. */
const OBRIGATORIOS: ChaveCampo[] = ["apolice", "cliente", "produto", "statusCobertura", "beneficio", "premioLiquido", "iof"];

function norm(valor: string): string {
  return valor.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.\s]+/g, " ").trim();
}

export function detectarColunasDetalhes(colunas: string[]): { colunas?: ColunasDetalhes; faltando: string[] } {
  const mapa = {} as ColunasDetalhes;
  for (const chave of Object.keys(CAMPOS) as ChaveCampo[]) {
    mapa[chave] = colunas.find((c) => norm(c) === CAMPOS[chave]) ?? null;
  }
  const faltando = OBRIGATORIOS.filter((k) => !mapa[k]).map((k) => CAMPOS[k]);
  return faltando.length > 0 ? { faltando } : { colunas: mapa, faltando };
}

function formatarCpf(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return v;
}

function limparTexto(v: string): string {
  return v.replace(/[;\s]+$/, "").trim();
}

function formatarCep(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : v;
}

/** Mantém só a data (dd/mm/aaaa) quando o relatório traz data e hora. */
function soData(v: string): string {
  const m = v.match(/^\d{2}\/\d{2}\/\d{4}/);
  return m ? m[0] : v;
}

function rotuloStatusApolice(bruto: string): string {
  const n = normalizarStatusApolice(bruto);
  if (n === "ativa") return "Ativa";
  if (n === "cancelada") return "Cancelada";
  if (n === "suspensa") return "Suspensa";
  return bruto;
}

export interface DetalheApoliceImportado {
  numeroNormalizado: string;
  dados: ApolicePrudentialDados;
}

export function montarDetalhesDasApolices(linhas: Record<string, string>[], c: ColunasDetalhes): DetalheApoliceImportado[] {
  const ler = (linha: Record<string, string>, chave: ChaveCampo): string => {
    const col = c[chave];
    return col ? (linha[col] ?? "").trim() : "";
  };
  const grupos = new Map<string, Record<string, string>[]>();
  for (const linha of linhas) {
    const numero = ler(linha, "apolice");
    if (!numero) continue;
    const chave = normalizarNumeroApolice(numero);
    grupos.set(chave, [...(grupos.get(chave) ?? []), linha]);
  }

  const resultado: DetalheApoliceImportado[] = [];
  for (const [chave, grupo] of grupos) {
    const base = grupo[0];
    const segurado: PessoaApolice = {
      nome: ler(base, "cliente"),
      cpf: formatarCpf(ler(base, "cpf")),
      nascimento: soData(ler(base, "nascimento")),
      idadeEmissao: ler(base, "idadeEmissao"),
      sexo: ler(base, "sexo"),
      endereco: limparTexto(ler(base, "endereco")),
      bairro: limparTexto(ler(base, "bairro")),
      cidade: ler(base, "cidade"),
      estado: ler(base, "estado"),
      cep: formatarCep(ler(base, "cep")),
      telefone: ler(base, "telefone"),
      celular: ler(base, "celular"),
      email: ler(base, "email"),
    };
    const responsavel: PessoaApolice = {
      nome: ler(base, "resp") || segurado.nome,
      cpf: formatarCpf(ler(base, "respCpf")) || segurado.cpf,
      idadeEmissao: ler(base, "respIdade"),
      endereco: limparTexto(ler(base, "respEndereco")),
      bairro: limparTexto(ler(base, "respBairro")),
      cidade: ler(base, "respCidade"),
      estado: ler(base, "respEstado"),
      cep: formatarCep(ler(base, "respCep")),
      telefone: ler(base, "respTelefone"),
      celular: ler(base, "respCelular"),
      email: ler(base, "respEmail"),
    };

    // Só as coberturas em vigor entram no documento.
    const coberturas: CoberturaApolice[] = [];
    let premioTotal = 0;
    for (const linha of grupo) {
      const st = normalizarStatusCobertura(ler(linha, "statusCobertura"));
      if (st === STATUS_REJEITADA || st !== "ativa") continue;
      const nome = ler(linha, "produto");
      if (!nome) continue;
      coberturas.push({
        nome,
        status: ler(linha, "statusCobertura"),
        valorSegurado: paraNumero(ler(linha, "beneficio")),
        premioLiquido: paraNumero(ler(linha, "premioLiquido")),
        iof: paraNumero(ler(linha, "iof")),
      });
      premioTotal += paraNumero(ler(linha, "premio"));
    }
    const premioLiquidoTotal = coberturas.reduce((s, x) => s + x.premioLiquido, 0);
    const iofTotal = coberturas.reduce((s, x) => s + x.iof, 0);
    const forma = ler(base, "forma");

    resultado.push({
      numeroNormalizado: chave,
      dados: {
        numero: ler(base, "apolice"),
        status: rotuloStatusApolice(ler(base, "statusApolice")),
        proposta: ler(base, "proposta"),
        dataEmissao: soData(ler(base, "emissao")),
        inicioVigencia: soData(ler(base, "inicio")),
        segurado,
        responsavel,
        coberturas,
        pagamento: {
          premioLiquidoTotal,
          iofTotal,
          premioTotal: premioTotal || premioLiquidoTotal + iofTotal,
          diaEscolhido: ler(base, "dia"),
          periodicidade: ler(base, "periodicidade"),
          formaPagamento: forma,
          cartao: /cart/i.test(forma) ? ler(base, "cartao") : "",
        },
      },
    });
  }
  return resultado;
}

export interface ApoliceBancoDetalhe {
  id: string;
  numero_apolice: string | null;
  status: string;
}

export interface PlanoDetalhes {
  total: number;
  gravar: { apoliceId: string; numero: string; segurado: string; ativa: boolean; dados: ApolicePrudentialDados; jaTinha: boolean }[];
  semCadastro: { numero: string; segurado: string }[];
  semCoberturas: number;
}

export function planejarDetalhes(detalhes: DetalheApoliceImportado[], apolices: ApoliceBancoDetalhe[], jaTemDetalhe: Set<string>): PlanoDetalhes {
  const porNumero = new Map<string, ApoliceBancoDetalhe[]>();
  for (const a of apolices) {
    if (!a.numero_apolice) continue;
    const n = normalizarNumeroApolice(a.numero_apolice);
    porNumero.set(n, [...(porNumero.get(n) ?? []), a]);
  }
  const plano: PlanoDetalhes = { total: detalhes.length, gravar: [], semCadastro: [], semCoberturas: 0 };
  for (const d of detalhes) {
    const achadas = porNumero.get(d.numeroNormalizado);
    if (!achadas) {
      plano.semCadastro.push({ numero: d.dados.numero, segurado: d.dados.segurado.nome });
      continue;
    }
    if (d.dados.coberturas.length === 0) plano.semCoberturas++;
    for (const a of achadas) {
      plano.gravar.push({ apoliceId: a.id, numero: d.dados.numero, segurado: d.dados.segurado.nome, ativa: a.status === "ativa", dados: d.dados, jaTinha: jaTemDetalhe.has(a.id) });
    }
  }
  return plano;
}
