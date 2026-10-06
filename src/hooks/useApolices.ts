import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { ApoliceInsert, ApoliceUpdate, ApoliceWithCoberturas } from "@/lib/types";

export function useApolices(clienteId: string | undefined) {
  return useQuery({
    queryKey: qk.apolices.byCliente(clienteId ?? ""),
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apolices")
        .select("*, coberturas(*)")
        .eq("cliente_id", clienteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ApoliceWithCoberturas[];
    },
  });
}

export function useCreateApolice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApoliceInsert) => {
      const { data, error } = await supabase.from("apolices").insert(input).select().maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.apolices.byCliente(vars.cliente_id) });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}

export function useUpdateApolice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cliente_id, ...input }: ApoliceUpdate & { id: string; cliente_id: string }) => {
      const payload = { ...input, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from("apolices").update(payload).eq("id", id).select().maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.apolices.byCliente(vars.cliente_id) });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}

export function useDeleteApolice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clienteId }: { id: string; clienteId: string }) => {
      const { error } = await supabase.from("apolices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { clienteId }) => {
      qc.invalidateQueries({ queryKey: qk.apolices.byCliente(clienteId) });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}
