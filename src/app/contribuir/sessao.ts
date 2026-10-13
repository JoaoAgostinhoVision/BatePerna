import { getClient } from "@/lib/db";
import { estaBloqueado } from "@/lib/db-contribuidor";
import { irPraEntrar, lerContribuidor, type QuemContribui } from "@/lib/contribuidor-sessao";
import { BLOQUEADA, CLERK_FORA } from "@/lib/porta-da-pessoa";

/** A PORTA DAS PÁGINAS DELA — irmã de `portaDaPessoa` (rotas): Clerk fora →
 *  a frase; sem sessão → a tela de entrar do Clerk (que volta pro mesmo
 *  endereço); bloqueada → a frase. A página que recebe `frase` mostra só ela. */
export async function quemNaTela(): Promise<{ pessoa: QuemContribui } | { frase: string }> {
  let pessoa: QuemContribui | null;
  try {
    pessoa = await lerContribuidor();
  } catch {
    return { frase: CLERK_FORA };
  }
  if (pessoa === null) return irPraEntrar();
  if (await estaBloqueado(getClient(), pessoa.id)) return { frase: BLOQUEADA };
  return { pessoa };
}
