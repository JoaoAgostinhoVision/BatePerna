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

/** O home.css sem os comentários. Mesmo motivo do helper gêmeo em
 *  tests/app/BarraNavegacao.test.tsx: um `.mapa-home { … }` escrito em PROSA
 *  dentro de um comentário casaria antes da regra de verdade, e a suíte ficaria
 *  vermelha (ou verde) por um texto. */
const home = () =>
  readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

const regraDe = (fonte: string, seletor: string) => {
  const re = new RegExp(`${seletor.replace(/[.\-]/g, "\\$&")}\\s*\\{[^}]*\\}`, "s");
  return fonte.match(re);
};

/** 🔴 O VALOR DA DECLARAÇÃO, não "existe em algum lugar deste bloco".
 *
 *  `toContain("height: 168px")` sobre o bloco inteiro é substring de
 *  `max-height: 168px`: a mutação `height:` → `max-height:` deixava a suíte
 *  VERDE e o mapa sumia inteiro da home — os tiles são `position: absolute`,
 *  então sem altura própria a caixa colapsa e os pins ficam boiando. A mesma
 *  fresta vale pro `min-height`, onde o decoy é um `--min-height: 36px`
 *  (propriedade customizada, inerte, e substring perfeita).
 *
 *  A âncora `(?:^|[{;])` obriga a propriedade a COMEÇAR uma declaração: o `-`
 *  de `max-` e o `-` de `--min` não são `{` nem `;` nem início de string. E o
 *  valor volta inteiro, pra ser comparado com `toBe` — bloco cresce, declaração
 *  não. */
const valorDe = (regra: string, prop: string): string | null => {
  const m = regra.match(new RegExp(`(?:^|[{;])\\s*${prop}\\s*:\\s*([^;}]+)`, "s"));
  return m ? m[1].trim() : null;
};

describe("o primeiro cartão nasce acima da dobra", () => {
  it("appbar + mapa + cabeçalho do grupo cabem no teto", () => {
    const soma = ALTURA_APPBAR_PX + MAPA_ALTURA_HOME_PX + ALTURA_CABECALHO_GRUPO_PX;
    expect(soma).toBeLessThanOrEqual(TETO_ANTES_DO_CARTAO_PX);
  });

  it("o mapa da home é mais baixo que o da ficha", () => {
    expect(MAPA_ALTURA_HOME_PX).toBeLessThan(200);
  });

  it("o CSS usa a MESMA altura que a constante — senão a conta da dobra é ficção", () => {
    const regra = regraDe(home(), ".mapa-home");
    expect(regra, "faltou a regra .mapa-home no home.css").not.toBeNull();
    expect(valorDe(regra![0], "height"), "a altura do mapa deixou de ser uma declaração `height`")
      .toBe(`${MAPA_ALTURA_HOME_PX}px`);
  });

  // A linha de resumo dos filtros entra ENTRE o mapa e a folha: ela come da
  // mesma folga que garante o primeiro cartão acima da dobra.
  it("appbar + mapa + LINHA DO FILTRO + cabeçalho ainda cabem no teto", () => {
    const soma =
      ALTURA_APPBAR_PX + MAPA_ALTURA_HOME_PX + ALTURA_LINHA_FILTRO_PX + ALTURA_CABECALHO_GRUPO_PX;
    expect(soma).toBeLessThanOrEqual(TETO_ANTES_DO_CARTAO_PX);
  });

  it("o CSS usa a MESMA altura da constante da linha", () => {
    const regra = regraDe(home(), ".filtro-linha");
    expect(regra, "faltou a regra .filtro-linha").not.toBeNull();
    expect(valorDe(regra![0], "min-height"), "a altura da linha deixou de ser um `min-height`")
      .toBe(`${ALTURA_LINHA_FILTRO_PX}px`);
  });
});
