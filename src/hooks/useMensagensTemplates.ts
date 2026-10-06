import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import type { MensagemTemplate } from "@/lib/types";

export function useTemplatesAniversario() {
  return useQuery({
    queryKey: qk.templatesAniversario.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensagens_templates")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MensagemTemplate[];
    },
  });
}

export function useCreateTemplateAniversario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, corpo }: { nome: string; corpo: string }) => {
      const { data, error } = await supabase
        .from("mensagens_templates")
        .insert({ nome, corpo })
        .select()
        .single();
      if (error) throw error;
      return data as MensagemTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.templatesAniversario.all }),
  });
}

export function useUpdateTemplateAniversario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome, corpo }: { id: string; nome: string; corpo: string }) => {
      const { data, error } = await supabase
        .from("mensagens_templates")
        .update({ nome, corpo, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as MensagemTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.templatesAniversario.all }),
  });
}

export function useDeleteTemplateAniversario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mensagens_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.templatesAniversario.all }),
  });
}
