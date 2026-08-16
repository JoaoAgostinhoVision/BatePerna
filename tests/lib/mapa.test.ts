import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { margemLado, paddingLado, px, regraDe, semComentarios, valorDe } from "../css";
import {
  MAPA_ALTURA_PX,
  MAPA_ESCALA,
  MAPA_LARGURA_PX,
  MAPA_ZOOM,
  TILE_PX,
  metrosPorPixel,
  pontoNoMundo,
  tilesParaCaixa,
  urlTile,
  zoomDeTiles,
} from "@/lib/mapa";
import {
  MAPA_ALTURA_HOME_PX,
  MAPA_JANELA_VISIVEL_HOME_PX,
  MARGEM_ENQUADRO_PX,
  RAIO_ALVO_TOQUE_PX,
  ZOOM_MINIMO,
  ZOOM_MINIMO_HOME_COM_VOCE,
  enquadrar,
  enquadrarComVoce,
  foraDaJanela,
  latDoMundo,
  lngDoMundo,
  posicaoNaCaixa,
} from "@/lib/mapa";
import type { Coord } from "@/lib/geo";

const RAMPA = { lat: -7.907889, lng: -36.019222 };

describe("pontoNoMundo", () => {
  it("o centro do mundo (0,0) cai no meio do tile único do zoom 0", () => {
    expect(pontoNoMundo({ lat: 0, lng: 0 }, 0)).toEqual({ x: 128, y: 128 });
  });

  it("as bordas de longitude viram as bordas do mundo", () => {
    expect(pontoNoMundo({ lat: 0, lng: -180 }, 3).x).toBeCloseTo(0, 6);
    expect(pontoNoMundo({ lat: 0, lng: 180 }, 3).x).toBeCloseTo(256 * 8, 6);
  });

  it("latitudes simétricas caem simétricas em torno do equador", () => {
    const norte = pontoNoMundo({ lat: 45, lng: 0 }, 5).y;
    const sul = pontoNoMundo({ lat: -45, lng: 0 }, 5).y;
    const equador = pontoNoMundo({ lat: 0, lng: 0 }, 5).y;
    expect(equador - norte).toBeCloseTo(sul - equador, 6);
  });

  it("cada zoom a mais dobra as coordenadas", () => {
    const a = pontoNoMundo(RAMPA, 10);
    const b = pontoNoMundo(RAMPA, 11);
    expect(b.x).toBeCloseTo(a.x * 2, 6);
    expect(b.y).toBeCloseTo(a.y * 2, 6);
  });

  it("no polo (lat 90 ou -90) o y continua finito — a projeção é grampeada", () => {
    const norte = pontoNoMundo({ lat: 90, lng: 0 }, 5);
    const sul = pontoNoMundo({ lat: -90, lng: 0 }, 5);
    expect(Number.isFinite(norte.y)).toBe(true);
    expect(Number.isFinite(sul.y)).toBe(true);
  });
});

describe("metrosPorPixel", () => {
  it("no zoom da ficha, na latitude da Rampa, ≈ 75,7 m/px", () => {
    expect(metrosPorPixel(RAMPA.lat, MAPA_ZOOM)).toBeCloseTo(75.7, 0);
  });

  it("cada zoom a mais corta a escala pela metade", () => {
    expect(metrosPorPixel(RAMPA.lat, 12)).toBeCloseTo(metrosPorPixel(RAMPA.lat, 11) / 2, 6);
  });
});

// ESTE é o teste que impede alguém de mexer no zoom sem perceber que
// mudou a pergunta que o mapa responde. ~26 km = "onde fica na região",
// não "onde é a porteira".
describe("enquadramento", () => {
  it("num celular típico (350px) a vista fica na casa dos 26 km", () => {
    const km = (metrosPorPixel(RAMPA.lat, MAPA_ZOOM) * 350) / 1000;
    expect(km).toBeGreaterThan(24);
    expect(km).toBeLessThan(29);
  });
});

