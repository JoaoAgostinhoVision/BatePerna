import { describe, expect, it } from "vitest";
import { MAPA_ALTURA_HOME_PX } from "@/lib/mapa";
import {
  ALTURA_APPBAR_PX,
  ALTURA_CABECALHO_GRUPO_PX,
  ALTURA_LINHA_FILTRO_PX,
  TETO_ANTES_DO_CARTAO_PX,
} from "@/lib/home-layout";
// A régua de CSS mora em tests/css.ts — uma só pro app inteiro. Ver o cabeçalho
// de lá: cada cópia solta do `valorDe` é uma chance de UMA delas perder a
// âncora e enfraquecer só o arquivo dela, em silêncio.
import { paddingLado, px, regraDe, semComentarios, valorDe } from "../css";

const home = () => semComentarios("home.css");
const fichaCss = () => semComentarios("ficha.css");

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

    const padTopo = px(paddingLado(linha![0], "top"));
    const padBase = px(paddingLado(linha![0], "bottom"));
    const borda = px(valorDe(linha![0], "border-bottom")?.split(/\s+/)[0]);
    const entrelinha = Number(valorDe(bp![0], "line-height"));
    expect(entrelinha, "o .bp perdeu o line-height de onde a altura do texto sai")
      .toBeGreaterThan(0);

    // O item mais alto da linha. O botão manda hoje (32px de alvo); o texto do
    // resumo entra na conta pra que aumentar a fonte dele também derrube isto.
    const miolo = Math.max(
      px(valorDe(botao![0], "min-height")),
      px(valorDe(conta![0], "font-size")) * entrelinha,
    );
    const empurrado = miolo + padTopo + padBase + borda;

    expect(Number.isFinite(empurrado), "não deu pra ler a corrente inteira do CSS").toBe(true);
    expect(
      declarado,
      `o miolo empurra a linha pra ${empurrado.toFixed(2)}px e o min-height declarado ` +
        `é ${declarado}px — ele parou de morder, e a constante virou ficção`,
    ).toBeGreaterThanOrEqual(empurrado);
  });

  // O cabeçalho de grupo é a MESMA família da linha de filtro — a constante
  // dizia 34 e a régua diz 34,45 —, mas com uma diferença que muda o conserto:
  // o `.grupo-k` não tem `min-height` nenhum, e inventar um só pra a constante
  // "morder" seria CSS escrito pra satisfazer teste. Aqui quem lê a corrente é
  // o teste: texto (fonte × entrelinha) mais os dois paddings.
  it("ALTURA_CABECALHO_GRUPO_PX cobre o que o .grupo-k realmente empurra", () => {
    const grupo = regraDe(home(), ".grupo-k");
    const bp = regraDe(fichaCss(), ".bp");
    expect(grupo, "faltou a regra .grupo-k no home.css").not.toBeNull();
    expect(bp, "faltou a regra .bp no ficha.css").not.toBeNull();

    // Se um dia ganhar `min-height`, quem manda passa a ser outro e esta conta
    // deixa de valer — melhor cair aqui do que mentir em silêncio.
    expect(valorDe(grupo![0], "min-height"), "o .grupo-k ganhou min-height: refaça esta conta")
      .toBeNull();

    const entrelinha = Number(valorDe(bp![0], "line-height"));
    expect(entrelinha, "o .bp perdeu o line-height de onde a altura do texto sai")
      .toBeGreaterThan(0);

    const empurrado =
      px(valorDe(grupo![0], "font-size")) * entrelinha +
      px(paddingLado(grupo![0], "top")) +
      px(paddingLado(grupo![0], "bottom"));

    expect(Number.isFinite(empurrado), "não deu pra ler a corrente inteira do .grupo-k").toBe(true);
    expect(
      ALTURA_CABECALHO_GRUPO_PX,
      `o .grupo-k empurra ${empurrado.toFixed(4)}px e a constante diz ` +
        `${ALTURA_CABECALHO_GRUPO_PX}px — ela mede pra menos, e o orçamento da ` +
        `dobra fica mais folgado no papel do que na tela`,
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
