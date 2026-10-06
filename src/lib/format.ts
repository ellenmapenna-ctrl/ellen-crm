// Formatadores pt-BR usados em todo o CRM.

const moedaFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const inteiroFmt = new Intl.NumberFormat("pt-BR");

/** Formata um valor numérico como moeda BRL. Trata nulos/strings. */
export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "R$ 0,00";
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (Number.isNaN(n)) return "R$ 0,00";
  return moedaFmt.format(n);
}

/** Formata número inteiro com separador de milhar pt-BR. */
export function formatarInteiro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "0";
  return inteiroFmt.format(valor);
}

/** Converte "yyyy-mm-dd" (ISO) ou Date para "dd/mm/yyyy". */
export function formatarData(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formata uma data como "11 de agosto" (sem ano). Aceita Date ou ISO. */
export function formatarDataPorExtenso(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

/** Formata moeda em forma compacta: "R$ 71,16 mi" (≥1 milhão), "R$ 68,9 mil" (≥1 mil), senão moeda cheia. */
export function formatarMoedaCompacta(valor: number | null | undefined): string {
  const n = valor ?? 0;
  if (!n) return "R$ 0,00";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  }
  if (abs >= 100_000) {
    return `R$ ${(n / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
  }
  return formatarMoeda(n);
}

/** Converte um valor string/numérico em number, tratando vírgula decimal. */
export function paraNumero(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return valor;
  const limpo = valor.replace(/\s/g, "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isNaN(n) ? 0 : n;
}