describe("tilesParaCaixa", () => {
  it("cobre a caixa inteira na largura de geração", () => {
    const largura = MAPA_LARGURA_PX * MAPA_ESCALA;
    const altura = MAPA_ALTURA_PX * MAPA_ESCALA;
    const tiles = tilesParaCaixa(RAMPA, MAPA_ZOOM + 1, largura, altura);

    expect(tiles.length).toBeGreaterThan(0);
    // nenhuma borda descoberta: começa em cima ou antes do 0...
    expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(0);
    expect(Math.min(...tiles.map((t) => t.top))).toBeLessThanOrEqual(0);
    // ...e termina em cima ou depois do fim
    expect(Math.max(...tiles.map((t) => t.left + TILE_PX))).toBeGreaterThanOrEqual(largura);
    expect(Math.max(...tiles.map((t) => t.top + TILE_PX))).toBeGreaterThanOrEqual(altura);
  });

  it("não puxa tile a mais do que precisa quando a caixa é um tile exato", () => {
    // no zoom 0 o mundo inteiro é um tile só, e a caixa coincide com ele
    const tiles = tilesParaCaixa({ lat: 0, lng: 0 }, 0, TILE_PX, TILE_PX);
    expect(tiles).toHaveLength(1);
  });

  it("uma caixa de um tile centrada numa borda precisa de dois", () => {
    // lng 0 no zoom 1 cai exatamente na divisa entre os tiles 0 e 1
    const tiles = tilesParaCaixa({ lat: 0, lng: 0 }, 1, TILE_PX, TILE_PX);
    expect([...new Set(tiles.map((t) => t.x))].sort()).toEqual([0, 1]);
  });

  it("índices de tile ficam dentro do mundo mesmo cruzando o antimeridiano", () => {
    const tiles = tilesParaCaixa({ lat: 0, lng: 179.99 }, 2, 512, 256);
    const nx = 2 ** 2;
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThan(nx);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThan(nx);
    }
    // e o posicionamento continua contínuo (sem salto), mesmo com o x envolvendo
    const lefts = [...new Set(tiles.map((t) => t.left))].sort((a, b) => a - b);
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i] - lefts[i - 1]).toBeCloseTo(TILE_PX, 6);
    }
  });

  it("descarta tiles fora do mundo em vez de pedir y negativo", () => {
    const tiles = tilesParaCaixa({ lat: 85, lng: 0 }, 1, 256, 512);
    expect(tiles.every((t) => t.y >= 0 && t.y < 2)).toBe(true);
  });

  it("no polo (lat 90) o loop termina e devolve tiles dentro do mundo", () => {
    const z = 4;
    const tiles = tilesParaCaixa({ lat: 90, lng: 0 }, z, 256, 512);
    const nTiles = 2 ** z;
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.y >= 0 && t.y < nTiles)).toBe(true);
  });
});

describe("zoomDeTiles", () => {
  it("com MAPA_ESCALA potência de 2, o zoom de tiles é inteiro", () => {
    expect(Number.isInteger(zoomDeTiles())).toBe(true);
  });
});

describe("urlTile", () => {
  it("monta o endereço do tile do OSM", () => {
    expect(urlTile({ z: 11, x: 793, y: 1064 })).toBe(
      "https://tile.openstreetmap.org/11/793/1064.png",
    );
  });
});

const LARGURA = 480;
const ALTURA = MAPA_ALTURA_HOME_PX;

describe("latDoMundo / lngDoMundo", () => {
  it("desfazem pontoNoMundo", () => {
    const z = 9;
    const p = pontoNoMundo(RAMPA, z);
    expect(latDoMundo(p.y, z)).toBeCloseTo(RAMPA.lat, 9);
    expect(lngDoMundo(p.x, z)).toBeCloseTo(RAMPA.lng, 9);
  });

  it("o topo do mundo é o limite de Mercator, não infinito", () => {
    expect(latDoMundo(0, 3)).toBeCloseTo(85.05112878, 5);
  });
});

