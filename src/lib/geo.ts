/** "É longe?" — distância entre dois pontos e o texto honesto que a ficha mostra.
 *  Puro de propósito: quando o tempo de estrada real entrar, troca-se a fonte
 *  do número e esta formatação continua de pé. */

import type { Ficha } from "@/types/ficha";

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
  // Arredonda pra uma casa ANTES de decidir o ramo: senão um valor como 9,99
  // cai no ramo de uma casa e toFixed(1) mostra "10,0", enquanto 10 mostra
  // "10" — a mesma distância com duas caras diferentes.
  const arred = Math.round(km * 10) / 10;
  const n = arred < 10 ? arred.toFixed(1).replace(".", ",") : String(Math.round(arred));
  return `~${n} km em linha reta daqui`;
}

/** A distância como o CARTÃO a mostra: sem o "daqui", porque a pílula do mapa
 *  logo acima já diz de onde se está medindo. O "em linha reta" fica — ele é
 *  a parte honesta do texto, não enfeite. */
export function formatarDistanciaCurta(km: number): string {
  return formatarDistancia(km).replace(" daqui", "");
}

/** 🔴 O ÚNICO ponto de onde o app mede distância até uma trilha.
 *
 *  Uma ficha carrega DUAS coordenadas — `trajeto.waypoints[0]` (onde a trilha
 *  começa) e `condicao.coords` (onde se mede a chuva) — e nada obriga as duas
 *  a coincidirem. Na Rampa elas são iguais por acaso; a segunda ficha desfaz
 *  esse acaso. Enquanto o cartão e o filtro mediam até `condicao.coords` e a
 *  ficha media até o waypoint, a MESMA trilha tinha dois km (89 e 40, com um
 *  par sintético) e o filtro "até 60 km" escondia uma trilha cujo portão está
 *  a 40. É a invariante "uma trilha, uma fonte" quebrada por dentro.
 *
 *  A escolha é o WAYPOINT, e a razão é o botão "Abrir no mapa" da ficha: ele
 *  abre o waypoint no Google Maps. Medir por outro ponto faria o app dizer
 *  "40 km" e mandar a pessoa pra um lugar diferente. O pin do mapa da HOME
 *  continua em `condicao.coords` — lá o pin marca o ponto do clima, que é o
 *  que aquele mapa responde.
 *
 *  Mora em geo.ts, e não em ficha.ts, por uma razão dura: ficha.ts carrega
 *  `node:fs` no topo e quebraria o bundle do navegador — e dois dos três
 *  consumidores (`CartaoTrilha`, `DistanciaDaqui`) são client components. É o
 *  mesmo motivo que já exilou o `formatarDuracao` pra duracao.ts. O `import
 *  type` daqui some na compilação, então nada de zod entra no bundle.
 *
 *  Recebe a FICHA inteira de propósito. Se recebesse uma `Coord`, cada chamador
 *  voltaria a escolher qual das duas passar — que é exatamente o defeito. */
export function coordDaDistancia(ficha: Ficha): Coord {
  const inicio = ficha.trajeto.waypoints[0];
  return { lat: inicio.lat, lng: inicio.lng };
}
