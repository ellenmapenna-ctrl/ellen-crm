import * as React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/Field";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientes } from "@/hooks/useClientes";
import { useDeleteDemanda, useUpdateDemanda } from "@/hooks/useDemandas";
import { PRIORIDADE_OPCOES, RESPONSAVEIS, STATUS_OPCOES } from "@/lib/demandas";
import { cn } from "@/lib/utils";
import type { DemandaWithCliente } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demanda: DemandaWithCliente | null;
}

export function DemandaFormDialog({ open, onOpenChange, demanda }: Props) {
  const { data: clientes } = useClientes();
  const updateMut = useUpdateDemanda();
  const deleteMut = useDeleteDemanda();

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    responsavel: "Renan",
    status: "a_fazer",
    prioridade: "normal",
    prazo: "",
    clienteId: "",
  });
  const [clientePopoverOpen, setClientePopoverOpen] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  useEffect(() => {
    if (!open || !demanda) return;
    setForm({
      titulo: demanda.titulo,
      descricao: demanda.descricao ?? "",
      responsavel: demanda.responsavel,
      status: demanda.status,
      prioridade: demanda.prioridade,
      prazo: demanda.prazo ?? "",
      clienteId: demanda.cliente_id ?? "",
    });
  }, [open, demanda]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const clienteSelecionado = (clientes ?? []).find((c) => c.id === form.clienteId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demanda) return;
    if (!form.titulo.trim()) {
      toast.error("Informe o título da demanda.");
      return;
    }
    const mudouStatus = form.status !== demanda.status;
    try {
      await updateMut.mutateAsync({
        id: demanda.id,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        responsavel: form.responsavel,
        status: form.status,
        prioridade: form.prioridade,
        prazo: form.prazo || null,
        cliente_id: form.clienteId || null,
        ...(mudouStatus ? { concluida_em: form.status === "concluida" ? new Date().toISOString() : null } : {}),
      });
      toast.success("Demanda atualizada.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar demanda.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleDelete = async () => {
    if (!demanda) return;
    try {
      await deleteMut.mutateAsync(demanda.id);
      toast.success("Demanda excluída.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao excluir.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar demanda</DialogTitle>
            <DialogDescription>Ajuste detalhes, responsável, prazo ou status.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Título *" htmlFor="dem-titulo">
              <Input id="dem-titulo" value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
            </Field>
            <Field label="Detalhes" htmlFor="dem-descricao">
              <Textarea id="dem-descricao" rows={3} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Responsável">
                <Select value={form.responsavel} onValueChange={(v) => v && set("responsavel", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESPONSAVEIS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => v && set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((o) => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prioridade">
                <Select value={form.prioridade} onValueChange={(v) => v && set("prioridade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADE_OPCOES.map((o) => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prazo" htmlFor="dem-prazo">
                <Input id="dem-prazo" type="date" value={form.prazo} onChange={(e) => set("prazo", e.target.value)} />
              </Field>
            </div>

            <Field label="Cliente (opcional)">
              <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {clienteSelecionado ? clienteSelecionado.nome_completo : "Nenhum"}
                    <ChevronsUpDown className="size-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__nenhum__"
                          onSelect={() => {
                            set("clienteId", "");
                            setClientePopoverOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 size-4", !form.clienteId ? "opacity-100" : "opacity-0")} />
                          Nenhum
                        </CommandItem>
                        {(clientes ?? []).map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.nome_completo}
                            onSelect={() => {
                              set("clienteId", c.id);
                              setClientePopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 size-4", form.clienteId === c.id ? "opacity-100" : "opacity-0")} />
                            {c.nome_completo}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
              <Button type="button" variant="destructive" onClick={() => setConfirmarExclusao(true)} disabled={deleteMut.isPending}>
                Excluir
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={updateMut.isPending}>{updateMut.isPending ? "Salvando..." : "Salvar"}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmarExclusao}
        onOpenChange={setConfirmarExclusao}
        title="Excluir esta demanda?"
        description="Essa ação não pode ser desfeita. Se ela só foi resolvida, prefira marcar como concluída."
        confirmText="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