describe("enquadrar", () => {
  it("com uma trilha só, é o mapa da ficha: mesmo centro, mesmo zoom", () => {
    const { centro, z } = enquadrar([RAMPA], LARGURA, ALTURA);
    expect(z).toBe(MAPA_ZOOM);
    expect(centro.lat).toBeCloseTo(RAMPA.lat, 9);
    expect(centro.lng).toBeCloseTo(RAMPA.lng, 9);
  });

  it("coordenadas repetidas não viram zoom infinito", () => {
    const { z } = enquadrar([RAMPA, RAMPA, RAMPA], LARGURA, ALTURA);
    expect(Number.isInteger(z)).toBe(true);
    expect(z).toBe(MAPA_ZOOM);
  });

  it("duas trilhas distantes cabem as duas dentro da caixa, com margem", () => {
    const recife = { lat: -8.05, lng: -34.9 };
    const distante = { lat: -7.9, lng: -36.02 };
    const { centro, z } = enquadrar([recife, distante], LARGURA, ALTURA);
    for (const c of [recife, distante]) {
      const { left, top } = posicaoNaCaixa(c, centro, z, LARGURA, ALTURA);
      expect(left).toBeGreaterThanOrEqual(MARGEM_ENQUADRO_PX);
      expect(left).toBeLessThanOrEqual(LARGURA - MARGEM_ENQUADRO_PX);
      expect(top).toBeGreaterThanOrEqual(MARGEM_ENQUADRO_PX);
      expect(top).toBeLessThanOrEqual(ALTURA - MARGEM_ENQUADRO_PX);
    }
  });

  it("nunca aproxima mais que o mapa da ficha", () => {
    const a = { lat: -7.9078, lng: -36.0192 };
    const b = { lat: -7.9079, lng: -36.0193 };
    expect(enquadrar([a, b], LARGURA, ALTURA).z).toBe(MAPA_ZOOM);
  });

  it("trilhas em lados opostos do mundo param no piso de zoom", () => {
    const { z } = enquadrar([{ lat: -60, lng: -170 }, { lat: 60, lng: 170 }], LARGURA, ALTURA);
    expect(z).toBe(ZOOM_MINIMO);
  });

  it("sem coordenada nenhuma é erro de programação, não mapa vazio", () => {
    expect(() => enquadrar([], LARGURA, ALTURA)).toThrow();
  });
});

describe("posicaoNaCaixa", () => {
  it("o centro do enquadramento cai no meio da caixa", () => {
    const { left, top } = posicaoNaCaixa(RAMPA, RAMPA, 10, LARGURA, ALTURA);
    expect(left).toBeCloseTo(LARGURA / 2, 6);
    expect(top).toBeCloseTo(ALTURA / 2, 6);
  });
});

