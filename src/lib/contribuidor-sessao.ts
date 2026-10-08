import { auth, currentUser } from "@clerk/nextjs/server";

/** 🔴 A ÚNICA PORTA DO APP PRO CLERK (spec de 07/10, "Login"). O Clerk cuida SÓ
 *  de quem contribui; o painel do João continua com a senha dele, e as telas
 *  públicas não têm login. Nenhum outro arquivo de `src/` importa `@clerk/*` —
 *  `tests/lib/clerk-so-numa-porta.test.ts` trava isso —, e os testes dublam
 *  ESTE módulo: nenhuma chave real roda na suíte. */

export type QuemContribui = { id: string; nome: string | null; email: string | null };

/** O Clerk não respondeu, ou não está configurado (sem chave, sem o
 *  middleware). A rota responde 503 com frase; nada do app público depende
 *  disto. */
export class ClerkFora extends Error {}

/** Quem está logado AGORA, ou `null`. O perfil (nome, e-mail) é só pro painel
 *  do João: se não vier, a pessoa contribui do mesmo jeito, e nada é
 *  inventado no lugar. */
export async function lerContribuidor(): Promise<QuemContribui | null> {
  let userId: string | null;
  try {
    ({ userId } = await auth());
  } catch (erro) {
    throw new ClerkFora(String(erro));
  }
  if (!userId) return null;
  let perfil: Awaited<ReturnType<typeof currentUser>> = null;
  try {
    perfil = await currentUser();
  } catch {
    perfil = null;
  }
  const nome = [perfil?.firstName, perfil?.lastName].filter((p) => typeof p === "string" && p.trim() !== "").join(" ");
  return { id: userId, nome: nome === "" ? null : nome, email: perfil?.primaryEmailAddress?.emailAddress ?? null };
}

/** Manda pra tela de entrar do Clerk; depois de entrar, ela volta pro mesmo
 *  endereço — o `?p=N` da pergunta inclusive (Review Focus 4). */
export async function irPraEntrar(): Promise<never> {
  const { redirectToSignIn } = await auth();
  return redirectToSignIn();
}
