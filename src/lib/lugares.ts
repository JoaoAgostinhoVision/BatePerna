/** "Onde eu estou?" quando não há GPS — o serviço de geocoding e a leitura
 *  da resposta dele.
 *
 *  Puro, sem fetch: quem busca é a rota. Aqui mora o que precisa de teste —
 *  a forma da URL e o que se aceita como um lugar de verdade. */

export type Lugar = { nome: string; regiao: string; pais: string; lat: number; lng: number };

/** Quantos resultados. Cinco cabem na tela sem rolar e já bastam pra
 *  desambiguar homônimos (Gravatá/PE vs Gravatal/SC). */
const QUANTOS = 5;

export function urlBusca(q: string): string {
  const params = new URLSearchParams({
    name: q,
    count: String(QUANTOS),
    language: "pt",
    format: "json",
  });
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}

/** Só vira lugar o que tem coordenada numérica.
 *
 *  Item sem `latitude` viraria `{lat: undefined}`, e daí todo km da home sai
 *  NaN — sem erro nenhum, só números sumindo da tela. A região pode faltar
 *  (vira ""), porque ela é rótulo, não decisão. */
export function lerLugares(raw: unknown): Lugar[] {
  const results = (raw as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const fora: Lugar[] = [];
  for (const r of results) {
    const o = r as Record<string, unknown>;
    if (
      typeof o?.name !== "string" ||
      typeof o.latitude !== "number" ||
      typeof o.longitude !== "number" ||
      !Number.isFinite(o.latitude) ||
      !Number.isFinite(o.longitude)
    ) {
      continue;
    }
    fora.push({
      nome: o.name,
      regiao: typeof o.admin1 === "string" ? o.admin1 : "",
      pais: typeof o.country === "string" ? o.country : "",
      lat: o.latitude,
      lng: o.longitude,
    });
  }
  return fora;
}
