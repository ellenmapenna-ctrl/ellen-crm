// Listas de opções usadas nos seletores da tela de comparativo (Nova Revisita
// / Editar Revisita), no mesmo espírito do seletor de cobertura/seguradora do
// Platoris — combobox com sugestões fixas, mas sempre aceitando texto livre.
export const SUGESTOES_COBERTURA = [
  "Morte qualquer causa",
  "Morte acidental",
  "Invalidez permanente por acidente",
  "Invalidez por doença",
  "Diagnóstico de doenças graves",
  "Diagnóstico de doenças graves Básico",
  "Diagnóstico de doenças graves Plus",
  "Diagnóstico de doenças graves Modular",
  "Diagnóstico de doenças graves Essencial",
  "Diagnóstico de doenças graves Multi",
  "Doenças incapacitantes",
  "Diária por internação hospitalar",
  "Diária por incapacidade temporária",
  "Cirurgias",
  "Cirurgias ampliada",
  "Quebra de ossos",
  "Assistência funeral",
  "Assistência funeral — Individual",
  "Assistência funeral — Familiar",
  "Resgate",
];

export const SEGURADORAS = ["Prudential", "MAG", "Azos", "Icatu", "Metlife", "SulAmerica", "Porto Seguro", "Allianz", "Omint"];

/** "Azos + Icatu" → ["Azos", "Icatu"]. */
export function listarSeguradoras(valor: string): string[] {
  return valor
    .split("+")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** ["Azos", "Icatu"] → "Azos + Icatu" (formato usado no documento e pela leitura da IA). */
export function juntarSeguradoras(lista: string[]): string {
  return lista.join(" + ");
}

/** Opções para escolher a seguradora dos textos padrão de uma cobertura: as da revisita primeiro, depois as demais conhecidas. */
export function opcoesSeguradora(valor: string): string[] {
  const doLado = listarSeguradoras(valor);
  return [...doLado, ...SEGURADORAS.filter((s) => !doLado.some((d) => d.toLowerCase() === s.toLowerCase()))];
}
