/** O "✓ FUI" ANOTADO NO APARELHO (25/10, desenho aprovado pelo João: "a
 *  personalização do usuário, que aparece os locais que ele já foi").
 *
 *  A ficha é pública e não carrega o login (só `/contribuir` tem o Clerk), e a
 *  sessão dele vive ~60 s sem o clerk-js no navegador: um "Fui" mandado da
 *  ficha quase nunca saberia QUEM tocou. Por isso o aparelho anota onde e
 *  quando ela tocou "Fui", e a área dela, logada, leva a lista pra conta
 *  (`/api/contribuir/fui`) e a esquece daqui. O placar anônimo do "Fui" segue
 *  como sempre — isto é só a memória dela.
 *
 *  🔴 O APARELHO PODE NEGAR (aba anônima, armazenamento cheio): tudo em
 *  `try/catch`, e o que falha só deixa de anotar. */

/** Uma ida: o endereço da ficha, a identidade do lugar quando a página a tinha
 *  (é ela que sobrevive à troca de endereço), e a hora do toque, em ms. */
export type FuiNoAparelho = { slug: string; lugar?: number; em: number };

export const CHAVE_FUI = "bp:fui-no-aparelho:v1";
/** Teto da lista: as mais novas ficam. Bem acima de um ano de passeios. */
export const MAX_FUIS = 200;

const DIA_MS = 24 * 60 * 60 * 1000;
const mesmoLugar = (a: FuiNoAparelho, b: FuiNoAparelho): boolean =>
  a.lugar !== undefined || b.lugar !== undefined ? a.lugar === b.lugar : a.slug === b.slug;
const ehFui = (x: unknown): x is FuiNoAparelho => {
  if (typeof x !== "object" || x === null) return false;
  const { slug, lugar, em } = x as Record<string, unknown>;
  return typeof slug === "string" && typeof em === "number" && Number.isFinite(em) && (lugar === undefined || (typeof lugar === "number" && Number.isSafeInteger(lugar) && lugar > 0));
};

export function lerFuis(): FuiNoAparelho[] {
  try {
    const cru: unknown = JSON.parse(localStorage.getItem(CHAVE_FUI) ?? "[]");
    return Array.isArray(cru) ? cru.filter(ehFui) : [];
  } catch {
    return [];
  }
}

function gravar(lista: FuiNoAparelho[]): void {
  try {
    localStorage.setItem(CHAVE_FUI, JSON.stringify(lista.slice(-MAX_FUIS)));
  } catch {
    // O aparelho negou: nada anotado.
  }
}

/** Anota uma ida. O mesmo lugar no mesmo dia vira UMA anotação (dois toques no
 *  "Fui" do mesmo passeio não são duas idas), com a hora mais nova. */
export function anotarFui(f: FuiNoAparelho): void {
  const lista = lerFuis().filter((x) => !(mesmoLugar(x, f) && Math.abs(x.em - f.em) < DIA_MS));
  lista.push(f.lugar === undefined ? { slug: f.slug, em: f.em } : { slug: f.slug, lugar: f.lugar, em: f.em });
  gravar(lista);
}

/** Tira do aparelho as anotações que já subiram pra conta. */
export function esquecerFuis(subiram: readonly FuiNoAparelho[]): void {
  const fica = lerFuis().filter((x) => !subiram.some((s) => s.slug === x.slug && s.lugar === x.lugar && s.em === x.em));
  gravar(fica);
}