// Defeito Important achado na revisão da branch inteira: MAPA_LARGURA_PX
// (480px) é largura de GERAÇÃO, não de exibição. `.mapa-home` (home.css) é
// fluida e corta o mosaico com overflow:hidden — no aparelho mais estreito
// que o app atende, medido a 375px de viewport, só 350,5px da caixa de 480
// ficam visíveis (janela [64,75 , 415,25] dentro da caixa). `enquadrar()`
// cabia contra os 480px inteiros: com uma segunda ficha mais distante, o
// mapa conseguia mostrar o VAZIO entre as duas trilhas e nenhum pin.
//
// Estas quatro contas replicam a tabela da revisão. Não são coordenadas de
// trilhas reais (só existe uma ficha real hoje, a Rampa do Pepe) — são
// pontos sintéticos escolhidos pra cair nos mesmos regimes (seguro / que
// estoura) que a revisão mediu; os números batem em ordem de grandeza, não
// casa decimal, porque a revisão partiu de coordenadas que este repo não
// tem.
describe("home: o enquadramento cabe contra a janela que a tela mostra, não a caixa de geração", () => {
  // GROUND TRUTH independente de MAPA_JANELA_VISIVEL_HOME_PX — de propósito.
  // Se este teste usasse a própria constante pra calcular a janela contra a
  // qual ele confere, um MAPA_JANELA_VISIVEL_HOME_PX errado (por exemplo
  // voltando a valer 480, o bug original) faria a "janela" virar a caixa de
  // geração inteira e o teste passaria sempre — vácuo. Este número vem
  // direto da medição em navegador (375px de viewport; ver o bloco
  // "MAPA_JANELA_VISIVEL_HOME_PX bate com o CSS..." logo abaixo, que é quem
  // amarra ele à fórmula do CSS) — não da constante em produção.
  const JANELA_VISIVEL_MEDIDA_PX = 350.5;
  const janelaMin = (MAPA_LARGURA_PX - JANELA_VISIVEL_MEDIDA_PX) / 2;
  const janelaMax = (MAPA_LARGURA_PX + JANELA_VISIVEL_MEDIDA_PX) / 2;

  /** Desloca uma coordenada por uma distância em metros (plano local —
   *  suficiente pra gerar pontos de teste, não pra navegação real). */
  function deslocaMetros(base: { lat: number; lng: number }, dxM: number, dyM: number) {
    const metroPorGrauLat = 111320;
    const metroPorGrauLng = 111320 * Math.cos((base.lat * Math.PI) / 180);
    return { lat: base.lat + dyM / metroPorGrauLat, lng: base.lng + dxM / metroPorGrauLng };
  }

  /** Afirma que o PONTO, não só a caixa de 480px, cai dentro da janela
   *  visível com os 44px do alvo de toque inteiros — nem meio alvo cortado
   *  pelo overflow:hidden de `.mapa-home`. */
  function afirmaAlvoInteiroVisivel(coords: { lat: number; lng: number }[]) {
    const { centro, z } = enquadrar(coords, MAPA_JANELA_VISIVEL_HOME_PX, MAPA_ALTURA_HOME_PX);
    for (const c of coords) {
      const { left, top } = posicaoNaCaixa(c, centro, z, MAPA_LARGURA_PX, MAPA_ALTURA_HOME_PX);
      expect(left).toBeGreaterThanOrEqual(janelaMin + RAIO_ALVO_TOQUE_PX);
      expect(left).toBeLessThanOrEqual(janelaMax - RAIO_ALVO_TOQUE_PX);
      expect(top).toBeGreaterThanOrEqual(RAIO_ALVO_TOQUE_PX);
      expect(top).toBeLessThanOrEqual(MAPA_ALTURA_HOME_PX - RAIO_ALVO_TOQUE_PX);
    }
  }

  it("a Rampa sozinha: pin no centro, sempre visível", () => {
    afirmaAlvoInteiroVisivel([RAMPA]);
  });

  it("Rampa + uma trilha a ~35km (leste-oeste): as duas visíveis", () => {
    afirmaAlvoInteiroVisivel([RAMPA, deslocaMetros(RAMPA, 35_000, 3_000)]);
  });

  it("Rampa + uma trilha a ~200km (leste-oeste): as duas visíveis", () => {
    afirmaAlvoInteiroVisivel([RAMPA, deslocaMetros(RAMPA, 200_000, -20_000)]);
  });

  it("duas trilhas a ~60km entre si no eixo leste-oeste: as duas visíveis", () => {
    afirmaAlvoInteiroVisivel([deslocaMetros(RAMPA, -30_000, 0), deslocaMetros(RAMPA, 30_000, 0)]);
  });
});

describe("MARGEM_ENQUADRO_PX cobre o alvo de toque, não só o losango", () => {
  it("a folga do enquadramento é maior ou igual ao raio do alvo de toque de 44px", () => {
    // Sem este teste, alguém pode encolher MARGEM_ENQUADRO_PX pensando só no
    // losango de 18px (a razão histórica do número) e voltar a cortar o
    // alvo de toque de 44px — o deferido que este conserto fechou.
    expect(MARGEM_ENQUADRO_PX).toBeGreaterThanOrEqual(RAIO_ALVO_TOQUE_PX);
  });
});

