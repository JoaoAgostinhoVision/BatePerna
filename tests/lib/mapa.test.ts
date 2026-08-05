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
