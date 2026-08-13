/** "Onde fica?" — projeção Web Mercator e o mosaico de tiles do OpenStreetMap.
 *  Puro, sem I/O, sem React: o componente só posiciona o que sai daqui. */

import type { Coord } from "@/lib/geo";

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
 *  largo não fica com faixa vazia.
 *
 *  "Estreito só vê menos mapa — nunca menos pin" só valia na FICHA, onde o
 *  pin é único e fica travado no centro (left: 50%, ver ficha.css .wp-pin):
 *  cortar sobra de um mosaico centrado nunca corta o centro. Na HOME os pins
 *  se espalham pela caixa inteira — um pin perto da borda da caixa de 480px
 *  pode cair fora da fatia que um celular estreito realmente exibe dentro do
 *  overflow:hidden. Por isso `enquadrar()` na home usa MAPA_JANELA_VISIVEL_HOME_PX
 *  (abaixo), não esta constante, pra decidir o zoom. */
export const MAPA_LARGURA_PX = 480;

/** Densidade: 2 = puxa tiles de um zoom a mais e desenha em metade do tamanho,
 *  pra não ficar mole em tela retina. Vira 1 se o peso incomodar mais que a nitidez. */
export const MAPA_ESCALA = 2;

export type Tile = { z: number; x: number; y: number; left: number; top: number };

/** Limite da projeção Web Mercator: além disso o polo vira reta infinita
 *  (ln((1+sen φ)/(1−sen φ)) diverge em φ = ±90°). Todo provedor de tile
 *  (OSM incluso) para aqui — é o próprio motivo do mapa ser quadrado. */
export const LIMITE_MERCATOR = 85.05112878;

/** Coordenada → pixel no "mundo" daquele zoom.
 *  Forma equivalente à clássica (1 − ln(tan φ + sec φ)/π)/2, porém em seno,
 *  que é numericamente mais estável perto dos polos.
 *  Latitude é grampeada em ±LIMITE_MERCATOR: sem isso, lat = ±90 vira
 *  ±Infinity e trava o loop de tilesParaCaixa num render force-dynamic. */
