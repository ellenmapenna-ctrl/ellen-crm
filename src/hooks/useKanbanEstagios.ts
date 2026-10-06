import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { KanbanEstagio, KanbanEstagioInsert, KanbanEstagioUpdate } from "@/lib/types";

export function useKanbanEstagios() {
  return useQuery({
    queryKey: qk.kanbanEstagios.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_estagios")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as KanbanEstagio[];
    },
  });
}

export function useCreateEstagio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: KanbanEstagioInsert) => {
      const { data, error } = await supabase
        .from("kanban_estagios")
        .insert(input)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as KanbanEstagio | null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.kanbanEstagios.all });
    },
  });
}

export function useUpdateEstagio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: KanbanEstagioUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("kanban_estagios")
        .update(input)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as KanbanEstagio | null;
    },
    onMutate: async ({ id, ...input }) => {
      await qc.cancelQueries({ queryKey: qk.kanbanEstagios.all });
      const previous = qc.getQueryData<KanbanEstagio[]>(qk.kanbanEstagios.all);
      if (previous) {
        const next = previous.map((e) => (e.id === id ? { ...e, ...input } : e));
        qc.setQueryData(qk.kanbanEstagios.all, next);
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.kanbanEstagios.all, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.kanbanEstagios.all });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}

export function useDeleteEstagio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kanban_estagios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.kanbanEstagios.all });
      qc.invalidateQueries({ queryKey: qk.funilPosicoes.all });
      qc.invalidateQueries({ queryKey: qk.clientes.all });
    },
  });
}

/** Reordena as colunas do Kanban em lote (atualiza o campo `ordem`). */
export function useReorderEstagios() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (estagios: { id: string; ordem: number }[]) => {
      await Promise.all(
        estagios.map((e) =>
          supabase.from("kanban_estagios").update({ ordem: e.ordem }).eq("id", e.id)
        )
      );
    },
    onMutate: async (estagios) => {
      await qc.cancelQueries({ queryKey: qk.kanbanEstagios.all });
      const previous = qc.getQueryData<KanbanEstagio[]>(qk.kanbanEstagios.all);
      if (previous) {
        const next = previous
          .map((e) => {
            const found = estagios.find((s) => s.id === e.id);
            return found ? { ...e, ordem: found.ordem } : e;
          })
          .sort((a, b) => a.ordem - b.ordem);
        qc.setQueryData(qk.kanbanEstagios.all, next);
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.kanbanEstagios.all, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.kanbanEstagios.all });
    },
  });
}
