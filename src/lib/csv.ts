import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface CsvResultado {
  colunas: string[];
  linhas: Record<string, string>[];
}

/** Extensões de arquivo aceitas na importação de clientes. */
export const EXTENSOES_ACEITAS = ["csv", "xls", "xlsx", "xlsm"] as const;

function extensaoDoArquivo(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

/** Indica se o arquivo tem uma extensão suportada pela importação. */
export function extensaoSuportada(file: File): boolean {
  return (EXTENSOES_ACEITAS as readonly string[]).includes(extensaoDoArquivo(file));
}

const linhaTemConteudo = (row: Record<string, string>) =>
  Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== "");

/**
 * Normaliza uma lista de cabeçalhos brutos preservando o alinhamento posicional
 * com as colunas originais da planilha:
 * - Cabeçalhos vazios (comuns em planilhas com colunas mescladas/agrupadas) nunca
 *   são descartados — descartá-los desalinharia o índice usado para ler os
 *   valores de cada linha. Recebem um nome de espaço reservado ("Coluna N").
 * - Cabeçalhos duplicados (comuns em planilhas com múltiplos segurados/coberturas,
 *   ex.: "CPF" repetido para titular e dependentes) recebem um sufixo " (2)", " (3)"
 *   etc., para nunca colidir como chave do mesmo objeto de linha.
 */
function normalizarCabecalhos(headersBrutos: string[]): string[] {
  const contagem = new Map<string, number>();
  return headersBrutos.map((h, idx) => {
    const base = h.trim() || `Coluna ${idx + 1}`;
    const vistas = contagem.get(base) ?? 0;
    contagem.set(base, vistas + 1);
    return vistas === 0 ? base : `${base} (${vistas + 1})`;
  });
}

/**
 * Garante que a tabela de codepages (cpexcel) esteja registrada no SheetJS.
 * Sem isso, arquivos .xls legados que usam codificação ANSI (não Unicode)
 * têm caracteres acentuados corrompidos ao serem lidos no navegador.
 * Carregada sob demanda para não pesar o bundle inicial.
 */
let codepageCarregada: Promise<void> | null = null;
function garantirCodepage(): Promise<void> {
  if (!codepageCarregada) {
    codepageCarregada = import("xlsx/dist/cpexcel.full.mjs").then((cptable) => {
      XLSX.set_cptable(cptable);
    });
  }
  return codepageCarregada;
}

/** Verdadeiro quando a célula não tem valor (nunca foi escrita ou está vazia). */
function celulaVazia(celula: XLSX.CellObject | undefined): boolean {
  return !celula || celula.v === undefined || celula.v === null || celula.v === "";
}

/**
 * Propaga o valor da célula superior-esquerda de cada intervalo mesclado para
 * as demais células desse intervalo. O SheetJS só guarda o valor na célula
 * superior-esquerda de uma mesclagem — as outras ficam vazias — o que
 * desalinha cabeçalhos agrupados (ex.: um grupo mesclado sobre "Cidade/UF")
 * e dados agrupados (ex.: nome do titular mesclado sobre as linhas dos
 * dependentes). Sem essa propagação, essas células ficam vazias em vez de
 * repetirem o valor visível na planilha original.
 */
function propagarCelulasMescladas(planilha: XLSX.WorkSheet): void {
  const merges = planilha["!merges"];
  if (!merges) return;
  for (const range of merges) {
    const origem = planilha[XLSX.utils.encode_cell(range.s)];
    if (!origem) continue;
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        if (r === range.s.r && c === range.s.c) continue;
        const endereco = XLSX.utils.encode_cell({ r, c });
        if (celulaVazia(planilha[endereco])) {
          planilha[endereco] = { ...origem };
        }
      }
    }
  }
}

/**
 * Escolhe a aba com mais linhas do workbook. Planilhas de exportação de
 * sistemas costumam ter abas extras de capa/notas bem menores que a aba com
 * os dados reais — usar sempre a primeira aba poderia ler a aba errada.
 */
function escolherAbaComMaisLinhas(workbook: XLSX.WorkBook): string {
  let melhorAba = workbook.SheetNames[0];
  let maiorContagem = -1;
  for (const nome of workbook.SheetNames) {
    const ref = workbook.Sheets[nome]?.["!ref"];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const totalLinhas = range.e.r - range.s.r + 1;
    if (totalLinhas > maiorContagem) {
      maiorContagem = totalLinhas;
      melhorAba = nome;
    }
  }
  return melhorAba;
}

