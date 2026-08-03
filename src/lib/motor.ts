import type { Regra } from "@/types/ficha";

export type Estado = "fresco" | "frio";
export type Precip = { time: number; mm: number }; // time = epoch seconds

const H = 3600;

/**
 * Binary rain rule: rain accumulated in the past window OR the forecast window
 * at/above the threshold => 'frio' (mud holds water; don't go). Otherwise 'fresco'.
 * Generic dispatch on regra.tipo leaves room for future rule types.
 */
export function avaliar(regra: Regra, precips: Precip[], agora: number): Estado {
  switch (regra.tipo) {
    case "chuva_binaria": {
      const pastStart = agora - regra.janela_passado_horas * H;
      const futEnd = agora + regra.janela_previsao_horas * H;
      const pastSum = precips
        .filter((p) => p.time >= pastStart && p.time <= agora)
        .reduce((s, p) => s + p.mm, 0);
      const futSum = precips
        .filter((p) => p.time > agora && p.time <= futEnd)
        .reduce((s, p) => s + p.mm, 0);
      return pastSum >= regra.limiar_mm || futSum >= regra.limiar_mm
        ? "frio"
        : "fresco";
    }
    default:
      // Exhaustiveness: unknown rule types are a programming error.
      throw new Error(`regra.tipo não suportada: ${(regra as { tipo: string }).tipo}`);
  }
}
