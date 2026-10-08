import { formatarMoeda, paraNumero } from "@/lib/format";
import { limparNomeCobertura } from "@/lib/apolice-prudential-template";
import { ehCoberturaBase } from "@/lib/seguros-taxonomia";
import type { Cobertura } from "@/lib/types";

/** Coberturas ativas de uma apólice, com capital segurado e prêmio mensal, para apoiar a montagem da revisita. */
export function CoberturasDaApolice({ coberturas }: { coberturas: Cobertura[] }) {
  const ativas = coberturas
    .filter((c) => c.status === "ativa")
    .sort((a, b) => Number(ehCoberturaBase(b)) - Number(ehCoberturaBase(a)) || a.nome_cobertura.localeCompare(b.nome_cobertura));

  if (ativas.length === 0) return <p className="px-3 pb-2 text-xs text-muted-foreground">Nenhuma cobertura ativa cadastrada nesta apólice.</p>;

  const totalPremio = ativas.reduce((s, c) => s + paraNumero(c.premio_mensal), 0);
  const totalCapital = ativas.reduce((s, c) => s + paraNumero(c.capital_segurado), 0);
  const semCapital = ativas.filter((c) => !(paraNumero(c.capital_segurado) > 0)).length;

  return (
    <div className="px-3 pb-2.5">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="py-1 pr-2 font-semibold">Cobertura</th>
            <th className="px-2 py-1 text-right font-semibold">Capital segurado</th>
            <th className="py-1 pl-2 text-right font-semibold">Prêmio mensal</th>
          </tr>
        </thead>
        <tbody>
          {ativas.map((c) => {
            const capital = paraNumero(c.capital_segurado);
            return (
              <tr key={c.id} className="border-t border-border/60">
                <td className="py-1 pr-2 font-medium" title={c.nome_cobertura}>
                  {limparNomeCobertura(c.nome_cobertura)}
                  {ehCoberturaBase(c) && <span className="ml-1.5 rounded bg-primary/10 px-1 py-px text-[9px] font-semibold uppercase text-primary">básica</span>}
                </td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">
                  {capital > 0 ? formatarMoeda(capital) : <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-800">sem capital</span>}
                </td>
                <td className="py-1 pl-2 text-right font-mono tabular-nums">{formatarMoeda(paraNumero(c.premio_mensal))}</td>
              </tr>
            );
          })}
          <tr className="border-t font-semibold">
            <td className="py-1 pr-2">Total das coberturas</td>
            <td className="px-2 py-1 text-right font-mono tabular-nums">{formatarMoeda(totalCapital)}</td>
            <td className="py-1 pl-2 text-right font-mono tabular-nums">{formatarMoeda(totalPremio)}</td>
          </tr>
        </tbody>
      </table>
      {semCapital > 0 && (
        <p className="mt-1 text-[10px] text-amber-700">
          {semCapital} cobertura{semCapital > 1 ? "s" : ""} sem capital cadastrado — confira antes de montar a comparação.
        </p>
      )}
    </div>
  );
}
