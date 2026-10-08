import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { GeradorPrevidencia } from "@/components/previdencia/GeradorPrevidencia";
import { formatarMoeda } from "@/lib/format";
import type { PrevidenciaInput, PrevidenciaResultado } from "@/lib/previdencia-calc";

interface Props {
  clienteId: string | null;
  clienteNome: string;
  /** Aplica o estudo no comparativo da revisita (resgate, seguradora nova e prêmios). */
  onAplicar: (input: PrevidenciaInput, resultado: PrevidenciaResultado) => void;
}

/** Gerador de previdência dentro da revisita: mesmos campos, prévia e PDF da aba Previdência, ligado ao cliente da revisita. */
export function PrevidenciaNaRevisita({ clienteId, clienteNome, onAplicar }: Props) {
  const [ultimo, setUltimo] = useState<{ input: PrevidenciaInput; resultado: PrevidenciaResultado } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {ultimo && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reserva estimada aos {ultimo.input.idadeAposentadoria} anos</p>
            <p className="font-semibold">{formatarMoeda(ultimo.resultado.reservaEstimada)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contribuição mensal total</p>
            <p className="font-semibold">{formatarMoeda(ultimo.resultado.contribuicaoMensalTotal)}</p>
          </div>
          <p className="ml-auto flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="size-4" />
            Aplicada na revisita (resgate, Icatu e prêmio da previdência)
          </p>
        </div>
      )}

      {(
        <div className="rounded-lg border bg-white p-3">
          <GeradorPrevidencia
            embutido
            clienteIdInicial={clienteId ?? undefined}
            nomeInicial={clienteNome}
            aoAplicar={({ input, resultado }) => {
              onAplicar(input, resultado);
              setUltimo({ input, resultado });
              toast.success("Previdência aplicada na revisita.", { description: "Resgate, Icatu nas seguradoras novas e o prêmio da previdência foram preenchidos. Revise antes de salvar." });
            }}
          />
        </div>
      )}
    </div>
  );
}