/**
 * Localiza a linha de cabeçalho real a partir de quantas células "próprias"
 * (com conteúdo, não herdadas de uma mesclagem/expansão) cada linha tem,
 * relativo ao total de colunas. Um banner/título ocupa uma única célula
 * mesclada por toda a largura — poucas células próprias — enquanto o
 * cabeçalho real tem uma célula própria por coluna. Procura nas primeiras
 * 15 linhas pela primeira com pelo menos metade das colunas preenchidas por
 * células próprias; se nenhuma atender, assume a primeira linha (sem
 * regressão para planilhas simples, onde o cabeçalho já está na linha 0).
 */
function encontrarLinhaDeCabecalhoPorContagem(contagemPorLinha: number[], larguraTotal: number): number {
  if (larguraTotal === 0) return 0;
  const limiteBusca = Math.min(contagemPorLinha.length, 15);
  for (let i = 0; i < limiteBusca; i++) {
    if (contagemPorLinha[i] / larguraTotal >= 0.5) return i;
  }
  return 0;
}

/** Faz o parse de um arquivo CSV (com cabeçalho) usando papaparse. */
function parseCsv(file: File): Promise<CsvResultado> {
  const contagem = new Map<string, number>();
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h, idx) => {
        const base = h.trim() || `Coluna ${idx + 1}`;
        const vistas = contagem.get(base) ?? 0;
        contagem.set(base, vistas + 1);
        return vistas === 0 ? base : `${base} (${vistas + 1})`;
      },
      complete: (result) => {
        const colunas = result.meta.fields ?? [];
        const linhas = result.data.filter(linhaTemConteudo);
        resolve({ colunas, linhas });
      },
      error: (err) => reject(err),
    });
  });
}

/** Lê a planilha em modo matriz (uma linha = um array de células, por posição). */
function lerLinhasBrutas(planilha: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(planilha, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
    dateNF: "yyyy-mm-dd",
  });
}

const ASSINATURA_ZIP = [0x50, 0x4b, 0x03, 0x04]; // .xlsx/.xlsm (OOXML, na verdade um .zip)
const ASSINATURA_OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // .xls legado (BIFF dentro de OLE2)

function bytesComecamCom(bytes: Uint8Array, assinatura: number[]): boolean {
  if (bytes.length < assinatura.length) return false;
  return assinatura.every((b, i) => bytes[i] === b);
}

/** Verdadeiro quando o arquivo é um binário Excel de verdade (OOXML zip ou BIFF/OLE2 legado). */
function ehBinarioExcel(bytes: Uint8Array): boolean {
  return bytesComecamCom(bytes, ASSINATURA_ZIP) || bytesComecamCom(bytes, ASSINATURA_OLE2);
}

/**
 * Muitos sistemas legados de back-office (comum em seguradoras) exportam
 * "Excel" que na verdade é uma tabela HTML salva com extensão .xls/.xlsx —
 * o Excel abre esse arquivo por reconhecer o conteúdo, não a extensão. Se
 * esses bytes forem entregues crus ao SheetJS (sem decodificar o charset
 * primeiro), o parser HTML dele assume UTF-8 internamente; ao encontrar uma
 * sequência de byte inválida como UTF-8 (comum em arquivos Windows-1252 com
 * acentos), ele perde a sincronia dos limites de tag e passa a misturar
 * fragmentos de tag (`</td>`) com texto de células vizinhas — exatamente o
 * padrão de corrupção observado. Detectar aqui e decodificar antes evita isso.
 * Usa os primeiros bytes decodificados como Latin-1 (1 byte -> 1 caractere,
 * nunca falha, suficiente para reconhecer tags ASCII independente da
 * codificação real do arquivo).
 */
function pareceHtml(previewLatin1: string): boolean {
  const p = previewLatin1.toLowerCase();
  return p.includes("<html") || p.includes("<table") || p.includes("<!doctype html") || p.includes("<?xml");
}

/**
 * Detecta a codificação declarada em um `<meta charset>` do HTML. Sistemas
 * legados brasileiros costumam declarar "iso-8859-1" (o navegador trata como
 * windows-1252, que é um superconjunto compatível) ou não declarar nada —
 * nesse caso windows-1252 é o padrão mais comum para exports em pt-BR dessa
 * geração de sistemas e evita a corrupção de acentos vista com UTF-8.
 */
