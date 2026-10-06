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
import {
  useCreateCobertura,
  useDeleteCobertura,
  useUpdateCobertura,
} from "@/hooks/useCoberturas";
import {
  COBERTURA_STATUS,
  COBERTURA_TIPO,
  type Cobertura,
  type CoberturaInsert,
} from "@/lib/types";
import { formatarMoeda, paraNumero } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apoliceId: string;
  cobertura?: Cobertura | null;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function CoberturaFormDialog({ open, onOpenChange, apoliceId, cobertura }: Props) {
  const editando = !!cobertura;
  const createMut = useCreateCobertura();
  const updateMut = useUpdateCobertura();
  const deleteMut = useDeleteCobertura();

  const [form, setForm] = useState({
    nome_cobertura: "",
    tipo: "base",
    capital_segurado: "",
    premio_mensal: "",
    status: "ativa",
  });

  useEffect(() => {
    if (open) {
      setForm({
        nome_cobertura: cobertura?.nome_cobertura ?? "",
        tipo: cobertura?.tipo ?? "base",
        capital_segurado: cobertura?.capital_segurado != null ? String(cobertura.capital_segurado) : "",
        premio_mensal: cobertura?.premio_mensal != null ? String(cobertura.premio_mensal) : "",
        status: cobertura?.status ?? "ativa",
      });
    }
  }, [open, cobertura]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_cobertura.trim()) {
      toast.error("Informe o nome da cobertura.");
      return;
    }
    const payload: CoberturaInsert = {
      apolice_id: apoliceId,
      nome_cobertura: form.nome_cobertura.trim(),
      tipo: form.tipo,
      capital_segurado: paraNumero(form.capital_segurado),
      premio_mensal: paraNumero(form.premio_mensal),
      status: form.status,
    };
    try {
      if (editando && cobertura) {
        await updateMut.mutateAsync({ id: cobertura.id, apolice_id: apoliceId, ...payload });
        toast.success("Cobertura atualizada.");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Cobertura criada.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar cobertura.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleDelete = async () => {
    if (!cobertura) return;
    try {
      await deleteMut.mutateAsync({ id: cobertura.id, apoliceId });
      toast.success("Cobertura excluída.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao excluir cobertura.", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar cobertura" : "Nova cobertura"}</DialogTitle>
          <DialogDescription>Coberturas vinculadas a uma apólice.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nome da cobertura *" htmlFor="nome_cobertura">
            <Input id="nome_cobertura" value={form.nome_cobertura} onChange={(e) => set("nome_cobertura", e.target.value)} placeholder="Ex.: Roubo e furto" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" htmlFor="tipo">
              <Select value={form.tipo} onValueChange={(v) => { if (v) set("tipo", v); }}>
                <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COBERTURA_TIPO.map((t) => <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status" htmlFor="status">
              <Select value={form.status} onValueChange={(v) => { if (v) set("status", v); }}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COBERTURA_STATUS.map((s) => <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Capital segurado" htmlFor="capital_segurado">
              <Input id="capital_segurado" inputMode="decimal" value={form.capital_segurado} onChange={(e) => set("capital_segurado", e.target.value)} placeholder={formatarMoeda(0)} />
            </Field>
            <Field label="Prêmio mensal" htmlFor="premio_mensal">
              <Input id="premio_mensal" inputMode="decimal" value={form.premio_mensal} onChange={(e) => set("premio_mensal", e.target.value)} placeholder={formatarMoeda(0)} />
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
