// Recebe a apólice atual (ex.: Prudential), 1+ propostas da(s) seguradora(s)
// nova(s) (ex.: Azos) e, quando o produto atual tem resgate (Vida Inteira /
// Vida e Saúde), também a tabela de evolução/resgate da apólice e a proposta
// de previdência que vai substituir o resgate (ex.: Icatu). Manda tudo pro
// Google Gemini ler (camada gratuita — sem custo por chamada, ao contrário da
// API da Anthropic), no mesmo formato de tabela única "Comparativo de
// Seguros" do Platoris (ver src/lib/revisita-template.ts), em um dos 3
// layouts. Não persiste nada aqui — quem salva no Supabase é o front, depois
// que o corretor revisa o preview.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { renderRevisitaHtml, type RevisitaDados, type RevisitaFormato } from "../src/lib/revisita-template.js";
import { aplicarCatalogo } from "../src/lib/catalogo-revisita.js";
import { descreverApolicesSistema, type ApoliceSistema } from "../src/lib/apolices-sistema.js";

// Schema no formato aceito pelo responseSchema do Gemini (subconjunto do
// OpenAPI 3.0 — sem additionalProperties, sem tuplas, etc).
const REVISITA_RESPONSE_SCHEMA = {
  type: "OBJECT",
  required: ["cpf", "seguradoraAtual", "seguradoraNova", "coberturas", "premiosAtual", "premiosNovo", "totalAtualTexto", "totalNovoTexto"],
  properties: {
    cpf: { type: "STRING", description: "CPF do segurado, extraído da apólice atual. Formato 000.000.000-00." },
    nascimento: { type: "STRING", description: "Data de nascimento do segurado, dd/mm/aaaa, se aparecer na apólice." },
    seguradoraAtual: { type: "STRING", description: "Nome da seguradora atual, ex: 'Prudential'." },
    seguradoraNova: { type: "STRING", description: "Nome da(s) seguradora(s) nova(s), ex: 'Azos'. Se houver mais de uma proposta, separe por ' + '." },
    coberturas: {
      type: "ARRAY",
      description:
        "Uma linha por categoria de cobertura, cruzando a apólice atual x a(s) proposta(s) nova(s) por equivalência semântica (mesmo quando nomes/códigos diferem). Inclua todas as categorias existentes em qualquer um dos lados. Se o produto atual tiver resgate (ver instruções de resgate), a linha 'Resgate' vem sempre por último.",
      items: {
        type: "OBJECT",
        required: ["titulo", "atualValor", "atualDetalhes", "novoValor", "novoDetalhes"],
        properties: {
          titulo: { type: "STRING", description: "Nome da cobertura, ex: 'Morte qualquer causa', 'Diagnóstico de doenças graves Plus', 'Resgate'." },
          atualSemCobertura: { type: "BOOLEAN", description: "true se a apólice atual não tiver essa cobertura." },
          atualValor: { type: "STRING", description: "Capital/valor em reais, formato 'R$ 1.234,56'. '—' se atualSemCobertura." },
          atualDetalhes: {
            type: "ARRAY",
            items: { type: "STRING" },
            description:
              "Linhas explicativas curtas sobre a cobertura atual: reduções futuras de capital (frase direta, sem parênteses, ex: 'Aos 51 anos o capital segurado será de R$ 70.000,00.'), características entre parênteses (ex: '(Franquia de 5 dias)', '(Encerra aos 71 anos)'). Vazio se sem detalhes relevantes.",
          },
          novoSemCobertura: { type: "BOOLEAN", description: "true se nenhuma proposta nova cobrir essa categoria." },
          novoValor: { type: "STRING", description: "Capital/valor da proposta nova em reais. '—' se novoSemCobertura." },
          novoDetalhes: { type: "ARRAY", items: { type: "STRING" }, description: "Mesma lógica de atualDetalhes, para a proposta nova." },
        },
      },
    },
    premiosAtual: {
      type: "ARRAY",
      description:
        "Prêmio mensal da apólice atual, normalmente uma seguradora só. Se a apólice atual vier em mais de um documento/arquivo (ex.: duas apólices separadas da mesma seguradora), some o 'Valor total a ser pago' de CADA um desses documentos numa única linha — nunca use o valor de só um deles.",
      items: {
        type: "OBJECT",
        required: ["seguradora", "valorTexto"],
        properties: { seguradora: { type: "STRING" }, valorTexto: { type: "STRING", description: "Ex: 'R$ 375,92'" } },
      },
    },
    premiosNovo: {
      type: "ARRAY",
      description: "Prêmio mensal de cada proposta nova (uma linha por seguradora, se houver mais de uma).",
      items: {
        type: "OBJECT",
        required: ["seguradora", "valorTexto"],
        properties: { seguradora: { type: "STRING" }, valorTexto: { type: "STRING" } },
      },
    },
    previdenciaValorTexto: {
      type: "STRING",
      description: "Só quando há substituição por previdência: 'Contribuição Mensal Total' extraída do PDF da previdência, ex: 'R$ 100,00'.",
    },
    totalAtualTexto: { type: "STRING", description: "Soma de premiosAtual." },
    totalNovoTexto: { type: "STRING", description: "Soma de premiosNovo + previdenciaValorTexto (se houver)." },
    observacoes: { type: "STRING", description: "Só se houver algo relevante fora do padrão a avisar o cliente. Deixe vazio na maioria dos casos." },
    recomendacaoHeadline: { type: "STRING", description: "Frase curta de destaque, proporcional ao resultado real — não infle ganhos pequenos. Ex: 'Nova formatação'." },
    recomendacaoTexto: { type: "STRING", description: "1 frase complementando o headline com o motivo real, ex: 'coberturas vitalícias e carências menores por um prêmio equivalente'." },
  },
} as const;

