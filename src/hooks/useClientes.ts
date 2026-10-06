import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { ClienteInsert, ClienteUpdate, ClienteWithRelations } from "@/lib/types";

export function useClientes() {
  return useQuery({
    queryKey: qk.clientes.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*, apolices(*, coberturas(*)), cliente_tags(tag:tags(*)), estagio:kanban_estagios(*)")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ClienteWithRelations[];
    },
  });
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: qk.clientes.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*, apolices(*, coberturas(*)), cliente_tags(tag:tags(*)), estagio:kanban_estagios(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ClienteWithRelations | null;
    },
  });
}

export function useCreateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClienteInsert) => {
      const { data, error } = await supabase
        .from("clientes")
        .insert(input)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clientes.all });
      qc.invalidateQueries({ queryKey: qk.aniversariantes(30) });
    },
  });
}

export function useUpdateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ClienteUpdate & { id: string }) => {
      const payload = { ...input, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from("clientes")
        .update(payload)
        .eq("id", id)
        .select("*, apolices(*, coberturas(*)), cliente_tags(tag:tags(*)), estagio:kanban_estagios(*)")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ClienteWithRelations | null;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: qk.clientes.all });
      if (updated?.id) {
        qc.setQueryData(qk.clientes.detail(updated.id), updated);
      }
    },
  });
}

export function useDeleteCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clientes.all });
      qc.invalidateQueries({ queryKey: qk.aniversariantes(30) });
    },
  });
}
