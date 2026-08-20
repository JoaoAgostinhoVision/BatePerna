import { describe, expect, it } from "vitest";
import {
  distanciaKm,
  formatarDistancia,
  formatarDistanciaCurta,
  formatarExtensao,
} from "@/lib/geo";

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

describe("formatarDistanciaCurta: a linha do cartão", () => {
  // "em linha reta" é load-bearing: no agreste, 40km em reta podem ser 1h30
  // de serra. Sem o rótulo, o número mente pra baixo. Só o "daqui" sai — a
  // pílula do mapa já diz de onde se está medindo.
  it("mantém o 'em linha reta'", () => {
    expect(formatarDistanciaCurta(41)).toBe("~41 km em linha reta");
  });
  it("não repete o 'daqui' que a pílula já diz", () => {
    expect(formatarDistanciaCurta(41)).not.toContain("daqui");
  });
  it("abaixo de 1 km", () => {
    expect(formatarDistanciaCurta(0.4)).toBe("menos de 1 km em linha reta");
  });
  it("uma casa decimal abaixo de 10, com vírgula", () => {
    expect(formatarDistanciaCurta(4.25)).toBe("~4,3 km em linha reta");
  });
});

describe("formatarExtensao: o mesmo número no cartão e na ficha", () => {
  // O sufixo é da FUNÇÃO, não do chamador — ver o comentário em geo.ts.
  it("formatarExtensao(4) devolve '4 km de trilha', com o sufixo", () => {
    expect(formatarExtensao(4)).toBe("4 km de trilha");
  });

  it("não devolve o mesmo formato de formatarDistanciaCurta", () => {
    // formatarDistanciaCurta sempre diz "em linha reta" e nunca "de trilha";
    // formatarExtensao é o oposto. Se as duas convergissem, um chamador
    // trocado por outro passaria despercebido.
    //
    // MEDIDO, pra este comentário não prometer mais do que entrega:
    // - com `formatarExtensao` delegando pra `formatarDistanciaCurta` (a
    //   convergência que o nome do teste cita), ele CAI — 'expected
    //   "~4,0 km em linha reta" not to be "~4,0 km em linha reta"'.
    // - com o sufixo " de trilha" simplesmente apagado, ele NÃO cai: "4 km" e
    //   "~4,0 km em linha reta" continuam diferentes, e nenhuma das três
    //   asserções olha pro sufixo. Quem mata esse caso são os testes de valor
    //   exato acima e abaixo, e é lá que ele está coberto — não aqui.
    expect(formatarExtensao(4)).not.toBe(formatarDistanciaCurta(4));
    expect(formatarExtensao(4)).not.toContain("em linha reta");
    expect(formatarDistanciaCurta(4)).not.toContain("de trilha");
  });

  it("fração abaixo de 10 usa uma casa decimal com vírgula", () => {
    expect(formatarExtensao(4.25)).toBe("4,3 km de trilha");
  });

  it("valor inteiro não ganha ',0' à toa", () => {
    expect(formatarExtensao(12)).toBe("12 km de trilha");
  });
});
