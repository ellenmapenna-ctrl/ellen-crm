import { useState } from "react";
import { toast } from "sonner";
import { Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatarData, formatarMoeda, paraNumero } from "@/lib/format";
import { idadeAtualDetalhada } from "@/lib/aniversario";
import { abrirWhatsapp } from "@/lib/whatsapp";
import { COBERTURAS_CANONICAS, RIDERS_INCLUSOS, coberturaCorrespondeARotulo, ehCoberturaBase } from "@/lib/seguros-taxonomia";
import type { ApoliceWithCoberturas, Cliente, Cobertura } from "@/lib/types";

interface Props {
  cliente: Pick<Cliente, "nome_completo" | "cliente_desde" | "data_nascimento" | "celular">;
  apolice: ApoliceWithCoberturas;
}

type EstadoLinha = "ativa" | "cancelada" | "incluso" | "inativa" | "extra";

interface LinhaEspelho {
  rotulo: string;
  estado: EstadoLinha;
  capital: number;
  premio: number;
}

/** Formata um valor monetário; retorna "—" quando o valor é nulo/zero. */
function formatarValorOuTraco(valor: number): string {
  if (!valor) return "—";
  return formatarMoeda(valor);
}

/** Extrai só o ano de uma data ISO (yyyy-mm-dd), sem depender de timezone. */
function anoDe(dataIso: string | null | undefined): string | null {
  if (!dataIso) return null;
  return dataIso.slice(0, 4);
}

/**
 * Monta as 13 linhas fixas do espelho a partir das coberturas reais da
 * apólice: soma valores quando mais de uma cobertura bate no mesmo rótulo,
 * marca "incluso" para riders sem linha própria quando há cobertura básica
 * ativa (mostrando o capital segurado da cobertura básica, já que o rider
 * não tem capital próprio no Excel), e devolve à parte qualquer cobertura
 * real sem rótulo correspondente (nunca some, aparece como "extra").
 */
function montarLinhasEspelho(coberturas: Cobertura[]): { fixas: LinhaEspelho[]; extras: LinhaEspelho[] } {
  const usadas = new Set<string>();
  const basicaAtiva = coberturas.find((c) => ehCoberturaBase(c) && c.status === "ativa");
  const capitalBasica = basicaAtiva ? paraNumero(basicaAtiva.capital_segurado) : 0;

  const fixas = COBERTURAS_CANONICAS.map(({ rotulo }) => {
    const correspondentes = coberturas.filter((c) => coberturaCorrespondeARotulo(c.nome_cobertura, rotulo));
    correspondentes.forEach((c) => usadas.add(c.id));

    if (correspondentes.length > 0) {
      const algumaAtiva = correspondentes.some((c) => c.status === "ativa");
      const capital = correspondentes.reduce((soma, c) => soma + paraNumero(c.capital_segurado), 0);
      const premio = correspondentes.reduce((soma, c) => soma + paraNumero(c.premio_mensal), 0);
      return { rotulo, estado: algumaAtiva ? "ativa" : "cancelada", capital, premio } as LinhaEspelho;
    }

    if (RIDERS_INCLUSOS.includes(rotulo) && basicaAtiva) {
      return { rotulo, estado: "incluso", capital: capitalBasica, premio: 0 } as LinhaEspelho;
    }

    return { rotulo, estado: "inativa", capital: 0, premio: 0 } as LinhaEspelho;
  });

  const extras: LinhaEspelho[] = coberturas
    .filter((c) => !usadas.has(c.id))
    .map((c) => ({
      rotulo: c.nome_cobertura,
      estado: c.status === "cancelada" ? "cancelada" : "extra",
      capital: paraNumero(c.capital_segurado),
      premio: paraNumero(c.premio_mensal),
    }));

  return { fixas, extras };
}

