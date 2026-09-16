import { lerConfigAdmin } from "@/lib/admin-config";
import { lerSessao } from "@/lib/admin-sessao";

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
