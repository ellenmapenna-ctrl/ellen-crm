import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { DemandaInsert, DemandaUpdate, DemandaWithCliente } from "@/lib/types";

/** Todas as demandas (dataset pequeno, uso interno), com o cliente vinculado carregado junto. */
export function useDemandas() {
  return useQuery({
    queryKey: qk.demandas.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select("*, cliente:clientes(id, nome_completo)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DemandaWithCliente[];
    },
  });
}

/** Quantidade de demandas em aberto (badge do menu). */
export function useDemandasAbertasCount() {
  return useQuery({
    queryKey: [...qk.demandas.all, "abertas-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("demandas")
        .select("id", { count: "exact", head: true })
        .neq("status", "concluida");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useCreateDemanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DemandaInsert) => {
      const { data, error } = await supabase.from("demandas").insert(input).select().maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.demandas.all });
    },
  });
}

export function useUpdateDemanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: DemandaUpdate & { id: string }) => {
      const payload = { ...input, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from("demandas").update(payload).eq("id", id).select().maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.demandas.all });
    },
  });
}

export function useDeleteDemanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demandas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.demandas.all });
    },
  });
}
