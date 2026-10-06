// Monta o PDF final da revisita juntando, nesta ordem: apólice(s) atual(is) →
// tabela de resgate (PDF ou imagem) → apresentação(ões) da seguradora →
// Comparative Board. A junção roda no navegador (pdf-lib) pra não esbarrar
// no limite de ~4,5 MB de corpo de requisição das functions da Vercel — só o
// Comparative Board (gerado a partir dos dados, pequeno) vem do servidor.
import { PDFDocument } from "pdf-lib";
import { decryptPDF, isEncrypted } from "@pdfsmaller/pdf-decrypt";
import type { RevisitaDados, RevisitaFormato } from "./revisita-template";

export interface EntradaPdfFinal {
  apolices: Uint8Array[];
  tabelaResgate?: { bytes: Uint8Array; mediaType: string };
  apresentacoes: Uint8Array[];
  comparativo: Uint8Array;
}

/**
 * PDFs de apólice (Prudential etc.) costumam vir criptografados (RC4/AES só
 * com senha de dono, sem senha de usuário). O pdf-lib com `ignoreEncryption`
 * só pula a checagem — não decripta os content streams, e as páginas copiadas
 * saem em branco. Decripta de verdade com senha vazia antes de copiar.
 */
async function descriptografarSeNecessario(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const info = await isEncrypted(bytes);
    if (!info.encrypted) return bytes;
    return await decryptPDF(bytes, "");
  } catch {
    return bytes;
  }
}

async function anexarPdf(destino: PDFDocument, bytes: Uint8Array) {
  const limpo = await descriptografarSeNecessario(bytes);
  const origem = await PDFDocument.load(limpo, { ignoreEncryption: true });
  const paginas = await destino.copyPages(origem, origem.getPageIndices());
  paginas.forEach((p) => destino.addPage(p));
}

async function anexarImagem(destino: PDFDocument, bytes: Uint8Array, mediaType: string) {
  const img = mediaType === "image/png" ? await destino.embedPng(bytes) : await destino.embedJpg(bytes);
  const larguraA4 = 595.28;
  const altura = img.height * (larguraA4 / img.width);
  const pagina = destino.addPage([larguraA4, altura]);
  pagina.drawImage(img, { x: 0, y: 0, width: larguraA4, height: altura });
}

export async function mesclarPdfFinal(entrada: EntradaPdfFinal): Promise<Uint8Array> {
  const final = await PDFDocument.create();

  for (const apolice of entrada.apolices) await anexarPdf(final, apolice);

  if (entrada.tabelaResgate) {
    const { bytes, mediaType } = entrada.tabelaResgate;
    if (mediaType === "image/png" || mediaType === "image/jpeg") await anexarImagem(final, bytes, mediaType);
    else await anexarPdf(final, bytes);
  }

  for (const apresentacao of entrada.apresentacoes) await anexarPdf(final, apresentacao);

  await anexarPdf(final, entrada.comparativo);

  return final.save();
}

/** pdf-lib não embute WebP — converte pra PNG via canvas antes. */
async function webpParaPng(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao converter a imagem."))), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function lerArquivo(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export interface ParamsDownloadRevisita {
  apolices: File[];
  tabelaResgate?: File | null;
  apresentacoes: File[];
  dados: RevisitaDados;
  formato: RevisitaFormato;
}

/** Gera o Comparative Board no servidor, junta com os arquivos enviados e dispara o download. */
export async function baixarRevisitaPdf({ apolices, tabelaResgate, apresentacoes, dados, formato }: ParamsDownloadRevisita): Promise<void> {
  const res = await fetch("/api/gerar-comparativo-pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dados, formato }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? "Erro ao gerar o comparativo.");
  }
  const comparativo = new Uint8Array(await res.arrayBuffer());

  let tabela: EntradaPdfFinal["tabelaResgate"];
  if (tabelaResgate) {
    if (tabelaResgate.type === "image/webp") tabela = { bytes: await webpParaPng(tabelaResgate), mediaType: "image/png" };
    else if (tabelaResgate.type === "image/png") tabela = { bytes: await lerArquivo(tabelaResgate), mediaType: "image/png" };
    else if (tabelaResgate.type === "image/jpeg" || tabelaResgate.type === "image/jpg") tabela = { bytes: await lerArquivo(tabelaResgate), mediaType: "image/jpeg" };
    else tabela = { bytes: await lerArquivo(tabelaResgate), mediaType: "application/pdf" };
  }

  const bytesFinais = await mesclarPdfFinal({
    apolices: await Promise.all(apolices.map(lerArquivo)),
    tabelaResgate: tabela,
    apresentacoes: await Promise.all(apresentacoes.map(lerArquivo)),
    comparativo,
  });

  const url = URL.createObjectURL(new Blob([bytesFinais as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Revisita_${dados.clienteNome.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
