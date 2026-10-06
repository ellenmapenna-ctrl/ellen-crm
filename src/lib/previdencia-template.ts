// Gera o HTML do "Estudo de Previdência Individual", no mesmo layout/texto do
// documento que a planilha oficial da Icatu ("Gerador de estudo
// previdência.xlsm") produz — carta de apresentação (pág. 1) + resumo do
// estudo com gráfico de evolução da reserva (pág. 2). Os valores vêm de
// gerarEstudoPrevidencia (src/lib/previdencia-calc.ts), que replica as
// fórmulas reais da planilha.
import type { PrevidenciaInput, PrevidenciaResultado } from "./previdencia-calc.js";

// Ativos copiados da planilha oficial da Icatu (aba de mídia embutida),
// servidos como arquivos estáticos do próprio CRM.
const BASE_URL = "https://ellen-crm.vercel.app";
const LOGO_ICATU = `${BASE_URL}/previdencia-assets/icatu-logo.png`;
const FAMILIA_ICATU = `${BASE_URL}/previdencia-assets/icatu-familia.png`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPercent(v: number): string {
  return `${Math.round(v * 1000) / 10}%`.replace(".", ",");
}

function fmtDataExtenso(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

const SHARED_CSS = `
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{background:#fff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;}
.pagina{width:794px;min-height:1123px;padding:30px 46px;position:relative;}
.pagina + .pagina{break-before:page;}
.topo{display:flex;justify-content:space-between;align-items:flex-start;}
.logo{height:34px;}
.data-topo{font-size:12px;color:#1a1a1a;padding-top:6px;}
.banner{margin-top:14px;background:#0f2145;border-radius:4px;overflow:hidden;position:relative;height:210px;}
.banner img{position:absolute;right:18px;bottom:-6px;height:230px;}
.saudacao{margin-top:22px;font-weight:bold;}
.corpo p{margin:14px 0;text-align:justify;}
.vida-frase{font-weight:bold;margin-top:6px;}
.assinatura{margin-top:26px;display:flex;justify-content:space-between;}
.assinatura .esq{font-weight:normal;}
.assinatura b{display:block;}

.titulo-estudo{font-size:16px;font-weight:bold;color:#0f2145;}
.linha-topo-estudo{display:flex;justify-content:space-between;align-items:center;}
.regua{height:3px;background:#0f2145;margin:8px 0 14px;}
.resumo-label{color:#3a9b3a;font-weight:bold;font-size:13px;margin-bottom:6px;}
.cliente-nome{font-weight:bold;margin-bottom:8px;}
.grid-info{display:grid;grid-template-columns:1fr 1fr;gap:3px 24px;margin-bottom:12px;}
.grid-info .linha{display:flex;justify-content:space-between;border-bottom:1px dotted #d8d8d8;padding:3px 0;font-size:12.5px;}
.grid-info .linha.total{font-weight:bold;border-bottom:none;}
.grid-info .linha span:first-child{color:#333;}
.grid-info .linha span:last-child{font-weight:bold;}

table.secao{width:100%;border-collapse:collapse;margin-bottom:10px;}
table.secao thead th{background:#3a9b3a;color:#fff;text-align:left;font-size:11px;font-weight:bold;padding:5px 10px;}
table.secao thead th.dir{text-align:right;}
table.secao tbody td{padding:4px 10px;font-size:12.5px;border-bottom:1px solid #eee;}
table.secao tbody td.dir{text-align:right;}
table.secao tbody tr.sub td{color:#3a9b3a;font-weight:bold;padding-top:7px;border-bottom:none;}
table.secao tbody tr.destaque td{font-weight:bold;}

.grafico-box{border:1px solid #e0e0e0;border-radius:4px;padding:10px 18px 4px;margin-top:4px;}
.grafico-titulo{text-align:center;font-weight:bold;font-size:13px;margin-bottom:4px;}
.grafico-eixo-label{text-align:center;font-size:11px;color:#444;margin-top:2px;}

.rodape-assinatura{margin-top:12px;display:flex;justify-content:space-between;}
.disclaimer{margin-top:8px;background:#f4f4f4;padding:8px 12px;font-size:8.5px;color:#555;line-height:1.4;}
`;

function paginaCapaHtml(input: PrevidenciaInput, dataEstudo: Date): string {
  const pronome = input.sexo === "F" ? "Prezada" : "Prezado";
  const verboCobertura = input.produto === "Unique Prev" ? "pode adquirir" : "adquire";
  return `<div class="pagina">
    <div class="topo">
      <img class="logo" src="${LOGO_ICATU}" alt="Icatu" />
      <div class="data-topo">${input.cidade ? escapeHtml(input.cidade) + ", " : ", "}${fmtDataExtenso(dataEstudo)}</div>
    </div>
    <div class="banner"><img src="${FAMILIA_ICATU}" alt="" /></div>
    <div class="saudacao">${pronome} ${escapeHtml(input.nomeCliente)},</div>
    <div class="corpo">
      <p>Você está recebendo um estudo para aquisição de um plano de previdência desenvolvido pela Icatu Seguros, seguradora fundada em 1991, com origem no Grupo Icatu, símbolo de solidez e experiência no mercado segurador do Brasil.</p>
      <p>Como seguradora independente, acreditamos que nosso compromisso é oferecer produtos e serviços para pessoas em busca de segurança e realização financeira em todas as fases da vida.</p>
      <p>O ${escapeHtml(input.produto)} é um produto que atende aos diversos públicos. Nele estão disponíveis planos acessíveis com diversos fundos com entrada facilitada, além taxas de administração competitivas e diferentes estratégias de investimentos, prontos para se adequar ao seu planejamento.</p>
      <p>Além do benefício da renda de aposentadoria, você também ${verboCobertura} as Coberturas de Proteção Familiar e proteger as pessoas que ama. Estas coberturas garantem uma pensão ou pagamento único em caso de morte e uma renda mensal em caso de invalidez total ou permanente.</p>
      <p>Veja a seguir um estudo que preparamos pra você.</p>
      <div class="vida-frase">Vida. Para toda vida.</div>
    </div>
    <div class="assinatura">
      <div class="esq">Atenciosamente,<br/><b>Icatu Seguros S/A</b></div>
      <div>Corretor(a)</div>
    </div>
  </div>`;
}

function graficoSvg(evolucao: { ano: number; valor: number }[]): string {
  const largura = 660;
  const altura = 190;
  const margemEsq = 56;
  const margemInf = 26;
  const margemSup = 10;
  const maxValor = Math.max(...evolucao.map((p) => p.valor), 1);
  // Topo do eixo Y arredondado pra próxima potência de 10 "redonda" abaixo do máximo.
  const passo = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxValor)) - 1));
  const topoEixo = Math.ceil(maxValor / passo) * passo || maxValor;
  const n = evolucao.length;
  const areaLargura = largura - margemEsq - 10;
  const areaAltura = altura - margemSup - margemInf;
  const x = (i: number) => margemEsq + (n <= 1 ? 0 : (i / (n - 1)) * areaLargura);
  const y = (v: number) => margemSup + areaAltura - (v / topoEixo) * areaAltura;

  const pontosLinha = evolucao.map((p, i) => `${x(i)},${y(p.valor)}`).join(" L");
  const areaPath = `M${x(0)},${y(0)} L${pontosLinha} L${x(n - 1)},${y(0)} Z`;

  const marcasY = 4;
  const linhasGrade: string[] = [];
  const rotulosY: string[] = [];
  for (let i = 0; i <= marcasY; i++) {
    const valor = (topoEixo / marcasY) * i;
    const yy = y(valor);
    linhasGrade.push(`<line x1="${margemEsq}" y1="${yy}" x2="${largura - 10}" y2="${yy}" stroke="#e5e5e5" stroke-width="1"/>`);
    rotulosY.push(`<text x="${margemEsq - 8}" y="${yy + 3}" font-size="9" fill="#666" text-anchor="end">${fmtMoeda(valor).replace(",00", "")}</text>`);
  }

  const passoRotuloX = n > 14 ? 2 : 1;
  const rotulosX = evolucao
    .map((p, i) => (i % passoRotuloX === 0 ? `<text x="${x(i)}" y="${altura - margemInf + 14}" font-size="9" fill="#444" text-anchor="middle">${p.ano}</text>` : ""))
    .join("");

  return `<svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" xmlns="http://www.w3.org/2000/svg">
    ${linhasGrade.join("")}
    ${rotulosY.join("")}
    <path d="${areaPath}" fill="#0f2145" fill-opacity="0.92"/>
    ${rotulosX}
    <line x1="${margemEsq}" y1="${y(0)}" x2="${largura - 10}" y2="${y(0)}" stroke="#1a1a1a" stroke-width="1"/>
  </svg>`;
}

