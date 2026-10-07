// Apresentações institucionais de seguradoras, guardadas em /public/apresentacoes.
// Para adicionar outra: coloque o PDF em public/apresentacoes/ e inclua uma linha aqui.

export interface Apresentacao {
  key: string;
  label: string;
  url: string;
}

export const APRESENTACOES: Apresentacao[] = [{ key: "azos", label: "Azos", url: "/apresentacoes/azos.pdf" }];

export function apresentacaoPorKey(key: string): Apresentacao | undefined {
  return APRESENTACOES.find((a) => a.key === key);
}
