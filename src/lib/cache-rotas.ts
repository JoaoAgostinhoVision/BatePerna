/** Onde as fichas navegadas com sucesso ficam guardadas — cada uma sob a
 *  própria URL, mais uma cópia sob CHAVE_ULTIMA. Cache com nome próprio pra
 *  poder ser limpo sozinho, sem levar junto o precache do build. */
export const CACHE_ULTIMA_FICHA = "bp-ultima-ficha";

/** O espelho offline do cookie bp_ultima: o service worker não lê cookie,
 *  então guarda a última ficha também sob esta chave fixa — e é ela que
 *  responde quando "/" abre sem rede, já que o redirect precisa de servidor. */
export const CHAVE_ULTIMA = "/__ultima__";

export function ehTileOsm(url: string): boolean {
  return new URL(url).hostname === "tile.openstreetmap.org";
}

/** Placar e cron nunca saem do cache. O resto da ficha é verdade parada;
 *  o placar não é. */
export function nuncaCachear(url: string): boolean {
  return new URL(url).pathname.startsWith("/api/");
}
