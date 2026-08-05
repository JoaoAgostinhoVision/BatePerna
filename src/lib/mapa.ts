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
