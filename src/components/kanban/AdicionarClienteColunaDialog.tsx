import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useClientes } from "@/hooks/useClientes";
import { useFunilPosicoes, useMoverNoFunil } from "@/hooks/useFunilPosicoes";
import type { FunilKey } from "@/lib/funis";
import type { KanbanEstagio } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estagio: KanbanEstagio | null;
}

/** Quick-add estilo Trello: buscar um cliente e clicar pra jogar direto nesta coluna. */
export function AdicionarClienteColunaDialog({ open, onOpenChange, estagio }: Props) {
  const { data: clientes } = useClientes();
  const { data: posicoes } = useFunilPosicoes();
  const mover = useMoverNoFunil();
  const [busca, setBusca] = useState("");

  const disponiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const jaNaColuna = new Set(
      (posicoes ?? []).filter((p) => p.estagio_id === estagio?.id).map((p) => p.cliente_id)
    );
    return (clientes ?? [])
      .filter((c) => !jaNaColuna.has(c.id))
      .filter((c) => !termo || c.nome_completo.toLowerCase().includes(termo))
      .slice(0, 50);
  }, [clientes, posicoes, busca, estagio]);

  const handleAdicionar = (clienteId: string) => {
    if (!estagio) return;
    mover.mutate({ clienteIds: [clienteId], funil: estagio.funil as FunilKey, estagioId: estagio.id });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setBusca(""); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar cliente — {estagio?.nome}</DialogTitle>
          <DialogDescription>Busque e clique num cliente pra colocá-lo direto nesta coluna.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome" className="pl-8" autoFocus />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border">
          {disponiveis.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
          {disponiveis.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleAdicionar(c.id)}
              className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-semibold text-primary-foreground">
                {c.nome_completo.charAt(0)}
              </span>
              <span className="flex-1 truncate">{c.nome_completo}</span>
              {c.cidade && <span className="shrink-0 text-xs text-muted-foreground">{c.cidade}{c.uf ? ` - ${c.uf}` : ""}</span>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
