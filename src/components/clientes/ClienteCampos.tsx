import type * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/shared/Field";
import { ESTADO_CIVIL_OPCOES, SEXO_OPCOES } from "@/lib/types";
import type { ClienteFormState } from "@/lib/cliente-form";

const ESTADO_CIVIL_LABEL: Record<string, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  uniao_estavel: "União estável",
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ClienteCampos({
  form,
  set,
  funis,
}: {
  form: ClienteFormState;
  set: (k: string, v: string) => void;
  /** Seletores de funil (ver FunisDoClienteCampos), na seção "Pipeline". */
  funis?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Dados pessoais</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Nome completo *" htmlFor="nome_completo" className="sm:col-span-2">
            <Input id="nome_completo" value={form.nome_completo ?? ""} onChange={(e) => set("nome_completo", e.target.value)} placeholder="Nome e sobrenome" />
          </Field>
          <Field label="CPF" htmlFor="cpf">
            <Input id="cpf" value={form.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" />
          </Field>
          <Field label="Data de nascimento" htmlFor="data_nascimento">
            <Input id="data_nascimento" type="date" value={form.data_nascimento ?? ""} onChange={(e) => set("data_nascimento", e.target.value)} />
          </Field>
          <Field label="Sexo" htmlFor="sexo">
            <Select value={form.sexo ?? ""} onValueChange={(v) => { if (v) set("sexo", v); }}>
              <SelectTrigger id="sexo"><SelectValue placeholder="Selecione">{form.sexo ? capitalize(form.sexo) : undefined}</SelectValue></SelectTrigger>
              <SelectContent>
                {SEXO_OPCOES.map((s) => <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado civil" htmlFor="estado_civil">
            <Select value={form.estado_civil ?? ""} onValueChange={(v) => { if (v) set("estado_civil", v); }}>
              <SelectTrigger id="estado_civil"><SelectValue placeholder="Selecione">{form.estado_civil ? (ESTADO_CIVIL_LABEL[form.estado_civil] ?? capitalize(form.estado_civil)) : undefined}</SelectValue></SelectTrigger>
              <SelectContent>
                {ESTADO_CIVIL_OPCOES.map((s) => <SelectItem key={s} value={s}>{ESTADO_CIVIL_LABEL[s] ?? capitalize(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Contato</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="E-mail" htmlFor="email">
            <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="email@exemplo.com" />
          </Field>
          <Field label="Celular" htmlFor="celular">
            <Input id="celular" value={form.celular ?? ""} onChange={(e) => set("celular", e.target.value)} placeholder="(11) 99999-9999" />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Endereço</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="CEP" htmlFor="cep">
            <Input id="cep" value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} />
          </Field>
          <Field label="Número" htmlFor="numero">
            <Input id="numero" value={form.numero ?? ""} onChange={(e) => set("numero", e.target.value)} />
          </Field>
          <Field label="UF" htmlFor="uf" className="col-span-2 sm:col-span-1">
            <Input id="uf" value={form.uf ?? ""} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" />
          </Field>
          <Field label="Cidade" htmlFor="cidade" className="col-span-2 sm:col-span-2">
            <Input id="cidade" value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
          </Field>
          <Field label="Bairro" htmlFor="bairro" className="col-span-2">
            <Input id="bairro" value={form.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} />
          </Field>
          <Field label="Logradouro" htmlFor="endereco" className="col-span-2 sm:col-span-3">
            <Input id="endereco" value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} />
          </Field>
          <Field label="Complemento" htmlFor="complemento">
            <Input id="complemento" value={form.complemento ?? ""} onChange={(e) => set("complemento", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Profissional e comercial</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Profissão" htmlFor="profissao">
            <Input id="profissao" value={form.profissao ?? ""} onChange={(e) => set("profissao", e.target.value)} />
          </Field>
          <Field label="Empresa" htmlFor="empresa">
            <Input id="empresa" value={form.empresa ?? ""} onChange={(e) => set("empresa", e.target.value)} />
          </Field>
          <Field label="Cargo" htmlFor="cargo">
            <Input id="cargo" value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Pipeline e observações</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {funis}
          <Field label="Cliente desde" htmlFor="cliente_desde">
            <Input id="cliente_desde" type="date" value={form.cliente_desde ?? ""} onChange={(e) => set("cliente_desde", e.target.value)} />
          </Field>
          <Field label="Observações" htmlFor="observacoes" className="sm:col-span-2">
            <Textarea id="observacoes" rows={3} value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} placeholder="Anotações livres sobre o cliente" />
          </Field>
        </div>
      </section>
    </div>
  );
}

