import {
  MAPA_ALTURA_HOME_PX,
  MAPA_ESCALA,
  MAPA_LARGURA_PX,
  TILE_PX,
  enquadrar,
  posicaoNaCaixa,
  tilesParaCaixa,
  urlTile,
} from "@/lib/mapa";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import PinTrilha from "./PinTrilha";

/** O mapa da home: onde ficam as trilhas de hoje.
 *
 *  Mesma natureza do mapa da ficha — imagem, mosaico de tiles, zero JS pra
 *  desenhar. A diferença é que este ENQUADRA várias coordenadas em vez de
 *  centrar numa.
 *
 *  Mais baixo que o da ficha porque aqui ele divide a tela com a decisão: o
 *  primeiro cartão tem que nascer acima da dobra. Ver src/lib/mapa.ts
 *  (MAPA_ALTURA_HOME_PX). */
export default function MapaHome({
  fichas,
  leituras,
}: {
  fichas: Ficha[];
  leituras: Map<string, LeituraCarimbo>;
}) {
  if (fichas.length === 0) return null;

  const coords = fichas.map((f) => f.condicao.coords);
  const { centro, z } = enquadrar(coords, MAPA_LARGURA_PX, MAPA_ALTURA_HOME_PX);

  // Tiles de um zoom a mais desenhados em 1/MAPA_ESCALA: o dobro da densidade,
  // igual à ficha. zoomDeTiles() não serve aqui — ela crava MAPA_ZOOM, e o
  // zoom desta caixa é o `z` que saiu do enquadramento, não uma constante.
  const zTiles = z + Math.log2(MAPA_ESCALA);
  const largura = MAPA_LARGURA_PX * MAPA_ESCALA;
  const altura = MAPA_ALTURA_HOME_PX * MAPA_ESCALA;
  const tiles = tilesParaCaixa(centro, zTiles, largura, altura);

  return (
    <div className="mapa-home">
      <div
        className="mapa-home-tiles"
        role="img"
        aria-label="Mapa com as trilhas de hoje"
        style={{ width: MAPA_LARGURA_PX, height: MAPA_ALTURA_HOME_PX, marginLeft: -MAPA_LARGURA_PX / 2 }}
      >
        <div
          className="mapa-home-in"
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
        {fichas.map((f) => {
          const { left, top } = posicaoNaCaixa(
            f.condicao.coords, centro, z, MAPA_LARGURA_PX, MAPA_ALTURA_HOME_PX,
          );
          return (
            <PinTrilha
              key={f.slug}
              slug={f.slug}
              nome={f.trajeto.waypoints[0].nome}
              left={left}
              top={top}
              inicial={leituras.get(f.slug)!}
            />
          );
        })}
      </div>
      {/* Atribuição ODbL — obrigação de licença, não enfeite. Não remover. */}
      <a className="wp-osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
        © OpenStreetMap
      </a>
    </div>
  );
}
