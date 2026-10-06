/** Retorna uma cor de texto (#000 ou #fff) com bom contraste sobre o hex informado. */
export function contrasteTexto(hex: string): string {
  const c = (hex ?? "").replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  if (full.length < 6) return "#ffffff";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#ffffff";
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? "#1f2937" : "#ffffff";
}

/** Converte um hex para "r, g, b" para uso em rgba(). */
export function hexParaRgb(hex: string): string {
  const c = (hex ?? "").replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  if (full.length < 6) return "0, 0, 0";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "0, 0, 0";
  return `${r}, ${g}, ${b}`;
}