export function pontoNoMundo(c: Coord, z: number): { x: number; y: number } {
  const lat = Math.max(-LIMITE_MERCATOR, Math.min(LIMITE_MERCATOR, c.lat));
  const escala = TILE_PX * 2 ** z;
  const seno = Math.sin((lat * Math.PI) / 180);
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

/** Zoom real dos tiles pedidos: um a mais desenhado em 1/MAPA_ESCALA do
 *  tamanho = o dobro da densidade. Só dá inteiro se MAPA_ESCALA for potência
 *  de 2 — fora disso o zoom fica fracionário, toda URL de tile 404 e o mapa
 *  fica em branco sem erro nenhum. Exportado (em vez de inline no componente)
 *  pra esse invariante ter teste. */
export function zoomDeTiles(): number {
  return MAPA_ZOOM + Math.log2(MAPA_ESCALA);
}

/** Altura do mapa na home. Mais baixo que o da ficha (200px) porque aqui ele
 *  divide a tela com a decisão: o carimbo do primeiro cartão tem que nascer
 *  acima da dobra. Ver src/lib/home-layout.ts — a conta tem teste. */
export const MAPA_ALTURA_HOME_PX = 168;

/** Janela VISÍVEL garantida na home, no aparelho mais estreito que o app
 *  atende — não a largura de geração (MAPA_LARGURA_PX). É contra ISTO, e não
 *  contra a caixa de 480px, que `enquadrar()` tem que caber as trilhas na
 *  home: `.mapa-home-tiles` (a caixa de geração) fica centrada dentro de
 *  `.mapa-home` com `overflow: hidden` (home.css), e `.mapa-home` é fluida —
 *  só mostra uma fatia central da caixa de 480px, cuja largura depende do
 *  viewport.
 *
 *  Aparelho mais estreito considerado: 375px CSS (iPhone SE / iPhone 12 e 13
 *  mini) — não há iPhone à venda mais estreito que isso, e este app não tem
 *  Android como alvo declarado. É também o viewport que a revisão da branch
 *  usou pra medir o defeito, então a constante reproduz a medição, não uma
 *  suposição nova.
 *
 *  Derivação (ver ficha.css `.bp` — o padding — e `.bp .screen` — a borda;
 *  a ligação entre este número e aquele CSS tem teste em tests/lib/mapa.test.ts):
 *    padding da .bp   = clamp(0px, 3vw, 1rem)  → em 375px, 3vw = 11,25px (< 16px, não bate no teto)
 *    borda da .screen = 1px de cada lado (box-sizing: border-box)
 *    visível = 375 − 2×11,25 − 2×1 = 350,5px */
export const MAPA_JANELA_VISIVEL_HOME_PX = 350.5;

/** Metade do alvo de toque do `.pin-home` (44px — ver home.css): o <a> fica
 *  CENTRADO na coordenada, então pra o alvo inteiro caber dentro da janela
 *  visível o PONTO não pode chegar mais perto da borda do que isto. */
export const RAIO_ALVO_TOQUE_PX = 22;

/** Folga de cada lado no enquadramento. Tem que cobrir as DUAS coisas que
 *  ficam centradas na coordenada: o losango de 18px (a ponta cai abaixo do
 *  centro do quadrado; sem folga, a trilha da borda nasce com a ponta
 *  cortada) e o alvo de toque de 44px — na home eles não são o mesmo
 *  número, o alvo é maior. 28 ≥ RAIO_ALVO_TOQUE_PX (22): a folga de hoje já
 *  cobre o alvo, mas é o teste de invariante em tests/lib/mapa.test.ts, não
 *  a leitura deste comentário, que impede alguém de encolhê-la sem
 *  perceber. */
export const MARGEM_ENQUADRO_PX = 28;

/** Abaixo disto o mundo inteiro cabe na caixa e começa a se repetir — mosaico
 *  duplicado não orienta ninguém. */
export const ZOOM_MINIMO = 2;

/** Inversa de pontoNoMundo no eixo y.
 *  De y = (0.5 − ln((1+s)/(1−s))/4π)·escala tira-se s = tanh((0.5 − y/escala)·2π),
 *  e φ = asin(s). Em tanh, e não em exponencial crua, pra não estourar longe do
 *  equador. */
export function latDoMundo(y: number, z: number): number {
  const escala = TILE_PX * 2 ** z;
  return (Math.asin(Math.tanh((0.5 - y / escala) * 2 * Math.PI)) * 180) / Math.PI;
}

export function lngDoMundo(x: number, z: number): number {
  const escala = TILE_PX * 2 ** z;
  return (x / escala) * 360 - 180;
}

/** Centro e zoom que fazem TODAS as coordenadas caberem na caixa.
 *
 *  Nunca aproxima mais que MAPA_ZOOM: uma home com duas trilhas vizinhas viraria
 *  foto de porteira, e o mapa deste app responde "onde fica", não "onde é a
 *  entrada". E nunca afasta além de ZOOM_MINIMO.
 *
 *  Não trata longitude que cruza o antimeridiano: as trilhas são todas do mesmo
 *  lado do mundo, e fingir que trata seria complexidade sem caso de uso. */
export function enquadrar(
  coords: Coord[],
  larguraPx: number,
  alturaPx: number,
): { centro: Coord; z: number } {
  if (coords.length === 0) {
    throw new Error("enquadrar: sem coordenada nenhuma — quem chama decide não desenhar mapa");
  }

  // Tudo medido no zoom 0 (mundo de 256px) e depois escalado: o span dobra a
  // cada zoom, então o zoom que serve sai de uma divisão só.
  const pontos = coords.map((c) => pontoNoMundo(c, 0));
  const minX = Math.min(...pontos.map((p) => p.x));
  const maxX = Math.max(...pontos.map((p) => p.x));
  const minY = Math.min(...pontos.map((p) => p.y));
  const maxY = Math.max(...pontos.map((p) => p.y));

  const centro: Coord = {
    lat: latDoMundo((minY + maxY) / 2, 0),
    lng: lngDoMundo((minX + maxX) / 2, 0),
  };

  const dispX = Math.max(1, larguraPx - 2 * MARGEM_ENQUADRO_PX);
  const dispY = Math.max(1, alturaPx - 2 * MARGEM_ENQUADRO_PX);
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  // Ponto único (ou pontos coincidentes): não há span pra caber, o zoom é o da
  // ficha. Sem este ramo a divisão por zero viraria Infinity.
  const zCabe =
    spanX === 0 && spanY === 0
      ? MAPA_ZOOM
      : Math.floor(
          Math.min(
            spanX === 0 ? Infinity : Math.log2(dispX / spanX),
            spanY === 0 ? Infinity : Math.log2(dispY / spanY),
          ),
        );

  return { centro, z: Math.max(ZOOM_MINIMO, Math.min(MAPA_ZOOM, zCabe)) };
}

/** Onde uma coordenada cai dentro da caixa desenhada, em pixels de CSS. */
export function posicaoNaCaixa(
  c: Coord,
  centro: Coord,
  z: number,
  larguraPx: number,
  alturaPx: number,
): { left: number; top: number } {
  const p = pontoNoMundo(c, z);
  const o = pontoNoMundo(centro, z);
  return { left: larguraPx / 2 + (p.x - o.x), top: alturaPx / 2 + (p.y - o.y) };
}
