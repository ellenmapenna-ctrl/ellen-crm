// Renderiza o "Estudo de Previdência Individual" (2 páginas: carta + resumo)
// em PDF de verdade via Chromium headless. Diferente do fluxo de Revisão
// Anual, aqui não há documentos originais pra juntar — é geração pura a
// partir dos dados calculados no cliente (src/lib/previdencia-calc.ts).
import type { VercelRequest, VercelResponse } from "@vercel/node";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { gerarEstudoPrevidencia, type PrevidenciaInput } from "../src/lib/previdencia-calc.js";
import { renderPrevidenciaHtml } from "../src/lib/previdencia-template.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const { input } = (req.body ?? {}) as { input?: PrevidenciaInput };
  if (!input || !input.nomeCliente || !input.idadeAtual || !input.idadeAposentadoria) {
    res.status(400).json({ error: "Faltam campos obrigatórios: input.nomeCliente, idadeAtual, idadeAposentadoria." });
    return;
  }

  try {
    const resultado = gerarEstudoPrevidencia(input);
    const html = renderPrevidenciaHtml(input, resultado);

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
      pdf = await page.pdf({
        format: "a4",
        printBackground: true,
        margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
      });
    } finally {
      await browser.close();
    }

    const nomeArquivo = `Estudo_Previdencia_${input.nomeCliente.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    res.status(200).send(Buffer.from(pdf));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