function detectarCharsetHtml(previewLatin1: string): string {
  const match = previewLatin1.match(/charset\s*=\s*["']?\s*([\w-]+)/i);
  if (!match) return "windows-1252";
  const bruto = match[1].toLowerCase();
  if (bruto === "utf8") return "utf-8";
  return bruto;
}

/** Decodifica bytes usando o charset informado; recua para windows-1252 se o label não for reconhecido. */
function decodificarComCharset(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

interface CelulaLogica {
  linha: number;
  col: number;
  colSpan: number;
  rowSpan: number;
  texto: string;
}

interface TabelaHtmlLida {
  matriz: string[][];
  /** Nº de células <td>/<th> com conteúdo próprias de cada linha (sem contar expansão de colspan/rowspan) — usado para detectar a linha de cabeçalho real. */
  contagemPorLinha: number[];
}

/**
 * Faz o parse de uma tabela HTML usando o `DOMParser` nativo do navegador,
 * em vez do parser HTML "smart" do SheetJS. O SheetJS, ao ler HTML, tenta
 * inferir o tipo de cada célula e converte texto que "parece número" para
 * number — mas usa a convenção americana (vírgula = separador de milhar),
 * corrompendo valores no formato brasileiro: "45,90" virava o número 4590,
 * cem vezes maior. Lendo com `DOMParser`, cada célula é sempre extraída como
 * texto puro (nunca convertida), e `rowspan`/`colspan` são propagados
 * manualmente célula a célula.
 */
function parseTabelaHtml(html: string): TabelaHtmlLida {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tabelas = Array.from(doc.querySelectorAll("table"));
  if (tabelas.length === 0) return { matriz: [], contagemPorLinha: [] };

  // Escolhe a tabela com mais linhas <tr> — evita pegar uma tabela de
  // layout/decoração em torno da tabela de dados real.
  let melhorTabela = tabelas[0];
  let maiorContagem = -1;
  for (const tabela of tabelas) {
    const contagem = tabela.querySelectorAll("tr").length;
    if (contagem > maiorContagem) {
      maiorContagem = contagem;
      melhorTabela = tabela;
    }
  }

  const linhasEl = Array.from(melhorTabela.querySelectorAll("tr"));
  const reservado = new Map<number, number>(); // coluna -> linhas restantes cobertas por rowspan
  const celulasLogicas: CelulaLogica[] = [];
  const contagemPorLinha: number[] = new Array(linhasEl.length).fill(0);

  linhasEl.forEach((tr, linhaIdx) => {
    let col = 0;
    const criadasNestaLinha = new Set<number>();
    for (const celula of Array.from(tr.querySelectorAll("td, th"))) {
      while ((reservado.get(col) ?? 0) > 0) col++;
      const texto = (celula.textContent ?? "").replace(/\s+/g, " ").trim();
      const colSpan = Math.max(1, Number(celula.getAttribute("colspan")) || 1);
      const rowSpan = Math.max(1, Number(celula.getAttribute("rowspan")) || 1);
      celulasLogicas.push({ linha: linhaIdx, col, colSpan, rowSpan, texto });
      if (texto !== "") contagemPorLinha[linhaIdx]++;
      for (let i = 0; i < colSpan; i++) {
        if (rowSpan > 1) {
          reservado.set(col + i, rowSpan - 1);
          criadasNestaLinha.add(col + i);
        }
      }
      col += colSpan;
    }
    // Decrementa só as reservas herdadas de linhas anteriores — as criadas
    // agora só passam a "contar" a partir da próxima linha.
    for (const [c, restante] of [...reservado.entries()]) {
      if (criadasNestaLinha.has(c)) continue;
      const novoRestante = restante - 1;
      if (novoRestante <= 0) reservado.delete(c);
      else reservado.set(c, novoRestante);
    }
  });

  const totalLinhas = linhasEl.length;
  let totalColunas = 0;
  for (const cl of celulasLogicas) totalColunas = Math.max(totalColunas, cl.col + cl.colSpan);

  const matriz: string[][] = Array.from({ length: totalLinhas }, () => new Array<string>(totalColunas).fill(""));
  for (const cl of celulasLogicas) {
    for (let r = 0; r < cl.rowSpan; r++) {
      for (let c = 0; c < cl.colSpan; c++) {
        const linhaDestino = cl.linha + r;
        if (linhaDestino < totalLinhas) matriz[linhaDestino][cl.col + c] = cl.texto;
      }
    }
  }
  return { matriz, contagemPorLinha };
}

/**
 * Lê uma planilha do SheetJS já resolvendo a linha de cabeçalho corretamente:
 * conta células com conteúdo ANTES de propagar mesclagens (um banner
 * mesclado por toda a largura só tem 1 célula com conteúdo até a
 * propagação — propagar antes faria esse banner "parecer" uma linha de
 * cabeçalho densa), propaga depois, e relê os valores finais.
 */
function lerPlanilhaSheetJs(planilha: XLSX.WorkSheet): { linhasBrutas: unknown[][]; indiceCabecalho: number } {
  const linhasAntes = lerLinhasBrutas(planilha);
  const larguraTotal = linhasAntes.reduce((max, l) => Math.max(max, l.length), 0);
  const contagemPorLinha = linhasAntes.map((linha) => linha.filter((v) => String(v ?? "").trim() !== "").length);
  const indiceCabecalho = encontrarLinhaDeCabecalhoPorContagem(contagemPorLinha, larguraTotal);

  propagarCelulasMescladas(planilha);
  const linhasBrutas = lerLinhasBrutas(planilha);
  return { linhasBrutas, indiceCabecalho };
}

/** Faz o parse da planilha com mais dados de um arquivo Excel (.xls, .xlsx, .xlsm). */
async function parseExcel(file: File): Promise<CsvResultado> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let linhasBrutas: unknown[][];
  let indiceCabecalho: number;

  if (ehBinarioExcel(bytes)) {
    // Binário real (.xlsx/.xlsm zip ou .xls/BIFF legado): usa o SheetJS
    // normalmente — ele já lê os tipos numéricos nativos da planilha
    // corretamente, sem precisar inferir nada de texto.
    await garantirCodepage();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const planilha = workbook.Sheets[escolherAbaComMaisLinhas(workbook)];
    ({ linhasBrutas, indiceCabecalho } = lerPlanilhaSheetJs(planilha));
  } else {
    const previewLatin1 = new TextDecoder("windows-1252").decode(bytes.slice(0, 4096));
    if (pareceHtml(previewLatin1)) {
      // "Excel" que na verdade é HTML: decodifica o arquivo inteiro com o
      // charset correto e usa o parser de tabela HTML próprio (ver
      // `parseTabelaHtml`), que nunca infere tipo — evita tanto a corrupção
      // de acentos quanto a inflação de valores decimais brasileiros.
      const charset = detectarCharsetHtml(previewLatin1);
      const texto = decodificarComCharset(bytes, charset);
      const lida = parseTabelaHtml(texto);
      linhasBrutas = lida.matriz;
      const larguraTotal = lida.matriz.reduce((max, l) => Math.max(max, l.length), 0);
      indiceCabecalho = encontrarLinhaDeCabecalhoPorContagem(lida.contagemPorLinha, larguraTotal);
    } else {
      // Nem assinatura binária conhecida, nem HTML: mantém o comportamento
      // padrão do SheetJS como último recurso (cobre outros formatos que ele
      // suporta, como SYLK/DIF/PRN).
      await garantirCodepage();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const planilha = workbook.Sheets[escolherAbaComMaisLinhas(workbook)];
      ({ linhasBrutas, indiceCabecalho } = lerPlanilhaSheetJs(planilha));
    }
  }

  if (linhasBrutas.length === 0) return { colunas: [], linhas: [] };

  // Importante: NÃO filtrar cabeçalhos vazios aqui — o índice de cada coluna
  // precisa continuar correspondendo à posição real na planilha, senão os
  // valores de cada linha são lidos da coluna errada (desalinhamento em cascata).
  const headersBrutos = (linhasBrutas[indiceCabecalho] ?? []).map((h) => String(h ?? ""));
  const colunas = normalizarCabecalhos(headersBrutos);
  const linhas: Record<string, string>[] = [];
  for (let i = indiceCabecalho + 1; i < linhasBrutas.length; i++) {
    const linhaBruta = linhasBrutas[i] ?? [];
    const linha: Record<string, string> = {};
    colunas.forEach((col, idx) => {
      linha[col] = linhaBruta[idx] != null ? String(linhaBruta[idx]).trim() : "";
    });
    if (linhaTemConteudo(linha)) linhas.push(linha);
  }
  return { colunas, linhas };
}

/** Faz o parse de um arquivo CSV ou Excel (.xls, .xlsx, .xlsm) com cabeçalho na primeira linha. */
export function parseArquivo(file: File): Promise<CsvResultado> {
  const ext = extensaoDoArquivo(file);
  if (ext === "csv") return parseCsv(file);
  if (ext === "xls" || ext === "xlsx" || ext === "xlsm") return parseExcel(file);
  return Promise.reject(new Error("Formato de arquivo não suportado."));
}

/**
 * Normaliza datas nos formatos dd/mm/yyyy ou yyyy-mm-dd para ISO yyyy-mm-dd.
 * Retorna null quando o valor não casa com nenhum formato conhecido.
 */
export function normalizarData(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const v = String(valor).trim();
  if (!v) return null;

  // ISO yyyy-mm-dd
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, a, m, d] = iso;
    return montarIso(a, m, d);
  }

  // dd/mm/yyyy (ou dd-mm-yyyy)
  const br = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (br) {
    const [, d, m, a] = br;
    return montarIso(a.length === 2 ? `20${a}` : a, m, d);
  }

  return null;
}

function montarIso(ano: string, mes: string, dia: string): string | null {
  const a = Number(ano);
  const m = Number(mes);
  const d = Number(dia);
  if (!a || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${a}-${mm}-${dd}`;
}

/** Limpa CPF mantendo apenas dígitos. */
export function limparCpf(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = valor.replace(/\D/g, "");
  return d || null;
}
