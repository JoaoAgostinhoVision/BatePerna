import { describe, expect, it } from "vitest";
import { campoPorCaminho } from "@/lib/campos-da-ficha";
import { ROTULO_GRATIS, ROTULO_PAGO, rotulosDe } from "@/lib/rotulos-das-opcoes";
import { DIAS, NOME_DO_DIA } from "@/lib/semana";

describe("rotulosDe — a palavra da tela de cada opção", () => {
  it("toda opção de custo.tag e de dias tem rótulo (nenhuma cai no valor cru)", () => {
    for (const c of ["custo.tag", "dias"]) {
      const opcoes = campoPorCaminho(c)!.opcoes!;
      expect(opcoes.length, c).toBeGreaterThan(1);
      for (const o of opcoes) expect(rotulosDe(c)![o], `${c}/${o}`).toBeTruthy();
    }
  });

  it("custo.tag é Grátis/Pago e dias é o nome do dia de semana.ts", () => {
    expect(rotulosDe("custo.tag")).toEqual({ gratis: ROTULO_GRATIS, pago: ROTULO_PAGO });
    for (const d of DIAS) expect(rotulosDe("dias")![d]).toBe(NOME_DO_DIA[d]);
  });

  it("campo sem rótulos devolve undefined (a opção aparece pelo valor)", () => {
    expect(rotulosDe("piso")).toBeUndefined();
    expect(rotulosDe("condicao.severidade")).toBeUndefined();
  });
});
