import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { Tag, TagInsert, TagUpdate } from "@/lib/types";

export function useTags() {
  return useQuery({
    queryKey: qk.tags.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TagInsert) => {
      const { data, error } = await supabase.from("tags").insert(input).select().maybeSingle();
      if (error) throw error;
      return data as Tag | null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tags.all });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: TagUpdate & { id: string }) => {
      const { data, error } = await supabase.from("tags").update(input).eq("id", id).select().maybeSingle();
      if (error) throw error;
      return data as Tag | null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tags.all });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tags.all });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}

/** Garante que uma tag com o nome informado existe; cria com a cor padrão se faltar. Retorna a tag. */
export function useEnsureTag() {
  const createTag = useCreateTag();
  return useMutation({
    mutationFn: async ({ nome, cor }: { nome: string; cor: string }) => {
      const { data: existing } = await supabase
        .from("tags")
        .select("*")
        .eq("nome", nome)
        .maybeSingle();
      if (existing) return existing as Tag;
      const created = await createTag.mutateAsync({ nome, cor });
      return created as Tag;
    },
  });
}

/** Vincula uma tag a vários clientes de uma vez (ignora duplicatas). */
export function useBulkTagClientes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clienteIds, tagId }: { clienteIds: string[]; tagId: string }) => {
      const rows = clienteIds.map((cliente_id) => ({ cliente_id, tag_id: tagId }));
      const { error } = await supabase.from("cliente_tags").upsert(rows, { onConflict: "cliente_id,tag_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clientes.all });
      qc.invalidateQueries({ queryKey: qk.clienteTags.all });
    },
  });
}

/** Vincula/remove uma tag de um cliente específico. */
export function useAddTagToCliente(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("cliente_tags")
        .upsert({ cliente_id: clienteId, tag_id: tagId }, { onConflict: "cliente_id,tag_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clienteTags.byCliente(clienteId) });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}

export function useRemoveTagFromCliente(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("cliente_tags")
        .delete()
        .eq("cliente_id", clienteId)
        .eq("tag_id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clienteTags.byCliente(clienteId) });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}