export function ApoliceResumoCard({ cliente, apolice }: Props) {
  const [copiando, setCopiando] = useState(false);
  const coberturas = apolice.coberturas ?? [];
  const { fixas, extras } = montarLinhasEspelho(coberturas);
  const todasLinhas = [...fixas, ...extras];

  const subtotalOpcionais = coberturas
    .filter((c) => !ehCoberturaBase(c) && c.status === "ativa")
    .reduce((soma, c) => soma + paraNumero(c.premio_mensal), 0);
  const temOpcionais = coberturas.some((c) => !ehCoberturaBase(c));

  const idade = idadeAtualDetalhada(cliente.data_nascimento);
  const anoCliente = anoDe(cliente.cliente_desde);
  // Não temos "quem importou" no modelo de dados — usamos a data em que a
  // apólice entrou no sistema como aproximação de "Importado em".
  const importadoEm = formatarData(apolice.created_at?.slice(0, 10));

  const resumoTexto = () => {
    const linhas = todasLinhas
      .filter((l) => l.estado !== "inativa")
      .map((l) => `${l.rotulo}: ${l.estado === "incluso" ? "incluso" : formatarValorOuTraco(l.premio)}`);
    return [
      cliente.nome_completo,
      `Apólice: ${apolice.numero_apolice || "sem número"}${apolice.seguradora ? ` · ${apolice.seguradora}` : ""}`,
      ...linhas,
      `Total: ${formatarMoeda(paraNumero(apolice.premio_mensal_total))}`,
    ].join("\n");
  };

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(resumoTexto());
      toast.success("Resumo copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    } finally {
      setCopiando(false);
    }
  };

  const handleEnviar = () => {
    abrirWhatsapp(cliente.celular, resumoTexto());
  };

  return (
    <Card className="overflow-hidden rounded-[8px] border-mirror-rowBorder p-0 text-mirror-text shadow-[0_1px_2px_rgba(20,32,74,0.06)]">
      <p className="px-3.5 pt-2.5 text-right text-xs italic text-[#4a4d5a]">
        Cliente desde: <strong className="font-semibold not-italic text-mirror-text">{anoCliente ?? "—"}</strong>
      </p>

      <h3 className="mx-2.5 border-y-[3px] border-mirror-navy py-1.5 text-center text-xl font-extrabold uppercase tracking-tight text-mirror-navyDeep">
        {cliente.nome_completo}
      </h3>

      <div className="flex flex-wrap items-center justify-center gap-x-2 px-2.5 pb-0.5 pt-1.5 text-center text-[13px]">
        <span>Nascimento: <strong>{formatarData(cliente.data_nascimento)}</strong></span>
        {idade && (
          <>
            <span className="text-mirror-rail">|</span>
            <span>Idade: <strong>{idade.anos} anos e {idade.meses} meses</strong></span>
          </>
        )}
      </div>

      <p className="flex items-baseline justify-between gap-2 px-3 pb-1 pt-1.5 text-[11px] font-semibold text-mirror-link">
        <span>Importado em {importadoEm}</span>
        <span>Apólice: {apolice.numero_apolice || "sem número"}</span>
      </p>

      <div className="grid grid-cols-[1fr_8rem_7rem] bg-mirror-navy text-[10.5px] font-bold uppercase tracking-wide text-mirror-navyForeground sm:grid-cols-[1fr_8.5rem_7.5rem]">
        <div className="px-2.5 py-2">Tipo de Cobertura</div>
        <div className="px-2.5 py-2 text-center">Capital Segurado</div>
        <div className="px-2.5 py-2 text-center">Prêmio Mensal</div>
      </div>

      <div>
        {todasLinhas.map((linha, i) => {
          const inativa = linha.estado === "inativa";
          const incluso = linha.estado === "incluso";
          const cancelada = linha.estado === "cancelada";
          return (
            <div
              key={`${linha.rotulo}-${i}`}
              className={cn(
                "grid grid-cols-[1fr_8rem_7rem] border-b border-mirror-rowBorder text-sm sm:grid-cols-[1fr_8.5rem_7.5rem]",
                i % 2 === 1 && "bg-mirror-rowAlt",
                (inativa || cancelada) && "italic text-[#9599ab]",
                cancelada && "line-through"
              )}
            >
              <div className="py-1.5 pl-[22px] pr-2.5 font-semibold">{linha.rotulo}</div>
              <div className="px-2.5 py-1.5 text-center font-mono tabular-nums">
                {inativa ? "-" : formatarValorOuTraco(linha.capital)}
              </div>
              <div className={cn("px-2.5 py-1.5 text-center font-mono tabular-nums", incluso && "italic text-[#6b7080]")}>
                {inativa ? "-" : incluso ? "incluso" : formatarValorOuTraco(linha.premio)}
              </div>
            </div>
          );
        })}
      </div>

      {temOpcionais && (
        <div className="flex items-center justify-between border-b border-mirror-rowBorder px-3 py-2 text-xs italic text-[#4a4d5a]">
          <span>Sub-total Opcionais</span>
          <strong className="not-italic text-mirror-text">{formatarMoeda(subtotalOpcionais)}</strong>
        </div>
      )}

      <div className="flex items-center justify-between bg-mirror-navy px-3.5 py-2.5 text-sm font-bold text-mirror-navyForeground">
        <span>Total</span>
        <span className="font-mono tabular-nums">{formatarMoeda(paraNumero(apolice.premio_mensal_total))}</span>
      </div>

      <p className="px-3.5 py-2.5 text-center text-[10.5px] italic text-[#8a8d9a]">
        Trata-se apenas de um simples resumo e não substitui as informações oficiais das seguradoras.
      </p>

      <div className="flex justify-end gap-2 border-t bg-card p-3">
        <Button variant="outline" size="sm" disabled={copiando} onClick={() => { setCopiando(true); handleCopiar(); }}>
          <Copy className="size-3.5" />
          Copiar
        </Button>
        <Button size="sm" onClick={handleEnviar} disabled={!cliente.celular}>
          <Send className="size-3.5" />
          Enviar ao cliente
        </Button>
      </div>
    </Card>
  );
}
