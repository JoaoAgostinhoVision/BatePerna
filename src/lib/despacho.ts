/** Rotas de um segmento que NÃO são ficha. Se nascer outra, entra aqui. */
const RESERVADOS = new Set(["trilhas", "icones", "admin"]);

/** O caminho parece uma ficha? Puro string, sem fs: é tudo o que o service
 *  worker consegue saber pra decidir se a navegação é dele. "Parece" é o
 *  limite honesto do que dá pra afirmar daqui.
 *
 *  (Este módulo já teve o cookie da última ficha. Ele morreu quando "/" deixou
 *  de despachar e virou a home — o ponteiro que sobrou é o do service worker,
 *  CHAVE_ULTIMA, que é outro bicho e mora em cache-rotas.ts.) */
export function ehCaminhoDeFicha(pathname: string): boolean {
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length !== 1) return false;
  const [seg] = partes;
  return !RESERVADOS.has(seg) && !seg.includes(".");
}