describe("MAPA_JANELA_VISIVEL_HOME_PX bate com o CSS de onde ela foi derivada", () => {
  it("o ficha.css ainda usa o padding e a borda que o comentário da constante descreve", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "ficha.css"), "utf8");
    const bp = css.match(/\n\.bp\s*\{[^}]*\}/s);
    expect(bp, "faltou a regra .bp no ficha.css").not.toBeNull();

    // 🔴 A fórmula da goteira NÃO mora mais dentro do `padding:`. Desde o
    // conserto da barra fixa ela vive nas variáveis `--goteira-esq`/`-dir`,
    // porque a `.bp .barra` (home.css) precisa se prender na MESMA medida pra
    // ficar alinhada com a moldura. Um `toContain("clamp(0px, 3vw, 1rem)")`
    // sobre a regra `.bp` inteira parava de provar o que existe pra provar:
    // com o padding lateral zerado — que invalida esta constante de verdade —
    // a fórmula continuava no arquivo, dentro das variáveis, e a asserção
    // passava. A garantia tinha migrado, sem registro, pro teste da BARRA,
    // noutro arquivo e sobre outro assunto.
    //
    // Por isso a corrente é conferida INTEIRA, e nesta ordem: o padding lê as
    // variáveis, e as variáveis carregam a fórmula. Quebrar qualquer um dos
    // dois elos derruba a constante — e agora derruba este teste.
    //
    // 🔴 E pelo LADO, não por `bp![0].match(/padding:[^;]*;/)`: aquilo casava
    // dentro de `--padding:`, e MEDIDO deixava passar `--padding: <a fórmula
    // toda>; padding: 0` com a suíte 521/521 verde — a moldura ia de borda a
    // borda, que é exatamente o que esta constante afirma não acontecer.
    expect(paddingLado(bp![0], "right"), "o padding direito do .bp parou de sair da goteira")
      .toBe("var(--goteira-dir)");
    expect(paddingLado(bp![0], "left"), "o padding esquerdo do .bp parou de sair da goteira")
      .toBe("var(--goteira-esq)");
    expect(bp![0], "a goteira esquerda perdeu a fórmula de onde a constante saiu")
      .toMatch(/--goteira-esq:[^;]*clamp\(0px, 3vw, 1rem\)/);
    expect(bp![0], "a goteira direita perdeu a fórmula de onde a constante saiu")
      .toMatch(/--goteira-dir:[^;]*clamp\(0px, 3vw, 1rem\)/);

    const screen = regraDe(css, ".bp .screen");
    expect(screen, "faltou a regra .bp .screen no ficha.css").not.toBeNull();
    // A borda entra na derivação da constante (visível = viewport − 2×goteira −
    // 2×borda). `toContain("border: 1px solid")` casava dentro de `--border`,
    // e MEDIDO deixava passar `--border: 1px solid …; border: 0` com a suíte
    // verde — a conta perdia 2px sem nada acusar.
    expect(valorDe(screen![0], "border"), "o .screen perdeu a borda de onde a constante saiu")
      .toMatch(/^1px solid/);

    // 🔴 A corrente conferida acima mora INTEIRA no ficha.css — e desde a Task
    // 12 o home.css tem um `.bp` PRÓPRIO (o `--barra-h`) que é importado
    // DEPOIS dele em toda página. Um `padding-left: 0; padding-right: 0` ali
    // anula a goteira sem tocar em uma linha do ficha.css: medido, a moldura
    // vai de borda a borda e o visível real vira 373,6px contra os 350,5 que
    // esta constante afirma — com a suíte inteira VERDE. Ler só o arquivo de
    // origem não basta quando outro arquivo pode sobrescrevê-lo por cascata.
    const homeCss = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const bpHome = homeCss.match(/(?:^|\n)\.bp\s*\{[^}]*\}/s);
    expect(bpHome, "faltou a regra .bp no home.css").not.toBeNull();
    expect(bpHome![0], "o .bp do home.css passou a declarar padding e anula a goteira do ficha.css")
      .not.toMatch(/(?:^|[{;])\s*padding(-[a-z]+)?\s*:/s);
  });

  it("no viewport de 375px (iPhone mais estreito considerado), a fórmula dá o mesmo número da constante", () => {
    const viewport = 375;
    const padding = Math.min(0.03 * viewport, 16); // clamp(0px, 3vw, 1rem) — 1rem = 16px
    const bordaScreen = 1;
    const visivel = viewport - 2 * padding - 2 * bordaScreen;
    expect(visivel).toBeCloseTo(MAPA_JANELA_VISIVEL_HOME_PX, 6);
  });
});

