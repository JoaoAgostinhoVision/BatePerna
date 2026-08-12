import { describe, expect, it } from "vitest";
import { MAPA_ALTURA_HOME_PX } from "@/lib/mapa";
import {
  ALTURA_APPBAR_PX,
  ALTURA_CABECALHO_GRUPO_PX,
  TETO_ANTES_DO_CARTAO_PX,
} from "@/lib/home-layout";

describe("o primeiro cartão nasce acima da dobra", () => {
  it("appbar + mapa + cabeçalho do grupo cabem no teto", () => {
    const soma = ALTURA_APPBAR_PX + MAPA_ALTURA_HOME_PX + ALTURA_CABECALHO_GRUPO_PX;
    expect(soma).toBeLessThanOrEqual(TETO_ANTES_DO_CARTAO_PX);
  });

  it("o mapa da home é mais baixo que o da ficha", () => {
    expect(MAPA_ALTURA_HOME_PX).toBeLessThan(200);
  });

});
