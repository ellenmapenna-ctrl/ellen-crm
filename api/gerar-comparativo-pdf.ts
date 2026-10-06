// Renderiza só o Comparative Board da revisita (uma página única, do tamanho
// do conteúdo) em PDF via Chromium headless. A junção com apólice, resgate e
// apresentação da seguradora acontece no navegador — ver src/lib/revisita-pdf.ts.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PDFDocument } from "pdf-lib";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { renderRevisitaHtml, type RevisitaDados, type RevisitaFormato } from "../src/lib/revisita-template.js";

const LARGURA_PAGINA_PX = 794; // largura A4 a 96dpi

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const { dados, formato } = req.body ?? {};
  if (!dados) {
    res.status(400).json({ error: "Falta o campo obrigatório: dados." });
    return;
  }

  const formatoFinal: RevisitaFormato = formato === "vanguarda" || formato === "essencial" ? formato : "vitrine";

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: LARGURA_PAGINA_PX, height: 1123 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(renderRevisitaHtml(dados as RevisitaDados, formatoFinal), { waitUntil: "load" });
    // As fontes do Google Fonts chegam depois do evento "load"; medir a altura
    // antes delas deixa o PDF cortado em 2 páginas mesmo pedindo 1.
    await page.evaluate(() => document.fonts.ready);
    // Página única do tamanho exato do conteúdo. A altura via scrollHeight não
    // bate 100% com o motor de impressão do Chromium — confere o nº de páginas
    // e, se saiu mais de uma, tenta de novo com mais altura.
    let alturaPx = await page.evaluate(() => document.documentElement.scrollHeight);
    let pdf: Uint8Array = new Uint8Array();
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      pdf = await page.pdf({
        width: `${LARGURA_PAGINA_PX}px`,
        height: `${alturaPx}px`,
        printBackground: true,
        margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
      });
      const paginas = await PDFDocument.load(pdf, { ignoreEncryption: true });
      if (paginas.getPageCount() <= 1) break;
      alturaPx = Math.ceil(alturaPx * 1.4);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.status(200).send(Buffer.from(pdf));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    await browser.close();
  }
}
