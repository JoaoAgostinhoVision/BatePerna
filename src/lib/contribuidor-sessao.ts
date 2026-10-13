import { auth, currentUser } from "@clerk/nextjs/server";

/** 🔴 A ÚNICA PORTA DO APP PRA SABER QUEM ESTÁ LOGADO (spec de 07/10, "Login"). O Clerk cuida SÓ
 *  de quem contribui; o painel do João continua com a senha dele, e as telas
 *  públicas não têm login. Além daqui, só dois arquivos de `src/` importam
 *  `@clerk/*`: o `src/middleware.ts` (que deixa a sessão legível) e o layout
 *  de `/contribuir` (o `<ClerkProvider>` que renova a sessão no navegador
 *  dela — ruling da Task 14). Nenhum outro: `tests/lib/clerk-so-numa-porta.test.ts`
 *  trava isso. Os testes dublam ESTE módulo: nenhuma chave real roda na suíte. */

export type QuemContribui = { id: string; nome: string | null; email: string | null };

/** O Clerk não respondeu, ou não está configurado. Sem as duas chaves, o
 *  `src/middleware.ts` deixa o pedido passar sem chamar o Clerk (de propósito:
 *  o `clerkMiddleware` estouraria 500 antes da rota), e é o `auth()` daqui que
 *  estoura — vira isto, e a rota responde 503 com frase. Nada do app público
 *  depende disto. (O Clerk fora do ar COM chave falha dentro do
 *  `clerkMiddleware`, antes da rota: esse caso não é coberto por teste.) */
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
