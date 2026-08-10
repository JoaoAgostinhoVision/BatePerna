/** Nome do cookie que lembra a última ficha aberta. Sublinhado, não
 *  dois-pontos: `:` é separador na RFC 6265 e não vale em nome de cookie.
 *  (Os `bp:` que existem no código são chaves de localStorage, onde vale.) */
export const COOKIE_ULTIMA = "bp_ultima";

/** O cookie tem que sobreviver a fechar o app e passar meses sem subir nada. */
export const UM_ANO_S = 60 * 60 * 24 * 365;

/** Pra onde mandar quem chega em "/".
 *
 *  Pura de propósito: quem chama é o server component de "/", que tem fs e
 *  sabe quais fichas existem. Continua validando mesmo agora que só ficha
 *  renderizada grava o cookie — o valor pode ter envelhecido no celular,
 *  apontando pra uma ficha que saiu do ar depois. */
export function destinoDe(ultima: string | undefined, slugsExistentes: string[]): string {
  return ultima && slugsExistentes.includes(ultima) ? `/${ultima}` : "/trilhas";
}

/** Rotas de um segmento que NÃO são ficha. Se nascer outra, entra aqui. */
const RESERVADOS = new Set(["trilhas", "icones"]);

/** O caminho parece uma ficha? Puro string, sem fs: é tudo o que o service
 *  worker consegue saber pra decidir se a navegação é dele. "Parece" é o
 *  limite honesto do que dá pra afirmar daqui. */
export function ehCaminhoDeFicha(pathname: string): boolean {
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length !== 1) return false;
  const [seg] = partes;
  return !RESERVADOS.has(seg) && !seg.includes(".");
}