function linhaGrid(label: string, valor: string, destaque = false): string {
  return `<div class="linha${destaque ? " total" : ""}"><span>${escapeHtml(label)}</span><span>${escapeHtml(valor)}</span></div>`;
}

function paginaResumoHtml(input: PrevidenciaInput, r: PrevidenciaResultado): string {
  const tempoContribuicaoAnos = input.idadeAposentadoria - input.idadeAtual;
  const labelPrazoPensao = input.pensaoPrazoCertoAnos
    ? `Pensão por Prazo Certo (${input.pensaoPrazoCertoAnos} ${input.pensaoPrazoCertoAnos === 1 ? "ano" : "anos"}):`
    : "Pensão por Prazo Certo:";

  return `<div class="pagina">
    <div class="linha-topo-estudo">
      <img class="logo" src="${LOGO_ICATU}" alt="Icatu" />
      <div class="titulo-estudo">Estudo de Previdência Individual</div>
    </div>
    <div class="regua"></div>

    <div class="resumo-label">Resumo do Estudo ${escapeHtml(input.produto)}:</div>
    <div class="cliente-nome">${escapeHtml(input.nomeCliente)}</div>

    <div class="grid-info">
      ${linhaGrid("Idade Atual:", String(input.idadeAtual))}
      ${linhaGrid("Aporte e/ou Portabilidade Inicial:", fmtMoeda(input.aporteInicial))}
      ${linhaGrid("Idade de Aposentadoria:", String(input.idadeAposentadoria))}
      ${linhaGrid("Contribuição Mensal Aposentadoria:", fmtMoeda(r.contribuicaoMensalAposentadoria))}
      ${linhaGrid("Tempo de Contribuição (anos):", String(tempoContribuicaoAnos))}
      ${linhaGrid("Contribuição Mensal das Coberturas:", fmtMoeda(r.contribuicaoMensalCoberturas))}
      ${linhaGrid("Sexo:", input.sexo)}
      ${linhaGrid("Contribuição Mensal Total:", fmtMoeda(r.contribuicaoMensalTotal), true)}
      ${linhaGrid("Rentabilidade Real Estimada:", fmtPercent(input.rentabilidadeAnual))}
    </div>

    <table class="secao">
      <thead><tr><th colspan="2">Aposentadoria</th></tr></thead>
      <tbody>
        <tr><td>Contribuição Mensal:</td><td class="dir">${fmtMoeda(r.contribuicaoMensalAposentadoria)}</td></tr>
        <tr><td>Reserva Estimada:</td><td class="dir">${fmtMoeda(r.reservaEstimada)}</td></tr>
        <tr class="sub"><td colspan="2">Opções de Renda:</td></tr>
        <tr><td>Renda Mensal Vitalícia Estimada:</td><td class="dir">${fmtMoeda(r.rendaMensalVitalicia)}</td></tr>
        <tr><td>Renda Mensal Temporária (15 anos) Estimada:</td><td class="dir">${fmtMoeda(r.rendaMensalTemporaria15Anos)}</td></tr>
        <tr><td>Renda Mensal Vitalícia PMG (5 anos) Estimada:</td><td class="dir">${fmtMoeda(r.rendaMensalVitaliciaPMG5Anos)}</td></tr>
      </tbody>
    </table>

    <table class="secao">
      <thead><tr><th>Coberturas de Proteção Familiar</th><th>Cobertura</th><th class="dir">Contribuição Mensal</th></tr></thead>
      <tbody>
        <tr><td>Renda por Invalidez:</td><td>${input.rendaInvalidezValor ? fmtMoeda(input.rendaInvalidezValor) : "—"}</td><td class="dir">${fmtMoeda(r.contribuicaoRendaInvalidez)}</td></tr>
        <tr><td>Pecúlio por Morte:</td><td>${input.peculioMorteValor ? fmtMoeda(input.peculioMorteValor) : "—"}</td><td class="dir">${fmtMoeda(r.contribuicaoPeculioMorte)}</td></tr>
        <tr><td>${escapeHtml(labelPrazoPensao)}</td><td>${input.pensaoPrazoCertoValor ? fmtMoeda(input.pensaoPrazoCertoValor) : "—"}</td><td class="dir">${fmtMoeda(r.contribuicaoPensaoPrazoCerto)}</td></tr>
      </tbody>
    </table>

    <div class="grafico-box">
      <div class="grafico-titulo">Evolução da sua Reserva</div>
      ${graficoSvg(r.evolucaoReserva)}
      <div class="grafico-eixo-label">Tempo de Contribuição</div>
    </div>

    <div class="rodape-assinatura">
      <div>Atenciosamente,<br/><b>Icatu Seguros S/A</b></div>
      <div>Corretor(a)</div>
    </div>

    <div class="disclaimer">
      Os valores informados são meramente exemplificativos, não constituindo obrigação contratual da Icatu Seguros S/A. Para essa simulação foi considerada Tábua Biométrica BR-EMSsb-2021 M/F e taxa de retorno de 0% a.a após a concessão do benefício. A renda apresentada no simulador é uma estimativa. O valor efetivo somente será calculado no momento da solicitação do recebimento, com base no valor acumulado no período. O valor da renda apresentado não está líquido de Imposto de Renda. A rentabilidade anual estimada não é uma garantia, pois dependerá da performance do fundo escolhido no seu Plano.
    </div>
  </div>`;
}

export function renderPrevidenciaHtml(input: PrevidenciaInput, resultado: PrevidenciaResultado, dataEstudo: Date = new Date()): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Estudo de Previdência — ${escapeHtml(input.nomeCliente)}</title>
<style>${SHARED_CSS}</style>
</head>
<body>
${paginaCapaHtml(input, dataEstudo)}
${paginaResumoHtml(input, resultado)}
</body>
</html>
`;
}
