import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { Cobertura, CoberturaInsert, CoberturaUpdate } from "@/lib/types";

/**
 * Mantém `apolices.premio_mensal_total` em sincronia com a soma das coberturas
 * ativas após qualquer criação/edição/exclusão manual de cobertura — o mesmo
 * cálculo que o importador já faz em lote (`handleImportar`), aqui aplicado
 * também ao fluxo manual (`CoberturaFormDialog`), que antes deixava o total
 * da apólice parado no valor de quando ela foi criada/importada.
 */
async function recalcularPremioApolice(apoliceId: string): Promise<void> {
  const { data, error } = await supabase
    .from("coberturas")
    .select("premio_mensal, status")
    .eq("apolice_id", apoliceId);
  if (error) return; // recálculo é best-effort — não deve quebrar o fluxo principal
  const premio_mensal_total = (data ?? [])
    .filter((c) => c.status === "ativa")
    .reduce((soma, c) => soma + Number(c.premio_mensal ?? 0), 0);
  await supabase
    .from("apolices")
    .update({ premio_mensal_total, updated_at: new Date().toISOString() })
    .eq("id", apoliceId);
}

export function useCoberturas(apoliceId: string | undefined) {
  return useQuery({
    queryKey: qk.coberturas.byApolice(apoliceId ?? ""),
    enabled: !!apoliceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coberturas")
        .select("*")
        .eq("apolice_id", apoliceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Cobertura[];
    },
  });
}

export function useCreateCobertura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CoberturaInsert) => {
      const { data, error } = await supabase.from("coberturas").insert(input).select().maybeSingle();
      if (error) throw error;
      await recalcularPremioApolice(input.apolice_id);
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.coberturas.byApolice(vars.apolice_id) });
      // A apólice embarca coberturas no detalhe do cliente:
      qc.invalidateQueries({ queryKey: qk.apolices.all });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}

export function useUpdateCobertura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, apolice_id, ...input }: CoberturaUpdate & { id: string; apolice_id: string }) => {
      const payload = { ...input, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from("coberturas").update(payload).eq("id", id).select().maybeSingle();
      if (error) throw error;
      await recalcularPremioApolice(apolice_id);
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.coberturas.byApolice(vars.apolice_id) });
      qc.invalidateQueries({ queryKey: qk.apolices.all });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}

export function useDeleteCobertura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, apoliceId }: { id: string; apoliceId: string }) => {
      const { error } = await supabase.from("coberturas").delete().eq("id", id);
      if (error) throw error;
      await recalcularPremioApolice(apoliceId);
    },
    onSuccess: (_d, { apoliceId }) => {
      qc.invalidateQueries({ queryKey: qk.coberturas.byApolice(apoliceId) });
      qc.invalidateQueries({ queryKey: qk.apolices.all });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}
