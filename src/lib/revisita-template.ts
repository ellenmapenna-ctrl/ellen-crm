// Motor de geração do documento "Comparativo de Seguros", no estilo Platoris
// (plataforma de referência usada por corretores do mercado) — tabela única
// de coberturas (formatação atual x nova formatação), prêmios consolidados
// e recomendação, em 3 layouts selecionáveis. Puro TS, sem I/O — usado tanto
// pelo preview no navegador quanto pela function serverless que chama a Claude API.

export type RevisitaFormato = "vanguarda" | "essencial" | "vitrine";

export interface RevisitaCobertura {
  titulo: string;
  atualSemCobertura?: boolean;
  atualValor: string;
  atualDetalhes: string[];
  novoSemCobertura?: boolean;
  novoValor: string;
  novoDetalhes: string[];
}

export interface RevisitaPremioLinha {
  seguradora: string;
  valorTexto: string;
}

export interface RevisitaDados {
  clienteNome: string;
  cpf: string;
  nascimento?: string;
  seguradoraAtual: string;
  seguradoraNova: string;
  coberturas: RevisitaCobertura[];
  premiosAtual: RevisitaPremioLinha[];
  premiosNovo: RevisitaPremioLinha[];
  previdenciaValorTexto?: string;
  totalAtualTexto: string;
  totalNovoTexto: string;
  observacoes?: string;
  recomendacaoHeadline?: string;
  recomendacaoTexto?: string;
  /** Apólices do sistema usadas como "apólice atual" (ids em `apolices`) — alimenta o espelho do PDF reunião. */
  apolicesSistemaIds?: string[];
  /** Chaves das apresentações de seguradora escolhidas (ver src/lib/apresentacoes.ts). */
  apresentacoes?: string[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SHARED_CSS = `
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{background:#fff;color:#14171c;font-family:"Montserrat","Helvetica Neue",Arial,sans-serif;line-height:1.5;}
.sheet{max-width:900px;margin:0 auto;padding:0 28px 60px;}
.cliente-linha{padding:20px 0 16px;display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;}
.cliente-nome{font-size:1.15rem;font-weight:800;}
.cliente-meta{font-size:0.82rem;color:#6b7280;}
.cliente-meta b{color:#374151;font-weight:700;}
table.cobertura-table{width:100%;border-collapse:collapse;}
table.cobertura-table th{
  text-align:left;font-size:0.68rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;
  padding:10px 14px;background:#f3f4f6;
}
table.cobertura-table th .sub{display:block;margin-top:3px;font-size:0.74rem;font-weight:700;letter-spacing:0;text-transform:none;color:#374151;}
table.cobertura-table td{padding:14px;vertical-align:top;border-bottom:1px solid #ececef;}
table.cobertura-table tr.zebra td{background:#fafafa;}
.cob-titulo{font-weight:700;font-size:0.88rem;}
.cob-valor{font-weight:700;font-size:0.98rem;margin-bottom:4px;}
.cob-det{font-size:0.78rem;color:#6b7280;line-height:1.5;}
.cob-det div{margin-bottom:1px;}
.cob-det .chk{vertical-align:-1px;margin-right:1px;}
.cob-sem{color:#9ca3af;font-style:italic;font-size:0.85rem;}
.obs-box{margin-top:18px;padding:14px 16px;border:1px solid #ececef;border-radius:8px;background:#fafafa;}
.obs-label{font-size:0.68rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;}
.obs-texto{font-size:0.86rem;color:#374151;white-space:pre-wrap;}
.doc-footer{margin-top:28px;padding-top:14px;border-top:1px solid #ececef;font-size:0.72rem;color:#9ca3af;}
`;

function fmtCliente(d: RevisitaDados): string {
  const partes = [`<b>CPF:</b> ${escapeHtml(d.cpf)}`];
  if (d.nascimento) partes.push(`<b>Nascimento:</b> ${escapeHtml(d.nascimento)}`);
  return `<div class="cliente-linha"><span class="cliente-nome">${escapeHtml(d.clienteNome)}</span><span class="cliente-meta">${partes.join(" &nbsp;·&nbsp; ")}</span></div>`;
}

// SVG em vez do caractere "✓": o Chromium headless usado para gerar o PDF
// final (sem fontes do sistema) não tem esse glifo disponível e desenha um
// quadrado vazio no lugar.
const CHECK_SVG = `<svg class="chk" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M3 8.5L6.2 12 13 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function ladoHtml(valor: string, detalhes: string[], semCobertura: boolean | undefined, comCheck: boolean, corValor: string): string {
  if (semCobertura) return `<div class="cob-sem">Não possui</div>`;
  const dets = detalhes
    .map((t) => `<div>${comCheck ? CHECK_SVG + " " : ""}${escapeHtml(t)}</div>`)
    .join("");
  return `<div class="cob-valor" style="color:${corValor}">${escapeHtml(valor)}</div><div class="cob-det">${dets}</div>`;
}

function linhasCoberturaHtml(d: RevisitaDados, comCheck: boolean, corNovo: string): string {
  return d.coberturas
    .map((c, i) => {
      const zebra = i % 2 === 1 ? " zebra" : "";
      return `<tr class="${zebra.trim()}">
        <td class="cob-titulo">${escapeHtml(c.titulo)}</td>
        <td>${ladoHtml(c.atualValor, c.atualDetalhes, c.atualSemCobertura, false, "#14171c")}</td>
        <td>${ladoHtml(c.novoValor, c.novoDetalhes, c.novoSemCobertura, comCheck, corNovo)}</td>
      </tr>`;
    })
    .join("\n      ");
}

function tabelaHtml(d: RevisitaDados, comCheck: boolean, corNovo: string): string {
  return `<table class="cobertura-table">
    <thead>
      <tr>
        <th>Cobertura</th>
        <th>Formatação atual<span class="sub">${escapeHtml(d.seguradoraAtual)}</span></th>
        <th>Nova formatação<span class="sub" style="color:${corNovo}">${escapeHtml(d.seguradoraNova)}</span></th>
      </tr>
    </thead>
    <tbody>
      ${linhasCoberturaHtml(d, comCheck, corNovo)}
    </tbody>
  </table>`;
}

function observacoesHtml(d: RevisitaDados): string {
  if (!d.observacoes?.trim()) return "";
  return `<div class="obs-box"><div class="obs-label">Observações</div><div class="obs-texto">${escapeHtml(d.observacoes)}</div></div>`;
}

function premioLinhasHtml(itens: RevisitaPremioLinha[]): string {
  return itens
    .map((p) => `<div class="pm-linha"><span>${escapeHtml(p.seguradora)}</span><span>${escapeHtml(p.valorTexto)}</span></div>`)
    .join("");
}

function docFooterHtml(): string {
  return `<div class="doc-footer">Valores da nova formatação referem-se a uma cotação, sujeita a análise de risco e Declaração Pessoal de Saúde — não possui caráter vinculante entre as partes.</div>`;
}

/* ============================= VANGUARDA ============================= */
function renderVanguarda(d: RevisitaDados): string {
  const corNovo = "#1e5fa8";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comparativo de Seguros — ${escapeHtml(d.clienteNome)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${SHARED_CSS}
.van-banner{
  background:linear-gradient(100deg,#0f2c52 0%,#1e5fa8 60%,#3d7fc4 100%);
  clip-path:polygon(0 0,100% 0,82% 100%,0 100%);
  padding:26px 40px;margin-bottom:0;
}
.van-banner .t1{color:#fff;font-weight:800;font-size:1.5rem;letter-spacing:.01em;}
.van-banner .t2{color:#cfe0f5;font-weight:400;font-size:1.5rem;}
table.cobertura-table td:last-child, table.cobertura-table th:last-child{background:#eef4fb;}
table.cobertura-table tr.zebra td:last-child{background:#e6eefa;}
.premios-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px;}
.premio-box{border:1px solid #ececef;border-radius:10px;padding:16px 18px;}
.premio-box .lbl{font-size:0.68rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;margin-bottom:10px;}
.pm-linha{display:flex;justify-content:space-between;font-size:0.86rem;color:#374151;padding:3px 0;}
.premio-box .tot{display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #ececef;font-weight:800;font-size:1.05rem;}
.premio-box.novo .tot{color:${corNovo};}
</style>
</head>
<body>
<div class="van-banner"><span class="t1">COMPARATIVE</span> <span class="t2">BOARD</span></div>
<div class="sheet">
  ${fmtCliente(d)}
  ${tabelaHtml(d, false, corNovo)}
  <div class="premios-grid">
    <div class="premio-box">
      <div class="lbl">Valor pago — formatação atual</div>
      ${premioLinhasHtml(d.premiosAtual)}
      <div class="tot"><span>Total</span><span>${escapeHtml(d.totalAtualTexto)}</span></div>
    </div>
    <div class="premio-box novo">
      <div class="lbl">Valor pago — nova formatação</div>
      ${premioLinhasHtml(d.premiosNovo)}${d.previdenciaValorTexto ? `<div class="pm-linha"><span>Previdência</span><span>${escapeHtml(d.previdenciaValorTexto)}</span></div>` : ""}
      <div class="tot"><span>Total</span><span>${escapeHtml(d.totalNovoTexto)}</span></div>
    </div>
  </div>
  ${observacoesHtml(d)}
  ${docFooterHtml()}
</div>
</body>
</html>
`;
}

/* ============================= ESSENCIAL ============================= */
function renderEssencial(d: RevisitaDados): string {
  const corNovo = "#1e5fa8";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comparativo de Seguros — ${escapeHtml(d.clienteNome)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${SHARED_CSS}
.ess-topline{height:4px;background:${corNovo};}
.ess-head{padding:22px 0 4px;}
.ess-eyebrow{font-size:0.66rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${corNovo};margin-bottom:4px;}
.ess-title{font-size:1.35rem;font-weight:800;}
.premios-flex{display:flex;gap:0;margin-top:22px;border:1px solid #ececef;border-radius:10px;overflow:hidden;}
.premios-flex > div{flex:1;padding:16px 18px;}
.premios-flex > div + div{border-left:1px solid #ececef;}
.premios-flex .lbl{font-size:0.68rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;margin-bottom:10px;}
.pm-linha{display:flex;justify-content:space-between;font-size:0.86rem;color:#374151;padding:3px 0;}
.premios-flex .tot{display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #ececef;font-weight:800;font-size:1.05rem;}
.premios-flex .novo .tot{color:${corNovo};}
.corretor-footer{margin-top:20px;padding:12px 16px;background:#fafafa;border-radius:8px;font-size:0.8rem;font-weight:600;color:#374151;}
</style>
</head>
<body>
<div class="ess-topline"></div>
<div class="sheet">
  <div class="ess-head">
    <div class="ess-eyebrow">Comparativo de seguros</div>
    <div class="ess-title">Comparative Board</div>
  </div>
  ${fmtCliente(d)}
  ${tabelaHtml(d, false, corNovo)}
  <div class="premios-flex">
    <div>
      <div class="lbl">Valor pago — formatação atual</div>
      ${premioLinhasHtml(d.premiosAtual)}
      <div class="tot"><span>Total</span><span>${escapeHtml(d.totalAtualTexto)}</span></div>
    </div>
    <div class="novo">
      <div class="lbl">Valor pago — nova formatação</div>
      ${premioLinhasHtml(d.premiosNovo)}${d.previdenciaValorTexto ? `<div class="pm-linha"><span>Previdência</span><span>${escapeHtml(d.previdenciaValorTexto)}</span></div>` : ""}
      <div class="tot"><span>Total</span><span>${escapeHtml(d.totalNovoTexto)}</span></div>
    </div>
  </div>
  ${observacoesHtml(d)}
  <div class="corretor-footer">Ellen Penna · MP Capital</div>
  ${docFooterHtml()}
</div>
</body>
</html>
`;
}

/* ============================== VITRINE =============================== */
function renderVitrine(d: RevisitaDados): string {
  const corNovo = "#1e5fa8";
  const temRecomendacao = !!(d.recomendacaoHeadline || d.recomendacaoTexto);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comparativo de Seguros — ${escapeHtml(d.clienteNome)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${SHARED_CSS}
.vit-banner{background:linear-gradient(100deg,#0f2c52 0%,#1e5fa8 55%,#4a90d9 100%);padding:22px 40px;}
.vit-banner .eyebrow{color:#cfe0f5;font-size:0.68rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:4px;}
.vit-banner .title{color:#fff;font-size:1.5rem;font-weight:800;}
table.cobertura-table td:last-child, table.cobertura-table th:last-child{background:#eef4fb;}
table.cobertura-table tr.zebra td:last-child{background:#e6eefa;}
.rodape{display:flex;gap:16px;margin-top:0;padding-top:16px;border-top:2px solid #14171c;align-items:flex-start;}
.premios-flex{display:flex;flex:1;gap:0;}
.premios-flex > div{flex:1;padding:0 18px 0 0;}
.premios-flex > div + div{padding-left:18px;border-left:1px solid #ececef;}
.premios-flex .lbl{font-size:0.68rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;margin-bottom:10px;}
.pm-linha{display:flex;justify-content:space-between;font-size:0.86rem;color:#374151;padding:3px 0;}
.premios-flex .tot{display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #ececef;font-weight:800;font-size:1.05rem;}
.premios-flex .novo .tot{color:${corNovo};}
.recomendacao{width:260px;flex-shrink:0;background:#0f2c52;color:#fff;border-radius:10px;padding:16px 18px;}
.recomendacao .lbl{font-size:0.64rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#9fc1e8;margin-bottom:8px;}
.recomendacao h3{margin:0 0 4px;font-size:1.05rem;font-weight:800;}
.recomendacao p{margin:0;font-size:0.78rem;color:#cfe0f5;line-height:1.4;}
@media (max-width:640px){ .rodape{flex-direction:column;} .recomendacao{width:100%;} }
</style>
</head>
<body>
<div class="vit-banner"><div class="eyebrow">Comparativo de seguros</div><div class="title">Comparative Board</div></div>
<div class="sheet">
  ${fmtCliente(d)}
  ${tabelaHtml(d, true, corNovo)}
  <div class="rodape">
    <div class="premios-flex">
      <div>
        <div class="lbl">Valor pago mensal — formatação atual</div>
        ${premioLinhasHtml(d.premiosAtual)}
        <div class="tot"><span>Total</span><span>${escapeHtml(d.totalAtualTexto)}</span></div>
      </div>
      <div class="novo">
        <div class="lbl">Valor pago mensal — nova formatação</div>
        ${premioLinhasHtml(d.premiosNovo)}${d.previdenciaValorTexto ? `<div class="pm-linha"><span>Previdência</span><span>${escapeHtml(d.previdenciaValorTexto)}</span></div>` : ""}
        <div class="tot"><span>Total</span><span>${escapeHtml(d.totalNovoTexto)}</span></div>
      </div>
    </div>
    ${temRecomendacao ? `<div class="recomendacao"><div class="lbl">Recomendação</div><h3>${escapeHtml(d.recomendacaoHeadline ?? "")}</h3><p>${escapeHtml(d.recomendacaoTexto ?? "")}</p></div>` : ""}
  </div>
  ${observacoesHtml(d)}
  ${docFooterHtml()}
</div>
</body>
</html>
`;
}

export function renderRevisitaHtml(d: RevisitaDados, formato: RevisitaFormato): string {
  if (formato === "vanguarda") return renderVanguarda(d);
  if (formato === "essencial") return renderEssencial(d);
  return renderVitrine(d);
}
