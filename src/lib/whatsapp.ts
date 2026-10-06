// Helpers para montar links do WhatsApp a partir do campo `celular`.
// O envio final continua manual — só abrimos a conversa pronta no WhatsApp.

/** Mantém apenas dígitos do celular informado. */
export function limparCelular(celular: string | null | undefined): string {
  if (!celular) return "";
  return celular.replace(/\D/g, "");
}

/**
 * Garante o código do Brasil (55) no início do número.
 * Se o número já começa com 55 e tem 12+ dígitos, presume que já está completo.
 */
function comDDI(numeroLimpo: string): string {
  if (!numeroLimpo) return "";
  if (numeroLimpo.startsWith("55") && numeroLimpo.length >= 12) return numeroLimpo;
  return `55${numeroLimpo}`;
}

// Usamos web.whatsapp.com (em vez de wa.me) de propósito: o link wa.me é
// entregue ao app WhatsApp Desktop no Mac, que tem um bug conhecido de
// corromper emojis (viram "�"). Forçando web.whatsapp.com o link abre numa
// aba do navegador, onde os emojis chegam certos.

/** Monta `https://web.whatsapp.com/send?phone=55...` para abrir uma conversa (sem texto). */
export function montarLinkWhatsapp(celular: string | null | undefined): string | null {
  const numero = comDDI(limparCelular(celular));
  if (numero.length < 12) return null;
  return `https://web.whatsapp.com/send?phone=${numero}`;
}

/** Monta `https://web.whatsapp.com/send?phone=55...&text=<mensagem codificada>`. */
export function montarLinkWhatsappComTexto(
  celular: string | null | undefined,
  mensagem: string
): string | null {
  const base = montarLinkWhatsapp(celular);
  if (!base) return null;
  return `${base}&text=${encodeURIComponent(mensagem)}`;
}

/** Abre o link do WhatsApp em nova aba (evita bloqueio de pop-up). */
export function abrirWhatsapp(celular: string | null | undefined, mensagem?: string): void {
  const link = mensagem ? montarLinkWhatsappComTexto(celular, mensagem) : montarLinkWhatsapp(celular);
  if (!link) return;
  window.open(link, "_blank", "noopener,noreferrer");
}
