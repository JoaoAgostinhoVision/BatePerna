import {
  MAPA_ALTURA_PX,
  MAPA_ESCALA,
  MAPA_LARGURA_PX,
  TILE_PX,
  tilesParaCaixa,
  urlTile,
  zoomDeTiles,
} from "@/lib/mapa";

/** Mapa de orientação: responde "onde fica", não "como chegar" — navegar é
 *  trabalho do "Abrir no mapa". Server component: só markup derivado de
 *  funções puras, zero JS no cliente.
 *
 *  O pin continua repetindo a decisão do carimbo, mas a cor NÃO chega mais por
 *  prop: ela vem do `data-state` da Moldura, por CSS. Prop seria a leitura do
 *  servidor congelada — quando o carimbo busca leitura nova no portão e o selo
 *  vira vermelho, o pin ficaria verde ao lado dele. */
export default function MapaEstatico({
  lat,
  lng,
  nome,
}: {
  lat: number;
  lng: number;
  nome: string;
}) {
  // Tiles de um zoom a mais desenhados em 1/MAPA_ESCALA = o dobro da densidade.
  const zTiles = zoomDeTiles();
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
      <span className="wp-pin" aria-hidden="true" />
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
