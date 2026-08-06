import { describe, expect, it } from "vitest";
import { VALIDADE_S, carimboVenceu, horaCurtaRecife } from "@/lib/validade";

const BASE = 1_800_000_000; // epoch em segundos, qualquer

describe("carimboVenceu", () => {
  it("leitura de agora vale", () => {
    expect(carimboVenceu(BASE, BASE)).toBe(false);
  });

  it("aos 29 minutos ainda vale", () => {
    expect(carimboVenceu(BASE, BASE + 29 * 60)).toBe(false);
  });

  it("aos 30 minutos vence", () => {
    expect(carimboVenceu(BASE, BASE + 30 * 60)).toBe(true);
  });

  it("muito depois, vence", () => {
    expect(carimboVenceu(BASE, BASE + 5 * 3600)).toBe(true);
  });

  it("relógio do celular atrasado não faz o carimbo vencer", () => {
    expect(carimboVenceu(BASE, BASE - 3600)).toBe(false);
  });

  it("a validade é de 30 minutos", () => {
    expect(VALIDADE_S).toBe(1800);
  });
});

describe("horaCurtaRecife", () => {
  it("formata no fuso de Recife (UTC-3), não em UTC", () => {
    // 2027-01-15T11:12:00Z = 08h12 em Recife
    expect(horaCurtaRecife(Date.UTC(2027, 0, 15, 11, 12) / 1000)).toBe("8h12");
  });

  it("preenche o minuto com zero", () => {
    expect(horaCurtaRecife(Date.UTC(2027, 0, 15, 11, 5) / 1000)).toBe("8h05");
  });

  it("atravessa a meia-noite pra trás sem quebrar", () => {
    // 01h30 UTC = 22h30 do dia anterior em Recife
    expect(horaCurtaRecife(Date.UTC(2027, 0, 15, 1, 30) / 1000)).toBe("22h30");
  });
});
