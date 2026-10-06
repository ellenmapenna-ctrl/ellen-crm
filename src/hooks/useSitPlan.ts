import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { SitplanItemWithCliente } from "@/lib/types";

/** Itens do SitPlan & TA de um dia específico (yyyy-mm-dd), com o cliente carregado junto, ordenados pela ordem manual. */
export function useSitPlanItens(data: string) {
  return useQuery({
    queryKey: qk.sitplan.byData(data),
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("sitplan_itens")
        .select("*, cliente:clientes(id, nome_completo, celular, cidade, uf, email, data_nascimento)")
        .eq("data", data)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (rows ?? []) as unknown as SitplanItemWithCliente[];
    },
  });
}

/** Quantos itens tem no SitPlan de um dia — usado no badge do menu lateral. */
export function useSitPlanCount(data: string) {
  return useQuery({
    queryKey: qk.sitplan.countByData(data),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("sitplan_itens")
        .select("id", { count: "exact", head: true })
        .eq("data", data);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Adiciona clientes ao SitPlan de um dia (ignora quem já está na lista desse dia). */
export function useAddClientesAoSitPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clienteIds, data }: { clienteIds: string[]; data: string }) => {
      // Novos clientes entram no fim da fila de prioridade, depois de quem já está na lista.
      const { data: existentes, error: errBusca } = await supabase
        .from("sitplan_itens")
        .select("ordem")
        .eq("data", data)
        .order("ordem", { ascending: false })
        .limit(1);
      if (errBusca) throw errBusca;
      const proximaOrdem = (existentes?.[0]?.ordem ?? -1) + 1;
      const rows = clienteIds.map((cliente_id, i) => ({ cliente_id, data, ordem: proximaOrdem + i }));
      const { error } = await supabase
        .from("sitplan_itens")
        .upsert(rows, { onConflict: "cliente_id,data", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.sitplan.byData(vars.data) });
      qc.invalidateQueries({ queryKey: qk.sitplan.countByData(vars.data) });
    },
  });
}

/** Atualiza o "Status da ligação" de um item do SitPlan. */
export function useAtualizarStatusLigacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data, statusLigacao }: { id: string; data: string; statusLigacao: string | null }) => {
      const { error } = await supabase
        .from("sitplan_itens")
        .update({ status_ligacao: statusLigacao, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.sitplan.byData(vars.data) });
    },
  });
}

/** Reordena a prioridade de contato dos itens do SitPlan de um dia (grava a nova `ordem`). */
export function useReordenarSitPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, itens }: { data: string; itens: { id: string; ordem: number }[] }) => {
      await Promise.all(itens.map((it) => supabase.from("sitplan_itens").update({ ordem: it.ordem }).eq("id", it.id)));
    },
    onMutate: async ({ data, itens }) => {
      await qc.cancelQueries({ queryKey: qk.sitplan.byData(data) });
      const previous = qc.getQueryData<SitplanItemWithCliente[]>(qk.sitplan.byData(data));
      if (previous) {
        const ordemPorId = new Map(itens.map((it) => [it.id, it.ordem]));
        const next = previous
          .map((it) => (ordemPorId.has(it.id) ? { ...it, ordem: ordemPorId.get(it.id)! } : it))
          .sort((a, b) => a.ordem - b.ordem);
        qc.setQueryData(qk.sitplan.byData(data), next);
      }
      return { previous, data };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.sitplan.byData(ctx.data), ctx.previous);
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: qk.sitplan.byData(vars.data) });
    },
  });
}

/** Remove um cliente do SitPlan de um dia (não afeta o cadastro do cliente). */
export function useRemoverDoSitPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; data: string }) => {
      const { error } = await supabase.from("sitplan_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.sitplan.byData(vars.data) });
      qc.invalidateQueries({ queryKey: qk.sitplan.countByData(vars.data) });
    },
  });
}
