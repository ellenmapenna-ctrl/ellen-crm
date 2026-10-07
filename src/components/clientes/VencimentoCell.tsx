import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateApolice } from "@/hooks/useApolices";
import { formatarData } from "@/lib/format";
import { observacaoVencimentoDoCliente, proximoVencimentoDoCliente, situacaoVencimento } from "@/lib/vencimentos";
import { cn } from "@/lib/utils";
import type { ClienteWithRelations } from "@/lib/types";

interface Edicao {
  data: string;
  obs: string;
}

/** Célula "Próx. vencimento" da lista de clientes: mostra a data e a observação (ex.: EM ATRASO) e deixa editar à mão, por apólice ativa. */
export function VencimentoCell({ cliente }: { cliente: ClienteWithRelations }) {
  const ativas = (cliente.apolices ?? []).filter((a) => a.status === "ativa");
  const venc = proximoVencimentoDoCliente(cliente.apolices ?? []);
  const obs = observacaoVencimentoDoCliente(cliente.apolices ?? []);
  const situacao = venc ? situacaoVencimento(venc) : null;

  const [aberto, setAberto] = useState(false);
  const [valores, setValores] = useState<Record<string, Edicao>>({});
  const [salvando, setSalvando] = useState(false);
  const updateMut = useUpdateApolice();

  useEffect(() => {
    if (aberto) {
      setValores(Object.fromEntries(ativas.map((a) => [a.id, { data: a.proximo_vencimento_premio ?? "", obs: a.observacao_vencimento ?? "" }])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  if (ativas.length === 0) return <span className="text-muted-foreground">—</span>;

  const alteradas = ativas.filter((a) => {
    const v = valores[a.id];
    return !!v && (v.data !== (a.proximo_vencimento_premio ?? "") || v.obs.trim() !== (a.observacao_vencimento ?? "").trim());
  });

  const mudar = (id: string, patch: Partial<Edicao>) => setValores((v) => ({ ...v, [id]: { ...v[id], ...patch } }));

  const salvar = async () => {
    setSalvando(true);
    try {
      for (const a of alteradas) {
        const v = valores[a.id];
        await updateMut.mutateAsync({
          id: a.id,
          cliente_id: cliente.id,
          proximo_vencimento_premio: v.data || null,
          observacao_vencimento: v.obs.trim() || null,
          vencimento_premio_atualizado_em: new Date().toISOString(),
        });
      }
      toast.success("Vencimento atualizado.");
      setAberto(false);
    } catch (err) {
      toast.error("Não foi possível salvar o vencimento.", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" className="group -mx-1 flex items-start gap-1 rounded px-1 py-0.5 text-left hover:bg-accent" title="Editar próximo vencimento">
          <span className="flex flex-col items-start gap-0.5">
            {venc && situacao && (
              <span>
                <span className="font-mono text-xs">{formatarData(venc)}</span>
                <span
                  className={cn(
                    "block text-[10px]",
                    situacao.situacao === "vencido" && "font-semibold text-destructive",
                    (situacao.situacao === "hoje" || situacao.situacao === "breve") && "font-semibold text-amber-600",
                    situacao.situacao === "futuro" && "text-muted-foreground",
                  )}
                >
                  {situacao.texto}
                </span>
              </span>
            )}
            {obs && <span className="max-w-40 truncate rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">{obs}</span>}
            {!venc && !obs && (
              <span className="text-xs text-muted-foreground">
                — <span className="text-primary opacity-0 group-hover:opacity-100">adicionar</span>
              </span>
            )}
          </span>
          <Pencil className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximo vencimento do prêmio</p>
        <div className="flex flex-col gap-3">
          {ativas.map((a) => (
            <div key={a.id} className="flex flex-col gap-1.5 text-xs">
              <span className="text-muted-foreground">Apólice {a.numero_apolice || "sem número"}</span>
              <span className="flex items-center gap-1.5">
                <Input type="date" className="h-8" value={valores[a.id]?.data ?? ""} onChange={(e) => mudar(a.id, { data: e.target.value })} aria-label="Data do vencimento" />
                {(valores[a.id]?.data ?? "") !== "" && (
                  <button type="button" className="text-xs text-muted-foreground underline" onClick={() => mudar(a.id, { data: "" })}>
                    limpar
                  </button>
                )}
              </span>
              <Input className="h-8" placeholder="Observação (ex.: EM ATRASO)" value={valores[a.id]?.obs ?? ""} onChange={(e) => mudar(a.id, { obs: e.target.value })} aria-label="Observação do vencimento" />
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={salvar} disabled={salvando || alteradas.length === 0}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
