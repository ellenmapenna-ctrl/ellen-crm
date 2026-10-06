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
import { useCreateTag, useDeleteTag, useUpdateTag } from "@/hooks/useTags";
import type { Tag, TagInsert } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | null;
}

const CATEGORIAS = ["Perfil", "Origem", "Produto", "Relacionamento", "Urgência"];

export function TagFormDialog({ open, onOpenChange, tag }: Props) {
  const editando = !!tag;
  const createMut = useCreateTag();
  const updateMut = useUpdateTag();
  const deleteMut = useDeleteTag();
  const [form, setForm] = useState<TagInsert>({ nome: "", cor: "#6366f1", categoria: null });
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        nome: tag?.nome ?? "",
        cor: tag?.cor ?? "#6366f1",
        categoria: tag?.categoria ?? null,
      });
    }
  }, [open, tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome da tag.");
      return;
    }
    const payload = { nome: form.nome.trim(), cor: form.cor, categoria: form.categoria?.trim() || null };
    try {
      if (editando && tag) {
        await updateMut.mutateAsync({ id: tag.id, ...payload });
        toast.success("Tag atualizada.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Tag criada.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar tag.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleDelete = async () => {
    if (!tag) return;
    try {
      await deleteMut.mutateAsync(tag.id);
      toast.success("Tag excluída.");
      setConfirmar(false);
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao excluir tag.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar tag" : "Nova tag"}</DialogTitle>
            <DialogDescription>Crie etiquetas para classificar clientes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Nome *" htmlFor="nome">
              <Input id="nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: VIP" />
            </Field>
            <Field label="Categoria" htmlFor="categoria">
              <Input id="categoria" list="categorias" value={form.categoria ?? ""} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value || null }))} placeholder="Ex.: Perfil" />
              <datalist id="categorias">
                {CATEGORIAS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Cor">
              <ColorPicker value={form.cor} onChange={(cor) => setForm((f) => ({ ...f, cor }))} />
            </Field>
            <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
              {editando ? (
                <Button type="button" variant="destructive" onClick={() => setConfirmar(true)} disabled={deleteMut.isPending}>
                  Excluir
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
        title="Excluir tag?"
        description="A tag será removida e desvinculada de todos os clientes. Esta ação não pode ser desfeita."
        confirmText="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
