import { useMemo, useState } from "react";
import { useFunilPosicoes, useMoverNoFunil } from "@/hooks/useFunilPosicoes";
import { ehFunilKey, type FunilKey, type FunisDoCliente } from "@/lib/funis";

/**
 * Estado dos seletores de funil num formulário de cliente: guarda as
 * alterações localmente e só grava em funil_posicoes no `salvar`.
 */
export function useFunisDoClienteForm(clienteId: string | null | undefined) {
  const { data: posicoes } = useFunilPosicoes();
  const mover = useMoverNoFunil();
  const [alterados, setAlterados] = useState<Partial<Record<FunilKey, string | null>>>({});

  const salvos = useMemo(() => {
    const v: FunisDoCliente = {};
    if (!clienteId) return v;
    for (const p of posicoes ?? []) {
      if (p.cliente_id === clienteId && ehFunilKey(p.funil)) v[p.funil] = p.estagio_id;
    }
    return v;
  }, [posicoes, clienteId]);

  const valores = useMemo(() => {
    const v: FunisDoCliente = { ...salvos };
    for (const [f, id] of Object.entries(alterados) as [FunilKey, string | null][]) {
      if (id) v[f] = id;
      else delete v[f];
    }
    return v;
  }, [salvos, alterados]);

  const onChange = (funil: FunilKey, estagioId: string | null) =>
    setAlterados((a) => ({ ...a, [funil]: estagioId }));

  const reset = () => setAlterados({});

  const salvar = async (idCliente: string) => {
    for (const [funil, estagioId] of Object.entries(alterados) as [FunilKey, string | null][]) {
      if ((estagioId ?? undefined) === salvos[funil]) continue;
      await mover.mutateAsync({ clienteIds: [idCliente], funil, estagioId });
    }
    reset();
  };

  return { salvos, valores, onChange, salvar, reset };
}
