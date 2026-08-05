# Mapa de verdade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a faixa decorativa da ficha da Rampa do Pepê por um mapa real montado com tiles do OpenStreetMap (pin na cor do carimbo) e acrescentar uma linha de distância em linha reta, medida sob demanda a partir do celular da pessoa.

**Architecture:** Duas funções puras testadas (`src/lib/mapa.ts` = projeção Web Mercator + mosaico de tiles; `src/lib/geo.ts` = haversine + formatação) consumidas por dois componentes finos: um server component que só monta markup (`MapaEstatico`) e um client component com máquina de estados de 4 fases (`DistanciaDaqui`). Nada de biblioteca de mapa, nada de chave de API, nada de backend novo. A ficha continua inteira e decidível se os tiles ou a geolocalização falharem.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Vitest + Testing Library, CSS puro escopado sob `.bp`.

**Spec:** `docs/superpowers/specs/2026-08-04-mapa-de-verdade-design.md`

## Global Constraints

- **Nenhuma dependência nova.** Nem npm, nem chave de API, nem provedor de tiles pago. Se um passo parecer pedir uma, o passo está errado.
- **Alias de import:** `@/` → `src/` (configurado em `vitest.config.ts` e `tsconfig.json`). Use `@/lib/...`, nunca caminho relativo longo.
- **Testes:** Vitest, `npm test` (= `vitest run`). Ambiente `jsdom`, `globals: true`. Os **26 testes existentes têm que continuar passando** em todo commit.
- **CSS:** tudo escopado sob `.bp` em `src/app/ficha.css`. O projeto tem Tailwind base ativo, que aplica `img { max-width: 100% }` — os tiles **precisam** de `max-width: none` ou o mosaico quebra.
- **Copy em PT-BR**, voz da Versão D: seca, sem exclamação, sem emoji decorativo em texto novo.
- **Nunca pedir geolocalização sem toque explícito da pessoa.** Prompt não solicitado é negação permanente.
- **A atribuição `© OpenStreetMap` é obrigação de licença (ODbL)**, não enfeite. Não pode ser removida por refatoração de estilo.
- **Cores do estado** já existem como variáveis CSS: `--go` (fresco) e `--stop` (frio). Não introduzir cor nova.
- Commits em PT-BR, no padrão do repo (`feat(escopo): ...`, `refactor(...)`). Terminar a mensagem com:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/geo.ts` (novo) | "É longe?" — tipo `Coord`, haversine, formatação do texto. Puro. |
| `tests/lib/geo.test.ts` (novo) | Testes do acima. |
| `src/lib/mapa.ts` (novo) | "Onde fica?" — constantes de enquadramento, projeção Web Mercator, mosaico de tiles, URL de tile. Puro. |
| `tests/lib/mapa.test.ts` (novo) | Testes do acima, incluindo o teste que trava o enquadramento. |
| `src/app/MapaEstatico.tsx` (novo) | Server component. Só markup derivado de `mapa.ts` + pin + atribuição. |
| `src/app/DistanciaDaqui.tsx` (novo) | Client component. Máquina de 4 estados em cima de `navigator.geolocation` + `geo.ts`. |
| `tests/app/DistanciaDaqui.test.tsx` (novo) | Testes do acima com `navigator.geolocation` stubado. |
| `src/app/page.tsx` (modificar) | Liga os dois componentes na seção Trajeto; remove a faixa decorativa. |
| `src/app/ficha.css` (modificar) | Remove `.wp-map`/`.wp-pin` antigos; adiciona estilos do mosaico, do pin e da distância. |

**Ordem:** Tasks 1 e 2 são puras e independentes entre si. Task 3 depende da 2. Task 4 depende da 1. Cada task termina com algo testável sozinho.

---

## Task 1: `geo.ts` — distância e o texto que não mente

**Files:**
- Create: `src/lib/geo.ts`
- Test: `tests/lib/geo.test.ts`

**Interfaces:**
- Consumes: nada (módulo folha).
- Produces:
  - `export type Coord = { lat: number; lng: number }` — **Task 2 importa este tipo.**
  - `export function distanciaKm(a: Coord, b: Coord): number`
  - `export function formatarDistancia(km: number): string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/lib/geo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { distanciaKm, formatarDistancia } from "@/lib/geo";

