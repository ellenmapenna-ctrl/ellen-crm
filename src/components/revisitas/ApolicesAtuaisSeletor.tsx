import { useMemo, useState } from "react";
import { CoberturasDaApolice } from "@/components/revisitas/CoberturasDaApolice";
import { Checkbox } from "@/components/ui/checkbox";
import { formatarMoeda, paraNumero } from "@/lib/format";
import { diaDoVencimento } from "@/lib/vencimentos";
import { agruparApolicesAtivas } from "@/lib/apolices-cliente";
import type { ApoliceWithCoberturas } from "@/lib/types";

interface Props {
  apolices: ApoliceWithCoberturas[];
  selecionadas: string[];
  onChange: (ids: string[]) => void;
}

export function ApolicesAtuaisSeletor({ apolices, selecionadas, onChange }: Props) {
  const grupos = useMemo(() => agruparApolicesAtivas(apolices), [apolices]);
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const alternarCoberturas = (id: string) =>
    setRecolhidas((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const naoAtivas = apolices.length - grupos.reduce((n, g) => n + g.apolices.length, 0);

  const alternarApolice = (id: string, marcada: boolean) =>
    onChange(marcada ? [...selecionadas, id] : selecionadas.filter((x) => x !== id));

  const alternarGrupo = (ids: string[], marcado: boolean) =>
    onChange(marcado ? [...new Set([...selecionadas, ...ids])] : selecionadas.filter((x) => !ids.includes(x)));

  if (grupos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este cliente não tem apólice ativa no sistema{naoAtivas > 0 ? ` (${naoAtivas} cancelada${naoAtivas > 1 ? "s" : ""})` : ""}. Envie o PDF da apólice atual na importação abaixo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {grupos.map((g) => {
        const ids = g.apolices.map((a) => a.id);
        const todas = ids.every((id) => selecionadas.includes(id));
        const algumas = ids.some((id) => selecionadas.includes(id));
        return (
          <div key={g.seguradora} className="rounded-lg border bg-white">
            <label className="flex cursor-pointer items-center gap-2.5 border-b bg-muted/40 px-3 py-2 text-sm font-semibold">
              <Checkbox
                checked={todas ? true : algumas ? "indeterminate" : false}
                onCheckedChange={(v) => alternarGrupo(ids, v === true)}
              />
              {g.seguradora}
              <span className="font-normal text-muted-foreground">
                · {g.apolices.length} apólice{g.apolices.length > 1 ? "s" : ""} ativa{g.apolices.length > 1 ? "s" : ""}
              </span>
            </label>
            <div className="divide-y">
              {g.apolices.map((a) => {
                const ativas = (a.coberturas ?? []).filter((c) => c.status === "ativa").length;
                const aberta = !recolhidas.has(a.id);
                return (
                  <div key={a.id}>
                    <label className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                      <Checkbox checked={selecionadas.includes(a.id)} onCheckedChange={(v) => alternarApolice(a.id, v === true)} />
                      <span className="font-mono text-xs font-semibold">{a.numero_apolice || "sem número"}</span>
                      <span className="text-xs text-muted-foreground">{ativas} cobertura{ativas === 1 ? "" : "s"}</span>
                      <span className="text-xs text-muted-foreground">Prêmio {formatarMoeda(paraNumero(a.premio_mensal_total))}/mês</span>
                      <span className="text-xs text-muted-foreground">Capital {formatarMoeda(paraNumero(a.capital_segurado_total))}</span>
                      {diaDoVencimento(a.proximo_vencimento_premio ?? null) && (
                        <span className="text-xs text-muted-foreground">Dia de vencimento {diaDoVencimento(a.proximo_vencimento_premio ?? null)}</span>
                      )}
                    </label>
                    <div className="px-3 pb-1">
                      <button type="button" className="text-[11px] text-primary underline" onClick={() => alternarCoberturas(a.id)}>
                        {aberta ? "Ocultar coberturas" : "Ver coberturas"}
                      </button>
                    </div>
                    {aberta && <CoberturasDaApolice coberturas={a.coberturas ?? []} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {naoAtivas > 0 && <p className="text-xs text-muted-foreground">{naoAtivas} apólice{naoAtivas > 1 ? "s" : ""} cancelada{naoAtivas > 1 ? "s" : ""}/suspensa{naoAtivas > 1 ? "s" : ""} não aparece{naoAtivas > 1 ? "m" : ""} aqui.</p>}
    </div>
  );
}
