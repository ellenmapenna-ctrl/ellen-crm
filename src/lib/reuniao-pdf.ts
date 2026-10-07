// PDF "reunião": página(s) "Detalhes da Apólice" da Prudential (dados guardados
// no sistema) → apresentação(ões) da seguradora → comparativo. A apólice e o
// comparativo são desenhados no servidor; a apresentação é um PDF fixo do
// projeto; a junção roda no navegador (pdf-lib), como no PDF completo da revisita.
import { supabase } from "@/integrations/supabase/client";
import type { ApolicePrudentialDados } from "@/lib/apolice-prudential-template";
import { apresentacaoPorKey } from "@/lib/apresentacoes";
import { baixarBytesPdf, gerarComparativoBytes, mesclarPdfFinal } from "@/lib/revisita-pdf";
import type { RevisitaDados, RevisitaFormato } from "@/lib/revisita-template";

interface ApoliceComDetalhe {
  id: string;
  status: string;
  numero_apolice: string | null;
  apolice_detalhes: { dados: ApolicePrudentialDados } | { dados: ApolicePrudentialDados }[] | null;
}

/** Página(s) da apólice atual; devolve null (com aviso) quando não há dados guardados para as apólices da revisita. */
async function gerarApolicasBytes(clienteId: string, dados: RevisitaDados): Promise<{ bytes: Uint8Array | null; aviso?: string }> {
  const { data, error } = await supabase
    .from("apolices")
    .select("id, status, numero_apolice, apolice_detalhes(dados)")
    .eq("cliente_id", clienteId);
  if (error) throw error;
  const apolices = (data ?? []) as unknown as ApoliceComDetalhe[];

  const ativas = apolices.filter((a) => a.status === "ativa");
  const ids = dados.apolicesSistemaIds ?? [];
  const escolhidas = ids.length > 0 ? ativas.filter((a) => ids.includes(a.id)) : ativas;
  const comDetalhe = escolhidas
    .map((a) => (Array.isArray(a.apolice_detalhes) ? a.apolice_detalhes[0] : a.apolice_detalhes))
    .filter((d): d is { dados: ApolicePrudentialDados } => !!d?.dados)
    .map((d) => d.dados);

  if (comDetalhe.length === 0) {
    return { bytes: null, aviso: "A página da apólice não entrou: não há dados guardados dessa(s) apólice(s). Importe-os em Importar → Importar dados das apólices." };
  }
  const aviso = comDetalhe.length < escolhidas.length ? `Só ${comDetalhe.length} de ${escolhidas.length} apólices tinham dados guardados e entraram no PDF.` : undefined;

  const res = await fetch("/api/gerar-apolice-pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apolices: comDetalhe }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? "Erro ao gerar a página da apólice.");
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), aviso };
}

export interface ResultadoReuniao {
  /** Avisos do que ficou de fora do PDF (ex.: apólice sem dados guardados). */
  avisos: string[];
}

export async function baixarReuniaoPdf(params: { dados: RevisitaDados; formato: RevisitaFormato; clienteId: string | null }): Promise<ResultadoReuniao> {
  const { dados, formato, clienteId } = params;
  const avisos: string[] = [];

  let apolice: Uint8Array | null = null;
  if (clienteId) {
    const r = await gerarApolicasBytes(clienteId, dados);
    apolice = r.bytes;
    if (r.aviso) avisos.push(r.aviso);
  } else {
    avisos.push("A página da apólice não entrou: o cliente desta revisita não está na carteira.");
  }

  const apresentacoes: Uint8Array[] = [];
  for (const key of dados.apresentacoes ?? []) {
    const ap = apresentacaoPorKey(key);
    if (!ap) continue;
    const res = await fetch(ap.url);
    if (!res.ok) throw new Error(`Não foi possível carregar a apresentação ${ap.label}.`);
    apresentacoes.push(new Uint8Array(await res.arrayBuffer()));
  }
  if (apresentacoes.length === 0) avisos.push("Nenhuma apresentação de seguradora foi escolhida nesta revisita.");

  const comparativo = await gerarComparativoBytes(dados, formato);
  const final = await mesclarPdfFinal({ apolices: apolice ? [apolice] : [], apresentacoes, comparativo });
  baixarBytesPdf(final, `Reuniao_${dados.clienteNome.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
  return { avisos };
}
