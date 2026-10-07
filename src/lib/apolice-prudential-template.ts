// Documento "Detalhes da Apólice" no padrão visual da Prudential, montado a
// partir de dados do sistema (para a revisita não depender de baixar a apólice
// no site da seguradora). Puro TS, sem imports com alias: também pode rodar na
// function serverless da Vercel para virar PDF.

export interface PessoaApolice {
  nome: string;
  cpf?: string;
  nascimento?: string;
  idadeEmissao?: string;
  sexo?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  celular?: string;
  email?: string;
}

export interface CoberturaApolice {
  nome: string;
  status: string;
  valorSegurado: number;
  premioLiquido: number;
  iof: number;
}

export interface ApolicePrudentialDados {
  numero: string;
  status: string;
  proposta?: string;
  dataEmissao?: string;
  inicioVigencia?: string;
  segurado: PessoaApolice;
  responsavel: PessoaApolice;
  coberturas: CoberturaApolice[];
  pagamento: {
    premioLiquidoTotal: number;
    iofTotal: number;
    premioTotal: number;
    diaEscolhido?: string;
    periodicidade?: string;
    formaPagamento?: string;
    cartao?: string;
  };
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Grafias corretas dos nomes mais comuns (o relatório vem sem acento).
const NOMES_CANONICOS: [RegExp, string][] = [
  [/^vida e saude/i, "Vida e Saúde"],
  [/^vida inteira/i, "Vida Inteira"],
  [/^doencas graves/i, "Doenças Graves"],
  [/^temporario/i, "Temporário"],
  [/^assistencia funeral/i, "Assistência Funeral"],
  [/^perda da autonomia/i, "Perda da Autonomia Pessoal"],
];

/**
 * "WV10G Vida e Saude por 10 anos G" → "Vida e Saúde";
 * "Doenças Graves Plus por 5 anos G" → "Doenças Graves Plus";
 * "Quebra de Ossos por 5 anos G" → "Quebra de Ossos".
 * Tira o código do produto no começo e o prazo/sufixo ("por N anos ...") no fim.
 */
export function limparNomeCobertura(bruto: string): string {
  let nome = bruto.trim();
  nome = nome.replace(/^[A-Z]{1,4}\d{1,3}[A-Z]?\s+(?=\S)/, ""); // código tipo "WV10G " / "DR15G "
  nome = nome.replace(/\s+por\s+\d+\s+anos?\b.*$/i, ""); // " por 5 anos G"
  nome = nome.replace(/\s+\d+\s+anos?\b.*$/i, ""); // " 5 anos G" (ex.: "…por Acidente 5 anos G")
  nome = nome.replace(/\s+(renov[aá]vel|renovavel)\b.*$/i, "");
  nome = nome.trim();
  for (const [padrao, correto] of NOMES_CANONICOS) {
    if (padrao.test(nome)) return nome.replace(padrao, correto);
  }
  return nome;
}

/** Status de cobertura do relatório (inglês) em linguagem de cliente. */
export function traduzirStatusCobertura(status: string): string {
  const v = status.toLowerCase();
  if (v.includes("premium paying")) return "Ativa";
  if (v.includes("lapsed")) return "Cancelada";
  if (v.includes("paid up")) return "Quitada";
  return status;
}

const CSS = `
@page{size:A4;margin:0;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{background:#fff;color:#1f2933;font-family:"Helvetica Neue",Arial,sans-serif;font-size:10.5px;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.pagina{padding:22px 32px 18px;page-break-after:always;}
.pagina:last-child{page-break-after:auto;}
.topo{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0067b1;padding-bottom:12px;margin-bottom:14px;}
.topo img{height:40px;display:block;}
.topo .titulo{text-align:right;}
.topo h1{margin:0;font-size:19px;font-weight:700;color:#0a3d6b;letter-spacing:-.01em;}
.topo .sub{margin-top:3px;font-size:11px;color:#52606d;}
.topo .sub b{color:#1f2933;}
.status{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:#e3f6ec;color:#12683f;font-size:10px;font-weight:700;}
section{margin-bottom:10px;break-inside:avoid;}
h2{margin:0 0 6px;padding:5px 9px;background:#0067b1;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:3px;}
.grade{display:grid;grid-template-columns:repeat(3,1fr);gap:5px 14px;padding:0 4px;}
.grade.dois{grid-template-columns:repeat(2,1fr);}
.grade .largo{grid-column:1/-1;}
.campo .r{display:block;font-size:8.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#7b8794;}
.campo .v{display:block;font-size:11px;color:#1f2933;font-weight:600;word-break:break-word;}
table{width:100%;border-collapse:collapse;}
th{background:#eaf3fb;color:#0a3d6b;font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;text-align:left;padding:6px 8px;}
td{padding:6px 8px;border-bottom:1px solid #e4e7eb;font-size:11px;}
th.n,td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
td.cob{font-weight:700;}
tr.tot td{border-bottom:0;background:#f5f7fa;font-weight:700;}
.nota{margin:6px 4px 0;font-size:9px;color:#7b8794;}
.rodape{margin-top:10px;padding-top:8px;border-top:1px solid #e4e7eb;font-size:8.5px;color:#9aa5b1;text-align:center;}
`;

function campo(rotulo: string, valor: string | undefined, largo = false): string {
  if (!valor || !valor.trim()) return "";
  return `<div class="campo${largo ? " largo" : ""}"><span class="r">${esc(rotulo)}</span><span class="v">${esc(valor)}</span></div>`;
}

function mesmaPessoa(a: PessoaApolice, b: PessoaApolice): boolean {
  const norm = (x?: string) => (x ?? "").replace(/\D/g, "") || (x ?? "").trim().toUpperCase();
  return norm(a.cpf) !== "" ? norm(a.cpf) === norm(b.cpf) : a.nome.trim().toUpperCase() === b.nome.trim().toUpperCase();
}

function blocoPessoa(p: PessoaApolice, rotuloNome: string, sufixo = ""): string {
  const local = [p.bairro ? `Bairro ${p.bairro}` : "", [p.cidade, p.estado].filter(Boolean).join(" - "), p.cep ? `CEP ${p.cep}` : ""].filter(Boolean).join(" · ");
  return `<div class="grade">
    ${campo(rotuloNome, p.nome, true)}
    ${campo("CPF / CNPJ", p.cpf)}
    ${campo("Data de nascimento", p.nascimento)}
    ${campo("Idade na emissão", p.idadeEmissao)}
    ${campo("Sexo", p.sexo)}
    ${campo("Celular", p.celular)}
    ${campo("Telefone", p.telefone)}
    ${campo("E-mail", p.email, true)}
    ${campo("Endereço", [p.endereco, local].filter(Boolean).join(" — "), true)}
  </div>${sufixo}`;
}

function paginaApolicePrudential(d: ApolicePrudentialDados, logoSrc: string, rodape: string): string {
  const linhasCob = d.coberturas
    .map(
      (c) => `<tr><td class="cob">${esc(limparNomeCobertura(c.nome))}</td><td>${esc(traduzirStatusCobertura(c.status))}</td><td class="n">${c.valorSegurado ? moeda.format(c.valorSegurado) : "—"}</td><td class="n">${moeda.format(c.premioLiquido)}</td><td class="n">${moeda.format(c.iof)}</td></tr>`,
    )
    .join("");
  const pg = d.pagamento;
  return `<div class="pagina">
  <div class="topo">
    <img src="${logoSrc}" alt="Prudential">
    <div class="titulo"><h1>Detalhes da Apólice</h1><div class="sub">Apólice <b>${esc(d.numero)}</b><span class="status">${esc(d.status)}</span></div></div>
  </div>

  <section><h2>Dados da apólice</h2><div class="grade">
    ${campo("Apólice", d.numero)}
    ${campo("Proposta", d.proposta)}
    ${campo("Data da emissão", d.dataEmissao)}
    ${campo("Início da vigência", d.inicioVigencia)}
  </div></section>

  <section><h2>Dados do segurado</h2>${blocoPessoa(d.segurado, "Segurado")}</section>
  <section><h2>Responsável pelo pagamento</h2>${
    mesmaPessoa(d.segurado, d.responsavel)
      ? `<div class="grade">${campo("Responsável", d.responsavel.nome)}${campo("CPF / CNPJ", d.responsavel.cpf)}<div class="campo"><span class="r">Observação</span><span class="v">O próprio segurado</span></div></div>`
      : blocoPessoa(d.responsavel, "Responsável")
  }</section>

  <section><h2>Coberturas</h2>
    <table>
      <thead><tr><th>Cobertura</th><th>Status</th><th class="n">Valor segurado</th><th class="n">Prêmio líquido</th><th class="n">IOF</th></tr></thead>
      <tbody>${linhasCob}
        <tr class="tot"><td colspan="3">Total</td><td class="n">${moeda.format(pg.premioLiquidoTotal)}</td><td class="n">${moeda.format(pg.iofTotal)}</td></tr>
      </tbody>
    </table>
    <p class="nota">Os valores indicam o prêmio de cada cobertura e estão sujeitos a correções e atualizações monetárias. O capital segurado é atualizado anualmente pelo IPCA/IBGE, conforme as Condições Gerais do seguro.</p>
  </section>

  <section><h2>Dados de pagamento</h2><div class="grade">
    ${campo("Prêmio líquido total", moeda.format(pg.premioLiquidoTotal))}
    ${campo("IOF total", moeda.format(pg.iofTotal))}
    ${campo("Prêmio total", moeda.format(pg.premioTotal))}
    ${campo("Periodicidade", pg.periodicidade)}
    ${campo("Forma de pagamento", pg.formaPagamento)}
    ${campo("Dia escolhido para pagamento", pg.diaEscolhido)}
    ${campo("Cartão de crédito", pg.cartao)}
  </div><p class="nota">O prêmio representa o valor a ser pago para manutenção da apólice.</p></section>

  <div class="rodape">${esc(rodape)}</div>
</div>`;
}

const RODAPE_PADRAO = "Resumo dos dados da apólice. Não substitui as informações oficiais da seguradora.";

/** Documento com uma página "Detalhes da Apólice" por apólice. */
export function renderApolicesPrudentialHtml(apolices: ApolicePrudentialDados[], logoSrc: string, opcoes: { rodapeExtra?: string } = {}): string {
  const paginas = apolices.map((d) => paginaApolicePrudential(d, logoSrc, opcoes.rodapeExtra ?? RODAPE_PADRAO)).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Detalhes da Apólice</title><style>${CSS}</style></head><body>${paginas}</body></html>`;
}

/** Atalho para uma apólice só (protótipos e testes). */
export function renderApolicePrudentialHtml(d: ApolicePrudentialDados, logoSrc: string, opcoes: { rodapeExtra?: string } = {}): string {
  return renderApolicesPrudentialHtml([d], logoSrc, opcoes);
}
