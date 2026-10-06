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
import { ClienteCampos } from "@/components/clientes/ClienteCampos";
import { FunisDoClienteCampos } from "@/components/clientes/FunisDoClienteCampos";
import { clienteFormToInsert, estadoInicialCliente, type ClienteFormState } from "@/lib/cliente-form";
import { useFunisDoClienteForm } from "@/hooks/useFunisDoClienteForm";
import { useCreateCliente, useUpdateCliente } from "@/hooks/useClientes";
import type { ClienteWithRelations } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: ClienteWithRelations | null;
  onSuccess?: (id: string) => void;
}

const VAZIO: ClienteFormState = {
  nome_completo: "",
  cpf: "",
  email: "",
  celular: "",
  data_nascimento: "",
  sexo: "",
  estado_civil: "",
  profissao: "",
  empresa: "",
  cargo: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  cliente_desde: "",
  observacoes: "",
};

export function ClienteFormDialog({ open, onOpenChange, cliente, onSuccess }: Props) {
  const editando = !!cliente;
  const funis = useFunisDoClienteForm(cliente?.id);
  const createMut = useCreateCliente();
  const updateMut = useUpdateCliente();
  const [form, setForm] = useState<ClienteFormState>(VAZIO);

  useEffect(() => {
    if (open) {
      setForm(estadoInicialCliente(cliente));
      funis.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cliente]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_completo.trim()) {
      toast.error("Informe o nome completo.");
      return;
    }
    const payload = clienteFormToInsert(form);

    try {
      if (editando && cliente) {
        await updateMut.mutateAsync({ id: cliente.id, ...payload });
        await funis.salvar(cliente.id);
        toast.success("Cliente atualizado com sucesso.");
        onSuccess?.(cliente.id);
      } else {
        const created = await createMut.mutateAsync(payload);
        if (created?.id) await funis.salvar(created.id);
        toast.success("Cliente criado com sucesso.");
        if (created?.id) onSuccess?.(created.id);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar cliente.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Preencha os dados do cliente. Campos com * são obrigatórios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <ClienteCampos
            form={form}
            set={set}
            funis={<FunisDoClienteCampos valores={funis.valores} onChange={funis.onChange} />}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar cliente"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
