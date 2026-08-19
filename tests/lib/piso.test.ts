import { describe, expect, it } from "vitest";
import { ordemPiso, PISOS, PISOS_FILTRAVEIS, rotuloPiso } from "@/lib/piso";

describe("PISOS: a ordem é a escala", () => {
  // A escala existe pra ser comparada; sem isto, ordemPiso é decoração.
  it("a ordem vai do pior pro melhor: barro < paralelepipedo < esburacado < tapete", () => {
    expect(ordemPiso("barro")).toBeLessThan(ordemPiso("paralelepipedo"));
    expect(ordemPiso("paralelepipedo")).toBeLessThan(ordemPiso("asfalto-esburacado"));
    expect(ordemPiso("asfalto-esburacado")).toBeLessThan(ordemPiso("asfalto-tapete"));
  });

  // 🔴 O teste que impede a segunda lista escrita à mão. A comparação tem que
  // ser CONTRA PISOS, não contra uma lista literal escrita aqui — senão o
  // teste passa igual com PISOS_FILTRAVEIS copiado à mão, e vira decoração.
  it("PISOS_FILTRAVEIS é PISOS sem o primeiro — derivado, não copiado", () => {
    expect(PISOS_FILTRAVEIS).toEqual(PISOS.slice(1));
    expect(PISOS_FILTRAVEIS.length).toBe(PISOS.length - 1);
    expect(PISOS_FILTRAVEIS).not.toContain(PISOS[0]);
  });

  it("rotuloPiso troca o hífen por espaço: asfalto-esburacado → 'asfalto esburacado'", () => {
    expect(rotuloPiso("asfalto-esburacado")).toBe("asfalto esburacado");
    expect(rotuloPiso("barro")).toBe("barro");
  });
});