// Mesmo padrão do bloco acima: RAIO_ALVO_TOQUE_PX era um literal solto, sem
// nada amarrando ele ao requisito real. Os testes de geometria em
// "enquadrar" conferem contra `janelaMin + RAIO_ALVO_TOQUE_PX`, e o teste de
// MARGEM_ENQUADRO_PX confere contra `RAIO_ALVO_TOQUE_PX` — os dois são
// relativos à PRÓPRIA constante: provam consistência interna, não que 22
// corresponde a alguma coisa real. Trocar 22 por 0 deixava as duas suítes
// verdes. Este teste lê o home.css — de onde o comentário da constante diz
// que ela vem — e prova que RAIO_ALVO_TOQUE_PX é metade do alvo de toque
// real do `.pin-home` (44px, `width`/`height` da regra).
describe("RAIO_ALVO_TOQUE_PX bate com o alvo de toque do .pin-home no CSS", () => {
  // 🔴 A QUINTA IRMÃ do decoy: `/width:\s*(\d+)px/` casa DENTRO de
  // `max-width:`/`min-width:`, e `match` sem /g devolve a primeira ocorrência.
  // Mutação provada: `max-width: 44px; width: 28px; height: 28px` deixava a
  // suíte VERDE com este teste ainda afirmando `alvoToquePx === 44` enquanto o
  // alvo real virava 28 — o que torna RAIO_ALVO_TOQUE_PX = 22 falso (seria
  // 14) e, por tabela, derruba o invariante MARGEM_ENQUADRO_PX >=
  // RAIO_ALVO_TOQUE_PX e a conta do `foraDaJanela`. Ancorado no `valorDe`
  // (tests/css.ts), e agora lendo os DOIS eixos: o alvo é quadrado, e um
  // `height` menor corta o toque na vertical do mesmo jeito.
  it("o home.css ainda dá 44px de alvo de toque ao .pin-home, e o raio é metade disso", () => {
    const regra = regraDe(semComentarios("home.css"), ".bp .pin-home");
    expect(regra, "faltou a regra .bp .pin-home no home.css").not.toBeNull();

    const largura = px(valorDe(regra![0], "width"));
    const altura = px(valorDe(regra![0], "height"));
    expect(Number.isFinite(largura), "a regra .bp .pin-home não tem mais um width: Npx").toBe(true);
    expect(altura, "o alvo de toque deixou de ser quadrado").toBe(largura);

    expect(largura).toBe(44); // documentado no comentário da constante em src/lib/mapa.ts
    expect(RAIO_ALVO_TOQUE_PX).toBe(largura / 2);
  });

  // O tamanho do alvo não basta: ele tem que estar CENTRADO na coordenada. O
  // `<a>` é posicionado com `left`/`top` na coordenada e puxado de volta por
  // uma margem negativa de METADE do alvo — é isso que põe o dedo em cima do
  // ponto, e é isso que o `foraDaJanela` assume ao usar RAIO_ALVO_TOQUE_PX como
  // margem dos quatro lados. Sem esta prova, `margin: -10px 0 0 -10px` com
  // `width: 44px` passava: o alvo continuava com 44, deslocado 12px pra baixo e
  // pra direita do morro, e a conta de "trilhas fora do mapa" mentia junto.
  it("o alvo de toque fica CENTRADO na coordenada — a margem é metade dele", () => {
    const regra = regraDe(semComentarios("home.css"), ".bp .pin-home");
    expect(regra, "faltou a regra .bp .pin-home no home.css").not.toBeNull();

    const cima = px(margemLado(regra![0], "top"));
    const esquerda = px(margemLado(regra![0], "left"));
    expect(cima, "a margem de cima do .pin-home não é mais um px legível")
      .toBe(-RAIO_ALVO_TOQUE_PX);
    expect(esquerda, "a margem da esquerda do .pin-home não centra o alvo")
      .toBe(-RAIO_ALVO_TOQUE_PX);
  });
});

