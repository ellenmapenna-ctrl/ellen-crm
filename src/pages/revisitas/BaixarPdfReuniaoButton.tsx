// Botão "Baixar PDF reunião": página da apólice atual → apresentação da
// seguradora → comparativo, num PDF só (ver src/lib/reuniao-pdf.ts).
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RevisitaDados, RevisitaFormato } from "@/lib/revisita-template";

export function BaixarPdfReuniaoButton({
  dados,
  formato,
  clienteId,
  variant = "outline",
  size,
}: {
  dados: RevisitaDados;
  formato: RevisitaFormato;
  clienteId: string | null;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
}) {
  const [baixando, setBaixando] = useState(false);
  const icone = size === "sm" ? "size-3.5" : "size-4";

  const baixar = async () => {
    setBaixando(true);
    try {
      const { baixarReuniaoPdf } = await import("@/lib/reuniao-pdf");
      const { avisos } = await baixarReuniaoPdf({ dados, formato, clienteId });
      if (avisos.length > 0) toast.warning("PDF reunião baixado, com ressalvas.", { description: avisos.join(" ") });
    } catch (err) {
      toast.error("Não foi possível gerar o PDF reunião.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBaixando(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={baixar} disabled={baixando} title="Apólice atual + apresentação da seguradora + comparativo">
      {baixando ? <Loader2 className={`${icone} animate-spin`} /> : <Presentation className={icone} />}
      {baixando ? "Montando..." : "Baixar PDF reunião"}
    </Button>
  );
}
