import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GeradorPrevidencia } from "@/components/previdencia/GeradorPrevidencia";
import { usePrevidenciaEstudoInfo } from "@/hooks/usePrevidenciaEstudo";
import { formatarMoeda } from "@/lib/format";
import type { PrevidenciaInput, PrevidenciaResultado } from "@/lib/previdencia-calc";

interface Props {
  clienteId: string | null;
  clienteNome: string;
  /** Está usando o estudo guardado (e não um PDF enviado à mão); padrão: sim, se houver. */
  usandoEstudoSalvo?: boolean;
  /** Sem estas duas, a opção de enviar um PDF não aparece (ex.: ao editar uma revisita salva). */
  onEnviarOutroArquivo?: () => void;
  onArquivo?: (arquivo: File | null) => void;
  /** Aplica o estudo no comparativo da revisita (resgate, seguradora nova e prêmios). */
  onAplicar: (input: PrevidenciaInput, resultado: PrevidenciaResultado) => void;
}

/** Proposta de previdência da revisita: mostra o estudo já feito e deixa fazer um novo num painel, sem sair da tela. */
export function PrevidenciaNaRevisita({ clienteId, clienteNome, usandoEstudoSalvo, onEnviarOutroArquivo, onArquivo, onAplicar }: Props) {
  const { data: estudo } = usePrevidenciaEstudoInfo(clienteId ?? undefined);
  const estudoEm = estudo?.updated_at ?? null;
  const [aberto, setAberto] = useState(false);
  const [ultimo, setUltimo] = useState<{ input: PrevidenciaInput; resultado: PrevidenciaResultado } | null>(null);
  const temEstudo = !!estudoEm;
  const usando = usandoEstudoSalvo ?? temEstudo;
  const dataEstudo = estudoEm ? new Date(estudoEm).toLocaleDateString("pt-BR") : "";

  return (
    <div className="flex flex-col gap-2">
      {usando ? (
        <div className="flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="size-4" />
            Já existe um estudo de previdência feito ({dataEstudo})
          </span>
          <span className="text-xs">Ele será usado na leitura. Se quiser, faça um novo: o novo substitui este.</span>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" variant="outline" className="bg-white" onClick={() => setAberto(true)}>
              <PiggyBank className="size-4" />
              Fazer novo estudo
            </Button>
            {onEnviarOutroArquivo && (
              <button type="button" className="text-xs underline" onClick={onEnviarOutroArquivo}>
                Enviar outro arquivo
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm">
          <span className="text-xs text-muted-foreground">
            {temEstudo ? `Estudo de ${dataEstudo} guardado — enviando outro arquivo no lugar.` : clienteId ? "Este cliente ainda não tem estudo de previdência." : "Escolha um cliente da carteira para guardar o estudo nele."}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" onClick={() => setAberto(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <PiggyBank className="size-4" />
              Fazer previdência
            </Button>
            {onArquivo && <span className="text-xs text-muted-foreground">ou envie um PDF:</span>}
          </div>
          {onArquivo && <Input type="file" accept="application/pdf" className="bg-white" onChange={(e) => onArquivo(e.target.files?.[0] ?? null)} />}
        </div>
      )}

      {ultimo && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-indigo-200 bg-indigo-50/60 p-3 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reserva aos {ultimo.input.idadeAposentadoria} anos</p>
            <p className="font-semibold">{formatarMoeda(ultimo.resultado.reservaEstimada)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contribuição mensal</p>
            <p className="font-semibold">{formatarMoeda(ultimo.resultado.contribuicaoMensalTotal)}</p>
          </div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="size-4" />
            Aplicada na comparação
          </p>
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogTitle>Estudo de previdência — {clienteNome || "cliente"}</DialogTitle>
          <GeradorPrevidencia
            embutido
            clienteIdInicial={clienteId ?? undefined}
            nomeInicial={clienteNome}
            aoAplicar={({ input, resultado }) => {
              onAplicar(input, resultado);
              setUltimo({ input, resultado });
              setAberto(false);
              toast.success("Previdência aplicada na revisita.", { description: "Resgate, Icatu nas seguradoras novas e o prêmio da previdência foram preenchidos. Revise antes de salvar." });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
