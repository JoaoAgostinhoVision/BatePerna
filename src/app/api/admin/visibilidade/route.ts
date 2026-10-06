import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient, gravarEdicao, versaoAtual, versaoPorId } from "@/lib/db";
import { LUGAR_MUDOU_DE_ENDERECO, baseIdValido } from "@/lib/endereco";

export const dynamic = "force-dynamic";

/** Esconder um lugar do público, e devolvê-lo ao ar — as duas pela MESMA porta,
 *  e as duas como VERSÃO NOVA em `ficha_versoes`. Nunca um `UPDATE`, nunca um
 *  `DELETE`: a tabela é append-only e é a única procedência que este projeto
 *  tem desde que a ficha saiu do git (2026-09-24). "Escondido" é um estado da
 *  versão de maior `id`, não uma linha que desapareceu.
 *
 *  O corpo é `{ slug, oculto: boolean, baseId }` (`baseId` desde a onda de fix 2
 *  da 11e: a versão que a tela abriu). A ordem das guardas é a das rotas
 *  irmãs do admin: config → sessão → corpo → domínio → grava.
 *
 *  🔴 A EXISTÊNCIA DO LUGAR É CONFERIDA COM `versaoAtual`, NUNCA COM `getFicha`.
 *  A rota irmã de aviso usava `getFicha(slug)` pra isso (até a onda de conserto 1
 *  da Task 9, que a passou pra `versaoAtual` pelo mesmo motivo), e aqui seria uma
 *  PORTA DE MÃO ÚNICA: `getFicha` sai de `versoesAtuais`, que desde a Tarefa 4
 *  esconde os ocultos por padrão — então o lugar escondido "não existiria" pra
 *  esta rota, e `{ oculto: false }` levaria 400. O dono esconderia um lugar e
 *  **nunca mais o devolveria ao ar sem um desenvolvedor**, que é exatamente o
 *  que a lei dele proíbe (e a mesma forma do defeito que a ruling C1 da Tarefa 1
 *  desta rodada já pagou uma vez, no "não sei" do horário).
 *
 *  🔴 O DOCUMENTO VAI VERBATIM, SEM `fichaSchema.parse`. Dois motivos, os dois
 *  medidos como escolha:
 *
 *   1. Renormalizar REESCREVERIA O PASSADO — o zod descarta chave desconhecida
 *      em silêncio (ver `src/types/ficha.ts`), então esconder um lugar apagaria
 *      pra sempre campos antigos que a ficha ainda carregasse. É o mesmo
 *      conserto que o "voltar" da rota de ficha já teve.
 *   2. Exigir que o documento ABRA trancaria o dono justamente no caso em que
 *      ele mais precisa desta porta: uma ficha que ficou ilegível (ou que o
 *      schema de hoje reprova) é uma ficha que ele quer **tirar do ar agora**.
 *      Uma porta que recusa esconder um lugar quebrado não serve pra nada.
 *
 *  🔴 E ESTA ROTA **NÃO** PASSA PELO PORTÃO DE COERÊNCIA DA TAREFA 3 — está
 *  escrito pra ninguém acrescentar por zelo. Esconder só REMOVE uma ficha do
 *  acervo público, e o portão de lá mede com `incluirOcultos: true` justamente
 *  porque lugar escondido volta: o acervo que a coerência vê não muda de tamanho
 *  quando alguém esconde. Rodar as regras de coerência aqui seria custo sem efeito
 *  nenhum — e, pior, poderia recusar um esconder por causa de uma incoerência
 *  preexistente, travando o dono de tirar do ar um lugar que ele quer fora. */
export async function POST(req: Request): Promise<Response> {
  // 🔴 404, não 401: painel desligado não anuncia que existe. Mesma regra das
  // rotas irmãs, e vem ANTES da sessão pela mesma razão — sem ADMIN_SENHA não
  // existe segredo pra validar sessão nenhuma.
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }

  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) {
    return new Response("", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("", { status: 400 });
  }
  // `null` é JSON válido e não estoura o `catch` acima, mas destructurar `null`
  // estoura na hora. Mesma guarda das rotas irmãs.
  if (typeof body !== "object" || body === null) return new Response("", { status: 400 });

  const { slug, oculto, baseId } = body as { slug?: unknown; oculto?: unknown; baseId?: unknown };
  if (typeof slug !== "string") return new Response("", { status: 400 });
  // 🔴 A versão que a tela abriu — a identidade do lugar (onda de fix 2 da 11e,
  // M6). Ver `gravarEdicao`.
  if (!baseIdValido(baseId)) return new Response("", { status: 400 });
  // 🔴 `boolean` E NADA MAIS — nem `1`, nem `"true"`, nem ausente. Esta é a
  // bandeira que decide se um lugar real está no ar; um corpo malformado não
  // pode virar "esconde" nem "mostra" por coerção. Falha fechada, como o
  // `naoSei !== true` da rota de ficha.
  if (typeof oculto !== "boolean") return new Response("", { status: 400 });

  const versao = await versaoAtual(getClient(), slug);
  if (versao == null) return new Response("", { status: 400 });

  // 🔴 PEDIR O ESTADO QUE JÁ VALE NÃO GRAVA NADA, e devolve 200. Toda linha de
  // `ficha_versoes` é uma coisa que alguém DISSE sobre um lugar, e o histórico é
  // a tela que o dono lê: um "esconder" sobre um lugar já escondido não disse
  // nada de novo, e gravá-lo enche a tela dele de linhas sem conteúdo. O 200 é
  // honesto — o estado pedido é o estado que vale — e o `id` devolvido é o da
  // versão que JÁ o carrega, não o de uma linha nova que não existe.
  //
  // 🔴 MAS SÓ SE É O MESMO LUGAR (onda de fix 2, M6): a aba velha de P em A,
  // depois que Q retomou A, pedindo "esconder" com Q já escondido leria 200 — "o
  // estado pedido é o que vale" — de um lugar que não é o da tela dela. Aqui não
  // há gravação pra carregar a condição, então ela é uma leitura; o que ela
  // decide é só a resposta, nunca o banco.
  if (versao.oculto === oculto) {
    if ((await versaoPorId(getClient(), baseId))?.ficha_slug !== slug) {
      return new Response(LUGAR_MUDOU_DE_ENDERECO, {
        status: 409,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return Response.json({ id: versao.id }, { headers: { "cache-control": "no-store" } });
  }

  // 🔴 CONDICIONAL (`gravarEdicao`, onda de fix da 11e, I1 da revisão): se a troca
  // de endereço levou o lugar embora depois da leitura acima, o INSERT de sempre
  // recriaria o lugar no endereço velho — e o dono leria 200 de um "esconder"
  // com o lugar ainda no ar no endereço novo. `null` = nada gravado: 409.
  const id = await gravarEdicao(getClient(), slug, versao.doc, agora, oculto, baseId);
  if (id === null) {
    return new Response(LUGAR_MUDOU_DE_ENDERECO, {
      status: 409,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return Response.json({ id }, { headers: { "cache-control": "no-store" } });
}