// Âncoras derivadas da própria geometria da esfera, não de geografia real:
// um grau no equador = 2·π·6371/360 = 111,195 km.
const GRAU_KM = (2 * Math.PI * 6371) / 360;

describe("distanciaKm", () => {
  it("um grau de longitude no equador ≈ 111,195 km", () => {
    const d = distanciaKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(d).toBeCloseTo(GRAU_KM, 1);
  });

  it("um grau de latitude ≈ 111,195 km (vale em qualquer meridiano)", () => {
    const d = distanciaKm({ lat: 0, lng: -36 }, { lat: 1, lng: -36 });
    expect(d).toBeCloseTo(GRAU_KM, 1);
  });

  it("o mesmo ponto dá zero", () => {
    const p = { lat: -7.907889, lng: -36.019222 };
    expect(distanciaKm(p, p)).toBeCloseTo(0, 6);
  });

  it("é simétrica", () => {
    const a = { lat: -7.907889, lng: -36.019222 };
    const b = { lat: -8.05, lng: -34.9 };
    expect(distanciaKm(a, b)).toBeCloseTo(distanciaKm(b, a), 9);
  });

  it("longitude encolhe com a latitude (1° a −60° vale metade do equador)", () => {
    const noEquador = distanciaKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const em60 = distanciaKm({ lat: -60, lng: 0 }, { lat: -60, lng: 1 });
    expect(em60).toBeCloseTo(noEquador / 2, 0);
  });
});