const SYSTEM_PROMPT = `Você monta o "Comparativo de Seguros" da corretora MP Capital — uma tabela única cruzando a apólice atual com uma ou mais propostas de seguradoras novas, cobertura por cobertura. Leia todos os documentos recebidos com atenção e extraia os dados reais — nunca invente números.

Este comparativo é só uma das partes do documento final: o corretor também anexa, por fora, o espelho original da apólice atual e a tabela de evolução/resgate originais (sem reformatação) antes deste comparativo — por isso você NÃO precisa reproduzir essas duas seções aqui, só o comparativo em si. Mas você ainda deve LER esses documentos quando enviados, porque os valores deles alimentam as regras abaixo (em especial a regra de RESGATE).

Regras de negócio do comparativo (aprendidas revisão a revisão, sempre aplicar):
- Categorias comuns entre seguradoras (adapte à realidade de cada documento, incluindo só o que existir): Morte qualquer causa, Diagnóstico de doenças graves, Diária por internação hospitalar, Invalidez permanente por acidente, Cirurgias (e Cirurgias ampliada, se a apólice atual separar em duas linhas), Quebra de ossos / Rupturas e Fraturas, Assistência funeral.
- Apólice atual em múltiplos documentos: se o corretor enviar mais de um arquivo de apólice atual (ex.: duas apólices separadas da mesma seguradora, cada uma com suas próprias coberturas e seu próprio prêmio), trate os dois como UMA ÚNICA apólice atual pra fins de comparação — cruze as coberturas de AMBOS os documentos contra a(s) proposta(s) nova(s) (uma cobertura pode estar só num dos dois arquivos) e SOME o "Valor total a ser pago" de cada documento pra formar o prêmio atual total (premiosAtual/totalAtualTexto). Nunca use o prêmio de só um dos arquivos.
- Duas coberturas de doenças graves diferentes na mesma proposta (ex.: um rider "Plus"/genérico/"Modular" cobrindo várias condições e outro rider adicional específico só pra câncer — ex.: "Doenças Graves Vital" —, condicionado à contratação do primeiro): NÃO junte num valor só e NÃO só cite em detalhe — crie DUAS linhas de cobertura separadas em "coberturas": (1) "Diagnóstico de doenças graves" com o capital e detalhes do rider genérico normal; (2) uma segunda linha titulada "Diagnóstico de doenças graves — câncer (adicional)" com atualSemCobertura=true (a apólice atual raramente tem um produto equivalente — confirme lendo o documento atual) e do lado novo o capital e detalhes do rider adicional específico de câncer. Isso deixa claro pro cliente que a proposta nova tem DOIS produtos de doenças graves onde a atual só tem um.
- Cálculo de idade: sempre calcule a partir da idade do segurado na emissão da apólice (campo "Idade na Emissão", ou data de nascimento + data de emissão) — nunca copie uma idade que não veio de conta explícita.
- Morte qualquer causa: quando alguma das partes (atual OU nova) tiver uma parte temporária com duração explícita em anos (ex.: código "DR15G" = 15 anos, "Temporário Decrescente por 15 anos", "Term Life" com prazo) somada a uma parte base/vitalícia (ex.: código "WV20G" = 20 anos, "Vida e Saúde", "Whole Life"), o capital dessa parte (atualValor e/ou novoValor) é a SOMA das duas partes vigentes hoje. NÃO separe em subrows. Para CADA lado que tiver essa composição, calcule a idade em que a parte temporária termina (idade na emissão + duração do rider temporário em anos, ou a "idade até" informada explicitamente) e registre a redução como frase completa nesse mesmo lado (atualDetalhes e/ou novoDetalhes, sem parênteses), deixando explícito o valor que PERMANECE (a parte vitalícia), ex.: "Aos 54 anos a cobertura diminui para R$ 70.000,00 (parte vitalícia que permanece)." Aplique essa frase nos DOIS lados sempre que ambos tiverem composição vitalícia+temporária, não só no lado atual.
- Demais riders opcionais (doenças graves, diária por internação, invalidez, cirurgias, funeral, etc.): mesmo quando o código do rider indica um prazo curto (ex.: "por 5 anos") ou a apólice mostrar um campo "Seguro válido até"/data de fim próxima (ex.: 5 anos após a emissão), na prática esses riders renovam automaticamente até uma idade máxima — use sempre "(Encerra aos 75 anos)" como padrão fixo (não calcule a partir da idade do cliente nem da data "Seguro válido até" do documento — esse campo normalmente reflete só o ciclo de renovação do prêmio, não o fim real da cobertura). Só use uma idade diferente de 75 quando o documento disser explicitamente algo como "cobertura vitalícia" ou "até os X anos de idade" (não uma data de renovação). Exceções: "Quebra de ossos"/"Rupturas e Fraturas" e "Assistência funeral" normalmente não têm idade de término (funeral costuma ser vitalícia) — não inclua linha de idade de término pra essas duas.
- Demais detalhes (franquias, quantidade de patologias/procedimentos cobertos, exclusões) vão entre parênteses, uma por linha, ex: "(Franquia de 5 dias)", "(SEM Cobertura para ruptura de tendões e ligamentos)".
- Formate valores em reais no padrão brasileiro: "R$ 1.234,56". Diária hospitalar sem sufixo "/dia" no valor principal (só no detalhe, se relevante).
- Seja honesto: se a apólice atual tiver mais capital por um prêmio menor em alguma cobertura, isso deve aparecer claramente nos detalhes — nunca esconda um ponto em que o produto atual é melhor.

Regra de RESGATE e substituição por previdência — SÓ inclua a linha "Resgate" quando o texto do usuário disser explicitamente que o produto atual é resgatável. Se essa instrução não vier, NÃO inclua "Resgate" em "coberturas" mesmo que algum documento enviado (ex.: uma proposta de seguro de vida com componente de reserva/resgate próprio) contenha uma tabela de evolução de reserva — isso não é o mesmo que o produto ATUAL ter resgate:
- Produtos "Vida e Saúde" ou "Vida Inteira" da Prudential normalmente têm um valor de resgate crescente que aumenta a cada ano de apólice. Quando o corretor sinalizar que há resgate, inclua uma linha "Resgate" como a ÚLTIMA linha de "coberturas".
- Identifique a duração do produto resgatável na apólice atual (ex.: "Vida e Saude por 20 anos" = 20 anos). Se vier uma tabela de "evolução de valores" (colunas como "Até o Final do Ano", "Valor de Resgate", etc., em PDF ou foto), localize a linha cujo "Até o Final do Ano" bate com essa duração (ex.: linha "020") e use o valor da coluna "Valor de Resgate" dessa linha como atualValor da linha "Resgate". Calcule a idade do segurado nesse ano (idade na emissão + duração) para a frase de detalhe, no estilo: "Sem considerar atualização de inflação, R$ X é o valor de resgate aos Y anos. Lembrando que ao resgatar a apólice cancela e todas as coberturas acabam."
- Se vier um PDF de proposta de previdência (ex.: Icatu), use o valor de "Reserva Estimada" desse estudo como novoValor da linha "Resgate", com detalhe no estilo: "Sem considerar atualização de inflação, R$ X é o valor de resgate aos Y anos." e "Resgate independente da apólice de seguro. Você pode resgatar a qualquer momento SEM CANCELAR a proteção." Use a "Contribuição Mensal Total" desse PDF como previdenciaValorTexto (linha separada de previdência nos totais, somada ao total novo).
- Sem tabela de resgate ou proposta de previdência, ainda inclua a linha "Resgate" usando o que for possível extrair da própria apólice/proposta (e deixe os detalhes mais genéricos), mas nunca invente um valor de resgate que não veio de nenhum documento.

Se vier um campo de instruções extras do corretor, siga-o à risca — pode conter contexto sobre a situação financeira/familiar do cliente que muda a análise (ex.: excluir capital de morte do cônjuge quando o outro já é o pilar financeiro da família).

Responda SOMENTE com o JSON estruturado pedido, sem nenhum texto fora dele.`;

