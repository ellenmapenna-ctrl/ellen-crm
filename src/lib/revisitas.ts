// Biblioteca de documentos de "Revisão Anual" (Revisita | Gestão de Apólice —
// Prudential x Azos). Os HTMLs em si vivem em public/revisitas/ e contêm
// dados financeiros reais de clientes — por isso a rota /revisitas fica
// atrás de RevisitasGate (senha simples). Isso é uma barreira de UI, não
// segurança real: os arquivos continuam acessíveis por URL direta pra quem
// souber o caminho exato. Trocar a senha aqui quando quiser.
export const REVISITAS_SENHA = "2407";

export interface RevisitaDoc {
  id: string;
  clienteNome: string;
  arquivo: string; // caminho servido pelo Vite a partir de public/
  dataGeracao: string; // ISO date
  resumo: string;
}

// Lista de documentos legados (HTMLs estáticos pré-Supabase) — esvaziada a
// pedido da Ellen. Toda revisita nova já é criada direto no banco (tabela
// "revisitas"), com Editar/Duplicar/Excluir — ver useRevisitas.ts.
export const REVISITAS: RevisitaDoc[] = [];
