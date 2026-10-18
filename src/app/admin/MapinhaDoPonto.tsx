import { MAPA_ESCALA, MAPA_ZOOM_EDITOR, TILE_PX, tilesParaCaixa, urlTile, zoomDeTiles } from "@/lib/mapa";

/** O MAPINHA DO PONTO na revisão (17/10, Task 8) — componente de SERVIDOR, sem
 *  JS: o ponto que a pessoa marcou, num pin fixo no meio, no zoom do mapa de
 *  pôr o pin. Existe porque a revisão mostra o ponto como MAPA, nunca como
 *  número; e não é o `MapaEstatico` porque o dele só tem estilo debaixo de `.bp`
 *  (a ficha pública — o painel não carrega esse CSS) e diz "Sem o mapa, vale a
 *  coordenada abaixo.", falso numa linha que não mostra coordenada.
 *
 *  Os tiles são os da vista (`tilesParaCaixa`), pedidos pelo navegador ao abrir
 *  a tela — nada de pré-carregar, a Tile Usage Policy do OSM. O crédito
 *  "© OpenStreetMap" é obrigação de licença (ODbL); não remover. */
const LARGURA_PX = 320;
const ALTURA_PX = 140;

export default function MapinhaDoPonto({ lat, lng }: { lat: number; lng: number }) {
  const tiles = tilesParaCaixa(
    { lat, lng },
    zoomDeTiles(MAPA_ZOOM_EDITOR),
    LARGURA_PX * MAPA_ESCALA,
    ALTURA_PX * MAPA_ESCALA,
  );
  return (
    <div className="adm-mapinha" style={{ height: ALTURA_PX }}>
      <div
        className="adm-mapinha-tiles"
        role="img"
        aria-label="Mapa do ponto marcado"
        style={{ width: LARGURA_PX, height: ALTURA_PX }}
      >
        <div
          className="adm-mapinha-tiles-in"
          style={{
            width: LARGURA_PX * MAPA_ESCALA,
            height: ALTURA_PX * MAPA_ESCALA,
            transform: `scale(${1 / MAPA_ESCALA})`,
          }}
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
      <span className="adm-mapinha-pin" aria-hidden="true" />
      <a className="adm-mapinha-osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
        © OpenStreetMap
      </a>
    </div>
  );
}
