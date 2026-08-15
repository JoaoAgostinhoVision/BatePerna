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
