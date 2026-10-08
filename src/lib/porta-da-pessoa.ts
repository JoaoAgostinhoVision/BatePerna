import { getClient } from "@/lib/db";
import { estaBloqueado, registrarContribuidor } from "@/lib/db-contribuidor";
import { lerContribuidor, type QuemContribui } from "@/lib/contribuidor-sessao";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

// PENDENTE: redação minha, o João ainda não leu
export const CLERK_FORA = "Não deu pra conferir quem você é agora. Nada foi gravado: tente de novo daqui a pouco.";
// PENDENTE: redação minha, o João ainda não leu
export const BLOQUEADA = "Esta conta não pode mais mandar nem mudar lugares no BatePerna.";
/** A variante DELA do `RASCUNHO_NAO_EXISTE_MAIS` do painel — aquele manda
 *  "voltar pela lista do painel", que ela não tem. */
// PENDENTE: redação minha, o João ainda não leu
export const RASCUNHO_DELA_SUMIU =
  "Nada foi gravado: este rascunho não está mais neste endereço. Ele foi publicado, apagado, ou mudou de nome ou de cidade: volte pela sua lista de lugares.";
/** 🔴 O 409 DE TODA COLISÃO DELA (I3 da pré-auditoria de 07/10) — o par, o
 *  gêmeo sem cidade, o endereço ocupado por lugar ou rascunho de outro, e o
 *  endereço antigo de outro lugar. UMA frase, e de propósito: as do painel
 *  falam do painel ("pela lista do painel", "responda a cidade dele") e
 *  NOMEIAM quem ocupa — um rascunho de outra pessoa, ou um lugar escondido do
 *  João. Esta não nomeia ninguém, e foi escrita POR SUBTRAÇÃO (onda de fix da
 *  Task 10): a anterior dizia "um lugar no ar ou um que alguém está mandando"
 *  e "ele já está (ou logo estará) no app" — falso pro lugar ESCONDIDO (não
 *  está no ar) e pro ENDEREÇO ANTIGO (o nome dela não está em uso: é o
 *  endereço que sairia dele que leva a outro lugar). Sobrou só o que vale nos
 *  quatro: o nome, ou o endereço que sairia dele, já é de outro lugar — sem
 *  dizer onde ele está nem se vai ao ar.
 *
 *  📝 DECISÃO DO JOÃO, pro pacote de copy: em dois casos ela fica SEM saída —
 *  o gêmeo sem cidade (só o João responde a cidade do lugar dele) e um lugar
 *  real diferente com o mesmo nome na mesma cidade. A frase não inventa
 *  saída; o que fazer nesses dois é dele. */
// PENDENTE: redação minha, o João ainda não leu
export const NOME_JA_EM_USO =
  "Nada foi gravado: este nome, ou o endereço que sairia dele, já é de outro lugar no BatePerna.";

/** A PORTA DE TODA ROTA DE QUEM CONTRIBUI, nesta ordem: o Clerk respondeu
 *  (senão 503 com frase), há sessão (senão 401 — e a tela recarrega e pede
 *  login, Review Focus 4), quem é fica registrado (nome e e-mail SÓ pro painel
 *  dele), e ela não está bloqueada (senão 403 com frase). O bloqueio também
 *  mora em cada gravação (`LIVRE`, em `db-contribuidor.ts`): esta checagem dá
 *  a frase, aquela fecha a corrida. */
export async function portaDaPessoa(agora: number): Promise<{ pessoa: QuemContribui } | { resposta: Response }> {
  let pessoa: QuemContribui | null;
  try {
    pessoa = await lerContribuidor();
  } catch {
    return { resposta: new Response(CLERK_FORA, { status: 503, headers: TEXTO }) };
  }
  if (pessoa === null) return { resposta: new Response("", { status: 401, headers: TEXTO }) };
  await registrarContribuidor(getClient(), pessoa, agora);
  if (await estaBloqueado(getClient(), pessoa.id)) {
    return { resposta: new Response(BLOQUEADA, { status: 403, headers: TEXTO }) };
  }
  return { pessoa };
}
