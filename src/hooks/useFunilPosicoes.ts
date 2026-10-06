import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { FunilKey } from "@/lib/funis";
import type { FunilPosicao } from "@/lib/types";

/** Todas as posições de clientes nos funis (dataset pequeno, buscado de uma vez). */
export function useFunilPosicoes() {
  return useQuery({
    queryKey: qk.funilPosicoes.all,
    queryFn: async () => {
      const { data, error } = await supabase.from("funil_posicoes").select("*");
      if (error) throw error;
      return (data ?? []) as FunilPosicao[];
    },
  });
}

interface MoverInput {
  clienteIds: string[];
  funil: FunilKey;
  /** null = tira o cliente deste funil ("Sem estágio"). */
  estagioId: string | null;
}

/** Move um ou mais clientes para uma coluna de um funil (ou tira do funil). */
export function useMoverNoFunil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clienteIds, funil, estagioId }: MoverInput) => {
      if (clienteIds.length === 0) return;
      if (estagioId) {
        const updated_at = new Date().toISOString();
        const { error } = await supabase
          .from("funil_posicoes")
          .upsert(clienteIds.map((cliente_id) => ({ cliente_id, funil, estagio_id: estagioId, updated_at })));
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("funil_posicoes")
          .delete()
          .eq("funil", funil)
          .in("cliente_id", clienteIds);
        if (error) throw error;
      }
    },
    onMutate: async ({ clienteIds, funil, estagioId }) => {
      await qc.cancelQueries({ queryKey: qk.funilPosicoes.all });
      const previous = qc.getQueryData<FunilPosicao[]>(qk.funilPosicoes.all);
      if (previous) {
        const ids = new Set(clienteIds);
        const next = previous.filter((p) => !(p.funil === funil && ids.has(p.cliente_id)));
        if (estagioId) {
          const updated_at = new Date().toISOString();
          for (const cliente_id of clienteIds) next.push({ cliente_id, funil, estagio_id: estagioId, updated_at });
        }
        qc.setQueryData(qk.funilPosicoes.all, next);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.funilPosicoes.all, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.funilPosicoes.all });
    },
  });
}