describe("formatarDistancia", () => {
  it("abaixo de 1 km não finge precisão", () => {
    expect(formatarDistancia(0.4)).toBe("menos de 1 km em linha reta daqui");
    expect(formatarDistancia(0.9)).toBe("menos de 1 km em linha reta daqui");
  });

  it("entre 1 e 10 km usa uma casa decimal com vírgula", () => {
    expect(formatarDistancia(1)).toBe("~1,0 km em linha reta daqui");
    expect(formatarDistancia(4.24)).toBe("~4,2 km em linha reta daqui");
    expect(formatarDistancia(9.9)).toBe("~9,9 km em linha reta daqui");
  });

  it("de 10 km pra cima arredonda pra inteiro", () => {
    expect(formatarDistancia(10)).toBe("~10 km em linha reta daqui");
    expect(formatarDistancia(38.4)).toBe("~38 km em linha reta daqui");
    expect(formatarDistancia(124.6)).toBe("~125 km em linha reta daqui");
  });

  it("cada ramo diz “em linha reta” — é o que impede o número de mentir", () => {
    for (const km of [0.1, 0.99, 1, 5.5, 9.99, 10, 42, 999]) {
      expect(formatarDistancia(km)).toContain("em linha reta");
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/lib/geo.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/geo"`.

- [ ] **Step 3: Implementar**

Criar `src/lib/geo.ts`:

```ts
/** "É longe?" — distância entre dois pontos e o texto honesto que a ficha mostra.
 *  Puro de propósito: quando o tempo de estrada real entrar, troca-se a fonte
 *  do número e esta formatação continua de pé. */

export type Coord = { lat: number; lng: number };

const RAIO_TERRA_KM = 6371;

const rad = (graus: number) => (graus * Math.PI) / 180;

/** Haversine. Linha reta sobre a esfera — nunca a estrada. */
export function distanciaKm(a: Coord, b: Coord): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** O "em linha reta" é load-bearing: no agreste, 40 km em reta pode ser 1h30
 *  de serra. Sem o rótulo, o número mente pra baixo. */
export function formatarDistancia(km: number): string {
  if (km < 1) return "menos de 1 km em linha reta daqui";
  const n = km < 10 ? km.toFixed(1).replace(".", ",") : String(Math.round(km));
  return `~${n} km em linha reta daqui`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/lib/geo.test.ts`
Expected: PASS (9 testes).

Depois: `npm test`
Expected: PASS — 26 antigos + 9 novos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.ts tests/lib/geo.test.ts
git commit -m "feat(geo): distância em linha reta + formatação que diz que é reta"
```

---

## Task 2: `mapa.ts` — projeção, mosaico e o enquadramento travado por teste

**Files:**
- Create: `src/lib/mapa.ts`
- Test: `tests/lib/mapa.test.ts`

**Interfaces:**
- Consumes: `import type { Coord } from "@/lib/geo"` (Task 1). Só tipo, zero acoplamento em runtime.
- Produces:
  - `export const MAPA_ZOOM = 11`
  - `export const MAPA_ALTURA_PX = 200`
  - `export const MAPA_LARGURA_PX = 480`
  - `export const MAPA_ESCALA = 2`
  - `export const TILE_PX = 256`
  - `export type Tile = { z: number; x: number; y: number; left: number; top: number }`
  - `export function pontoNoMundo(c: Coord, z: number): { x: number; y: number }`
  - `export function metrosPorPixel(lat: number, z: number): number`
  - `export function tilesParaCaixa(centro: Coord, z: number, larguraPx: number, alturaPx: number): Tile[]`
  - `export function urlTile(t: { z: number; x: number; y: number }): string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/lib/mapa.test.ts`:

```ts
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
});

describe("urlTile", () => {
  it("monta o endereço do tile do OSM", () => {
    expect(urlTile({ z: 11, x: 793, y: 1064 })).toBe(
      "https://tile.openstreetmap.org/11/793/1064.png",
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/lib/mapa.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/mapa"`.

- [ ] **Step 3: Implementar**

Criar `src/lib/mapa.ts`:

```ts
/** "Onde fica?" — projeção Web Mercator e o mosaico de tiles do OpenStreetMap.
 *  Puro, sem I/O, sem React: o componente só posiciona o que sai daqui. */

import type { Coord } from "./geo";

export const TILE_PX = 256;

/** Zoom da ficha. Nesta latitude dá ~75,7 m/px → ~26 km de largura num
 *  celular de 350px: aberto o bastante pra aparecer estrada e nome de cidade,
 *  que é o que responde "onde fica". ÚNICO número a mexer depois de ver no
 *  celular — e mexer nele quebra o teste de enquadramento de propósito. */
export const MAPA_ZOOM = 11;

/** Altura de exibição. A faixa decorativa antiga tinha 88px, curta demais
 *  pra ler nome de cidade. */
export const MAPA_ALTURA_PX = 200;

/** Largura de GERAÇÃO, não de exibição: o cartão é fluido e o mosaico precisa
 *  de um número. Geramos 480px (~36 km) e o cartão corta a sobra. Celular
 *  largo não fica com faixa vazia; estreito só vê menos mapa — nunca menos pin. */
export const MAPA_LARGURA_PX = 480;

/** Densidade: 2 = puxa tiles de um zoom a mais e desenha em metade do tamanho,
 *  pra não ficar mole em tela retina. Vira 1 se o peso incomodar mais que a nitidez. */
export const MAPA_ESCALA = 2;

export type Tile = { z: number; x: number; y: number; left: number; top: number };

/** Coordenada → pixel no "mundo" daquele zoom.
 *  Forma equivalente à clássica (1 − ln(tan φ + sec φ)/π)/2, porém em seno,
 *  que é numericamente mais estável perto dos polos. */
export function pontoNoMundo(c: Coord, z: number): { x: number; y: number } {
  const escala = TILE_PX * 2 ** z;
  const seno = Math.sin((c.lat * Math.PI) / 180);
  return {
    x: ((c.lng + 180) / 360) * escala,
    y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * escala,
  };
}

/** Resolução do mapa. Existe pra que o enquadramento seja verificável em
 *  teste, não afirmado de boca. */
export function metrosPorPixel(lat: number, z: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

/** Os tiles que cobrem uma caixa centrada no ponto, cada um já com o offset
 *  em pixels de CSS dentro da caixa. */
export function tilesParaCaixa(
  centro: Coord,
  z: number,
  larguraPx: number,
  alturaPx: number,
): Tile[] {
  const p = pontoNoMundo(centro, z);
  const esq = p.x - larguraPx / 2;
  const topo = p.y - alturaPx / 2;
  const nTiles = 2 ** z;

  const tx0 = Math.floor(esq / TILE_PX);
  const tx1 = Math.ceil((esq + larguraPx) / TILE_PX) - 1;
  const ty0 = Math.floor(topo / TILE_PX);
  const ty1 = Math.ceil((topo + alturaPx) / TILE_PX) - 1;

  const tiles: Tile[] = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    if (ty < 0 || ty >= nTiles) continue; // acima do polo norte / abaixo do sul
    for (let tx = tx0; tx <= tx1; tx++) {
      tiles.push({
        z,
        // x envolve no antimeridiano pra pedir um tile que existe...
        x: ((tx % nTiles) + nTiles) % nTiles,
        y: ty,
        // ...mas o posicionamento usa o tx original, pra o mosaico não saltar.
        left: tx * TILE_PX - esq,
        top: ty * TILE_PX - topo,
      });
    }
  }
  return tiles;
}

export function urlTile(t: { z: number; x: number; y: number }): string {
  return `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/lib/mapa.test.ts`
Expected: PASS (13 testes).

Depois: `npm test`
Expected: PASS — 26 + 9 (Task 1) + 13 = 48.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mapa.ts tests/lib/mapa.test.ts
git commit -m "feat(mapa): projeção Web Mercator + mosaico de tiles do OSM"
```

---

## Task 3: `MapaEstatico` na ficha — a hachura sai, o mapa real entra

**Files:**
- Create: `src/app/MapaEstatico.tsx`
- Modify: `src/app/page.tsx` (import no topo; bloco `.waypoint` em ~122-132)
- Modify: `src/app/ficha.css` (remover linhas 93-96; adicionar bloco novo)

**Interfaces:**
- Consumes: tudo de `@/lib/mapa` (Task 2); `type Estado` de `@/lib/motor` (já existe: `"fresco" | "frio"`).
- Produces: `export default function MapaEstatico(props: { lat: number; lng: number; nome: string; estado: Estado })` — server component, **sem** `"use client"`.

- [ ] **Step 1: Criar o componente**

Criar `src/app/MapaEstatico.tsx`:

```tsx
import {
  MAPA_ALTURA_PX,
  MAPA_ESCALA,
  MAPA_LARGURA_PX,
  MAPA_ZOOM,
  TILE_PX,
  tilesParaCaixa,
  urlTile,
} from "@/lib/mapa";
import type { Estado } from "@/lib/motor";

/** Mapa de orientação: responde "onde fica", não "como chegar" — navegar é
 *  trabalho do "Abrir no mapa". Server component: só markup derivado de
 *  funções puras, zero JS no cliente. */
export default function MapaEstatico({
  lat,
  lng,
  nome,
  estado,
}: {
  lat: number;
  lng: number;
  nome: string;
  estado: Estado;
}) {
  // Tiles de um zoom a mais desenhados em 1/MAPA_ESCALA = o dobro da densidade.
  const zTiles = MAPA_ZOOM + Math.log2(MAPA_ESCALA);
  const largura = MAPA_LARGURA_PX * MAPA_ESCALA;
  const altura = MAPA_ALTURA_PX * MAPA_ESCALA;
  const tiles = tilesParaCaixa({ lat, lng }, zTiles, largura, altura);

  return (
    <div className="wp-mapa" style={{ height: MAPA_ALTURA_PX }}>
      <div
        className="wp-tiles"
        role="img"
        aria-label={`Mapa da região de ${nome}`}
        style={{
          width: MAPA_LARGURA_PX,
          height: MAPA_ALTURA_PX,
          marginLeft: -MAPA_LARGURA_PX / 2,
        }}
      >
        <div
          className="wp-tiles-in"
          style={{ width: largura, height: altura, transform: `scale(${1 / MAPA_ESCALA})` }}
        >
          {tiles.map((t) => (
            <img
              key={`${t.z}/${t.x}/${t.y}`}
              src={urlTile(t)}
              alt=""
              width={TILE_PX}
              height={TILE_PX}
              style={{ left: t.left, top: t.top }}
            />
          ))}
        </div>
      </div>
      <span className="wp-pin" data-estado={estado} aria-hidden="true" />
      {/* Atribuição ODbL — obrigação de licença, não enfeite. Não remover. */}
      <a
        className="wp-osm"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Trocar o CSS**

Em `src/app/ficha.css`, **apagar** as duas regras antigas (linhas ~93-96):

```css
.bp .wp-map { height: 88px; position: relative; background:
    radial-gradient(60% 90% at 78% 30%, color-mix(in srgb, var(--go) 22%, transparent), transparent 60%),
    repeating-linear-gradient(115deg, color-mix(in srgb, var(--accent) 8%, transparent) 0 2px, transparent 2px 16px); }
.bp .wp-pin { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-100%); font-size: 1.4rem; filter: drop-shadow(0 2px 3px rgba(0,0,0,.25)); }
```

E **colocar no lugar**:

```css
/* mapa real: mosaico de tiles do OSM, centrado no waypoint.
   .wp-mapa é fluido; .wp-tiles tem largura fixa de geração e fica centrado,
   o que garante o pin no meio do cartão em qualquer largura de tela. */
.bp .wp-mapa { position: relative; overflow: hidden; background: var(--surface-2); }
.bp .wp-tiles { position: absolute; top: 0; left: 50%; overflow: hidden; }
.bp .wp-tiles-in { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
/* max-width: none é obrigatório — o reset do Tailwind põe 100% em img e
   isso esmagaria cada tile do mosaico. */
.bp .wp-tiles-in img { position: absolute; display: block; max-width: none; }

/* o pin repete a decisão do carimbo em vez de só ilustrar */
.bp .wp-pin { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px;
  margin: -18px 0 0 -9px; background: var(--go); border: 2px solid var(--screen);
  border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
  box-shadow: 0 2px 6px rgba(0,0,0,.35); }
.bp .wp-pin[data-estado="frio"] { background: var(--stop); }

.bp .wp-osm { position: absolute; right: 0; bottom: 0; padding: .12rem .35rem;
  font-family: var(--type); font-size: .58rem; text-decoration: none;
  color: var(--ink-soft); background: color-mix(in srgb, var(--screen) 78%, transparent);
  border-top-left-radius: 6px; }
```

- [ ] **Step 3: Ligar na ficha**

Em `src/app/page.tsx`, adicionar o import junto dos outros (depois da linha 5):

```tsx
import MapaEstatico from "./MapaEstatico";
```

E trocar a linha da faixa decorativa (linha ~123):

```tsx
<div className="wp-map" aria-hidden="true"><span className="wp-pin">📍</span></div>
```

por:

```tsx
<MapaEstatico lat={wp.lat} lng={wp.lng} nome={wp.nome} estado={state} />
```

- [ ] **Step 4: Verificar que nada quebrou**

Run: `npm test`
Expected: PASS — os 48 continuam passando (nenhum toca `page.tsx`).

Run: `npm run build`
Expected: build limpo, sem erro de tipo. `state` já é `Estado` na linha 47 de `page.tsx`.

Confirmar que a hachura sumiu de vez:
Run: `git grep -n "wp-map\b\|repeating-linear-gradient"`
Expected: nenhuma ocorrência de `.wp-map` (só `.wp-mapa`).

- [ ] **Step 5: Commit**

```bash
git add src/app/MapaEstatico.tsx src/app/page.tsx src/app/ficha.css
git commit -m "feat(rampa): mapa real de tiles no lugar da hachura, pin na cor do carimbo"
```

---

## Task 4: `DistanciaDaqui` — o número atrás de um toque

**Files:**
- Create: `src/app/DistanciaDaqui.tsx`
- Test: `tests/app/DistanciaDaqui.test.tsx`
- Modify: `src/app/page.tsx` (import + uma linha no `.wp-body`)
- Modify: `src/app/ficha.css` (adicionar estilos no fim do bloco do waypoint)

**Interfaces:**
- Consumes: `distanciaKm`, `formatarDistancia` de `@/lib/geo` (Task 1).
- Produces: `export default function DistanciaDaqui(props: { lat: number; lng: number })` — client component (`"use client"`).

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/app/DistanciaDaqui.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DistanciaDaqui from "@/app/DistanciaDaqui";

const RAMPA = { lat: -7.907889, lng: -36.019222 };

/** jsdom não traz navigator.geolocation; a gente planta (ou remove) na mão. */
function plantarGeo(valor: unknown) {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    value: valor,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  plantarGeo(undefined);
  vi.restoreAllMocks();
});

describe("DistanciaDaqui", () => {
  it("um toque mede e mostra a distância dizendo que é linha reta", () => {
    plantarGeo({
      getCurrentPosition: (ok: PositionCallback) =>
        // um grau de latitude ao norte da Rampa ≈ 111 km
        ok({ coords: { latitude: RAMPA.lat + 1, longitude: RAMPA.lng } } as GeolocationPosition),
    });

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));

    expect(screen.getByText(/~111 km em linha reta daqui/)).toBeTruthy();
  });

  it("em cima do lugar não finge precisão", () => {
    plantarGeo({
      getCurrentPosition: (ok: PositionCallback) =>
        ok({ coords: { latitude: RAMPA.lat, longitude: RAMPA.lng } } as GeolocationPosition),
    });

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));

    expect(screen.getByText(/menos de 1 km em linha reta daqui/)).toBeTruthy();
  });

  it("permissão negada vira estado normal, sem insistir", () => {
    plantarGeo({
      getCurrentPosition: (_ok: PositionCallback, erro: PositionErrorCallback) =>
        erro({ code: 1, message: "denied" } as GeolocationPositionError),
    });

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));

    expect(screen.getByText(/sem localiza[çc][ãa]o/i)).toBeTruthy();
    // e o convite some — não fica pedindo de novo
    expect(screen.queryByRole("button", { name: /dist[âa]ncia/i })).toBe(null);
  });

  it("navegador sem geolocalização cai no mesmo estado, sem quebrar", () => {
    plantarGeo(undefined);

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));

    expect(screen.getByText(/sem localiza[çc][ãa]o/i)).toBeTruthy();
  });

  it("não pede localização sozinho — só depois do toque", () => {
    const espiao = vi.fn();
    plantarGeo({ getCurrentPosition: espiao });

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    expect(espiao).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));
    expect(espiao).toHaveBeenCalledTimes(1);
  });

  it("enquanto mede, o botão não aceita toque duplo", () => {
    const espiao = vi.fn(); // nunca chama callback: fica preso em "medindo"
    plantarGeo({ getCurrentPosition: espiao });

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    const btn = screen.getByRole("button", { name: /dist[âa]ncia/i });
    fireEvent.click(btn);

    expect(screen.getByText(/vendo/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(espiao).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/app/DistanciaDaqui.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/DistanciaDaqui"`.

- [ ] **Step 3: Implementar**

Criar `src/app/DistanciaDaqui.tsx`:

```tsx
"use client";
import { useState } from "react";
import { distanciaKm, formatarDistancia } from "@/lib/geo";

type Fase = "idle" | "medindo" | "ok" | "negado";

/** A distância fica ATRÁS DE UM TOQUE de propósito: prompt de GPS não
 *  solicitado é o jeito mais rápido de ser negado pra sempre — e negado uma
 *  vez, o navegador não pergunta de novo. */
export default function DistanciaDaqui({ lat, lng }: { lat: number; lng: number }) {
  const [fase, setFase] = useState<Fase>("idle");
  const [texto, setTexto] = useState("");

  function medir() {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) {
      setFase("negado");
      return;
    }
    setFase("medindo");
    geo.getCurrentPosition(
      (pos) => {
        const daqui = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setTexto(formatarDistancia(distanciaKm(daqui, { lat, lng })));
        setFase("ok");
      },
      // Negado, estourou o tempo, indisponível: pro cliente dá tudo no mesmo.
      () => setFase("negado"),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }

  if (fase === "ok") return <div className="dist">{texto}</div>;
  if (fase === "negado") {
    return <div className="dist sem">sem localização — use o “Abrir no mapa”</div>;
  }
  return (
    <button className="dist-btn" onClick={medir} disabled={fase === "medindo"}>
      {fase === "medindo" ? "vendo…" : "A que distância estou?"}
    </button>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/app/DistanciaDaqui.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 5: Ligar na ficha + estilos**

Em `src/app/page.tsx`, adicionar o import junto dos outros:

```tsx
import DistanciaDaqui from "./DistanciaDaqui";
```

E acrescentar a linha logo depois da linha das coordenadas (~128), dentro da mesma `<div>`:

```tsx
<div className="coord">{wp.lat}, {wp.lng}</div>
<DistanciaDaqui lat={wp.lat} lng={wp.lng} />
```

Em `src/app/ficha.css`, acrescentar depois das regras `.maplink`:

```css
/* distância: convite discreto, resposta discreta — o carimbo continua sendo
   a coisa mais alta da ficha */
.bp .dist-btn { margin-top: .35rem; padding: 0; border: 0; background: none;
  font-family: var(--sans); font-size: .78rem; font-weight: 600; color: var(--accent);
  text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.bp .dist-btn:disabled { color: var(--ink-faint); text-decoration: none; cursor: default; }
.bp .dist-btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 4px; }
.bp .dist { margin-top: .35rem; font-size: .78rem; color: var(--ink-soft); }
.bp .dist.sem { color: var(--ink-faint); }
```

- [ ] **Step 6: Verificar tudo**

Run: `npm test`
Expected: PASS — 26 antigos + 9 + 13 + 6 = **54**.

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 7: Commit**

```bash
git add src/app/DistanciaDaqui.tsx tests/app/DistanciaDaqui.test.tsx src/app/page.tsx src/app/ficha.css
git commit -m "feat(rampa): distância em linha reta sob demanda, sem prompt de GPS não pedido"
```

---

## Verificação final (depois das 4 tasks)

- [ ] `npm test` → 54 verdes.
- [ ] `npm run build` → limpo.
- [ ] `git grep -n "wp-map\b"` → vazio (nenhum resto da hachura).
- [ ] `git grep -n "OpenStreetMap" src/app/MapaEstatico.tsx` → a atribuição está lá.
- [ ] Deploy: `vercel --prod --yes`.
- [ ] **No celular do João** (é isto que decide, não os testes):
  - o mapa mostra a Rampa com estrada/cidade em volta e não fica mole;
  - o pin está na cor do carimbo do dia (verde em "Pode subir", vermelho em "Não suba" — conferir com `?debug=fresco` e `?debug=frio`);
  - tocar em "A que distância estou?" pede permissão e mostra número plausível;
  - negar a permissão deixa a ficha inteira e legível.
- [ ] Se o enquadramento estiver errado no celular, mexer **só** em `MAPA_ZOOM` e ajustar a faixa do teste de enquadramento junto — o teste existe pra obrigar essa decisão a ser consciente.
