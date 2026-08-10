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

/** Rotas de um segmento que NÃO são ficha. Se nascer outra, entra aqui —
 *  senão o middleware grava o nome dela como se fosse trilha. */
const RESERVADOS = new Set(["trilhas", "icones"]);

/** O caminho parece uma ficha? Puro string: é o que o middleware consegue
 *  saber sem fs. Se o slug for inventado, o cookie fica inválido e quem
 *  descarta é "/" — que sabe quais fichas existem. */
export function ehCaminhoDeFicha(pathname: string): boolean {
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length !== 1) return false;
  const [seg] = partes;
  return !RESERVADOS.has(seg) && !seg.includes(".");
}
