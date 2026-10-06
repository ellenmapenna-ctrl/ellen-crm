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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/shared/Field";
import { useCreateApolice, useDeleteApolice, useUpdateApolice } from "@/hooks/useApolices";
import {
  APOLICE_STATUS,
  type Apolice,
  type ApoliceInsert,
} from "@/lib/types";
import { formatarMoeda, paraNumero } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  apolice?: Apolice | null;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ApoliceFormDialog({ open, onOpenChange, clienteId, apolice }: Props) {
  const editando = !!apolice;
  const createMut = useCreateApolice();
  const updateMut = useUpdateApolice();
  const deleteMut = useDeleteApolice();

  const [form, setForm] = useState({
    numero_apolice: "",
    seguradora: "",
    tipo_produto: "",
    status: "ativa",
    data_emissao: "",
    vencimento_apolice: "",
    melhor_dia_pagamento: "",
    premio_mensal_total: "",
    capital_segurado_total: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        numero_apolice: apolice?.numero_apolice ?? "",
        seguradora: apolice?.seguradora ?? "",
        tipo_produto: apolice?.tipo_produto ?? "",
        status: apolice?.status ?? "ativa",
        data_emissao: apolice?.data_emissao ?? "",
        vencimento_apolice: apolice?.vencimento_apolice ?? "",
        melhor_dia_pagamento: apolice?.melhor_dia_pagamento != null ? String(apolice.melhor_dia_pagamento) : "",
        premio_mensal_total: apolice?.premio_mensal_total != null ? String(apolice.premio_mensal_total) : "",
        capital_segurado_total: apolice?.capital_segurado_total != null ? String(apolice.capital_segurado_total) : "",
      });
    }
  }, [open, apolice]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ApoliceInsert = {
      cliente_id: clienteId,
      numero_apolice: form.numero_apolice.trim() || null,
      seguradora: form.seguradora.trim() || null,
      tipo_produto: form.tipo_produto.trim() || null,
      status: form.status,
      data_emissao: form.data_emissao || null,
      vencimento_apolice: form.vencimento_apolice || null,
      melhor_dia_pagamento: form.melhor_dia_pagamento ? Number(form.melhor_dia_pagamento) : null,
      premio_mensal_total: paraNumero(form.premio_mensal_total),
      capital_segurado_total: paraNumero(form.capital_segurado_total),
    };
    try {
      if (editando && apolice) {
        await updateMut.mutateAsync({ id: apolice.id, cliente_id: clienteId, ...payload });
        toast.success("Apólice atualizada.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Apólice criada.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar apólice.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleDelete = async () => {
    if (!apolice) return;
    try {
      await deleteMut.mutateAsync({ id: apolice.id, clienteId });
      toast.success("Apólice excluída.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao excluir apólice.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar apólice" : "Nova apólice"}</DialogTitle>
          <DialogDescription>Dados da apólice e prêmio/capital totais.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Número da apólice" htmlFor="numero_apolice">
              <Input id="numero_apolice" value={form.numero_apolice} onChange={(e) => set("numero_apolice", e.target.value)} />
            </Field>
            <Field label="Seguradora" htmlFor="seguradora">
              <Input id="seguradora" value={form.seguradora} onChange={(e) => set("seguradora", e.target.value)} placeholder="Ex.: Mapfre" />
            </Field>
            <Field label="Tipo de produto" htmlFor="tipo_produto">
              <Input id="tipo_produto" value={form.tipo_produto} onChange={(e) => set("tipo_produto", e.target.value)} placeholder="Ex.: Auto, Vida, Residencial" />
            </Field>
            <Field label="Status" htmlFor="status">
              <Select value={form.status} onValueChange={(v) => { if (v) set("status", v); }}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APOLICE_STATUS.map((s) => <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data de emissão" htmlFor="data_emissao">
              <Input id="data_emissao" type="date" value={form.data_emissao} onChange={(e) => set("data_emissao", e.target.value)} />
            </Field>
            <Field label="Vencimento" htmlFor="vencimento_apolice">
              <Input id="vencimento_apolice" type="date" value={form.vencimento_apolice} onChange={(e) => set("vencimento_apolice", e.target.value)} />
            </Field>
            <Field label="Melhor dia de pagamento (1-31)" htmlFor="melhor_dia_pagamento">
              <Input id="melhor_dia_pagamento" type="number" min={1} max={31} value={form.melhor_dia_pagamento} onChange={(e) => set("melhor_dia_pagamento", e.target.value)} />
            </Field>
            <Field label="Prêmio mensal total" htmlFor="premio_mensal_total">
              <Input id="premio_mensal_total" inputMode="decimal" value={form.premio_mensal_total} onChange={(e) => set("premio_mensal_total", e.target.value)} placeholder={formatarMoeda(0)} />
            </Field>
            <Field label="Capital segurado total" htmlFor="capital_segurado_total" className="sm:col-span-2">
              <Input id="capital_segurado_total" inputMode="decimal" value={form.capital_segurado_total} onChange={(e) => set("capital_segurado_total", e.target.value)} placeholder={formatarMoeda(0)} />
            </Field>
          </div>
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            {editando ? (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteMut.isPending}>
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
  );
}
