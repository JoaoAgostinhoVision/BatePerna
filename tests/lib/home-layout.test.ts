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
const semComentarios = (arq: string) =>
  readFileSync(path.join(process.cwd(), "src", "app", arq), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
const home = () => semComentarios("home.css");
const fichaCss = () => semComentarios("ficha.css");

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

/** Os valores de um shorthand, separados por espaço fora de parênteses. */
const fatiar = (valores: string): string[] => valores.trim().split(/\s+/);

/** rem → px. Nenhum arquivo do app declara `font-size` na raiz (o teste logo
 *  abaixo prova), então vale o padrão do navegador: 16px. */
const REM_PX = 16;
const px = (valor: string | null | undefined): number => {
  const m = valor?.trim().match(/^(-?[\d.]*\d)(px|rem)$/);
  if (!m) return NaN;
  return parseFloat(m[1]) * (m[2] === "rem" ? REM_PX : 1);
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

  // 🔴 O teste acima só prova que o CSS repete o número da constante. Ele é
  // CEGO pra pergunta que importa: esse `min-height` MORDE? A constante era 36
  // e a linha media 39,2px no navegador, porque quem mandava era o miolo — e o
  // teste de orçamento somava a constante, nunca a régua. Com o botão em
  // `min-height: 64px` a suíte ficava verde e o primeiro cartão nascia em
  // y=344,65, acima do teto de 320 que o teste diz defender.
  //
  // Isto aqui refaz a conta da altura da caixa a partir do CSS: `box-sizing:
  // border-box` (`.bp, .bp *`) faz o `min-height` incluir padding e borda, e o
  // conteúdo é o item mais alto da linha. Se o declarado for menor que o que o
  // miolo empurra, o `min-height` virou enfeite — e este teste cai.
  it("o min-height declarado é quem MANDA na altura da linha, não enfeite", () => {
    const css = home();
    const linha = regraDe(css, ".filtro-linha");
    const botao = regraDe(css, ".filtro-abrir");
    const conta = regraDe(css, ".filtro-conta");
    const bp = regraDe(fichaCss(), ".bp");
    expect(linha, "faltou a regra .filtro-linha").not.toBeNull();
    expect(botao, "faltou a regra .filtro-abrir").not.toBeNull();
    expect(conta, "faltou a regra .filtro-conta").not.toBeNull();
    expect(bp, "faltou a regra .bp no ficha.css").not.toBeNull();

    const declarado = px(valorDe(linha![0], "min-height"));
    expect(declarado, "o min-height da linha não é mais um px/rem legível")
      .toBe(ALTURA_LINHA_FILTRO_PX);

    // O primeiro valor do shorthand é o padding de CIMA; sem um terceiro, o de
    // baixo é igual a ele.
    const padVertical = px(fatiar(valorDe(linha![0], "padding") ?? "")[0]);
    const borda = px(fatiar(valorDe(linha![0], "border-bottom") ?? "")[0]);
    const entrelinha = Number(valorDe(bp![0], "line-height"));
    expect(entrelinha, "o .bp perdeu o line-height de onde a altura do texto sai")
      .toBeGreaterThan(0);

    // O item mais alto da linha. O botão manda hoje (32px de alvo); o texto do
    // resumo entra na conta pra que aumentar a fonte dele também derrube isto.
    const miolo = Math.max(
      px(valorDe(botao![0], "min-height")),
      px(valorDe(conta![0], "font-size")) * entrelinha,
    );
    const empurrado = miolo + 2 * padVertical + borda;

    expect(Number.isFinite(empurrado), "não deu pra ler a corrente inteira do CSS").toBe(true);
    expect(
      declarado,
      `o miolo empurra a linha pra ${empurrado.toFixed(2)}px e o min-height declarado ` +
        `é ${declarado}px — ele parou de morder, e a constante virou ficção`,
    ).toBeGreaterThanOrEqual(empurrado);
  });

  // A conta de rem → px acima vale porque ninguém mexe na raiz. Se alguém
  // mexer, TODA altura derivada deste arquivo passa a mentir em silêncio.
  it("nenhum arquivo do app declara font-size na raiz", () => {
    for (const arq of ["globals.css", "ficha.css", "home.css"]) {
      expect(semComentarios(arq), `${arq} declarou font-size na raiz — o rem deixou de ser 16px`)
        .not.toMatch(/(?:^|\})\s*(?:html|:root)[^{}]*\{[^}]*font-size/s);
    }
  });
});
