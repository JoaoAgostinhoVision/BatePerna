/** "Onde eu estou?" quando não há GPS — o serviço de geocoding e a leitura
 *  da resposta dele.
 *
 *  Puro, sem fetch: quem busca é a rota. Aqui mora o que precisa de teste —
 *  a forma da URL e o que se aceita como um lugar de verdade. */

/** Quanto a rota espera o serviço de geocoding antes de desistir. Menor que o
 *  PRAZO_CLIMA_MS (4s): aqui a pessoa está digitando e olhando pra tela, não
 *  abrindo o app.
 *
 *  Mora AQUI, e não no `route.ts` que a usa, porque o Next restringe o que um
 *  route handler pode exportar: qualquer export além de GET/POST/dynamic/etc
 *  quebra o `next build` com "Type '3000' is not assignable to type 'never'".
 *  A suíte de testes não pega isso — o vitest não roda o build. */
export const PRAZO_BUSCA_MS = 3_000;

export type Lugar = { nome: string; regiao: string; pais: string; lat: number; lng: number };

/** Quantos resultados.
 *
 *  ⚠️ Este comentário já disse "cinco cabem na tela sem rolar", e era FALSO
 *  pela régua: o painel de busca cobre o mapa (168px de altura), e depois do
 *  campo, do crédito e dos respiros sobram ~70px pra lista — um resultado
 *  inteiro e um pedaço do segundo, com cada `.busca-item` medindo 44px mais
 *  6,4 de gap (medido em 375×667).
 *
 *  O número FICA em 5, e o comentário é que estava errado. Cinco é o que
 *  desambigua homônimo (Gravatá/PE vs Gravatal/SC vs Gravatá/BA): cortar pra 2
 *  faria a cidade certa simplesmente não aparecer, que é pior do que rolar. A
 *  lista rola de propósito — o que NÃO pode rolar pra fora da tela é o crédito
 *  do GeoNames, e por isso ele mora fora da caixa que rola (ver o `.busca-rolo`
 *  em home.css). */
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
