/**
 * Monta a URL do Google Agenda ("Adicionar evento" pré-preenchido) para um
 * cliente. Não precisa de OAuth/login — abre a tela de criação de evento do
 * Google com título/detalhes/local já preenchidos; o usuário só escolhe a
 * data/hora e salva.
 */
export function urlGoogleAgenda(cliente: {
  nome_completo: string;
  celular?: string | null;
  email?: string | null;
  cidade?: string | null;
  uf?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", `Reunião com ${cliente.nome_completo}`);

  const detalhes = [
    cliente.celular ? `Telefone: ${cliente.celular}` : null,
    cliente.email ? `E-mail: ${cliente.email}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  if (detalhes) params.set("details", detalhes);

  const local = [cliente.cidade, cliente.uf].filter(Boolean).join(" - ");
  if (local) params.set("location", local);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
