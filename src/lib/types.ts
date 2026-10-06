import type { Database } from "@/integrations/supabase/types";

// ---- Base table types (gerados a partir da migração) ----
export type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
export type ClienteInsert = Database["public"]["Tables"]["clientes"]["Insert"];
export type ClienteUpdate = Database["public"]["Tables"]["clientes"]["Update"];

export type Apolice = Database["public"]["Tables"]["apolices"]["Row"];
export type ApoliceInsert = Database["public"]["Tables"]["apolices"]["Insert"];
export type ApoliceUpdate = Database["public"]["Tables"]["apolices"]["Update"];

export type Cobertura = Database["public"]["Tables"]["coberturas"]["Row"];
export type CoberturaInsert = Database["public"]["Tables"]["coberturas"]["Insert"];
export type CoberturaUpdate = Database["public"]["Tables"]["coberturas"]["Update"];

export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type TagInsert = Database["public"]["Tables"]["tags"]["Insert"];
export type TagUpdate = Database["public"]["Tables"]["tags"]["Update"];

export type KanbanEstagio = Database["public"]["Tables"]["kanban_estagios"]["Row"];
export type KanbanEstagioInsert = Database["public"]["Tables"]["kanban_estagios"]["Insert"];
export type KanbanEstagioUpdate = Database["public"]["Tables"]["kanban_estagios"]["Update"];
export type FunilPosicao = Database["public"]["Tables"]["funil_posicoes"]["Row"];

export type MensagemTemplate = Database["public"]["Tables"]["mensagens_templates"]["Row"];

export type SitplanItem = Database["public"]["Tables"]["sitplan_itens"]["Row"];
export type SitplanItemInsert = Database["public"]["Tables"]["sitplan_itens"]["Insert"];
export type SitplanItemUpdate = Database["public"]["Tables"]["sitplan_itens"]["Update"];

export type Compromisso = Database["public"]["Tables"]["compromissos"]["Row"];
export type CompromissoInsert = Database["public"]["Tables"]["compromissos"]["Insert"];
export type CompromissoUpdate = Database["public"]["Tables"]["compromissos"]["Update"];

// ---- Tipos com relações aninhadas (resultado de selects com join) ----

/** Cliente com coberturas de cada apólice carregadas (uso na aba de apólices). */
export type ApoliceWithCoberturas = Apolice & {
  coberturas: Cobertura[] | null;
};

/** Cliente com apólices (já com coberturas aninhadas), vínculos de tags e estágio do Kanban carregados. */
export type ClienteWithRelations = Cliente & {
  apolices: ApoliceWithCoberturas[] | null;
  cliente_tags: { tag_id: string; tag: Tag }[] | null;
  estagio: Pick<KanbanEstagio, "id" | "nome" | "cor"> | null;
};

/** Item do SitPlan & TA com os dados do cliente carregados junto. */
export type SitplanItemWithCliente = SitplanItem & {
  cliente: Pick<Cliente, "id" | "nome_completo" | "celular" | "cidade" | "uf" | "email" | "data_nascimento">;
};

/** Compromisso da Agenda com o cliente vinculado (quando houver) carregado junto. */
export type CompromissoWithCliente = Compromisso & {
  cliente: Pick<Cliente, "id" | "nome_completo"> | null;
};

/** Linha enxuta retornada pelo hook de aniversariantes. */
export type AniversarianteRow = {
  id: string;
  nome_completo: string;
  data_nascimento: string | null;
  celular: string | null;
  estagio: { nome: string; cor: string } | null;
};

// ---- Domínios enumerados (espelham os CHECKs do banco) ----
export const APOLICE_STATUS = ["ativa", "cancelada", "suspensa"] as const;
export type ApoliceStatus = (typeof APOLICE_STATUS)[number];

export const COBERTURA_TIPO = ["base", "opcional"] as const;
export type CoberturaTipo = (typeof COBERTURA_TIPO)[number];

export const COBERTURA_STATUS = ["ativa", "cancelada"] as const;
export type CoberturaStatus = (typeof COBERTURA_STATUS)[number];

export const SEXO_OPCOES = ["masculino", "feminino", "outro"] as const;
export const ESTADO_CIVIL_OPCOES = [
  "solteiro",
  "casado",
  "divorciado",
  "viuvo",
  "uniao_estavel",
] as const;
