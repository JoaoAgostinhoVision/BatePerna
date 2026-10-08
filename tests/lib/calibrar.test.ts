import { describe, expect, it } from "vitest";
import { JaTemRegra, calibrarDoc } from "@/lib/calibrar";
import { loadAll } from "@/lib/ficha";

const PESSOA = JSON.stringify({
  slug: "pedra-mandada-cidade-teste", modos: [], cidade: "Cidade Teste", promessa: "p",
  trajeto: { waypoints: [{ nome: "Pedra Mandada", lat: -8.31, lng: -35.97 }] }, acesso: "a",
  condicao: { coords: { lat: -8.31, lng: -35.97 } }, custo: { tag: "gratis" },
});
const R = { janela_previsao_horas: 2, janela_passado_horas: 5, limiar_mm: 1.2, severidade: "espera" as const };

describe("calibrarDoc", () => {
  it("grava a regra inteira e a severidade, e nada mais muda", () => {
    const depois = JSON.parse(calibrarDoc(PESSOA, R));
    expect(depois.condicao).toEqual({
      coords: { lat: -8.31, lng: -35.97 },
      regra: { tipo: "chuva_binaria", janela_previsao_horas: 2, janela_passado_horas: 5, limiar_mm: 1.2 },
      severidade: "espera",
    });
    expect({ ...depois, condicao: undefined }).toEqual({ ...JSON.parse(PESSOA), condicao: undefined });
  });

  it("lugar que JÁ tem regra é recusado — calibrar não sobrescreve", () => {
    const rampa = JSON.stringify(loadAll().find((f) => f.slug === "rampa-do-pepe"));
    expect(() => calibrarDoc(rampa, R)).toThrow(JaTemRegra);
  });

  it("documento podre não vira calibrado", () => {
    expect(() => calibrarDoc('{"slug":"x"}', R)).toThrow();
  });
});
