import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { qk } from "@/lib/query-keys";
import type { RevisitaDados } from "@/lib/revisita-template";

export interface RevisitaRow {
  id: string;
  created_at: string | null;
  cliente_id: string | null;
  cliente_nome: string;
  dados: RevisitaDados;
  html: string;
  instrucoes_extras: string | null;
}

export function useRevisitas() {
  return useQuery({
    queryKey: qk.revisitas.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revisitas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RevisitaRow[];
    },
  });
}

export function useRevisita(id: string | undefined) {
  return useQuery({
    queryKey: qk.revisitas.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("revisitas").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as unknown as RevisitaRow | null;
    },
  });
}

export function useCriarRevisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clienteId: string | null;
      clienteNome: string;
      dados: RevisitaDados;
      html: string;
      instrucoesExtras: string | null;
    }) => {
      const { data, error } = await supabase
        .from("revisitas")
        .insert({
          cliente_id: input.clienteId,
          cliente_nome: input.clienteNome,
          dados: input.dados as unknown as Json,
          html: input.html,
          instrucoes_extras: input.instrucoesExtras,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.revisitas.all });
    },
  });
}

export function useAtualizarRevisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; clienteNome: string; dados: RevisitaDados; html: string }) => {
      const { data, error } = await supabase
        .from("revisitas")
        .update({
          cliente_nome: input.clienteNome,
          dados: input.dados as unknown as Json,
          html: input.html,
        })
        .eq("id", input.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.revisitas.all });
      qc.invalidateQueries({ queryKey: qk.revisitas.detail(variables.id) });
    },
  });
}

/** Cria uma nova revisita a partir de uma existente (mesmo cliente/dados/html) — usado pelo botão "Duplicar". */
export function useDuplicarRevisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (origem: RevisitaRow) => {
      const { data, error } = await supabase
        .from("revisitas")
        .insert({
          cliente_id: origem.cliente_id,
          cliente_nome: origem.cliente_nome,
          dados: origem.dados as unknown as Json,
          html: origem.html,
          instrucoes_extras: origem.instrucoes_extras,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.revisitas.all });
    },
  });
}

export function useExcluirRevisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("revisitas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.revisitas.all });
    },
  });
}
