import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { enderecoNovoDe, getClient, rascunhoDeQualquerUm, trocarEndereco, versaoAtual, versaoPorId } from "@/lib/db";
import {
  ENDERECO_JA_E_ESSE,
  ENDERECO_NAO_TROCOU,
  LUGAR_MUDOU_DE_ENDERECO,
  SEM_CIDADE_PRA_ENDERECO,
  baseIdValido,
  enderecoOcupadoPorLugar,
  enderecoOcupadoPorRascunho,
  enderecoSugerido,
} from "@/lib/endereco";
import { cidadeDoDoc, nomeComCidade, nomeDoRascunho } from "@/lib/rascunho";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** TROCAR O ENDEREÇO DE UM LUGAR PUBLICADO (Tarefa 11e, decisões do João de
 *  04/10): o endereço é dado no banco, muda SÓ quando ele manda, e o antigo
 *  passa a levar ao novo. Corpo `{ slug, baseId }` e NADA MAIS (`baseId`, a
 *  versão que a tela abriu, desde a onda de fix 2 da 11e — M6).
 *
 *  A ordem das guardas é a das rotas irmãs do admin: config (404, painel
 *  desligado não anuncia que existe) → sessão (401 de corpo vazio) → corpo →
 *  domínio → grava.
 *
 *  🔴 O ENDEREÇO NOVO É CALCULADO AQUI, NUNCA VEM NO CORPO (I6 da auditoria): é
 *  `nome-cidade` do documento ATUAL, pela mesma regra de quando o lugar nasce.
 *  Um endereço com uma cidade que nenhum dado do lugar diz seria o app afirmando
 *  onde o lugar fica sem ninguém ter dito — por isso chave a mais é 400.
 *
 *  🔴 A CONFERÊNCIA DE "OCUPADO" ACONTECE DUAS VEZES, e só uma decide: a leitura
 *  daqui só ESCOLHE A FRASE (molde de `parOcupado`, um dono só); quem decide é o
 *  1º passo do batch de `trocarEndereco`, que confere e grava junto. Se os dois
 *  discordarem (outra gravação no meio), a resposta é a frase genérica e nada
 *  mudou.
 *
 *  As rotas de ESCRITA da ficha (`ficha`, `aviso`, `visibilidade`) NÃO resolvem
 *  o endereço velho (M5 da auditoria): uma aba aberta antes da troca leva uma
 *  recusa, e recarregar a leva ao endereço novo. Fecha pro lado seguro. */
export async function POST(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }

  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) {
    return new Response("", { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const { slug, baseId } = corpo as { slug?: unknown; baseId?: unknown };
  if (Object.keys(corpo).length !== 2 || typeof slug !== "string" || !baseIdValido(baseId)) {
    return new Response("", { status: 400, headers: TEXTO });
  }

  const atual = await versaoAtual(getClient(), slug);
  if (atual === null) return new Response("", { status: 400, headers: TEXTO });
  // 🔴 A VERSÃO QUE A TELA ABRIU TEM DE MORAR AQUI (onda de fix 2 da 11e, M6): se
  // outro lugar retomou este endereço depois que a aba abriu, o "lugar de agora"
  // aqui é ELE, e a conta abaixo daria o endereço novo DELE — a aba velha
  // mudaria o endereço de outro lugar. Esta leitura só escolhe a FRASE; quem
  // decide é o 1º passo de `trocarEndereco`, que confere o mesmo no batch.
  if ((await versaoPorId(getClient(), baseId))?.ficha_slug !== slug) {
    return new Response(LUGAR_MUDOU_DE_ENDERECO, { status: 409, headers: TEXTO });
  }

  const novo = enderecoSugerido(nomeDoRascunho(atual.doc, ""), cidadeDoDoc(atual.doc));
  if (novo === null) return new Response(SEM_CIDADE_PRA_ENDERECO, { status: 400, headers: TEXTO });
  if (novo === slug) return new Response(ENDERECO_JA_E_ESSE, { status: 400, headers: TEXTO });

  const dono = await versaoAtual(getClient(), novo);
  if (dono !== null) {
    const quem = nomeComCidade(nomeDoRascunho(dono.doc, novo), cidadeDoDoc(dono.doc));
    return new Response(enderecoOcupadoPorLugar(novo, quem), { status: 409, headers: TEXTO });
  }
  // `rascunhoDeQualquerUm`, NUNCA `lerRascunho` (só do João desde 07/10, M11
  // da pré-auditoria): o rascunho de quem usa também ocupa o endereço novo.
  const rascunho = await rascunhoDeQualquerUm(getClient(), novo);
  if (rascunho !== null) {
    const quem = nomeComCidade(nomeDoRascunho(rascunho.doc, novo), cidadeDoDoc(rascunho.doc));
    return new Response(enderecoOcupadoPorRascunho(novo, quem), { status: 409, headers: TEXTO });
  }

  if (!(await trocarEndereco(getClient(), slug, novo, agora, baseId))) {
    // 🔴 DUAS ABAS (M1 da revisão da onda de fix): se a recusa é porque OUTRA
    // requisição acabou de levar este lugar pro MESMO endereço, "nada mudou"
    // seria falso. O endereço que vale é o novo, e a resposta diz isso — sem
    // gravar nada (o batch não gravou: a porta dele exige o lugar no velho).
    if ((await enderecoNovoDe(getClient(), slug)) === novo) {
      return Response.json({ slug: novo }, { headers: { "cache-control": "no-store" } });
    }
    return new Response(ENDERECO_NAO_TROCOU, { status: 409, headers: TEXTO });
  }
  return Response.json({ slug: novo }, { headers: { "cache-control": "no-store" } });
}
