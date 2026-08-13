import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
  enquadrar,
  latDoMundo,
  lngDoMundo,
  posicaoNaCaixa,
} from "@/lib/mapa";

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
    expect(bp![0]).toContain("clamp(0px, 3vw, 1rem)");

    const screen = css.match(/\.bp \.screen\s*\{[^}]*\}/);
    expect(screen, "faltou a regra .bp .screen no ficha.css").not.toBeNull();
    expect(screen![0]).toContain("border: 1px solid");
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
  it("o home.css ainda dá 44px de alvo de toque ao .pin-home, e o raio é metade disso", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
    const regra = css.match(/\.bp \.pin-home\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .bp .pin-home no home.css").not.toBeNull();

    const largura = regra![0].match(/width:\s*(\d+(?:\.\d+)?)px/);
    expect(largura, "a regra .bp .pin-home não tem mais um width: Npx").not.toBeNull();

    const alvoToquePx = Number(largura![1]);
    expect(alvoToquePx).toBe(44); // documentado no comentário da constante em src/lib/mapa.ts
    expect(RAIO_ALVO_TOQUE_PX).toBe(alvoToquePx / 2);
  });
});
