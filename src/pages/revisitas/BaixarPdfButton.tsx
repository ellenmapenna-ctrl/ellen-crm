// Botão "Baixar PDF comparação" reutilizado na lista, na visualização e na
// edição de uma revisita já salva: baixa direto o quadro comparativo, gerado a
// partir dos dados salvos. (A apólice atual e a apresentação da seguradora
// entram no "Baixar PDF reunião".)
import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RevisitaDados, RevisitaFormato } from "@/lib/revisita-template";

export function BaixarPdfButton({
  dados,
  formato,
  variant = "outline",
  size,
}: {
  dados: RevisitaDados;
  formato: RevisitaFormato;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
}) {
  const [baixando, setBaixando] = useState(false);
  const icone = size === "sm" ? "size-3.5" : "size-4";

  const baixar = async () => {
    setBaixando(true);
    try {
      const { baixarRevisitaPdf } = await import("@/lib/revisita-pdf");
      await baixarRevisitaPdf({ apolices: [], tabelaResgate: null, apresentacoes: [], dados, formato });
    } catch (err) {
      toast.error("Não foi possível gerar o PDF.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBaixando(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={baixar} disabled={baixando}>
      {baixando ? <Loader2 className={`${icone} animate-spin`} /> : <Download className={icone} />}
      {baixando ? "Gerando..." : "Baixar PDF comparação"}
    </Button>
  );
}
