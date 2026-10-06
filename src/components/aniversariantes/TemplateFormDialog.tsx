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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/Field";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useCreateTemplateAniversario, useDeleteTemplateAniversario, useUpdateTemplateAniversario } from "@/hooks/useMensagensTemplates";
import type { MensagemTemplate } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MensagemTemplate | null;
}

export function TemplateFormDialog({ open, onOpenChange, template }: Props) {
  const editando = !!template;
  const createMut = useCreateTemplateAniversario();
  const updateMut = useUpdateTemplateAniversario();
  const deleteMut = useDeleteTemplateAniversario();
  const [nome, setNome] = useState("");
  const [corpo, setCorpo] = useState("");
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(template?.nome ?? "");
      setCorpo(template?.corpo ?? "");
    }
  }, [open, template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Dê um nome para o template (ex.: Formal).");
      return;
    }
    if (!corpo.trim()) {
      toast.error("O corpo da mensagem não pode ficar vazio.");
      return;
    }
    try {
      if (editando && template) {
        await updateMut.mutateAsync({ id: template.id, nome: nome.trim(), corpo: corpo.trim() });
        toast.success("Template atualizado.");
      } else {
        await createMut.mutateAsync({ nome: nome.trim(), corpo: corpo.trim() });
        toast.success("Template criado.");
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Já existe um template com esse nome.");
      } else {
        toast.error("Erro ao salvar template.", { description: msg });
      }
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    try {
      await deleteMut.mutateAsync(template.id);
      toast.success("Template excluído.");
      setConfirmar(false);
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao excluir template.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar template" : "Novo template"}</DialogTitle>
            <DialogDescription>
              Use o placeholder <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{primeiro_nome}"}</code> para inserir o primeiro nome do cliente automaticamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Nome do template *" htmlFor="nome">
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Formal, Mais próximo, Curta e direta" />
            </Field>
            <Field label="Mensagem *" htmlFor="corpo">
              <Textarea id="corpo" rows={6} value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder="Olá {primeiro_nome}, a equipe deseja um feliz aniversário!" />
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
        title="Excluir template?"
        description="O template será removido. Esta ação não pode ser desfeita."
        confirmText="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
