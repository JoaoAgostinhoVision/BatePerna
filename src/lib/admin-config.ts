/** O comprimento mínimo da senha do painel.
 *
 *  🔴 Não é conselho, é GUARDA: abaixo disto o painel não liga. Esta senha é a
 *  chave do app inteiro — quem a tem edita o que o app afirma sobre lugares
 *  reais. 24 caracteres aleatórios põem força bruta fora do mundo físico, e
 *  recusar o que é menor torna a senha fraca impossível em vez de pedir
 *  cuidado. Mesma família do prazo obrigatório do aviso. */
export const MIN_SENHA = 24;

export type EstadoAdmin =
  | { ligado: true; senha: string; segredo: string }
  | { ligado: false; motivo: "ausente" | "senha-curta" | "sem-segredo" };

/** O admin está ligado?
 *
 *  🔴 FALHA FECHADA, e é a linha que mais importa aqui: sem `ADMIN_SENHA` o
 *  painel NÃO EXISTE — quem chama devolve 404, não 401. "Ausente" é o estado
 *  normal de qualquer ambiente que ele não configurou (preview, clone, o
 *  próprio deploy antes de ele criar a variável), e o app roda inteiro assim.
 *
 *  O env vem por parâmetro, e não de `process.env` aqui dentro, pra esta
 *  decisão ter teste — mesma disciplina de `resolverNavegacao` e `aquecer`. */
export function lerConfigAdmin(env: Record<string, string | undefined>): EstadoAdmin {
  const senha = env.ADMIN_SENHA?.trim() ?? "";
  const segredo = env.ADMIN_SEGREDO?.trim() ?? "";
  if (senha === "") return { ligado: false, motivo: "ausente" };
  if (senha.length < MIN_SENHA) return { ligado: false, motivo: "senha-curta" };
  if (segredo === "") return { ligado: false, motivo: "sem-segredo" };
  return { ligado: true, senha, segredo };
}
