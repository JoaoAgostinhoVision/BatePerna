import { lerConfigAdmin, type EstadoAdmin } from "@/lib/admin-config";
import { lerSessao } from "@/lib/admin-sessao";

/** O painel está desligado por ENGANO de configuração — avisa no log do
 *  servidor, e só lá.
 *
 *  🔴 FALHA FECHADA VENCE "motivo explícito na tela" (revisão final,
 *  2026-09-16): a spec pedia os dois e eles se contradizem — a tela pública
 *  NUNCA explica por que o admin está desligado, porque explicar já anuncia
 *  que ele existe. O 404 fica; o motivo vai pro log da Vercel, que é onde o
 *  dono descobre que a senha ficou curta ou o segredo não foi criado.
 *
 *  `ausente` NÃO avisa, de propósito: é o estado NORMAL de todo ambiente que
 *  ele não configurou (preview, clone, o deploy antes da variável), e um log
 *  a cada request ali seria ruído até virar invisível. Só `senha-curta` e
 *  `sem-segredo` são engano — alguém tentou ligar e não conseguiu.
 *
 *  Uma função pros QUATRO call sites (a página e as três rotas): três linhas
 *  copiadas quatro vezes é como uma delas esquece o `ausente`. */
export function avisarDesligado(cfg: EstadoAdmin): void {
  if (cfg.ligado || cfg.motivo === "ausente") return;
  console.warn(`[admin] desligado: ${cfg.motivo}`);
}

/** O nome do cookie da sessão do painel. Mora aqui porque três lugares
 *  precisam dele — as duas rotas e a página — e três cópias de uma string é
 *  como uma delas fica para trás. */
export const COOKIE_ADMIN = "bp_admin";

/** O header `Set-Cookie` completo.
 *
 *  `HttpOnly`: o JS da página não lê a sessão. `Secure`: só por HTTPS.
 *  `SameSite=Strict`: mata CSRF nas rotas que MUDAM coisa — e todas as rotas
 *  do painel mudam. */
export function cookieDeSessao(token: string, maxAgeS: number): string {
  return `${COOKIE_ADMIN}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeS}`;
}

/** O token de sessão que veio no cookie desta requisição, ou `undefined` se
 *  não veio nenhum.
 *
 *  🔴 FIX ROUND 1 (2026-09-26): morava duplicada, byte a byte, em
 *  `api/admin/aviso/route.ts` e `api/admin/ficha/route.ts` — as duas rotas
 *  copiaram "o molde exato" da rota irmã (como o brief da Task 6 mandou) e
 *  arrastaram o helper junto. Copiar o molde não obrigava a duplicar a
 *  lógica; ela mora aqui, junto de `COOKIE_ADMIN` e `sessaoValida`, que já
 *  são os outros dois pedaços que as mesmas rotas compartilham. */
export function tokenDoCookie(req: Request): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_ADMIN}=`))
    ?.slice(COOKIE_ADMIN.length + 1);
}

/** Esta requisição tem sessão boa? Falso também quando o admin está desligado —
 *  painel desligado não tem sessão válida nenhuma. */
export function sessaoValida(
  env: Record<string, string | undefined>,
  token: string | undefined,
  agora: number,
): boolean {
  const cfg = lerConfigAdmin(env);
  if (!cfg.ligado || !token) return false;
  return lerSessao(cfg.segredo, token, agora).valida;
}
