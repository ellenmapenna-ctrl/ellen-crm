import { ptBR } from "date-fns/locale";
import { differenceInCalendarYears, differenceInMonths, differenceInYears, isSameDay } from "date-fns";

/** Extrai o primeiro nome do nome completo (primeiro token, sem espaços). */
export function primeiroNome(nomeCompleto: string | null | undefined): string {
  if (!nomeCompleto) return "";
  return nomeCompleto.trim().split(/\s+/)[0];
}

/**
 * Calcula a data do próximo aniversário (mês/dia do nascimento) a partir da
 * referência informada, sem considerar o ano de nascimento.
 */
export function proximaDataAniversario(
  dataNascimento: string | Date | null | undefined,
  referencia: Date = new Date()
): Date | null {
  if (!dataNascimento) return null;
  const nasc = typeof dataNascimento === "string" ? new Date(dataNascimento + "T00:00:00") : dataNascimento;
  if (Number.isNaN(nasc.getTime())) return null;

  const ref = new Date(referencia);
  let proximo = new Date(ref.getFullYear(), nasc.getMonth(), nasc.getDate());
  // Se o aniversário deste ano já passou (antes de hoje), agenda para o ano seguinte.
  if (proximo < new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())) {
    proximo = new Date(ref.getFullYear() + 1, nasc.getMonth(), nasc.getDate());
  }
  return proximo;
}

/** Idade que a pessoa fará no próximo aniversário. */
export function idadeQueFara(
  dataNascimento: string | Date | null | undefined,
  referencia: Date = new Date()
): number | null {
  if (!dataNascimento) return null;
  const nasc = typeof dataNascimento === "string" ? new Date(dataNascimento + "T00:00:00") : dataNascimento;
  if (Number.isNaN(nasc.getTime())) return null;
  const proximo = proximaDataAniversario(dataNascimento, referencia);
  if (!proximo) return null;
  return differenceInCalendarYears(proximo, nasc);
}

/**
 * Idade atual completa, em anos e meses (ex.: "32 anos e 7 meses"),
 * calculada a partir da data de referência — diferente de `idadeQueFara`,
 * que calcula a idade no *próximo* aniversário, não a idade de hoje.
 */
export function idadeAtualDetalhada(
  dataNascimento: string | Date | null | undefined,
  referencia: Date = new Date()
): { anos: number; meses: number } | null {
  if (!dataNascimento) return null;
  const nasc = typeof dataNascimento === "string" ? new Date(dataNascimento + "T00:00:00") : dataNascimento;
  if (Number.isNaN(nasc.getTime())) return null;
  if (nasc > referencia) return null;

  const anos = differenceInYears(referencia, nasc);
  const ultimoAniversario = new Date(nasc);
  ultimoAniversario.setFullYear(nasc.getFullYear() + anos);
  const meses = differenceInMonths(referencia, ultimoAniversario);
  return { anos, meses };
}

/** Indica se o aniversário cai exatamente hoje. */
export function ehAniversarioHoje(
  dataNascimento: string | Date | null | undefined,
  referencia: Date = new Date()
): boolean {
  const proximo = proximaDataAniversario(dataNascimento, referencia);
  if (!proximo) return false;
  return isSameDay(proximo, referencia);
}

/** Indica se o aniversário cai no mesmo mês da referência (independente do dia). */
export function ehAniversarioMesAtual(
  dataNascimento: string | Date | null | undefined,
  referencia: Date = new Date()
): boolean {
  if (!dataNascimento) return false;
  const nasc = typeof dataNascimento === "string" ? new Date(dataNascimento + "T00:00:00") : dataNascimento;
  if (Number.isNaN(nasc.getTime())) return false;
  return nasc.getMonth() === referencia.getMonth();
}

/** Formata uma data como "11 de agosto" usando date-fns/locale pt-BR. */
export function formatarDataPorExtensoDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

/** Substitui o placeholder {primeiro_nome} no corpo do template. */
export function substituirPrimeiroNome(corpo: string, nomeCompleto: string | null | undefined): string {
  return corpo.replaceAll("{primeiro_nome}", primeiroNome(nomeCompleto));
}

export { ptBR };
