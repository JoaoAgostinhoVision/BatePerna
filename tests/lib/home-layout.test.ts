import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAPA_ALTURA_HOME_PX } from "@/lib/mapa";
import {
  ALTURA_APPBAR_PX,
  ALTURA_CABECALHO_GRUPO_PX,
  ALTURA_LINHA_FILTRO_PX,
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

  it("o CSS usa a MESMA altura que a constante — senão a conta da dobra é ficção", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
    const regra = css.match(/\.mapa-home\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .mapa-home no home.css").not.toBeNull();
    expect(regra![0]).toContain(`height: ${MAPA_ALTURA_HOME_PX}px`);
  });

  // A linha de resumo dos filtros entra ENTRE o mapa e a folha: ela come da
  // mesma folga que garante o primeiro cartão acima da dobra.
  it("appbar + mapa + LINHA DO FILTRO + cabeçalho ainda cabem no teto", () => {
    const soma =
      ALTURA_APPBAR_PX + MAPA_ALTURA_HOME_PX + ALTURA_LINHA_FILTRO_PX + ALTURA_CABECALHO_GRUPO_PX;
    expect(soma).toBeLessThanOrEqual(TETO_ANTES_DO_CARTAO_PX);
  });

  it("o CSS usa a MESMA altura da constante da linha", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
    const regra = css.match(/\.filtro-linha\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .filtro-linha").not.toBeNull();
    expect(regra![0]).toContain(`min-height: ${ALTURA_LINHA_FILTRO_PX}px`);
  });
});
