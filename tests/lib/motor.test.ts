import { describe, expect, it } from "vitest";
import { avaliar, type Precip } from "@/lib/motor";
import type { Regra } from "@/types/ficha";

const H = 3600;
const AGORA = 1_000_000; // arbitrary fixed epoch-seconds "now"
const regra: Regra = {
  tipo: "chuva_binaria",
  janela_previsao_horas: 48,
  janela_passado_horas: 48,
  limiar_mm: 0.2,
};

function precip(offsetHours: number, mm: number): Precip {
  return { time: AGORA + offsetHours * H, mm };
}

describe("motor chuva_binaria", () => {
  it("returns 'fresco' when dry in both windows", () => {
    const precips = [precip(-24, 0), precip(-1, 0), precip(12, 0), precip(40, 0)];
    expect(avaliar(regra, precips, AGORA)).toBe("fresco");
  });

  it("returns 'frio' when rain in the forecast window", () => {
    const precips = [precip(-1, 0), precip(10, 0.5)];
    expect(avaliar(regra, precips, AGORA)).toBe("frio");
  });

  it("returns 'frio' when rain in the past window (mud holds water)", () => {
    const precips = [precip(-6, 0.9), precip(10, 0)];
    expect(avaliar(regra, precips, AGORA)).toBe("frio");
  });

  it("ignores rain outside both windows", () => {
    const precips = [precip(-60, 5), precip(60, 5)];
    expect(avaliar(regra, precips, AGORA)).toBe("fresco");
  });

  it("respects the threshold (below limiar = fresco)", () => {
    const precips = [precip(-3, 0.1), precip(3, 0.1)];
    expect(avaliar(regra, precips, AGORA)).toBe("fresco");
  });

  it("threshold boundary: sum >= limiar = frio", () => {
    const precips = [precip(-3, 0.1), precip(-2, 0.1)]; // past sum 0.2 == limiar
    expect(avaliar(regra, precips, AGORA)).toBe("frio");
  });
});
