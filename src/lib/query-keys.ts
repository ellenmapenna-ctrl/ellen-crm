// Chaves de cache centralizadas do React Query.

export const qk = {
  clientes: {
    all: ["clientes"] as const,
    list: () => ["clientes", "list"] as const,
    detail: (id: string) => ["clientes", "detail", id] as const,
  },
  apolices: {
    all: ["apolices"] as const,
    byCliente: (clienteId: string) => ["apolices", "cliente", clienteId] as const,
  },
  coberturas: {
    byApolice: (apoliceId: string) => ["coberturas", "apolice", apoliceId] as const,
  },
  tags: {
    all: ["tags"] as const,
  },
  clienteTags: {
    all: ["cliente_tags"] as const,
    byCliente: (clienteId: string) => ["cliente_tags", "cliente", clienteId] as const,
  },
  kanbanEstagios: {
    all: ["kanban_estagios"] as const,
  },
  sitplan: {
    all: ["sitplan_itens"] as const,
    byData: (data: string) => ["sitplan_itens", "data", data] as const,
    countByData: (data: string) => ["sitplan_itens", "count", data] as const,
  },
  compromissos: {
    byPeriodo: (inicio: string, fim: string) => ["compromissos", "periodo", inicio, fim] as const,
  },
  revisitas: {
    all: ["revisitas"] as const,
    list: () => ["revisitas", "list"] as const,
    detail: (id: string) => ["revisitas", "detail", id] as const,
  },
  aniversariantes: (dias: number) => ["aniversariantes", dias] as const,
  templatesAniversario: {
    all: ["templates-aniversario", "all"] as const,
  },
  funilPosicoes: {
    all: ["funil-posicoes"] as const,
  },
} as const;
