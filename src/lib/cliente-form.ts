import type { ClienteInsert, ClienteWithRelations } from "@/lib/types";

/** Estado de formulário do cliente: todos os campos como string (datas em ISO yyyy-mm-dd). */
export type ClienteFormState = Record<string, string>;

/** Converte o estado do formulário (strings) em um cliente pronto para o Supabase (sem id/created_at/updated_at). */
export const clienteFormToInsert = (form: ClienteFormState): Omit<ClienteInsert, "id" | "created_at" | "updated_at"> => ({
  nome_completo: form.nome_completo?.trim() ?? "",
  cpf: form.cpf?.trim() || null,
  email: form.email?.trim() || null,
  celular: form.celular?.trim() || null,
  data_nascimento: form.data_nascimento || null,
  sexo: form.sexo || null,
  estado_civil: form.estado_civil || null,
  profissao: form.profissao?.trim() || null,
  empresa: form.empresa?.trim() || null,
  cargo: form.cargo?.trim() || null,
  cep: form.cep?.trim() || null,
  endereco: form.endereco?.trim() || null,
  numero: form.numero?.trim() || null,
  complemento: form.complemento?.trim() || null,
  bairro: form.bairro?.trim() || null,
  cidade: form.cidade?.trim() || null,
  uf: form.uf?.trim() || null,
  cliente_desde: form.cliente_desde || null,
  observacoes: form.observacoes?.trim() || null,
});

/** Monta o estado inicial do formulário a partir de um cliente carregado. */
export const estadoInicialCliente = (
  cliente: ClienteWithRelations | null | undefined
): ClienteFormState => ({
  nome_completo: cliente?.nome_completo ?? "",
  cpf: cliente?.cpf ?? "",
  email: cliente?.email ?? "",
  celular: cliente?.celular ?? "",
  data_nascimento: cliente?.data_nascimento ?? "",
  sexo: cliente?.sexo ?? "",
  estado_civil: cliente?.estado_civil ?? "",
  profissao: cliente?.profissao ?? "",
  empresa: cliente?.empresa ?? "",
  cargo: cliente?.cargo ?? "",
  cep: cliente?.cep ?? "",
  endereco: cliente?.endereco ?? "",
  numero: cliente?.numero ?? "",
  complemento: cliente?.complemento ?? "",
  bairro: cliente?.bairro ?? "",
  cidade: cliente?.cidade ?? "",
  uf: cliente?.uf ?? "",
  cliente_desde: cliente?.cliente_desde ?? "",
  observacoes: cliente?.observacoes ?? "",
});

