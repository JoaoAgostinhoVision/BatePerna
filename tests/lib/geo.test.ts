import { describe, expect, it } from "vitest";
import { distanciaKm, formatarDistancia } from "@/lib/geo";

// Âncoras derivadas da própria geometria da esfera, não de geografia real:
// um grau no equador = 2·π·6371/360 = 111,195 km.
const GRAU_KM = (2 * Math.PI * 6371) / 360;

describe("distanciaKm", () => {
  it("um grau de longitude no equador ≈ 111,195 km", () => {
    const d = distanciaKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(d).toBeCloseTo(GRAU_KM, 1);
  });

  it("um grau de latitude ≈ 111,195 km (vale em qualquer meridiano)", () => {
    const d = distanciaKm({ lat: 0, lng: -36 }, { lat: 1, lng: -36 });
    expect(d).toBeCloseTo(GRAU_KM, 1);
  });

  it("o mesmo ponto dá zero", () => {
    const p = { lat: -7.907889, lng: -36.019222 };
    expect(distanciaKm(p, p)).toBeCloseTo(0, 6);
  });

  it("é simétrica", () => {
    const a = { lat: -7.907889, lng: -36.019222 };
    const b = { lat: -8.05, lng: -34.9 };
    expect(distanciaKm(a, b)).toBeCloseTo(distanciaKm(b, a), 9);
  });

  it("longitude encolhe com a latitude (1° a −60° vale metade do equador)", () => {
    const noEquador = distanciaKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const em60 = distanciaKm({ lat: -60, lng: 0 }, { lat: -60, lng: 1 });
    expect(em60).toBeCloseTo(noEquador / 2, 0);
  });
});

describe("formatarDistancia", () => {
  it("abaixo de 1 km não finge precisão", () => {
    expect(formatarDistancia(0.4)).toBe("menos de 1 km em linha reta daqui");
    expect(formatarDistancia(0.9)).toBe("menos de 1 km em linha reta daqui");
  });

  it("entre 1 e 10 km usa uma casa decimal com vírgula", () => {
    expect(formatarDistancia(1)).toBe("~1,0 km em linha reta daqui");
    expect(formatarDistancia(4.24)).toBe("~4,2 km em linha reta daqui");
    expect(formatarDistancia(9.9)).toBe("~9,9 km em linha reta daqui");
  });

  it("de 10 km pra cima arredonda pra inteiro", () => {
    expect(formatarDistancia(10)).toBe("~10 km em linha reta daqui");
    expect(formatarDistancia(38.4)).toBe("~38 km em linha reta daqui");
    expect(formatarDistancia(124.6)).toBe("~125 km em linha reta daqui");
  });

  it("na lacuna [9,95, 10) arredonda pra 10 inteiro, não '10,0'", () => {
    expect(formatarDistancia(9.99)).toBe("~10 km em linha reta daqui");
  });

  it('cada ramo diz "em linha reta" — é o que impede o número de mentir', () => {
    for (const km of [0.1, 0.99, 1, 5.5, 9.99, 10, 42, 999]) {
      expect(formatarDistancia(km)).toContain("em linha reta");
    }
  });
});