describe("enquadrarComVoce", () => {
  const RAMPA = { lat: -7.907889, lng: -36.019222 };
  const L = MAPA_JANELA_VISIVEL_HOME_PX;
  const A = MAPA_ALTURA_HOME_PX;

  it("sem localização, é exatamente o enquadramento de hoje", () => {
    const so = enquadrar([RAMPA], L, A);
    expect(enquadrarComVoce([RAMPA], null, L, A)).toEqual(so);
  });

  it("com localização, você entra na conta: o centro se desloca na sua direção", () => {
    const voce = { lat: -8.2, lng: -35.56 };
    const semVoce = enquadrarComVoce([RAMPA], null, L, A);
    const comVoce = enquadrarComVoce([RAMPA], voce, L, A);
    expect(comVoce.centro.lat).not.toBeCloseTo(semVoce.centro.lat, 4);
    // O centro fica ENTRE os dois pontos, não em cima de nenhum.
    expect(comVoce.centro.lat).toBeLessThan(Math.max(RAMPA.lat, voce.lat));
    expect(comVoce.centro.lat).toBeGreaterThan(Math.min(RAMPA.lat, voce.lat));
  });

  // O piso: abaixo do zoom 8 o mosaico do OSM vira mancha sem nome de cidade.
  // Aí o mapa para de tentar caber tudo e vira "onde eu estou".
  it("trilha longe demais: para no piso e centra em VOCÊ, não no meio do caminho", () => {
    const voce = { lat: -8.2, lng: -35.56 };
    const longe = { lat: -15.8, lng: -47.9 }; // ~1400 km
    const { centro, z } = enquadrarComVoce([longe], voce, L, A);
    expect(z).toBe(ZOOM_MINIMO_HOME_COM_VOCE);
    expect(centro.lat).toBeCloseTo(voce.lat, 6);
    expect(centro.lng).toBeCloseTo(voce.lng, 6);
  });

  it("sem localização o piso NÃO vale — o mapa de hoje não muda de comportamento", () => {
    const a = { lat: -8.2, lng: -35.56 };
    const b = { lat: -15.8, lng: -47.9 };
    expect(enquadrarComVoce([a, b], null, L, A).z).toBeLessThan(ZOOM_MINIMO_HOME_COM_VOCE);
  });

  it("nunca aproxima mais que o zoom da ficha", () => {
    const voce = { lat: RAMPA.lat + 0.0001, lng: RAMPA.lng };
    expect(enquadrarComVoce([RAMPA], voce, L, A).z).toBeLessThanOrEqual(MAPA_ZOOM);
  });

  // A derivação do 8, conferida em vez de afirmada: ~605 m/px nesta latitude,
  // que na janela de 350,5px dá ~212 km de largura. Se alguém trocar o 8 por
  // 6, esta conta denuncia — o mapa passaria de 212 pra 850 km de largura.
  it("o piso corresponde a uma largura de mapa entre 150 e 300 km", () => {
    const kmDeLargura = (metrosPorPixel(-8, ZOOM_MINIMO_HOME_COM_VOCE) * L) / 1000;
    expect(kmDeLargura).toBeGreaterThan(150);
    expect(kmDeLargura).toBeLessThan(300);
  });
});

