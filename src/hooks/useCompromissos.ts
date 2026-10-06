import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { CompromissoInsert, CompromissoUpdate, CompromissoWithCliente } from "@/lib/types";

/** Compromissos entre duas datas (inclusive), com o cliente vinculado carregado junto. */
export function useCompromissosPeriodo(inicio: string, fim: string) {
  return useQuery({
    queryKey: qk.compromissos.byPeriodo(inicio, fim),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compromissos")
        .select("*, cliente:clientes(id, nome_completo)")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CompromissoWithCliente[];
    },
  });
}

export function useCreateCompromisso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CompromissoInsert) => {
      const { data, error } = await supabase.from("compromissos").insert(input).select().maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compromissos"] });
    },
  });
}

export function useUpdateCompromisso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CompromissoUpdate & { id: string }) => {
      const payload = { ...input, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from("compromissos").update(payload).eq("id", id).select().maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compromissos"] });
    },
  });
}

export function useDeleteCompromisso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compromissos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compromissos"] });
    },
  });
}
