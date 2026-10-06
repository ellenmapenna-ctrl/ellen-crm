import * as React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientes } from "@/hooks/useClientes";
import { useCreateCompromisso, useDeleteCompromisso, useUpdateCompromisso } from "@/hooks/useCompromissos";
import { ETAPA_OPCOES } from "@/lib/etapas";
import { cn } from "@/lib/utils";
import type { CompromissoWithCliente } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataInicial?: string;
  compromisso?: CompromissoWithCliente | null;
}

export function CompromissoFormDialog({ open, onOpenChange, dataInicial, compromisso }: Props) {
  const editando = !!compromisso;
  const { data: clientes } = useClientes();
  const createMut = useCreateCompromisso();
  const updateMut = useUpdateCompromisso();
  const deleteMut = useDeleteCompromisso();

  const [form, setForm] = useState({
    titulo: "",
    clienteId: "",
    tipo: "__nenhum__",
    data: dataInicial ?? "",
    horaInicio: "09:00",
    horaFim: "",
  });
  const [clientePopoverOpen, setClientePopoverOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      titulo: compromisso?.titulo ?? "",
      clienteId: compromisso?.cliente_id ?? "",
      tipo: compromisso?.tipo ?? "__nenhum__",
      data: compromisso?.data ?? dataInicial ?? "",
      horaInicio: compromisso?.hora_inicio?.slice(0, 5) ?? "09:00",
      horaFim: compromisso?.hora_fim?.slice(0, 5) ?? "",
    });
  }, [open, compromisso, dataInicial]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const clienteSelecionado = (clientes ?? []).find((c) => c.id === form.clienteId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.data || !form.horaInicio) {
      toast.error("Preencha título, data e hora de início.");
      return;
    }
    const payload = {
      titulo: form.titulo.trim(),
      cliente_id: form.clienteId || null,
      tipo: form.tipo === "__nenhum__" ? null : form.tipo,
      data: form.data,
      hora_inicio: form.horaInicio,
      hora_fim: form.horaFim || null,
    };
    try {
      if (editando && compromisso) {
        await updateMut.mutateAsync({ id: compromisso.id, ...payload });
        toast.success("Compromisso atualizado.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Compromisso criado.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar compromisso.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleDelete = async () => {
    if (!compromisso) return;
    try {
      await deleteMut.mutateAsync(compromisso.id);
      toast.success("Compromisso excluído.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao excluir.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
          <DialogDescription>Aparece na grade semanal da Agenda.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Título *" htmlFor="titulo">
            <Input id="titulo" value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex.: Reunião de revisão" />
          </Field>

          <Field label="Cliente (opcional)" htmlFor="cliente">
            <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
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

          <Field label="Linha de negócio (opcional)" htmlFor="tipo">
            <Select value={form.tipo} onValueChange={(v) => v && set("tipo", v)}>
              <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhum__">Nenhuma</SelectItem>
                {ETAPA_OPCOES.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    <span className={cn("flex items-center gap-1.5", o.colorClass)}>
                      <o.icon className="size-3.5" />
                      {o.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Data *" htmlFor="data">
              <Input id="data" type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
            </Field>
            <Field label="Início *" htmlFor="horaInicio">
              <Input id="horaInicio" type="time" value={form.horaInicio} onChange={(e) => set("horaInicio", e.target.value)} />
            </Field>
            <Field label="Fim" htmlFor="horaFim">
              <Input id="horaFim" type="time" value={form.horaFim} onChange={(e) => set("horaFim", e.target.value)} />
            </Field>
          </div>

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            {editando ? (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteMut.isPending}>Excluir</Button>
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
  );
}
