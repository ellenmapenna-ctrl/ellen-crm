// Renderiza a(s) página(s) "Detalhes da Apólice" no padrão visual da Prudential
// em PDF de verdade via Chromium headless. Recebe os dados já guardados no
// sistema e só desenha — ver src/lib/apolice-prudential-template.ts.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { renderApolicesPrudentialHtml, type ApolicePrudentialDados } from "../src/lib/apolice-prudential-template.js";
import { PRUDENTIAL_LOGO_DATA_URI } from "../src/lib/prudential-logo.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const { apolices } = (req.body ?? {}) as { apolices?: ApolicePrudentialDados[] };
  if (!Array.isArray(apolices) || apolices.length === 0 || apolices.some((a) => !a?.numero || !a?.segurado?.nome)) {
    res.status(400).json({ error: "Faltam campos obrigatórios: apolices (1+), cada uma com numero e segurado.nome." });
    return;
  }

  try {
    const html = renderApolicesPrudentialHtml(apolices, PRUDENTIAL_LOGO_DATA_URI);
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    let pdf: Uint8Array;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      pdf = await page.pdf({ format: "a4", printBackground: true, margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" } });
    } finally {
      await browser.close();
    }
    res.setHeader("Content-Type", "application/pdf");
    res.status(200).send(Buffer.from(pdf));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
