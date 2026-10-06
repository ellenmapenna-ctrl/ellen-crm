import * as React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/Field";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useKanbanEstagios, useCreateEstagio, useDeleteEstagio, useUpdateEstagio } from "@/hooks/useKanbanEstagios";
import { funilInfo, type FunilKey } from "@/lib/funis";
import type { KanbanEstagio } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estagio?: KanbanEstagio | null;
  /** Funil onde a coluna nova é criada. */
  funil: FunilKey;
}

export function ColumnFormDialog({ open, onOpenChange, estagio, funil }: Props) {
  const editando = !!estagio;
  const { data: estagios } = useKanbanEstagios();
  const createMut = useCreateEstagio();
  const updateMut = useUpdateEstagio();
  const deleteMut = useDeleteEstagio();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#6366f1");
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(estagio?.nome ?? "");
      setCor(estagio?.cor ?? "#6366f1");
    }
  }, [open, estagio]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome da coluna.");
      return;
    }
    try {
      if (editando && estagio) {
        await updateMut.mutateAsync({ id: estagio.id, nome: nome.trim(), cor });
        toast.success("Coluna atualizada.");
      } else {
        const doFunil = (estagios ?? []).filter((e) => e.funil === funil);
        const proximaOrdem = doFunil.reduce((max, e) => Math.max(max, e.ordem + 1), 0);
        await createMut.mutateAsync({ nome: nome.trim(), cor, ordem: proximaOrdem, funil });
        toast.success("Coluna criada.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar coluna.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleDelete = async () => {
    if (!estagio) return;
    try {
      await deleteMut.mutateAsync(estagio.id);
      toast.success("Coluna excluída. Os clientes voltaram para 'Sem estágio'.");
      setConfirmar(false);
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao excluir coluna.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar coluna" : "Nova coluna"}</DialogTitle>
            <DialogDescription>
              Coluna do funil {funilInfo(estagio?.funil ?? funil)?.nomeCompleto} — nome e cor.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Nome *" htmlFor="col-nome">
              <Input id="col-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Em negociação" />
            </Field>
            <Field label="Cor">
              <ColorPicker value={cor} onChange={setCor} />
            </Field>
            <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
              {editando ? (
                <Button type="button" variant="destructive" onClick={() => setConfirmar(true)} disabled={deleteMut.isPending}>
                  Excluir coluna
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title="Excluir coluna?"
        description="Os clientes desta coluna voltarão para 'Sem estágio' neste funil. Os outros funis, as apólices e os dados do cliente não são afetados."
        confirmText="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