describe("foraDaJanela: quantas trilhas o mapa não mostra", () => {
  const L = MAPA_JANELA_VISIVEL_HOME_PX;
  const A = MAPA_ALTURA_HOME_PX;

  it("tudo dentro: zero", () => {
    const a = { lat: -8.2, lng: -35.56 };
    const b = { lat: -8.25, lng: -35.6 };
    const { centro, z } = enquadrarComVoce([a, b], null, L, A);
    expect(foraDaJanela([a, b], centro, z, L, A)).toBe(0);
  });

  it("no piso, a trilha distante conta como fora", () => {
    const voce = { lat: -8.2, lng: -35.56 };
    const longe = { lat: -15.8, lng: -47.9 };
    const { centro, z } = enquadrarComVoce([longe], voce, L, A);
    expect(foraDaJanela([longe], centro, z, L, A)).toBe(1);
  });

  it("conta cada trilha uma vez, e só as que estão fora", () => {
    const voce = { lat: -8.2, lng: -35.56 };
    const perto = { lat: -8.21, lng: -35.57 };
    const longe1 = { lat: -15.8, lng: -47.9 };
    const longe2 = { lat: -23.5, lng: -46.6 };
    const { centro, z } = enquadrarComVoce([perto, longe1, longe2], voce, L, A);
    expect(foraDaJanela([perto, longe1, longe2], centro, z, L, A)).toBe(2);
  });

  // O alvo de toque é de 44px centrado na coordenada: um pin cujo CENTRO está
  // dentro mas cuja metade sai da janela não é tocável inteiro. Contar como
  // dentro faria o texto "1 trilha fora" mentir pra menos.
  //
  // UMA BORDA POR TESTE, e de propósito. `foraDaJanela` é um OU de quatro
  // sub-cláusulas, e num OU a cláusula que dispara primeiro esconde as outras:
  // as trilhas "longe" dos testes acima caem a oeste E ao sul, então `esq` e
  // `base` são verdadeiras juntas e apagar qualquer uma das duas mantém a
  // contagem igual. Conferido antes de escrever: com só o teste da borda
  // esquerda, `dir`, `topo` e `base` podiam ser apagadas com a suíte verde.
  // Cada coordenada abaixo fica a 12px da sua borda — CENTRO ainda dentro da
  // caixa, alvo de toque cortado — então é a única sub-cláusula verdadeira, e
  // ela prova a margem de RAIO_ALVO_TOQUE_PX, não um trivial "saiu da caixa".
  describe("cada borda tem que contar sozinha", () => {
    const centro = { lat: -8.2, lng: -35.56 };
    const z = 11;
    const grauLng = (metrosPorPixel(centro.lat, z) * (L / 2 - 12)) / 111320;
    const grauLat = (metrosPorPixel(centro.lat, z) * (A / 2 - 12)) / 111320;

    const bordas: [string, Coord][] = [
      ["esquerda", { lat: centro.lat, lng: centro.lng - grauLng }],
      ["direita", { lat: centro.lat, lng: centro.lng + grauLng }],
      ["topo", { lat: centro.lat + grauLat, lng: centro.lng }],
      ["base", { lat: centro.lat - grauLat, lng: centro.lng }],
    ];

    for (const [nome, pino] of bordas) {
      it(`pin colado na borda ${nome} conta como fora — o alvo de toque não cabe`, () => {
        expect(foraDaJanela([pino], centro, z, L, A)).toBe(1);
      });

      // A outra metade da prova: sem ela, um `foraDaJanela` que devolvesse
      // sempre `coords.length` passaria nos quatro testes acima.
      it(`o mesmo pin, afastado da borda ${nome}, conta como dentro`, () => {
        const dentro: Coord = {
          lat: centro.lat + (pino.lat - centro.lat) * 0.5,
          lng: centro.lng + (pino.lng - centro.lng) * 0.5,
        };
        expect(foraDaJanela([dentro], centro, z, L, A)).toBe(0);
      });
    }
  });
});
