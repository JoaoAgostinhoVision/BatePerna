/** Nome do cookie que lembra a última ficha aberta. Sublinhado, não
 *  dois-pontos: `:` é separador na RFC 6265 e não vale em nome de cookie.
 *  (Os `bp:` que existem no código são chaves de localStorage, onde vale.) */
export const COOKIE_ULTIMA = "bp_ultima";

/** Pra onde mandar quem chega em "/".
 *
 *  Pura de propósito: quem chama é o server component de "/", que tem fs e
 *  sabe quais fichas existem. O middleware nunca chama isto — ele roda fora
 *  do runtime que enxerga content/fichas e não teria como validar nada. */
export function destinoDe(ultima: string | undefined, slugsExistentes: string[]): string {
  return ultima && slugsExistentes.includes(ultima) ? `/${ultima}` : "/trilhas";
}
