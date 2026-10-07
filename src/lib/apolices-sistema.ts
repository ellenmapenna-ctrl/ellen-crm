// Descreve, em texto, as apólices que o cliente já tem no sistema para a IA da
// Nova Revisita usar como "apólice atual" no lugar do PDF. Sem imports com
// alias ("@/"): este arquivo também é usado pela function serverless da Vercel.

export interface CoberturaSistema {
  nome: string;
  tipo: string;
  status: string;
  capital: number;
  premioMensal: number;
}

export interface ApoliceSistema {
  numero: string | null;
  seguradora: string | null;
  status: string;
  dataEmissao: string | null;
  vencimento: string | null;
  premioMensalTotal: number;
  capitalTotal: number;
  coberturas: CoberturaSistema[];
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function data(iso: string | null): string {
  if (!iso) return "não informada";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/** Texto enviado à IA com todas as apólices selecionadas, só com as coberturas ainda ativas. */
export function descreverApolicesSistema(clienteNome: string, nascimentoIso: string | null, apolices: ApoliceSistema[]): string {
  const linhas: string[] = [
    `DADOS DA APÓLICE ATUAL (vindos do sistema do corretor, não de PDF) — cliente ${clienteNome}, nascimento ${data(nascimentoIso)}.`,
    apolices.length > 1
      ? `São ${apolices.length} apólices separadas: trate-as como UMA ÚNICA apólice atual combinada — some os prêmios de todas e cruze as coberturas de todas contra a(s) proposta(s) nova(s).`
      : "É uma única apólice atual.",
    "Use a data de nascimento e a data de emissão abaixo para calcular a idade na emissão. Valores já estão em reais. Estas são todas as coberturas ativas; coberturas canceladas foram omitidas.",
    "Atenção: o capital de cada cobertura é o \"Valor do Benefício\" do relatório da seguradora (na Renda Hospitalar é o valor da diária). Capital R$ 0,00 significa que o valor não foi informado — não invente um valor nesses casos, deixe claro em detalhes. O nome das coberturas pode não trazer o prazo (\"por N anos\"); nesse caso não presuma o prazo — use a tabela de evolução/resgate quando enviada.",
  ];
  apolices.forEach((a, i) => {
    linhas.push(
      "",
      `Apólice ${i + 1}: nº ${a.numero ?? "sem número"} · seguradora ${a.seguradora ?? "não informada"} · emissão ${data(a.dataEmissao)} · vencimento ${data(a.vencimento)} · prêmio mensal total ${moeda.format(a.premioMensalTotal)} · capital total ${moeda.format(a.capitalTotal)}`,
    );
    const ativas = a.coberturas.filter((c) => c.status === "ativa");
    if (ativas.length === 0) linhas.push("  (sem coberturas ativas cadastradas)");
    for (const c of ativas) {
      linhas.push(`  - ${c.nome} (${c.tipo === "base" ? "cobertura básica" : "adicional"}): capital ${moeda.format(c.capital)} · prêmio mensal ${moeda.format(c.premioMensal)}`);
    }
  });
  return linhas.join("\n");
}
