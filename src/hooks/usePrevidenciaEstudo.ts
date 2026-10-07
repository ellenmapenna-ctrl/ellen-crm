import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { qk } from "@/lib/query-keys";

/** Metadados do último estudo de previdência do cliente (sem trazer o PDF, que é pesado). */
export function usePrevidenciaEstudoInfo(clienteId: string | undefined) {
  return useQuery({
    queryKey: qk.previdenciaEstudo.byCliente(clienteId ?? ""),
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previdencia_estudos")
        .select("id, updated_at")
        .eq("cliente_id", clienteId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Baixa o PDF (base64) do último estudo do cliente, ou null se não houver. */
export async function buscarPrevidenciaPdfBase64(clienteId: string): Promise<string | null> {
  const { data, error } = await supabase.from("previdencia_estudos").select("pdf_base64").eq("cliente_id", clienteId).maybeSingle();
  if (error) throw error;
  return data?.pdf_base64 ?? null;
}

/** Guarda o estudo como o mais recente do cliente, substituindo o anterior. */
export function useSalvarPrevidenciaEstudo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clienteId: string; pdfBase64: string; dados: unknown }) => {
      const { error } = await supabase.from("previdencia_estudos").upsert(
        {
          cliente_id: input.clienteId,
          pdf_base64: input.pdfBase64,
          input: input.dados as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cliente_id" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.previdenciaEstudo.byCliente(vars.clienteId) });
    },
  });
}