const IMAGE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function inlinePart(base64: string, mimeType: string) {
  return { inline_data: { mime_type: mimeType, data: base64 } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    return;
  }

  const {
    clienteNome,
    apolicePdfsBase64,
    apolicesSistema,
    clienteNascimentoIso,
    propostasPdfBase64,
    temResgate,
    tabelaResgateBase64,
    tabelaResgateMediaType,
    previdenciaPdfBase64,
    instrucoesExtras,
    dataPreparo,
    formato,
  } = req.body ?? {};

  const apolices: string[] = Array.isArray(apolicePdfsBase64) ? apolicePdfsBase64 : [];
  // Alternativa ao PDF: apólices que o cliente já tem no sistema (Nova Revisita).
  const apolicesDoSistema: ApoliceSistema[] = Array.isArray(apolicesSistema) ? apolicesSistema : [];
  const propostas: string[] = Array.isArray(propostasPdfBase64) ? propostasPdfBase64 : [];
  const formatoFinal: RevisitaFormato = formato === "vanguarda" || formato === "essencial" ? formato : "vitrine";

  if (!clienteNome || (apolices.length === 0 && apolicesDoSistema.length === 0) || propostas.length === 0 || !dataPreparo) {
    res.status(400).json({ error: "Faltam campos obrigatórios: clienteNome, apolicePdfsBase64 (1+) ou apolicesSistema (1+), propostasPdfBase64 (1+), dataPreparo." });
    return;
  }

  const userTextPartes = [
    `Cliente: ${clienteNome}`,
    `Data de preparo do documento: ${dataPreparo}`,
    instrucoesExtras ? `Instruções extras do corretor: ${instrucoesExtras}` : null,
    apolicesDoSistema.length > 0
      ? descreverApolicesSistema(clienteNome, typeof clienteNascimentoIso === "string" ? clienteNascimentoIso : null, apolicesDoSistema)
      : apolices.length > 1
      ? `Os primeiros ${apolices.length} documentos são da situação de seguro atual do cliente (podem ser apólices separadas, inclusive com números diferentes — trate-as como uma única "apólice atual" combinada: some os prêmios de todas e cruze as coberturas de todas contra a(s) proposta(s) nova(s)).`
      : "O primeiro documento é a apólice atual do cliente.",
    apolicesDoSistema.length > 0
      ? `Os ${propostas.length} documento(s) a seguir são proposta(s) de seguradora(s) nova(s).`
      : `Em seguida vêm ${propostas.length} documento(s) de proposta(s) de seguradora(s) nova(s).`,
    temResgate
      ? "O produto atual do cliente é resgatável (Vida Inteira / Vida e Saúde) e será substituído por uma previdência — siga a regra de RESGATE e substituição por previdência. " +
        (tabelaResgateBase64 ? "Em seguida vem a tabela de evolução/resgate da apólice atual (pode ser PDF ou uma foto/print da tabela). " : "") +
        (previdenciaPdfBase64 ? "Por último vem o documento da proposta de previdência." : "")
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const parts: unknown[] = [{ text: userTextPartes }];
  for (const a of apolices) parts.push(inlinePart(a, "application/pdf"));
  for (const p of propostas) parts.push(inlinePart(p, "application/pdf"));
  if (temResgate && tabelaResgateBase64) {
    const mime = IMAGE_MEDIA_TYPES.has(tabelaResgateMediaType) ? tabelaResgateMediaType : "application/pdf";
    parts.push(inlinePart(tabelaResgateBase64, mime));
  }
  if (temResgate && previdenciaPdfBase64) parts.push(inlinePart(previdenciaPdfBase64, "application/pdf"));

  try {
    const chamarGemini = () =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: REVISITA_RESPONSE_SCHEMA,
            maxOutputTokens: 8000,
          },
        }),
      });

    // O Gemini gratuito às vezes fica sobrecarregado (503) — tenta de novo
    // algumas vezes com espera crescente antes de desistir.
    let geminiRes = await chamarGemini();
    for (let tentativa = 0; !geminiRes.ok && (geminiRes.status === 503 || geminiRes.status === 429) && tentativa < 3; tentativa++) {
      await new Promise((r) => setTimeout(r, 1500 * (tentativa + 1)));
      geminiRes = await chamarGemini();
    }

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      res.status(502).json({ error: `Erro na API do Gemini (${geminiRes.status}): ${errBody}` });
      return;
    }

    const geminiJson = await geminiRes.json();
    const textoResposta: string | undefined = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoResposta) {
      res.status(502).json({ error: "O Gemini não retornou os dados estruturados esperados.", detalhe: geminiJson });
      return;
    }

    const extraido = JSON.parse(textoResposta) as Omit<RevisitaDados, "clienteNome">;
    // Trava determinística: o prompt pede pra IA só incluir "Resgate" quando
    // temResgate vier marcado, mas o modelo às vezes inclui mesmo assim (ex.:
    // quando a proposta nova tem uma tabela de reserva própria) — não dá pra
    // confiar só no prompt aqui, então filtra no código.
    if (!temResgate) {
      extraido.coberturas = extraido.coberturas.filter((c) => !/resgate/i.test(c.titulo));
    }
    const dados: RevisitaDados = aplicarCatalogo({ clienteNome, ...extraido });
    const html = renderRevisitaHtml(dados, formatoFinal);

    res.status(200).json({ dados, html, formato: formatoFinal });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
