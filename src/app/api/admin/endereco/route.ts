import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient, lerRascunho, trocarEndereco, versaoAtual } from "@/lib/db";
import {
  ENDERECO_JA_E_ESSE,
  ENDERECO_NAO_TROCOU,
  SEM_CIDADE_PRA_ENDERECO,
  enderecoOcupadoPorLugar,
  enderecoOcupadoPorRascunho,
  enderecoSugerido,
} from "@/lib/endereco";
import { cidadeDoDoc, nomeComCidade, nomeDoRascunho } from "@/lib/rascunho";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** TROCAR O ENDEREÇO DE UM LUGAR PUBLICADO (Tarefa 11e, decisões do João de
 *  04/10): o endereço é dado no banco, muda SÓ quando ele manda, e o antigo
 *  passa a levar ao novo. Corpo `{ slug }` e NADA MAIS.
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
  const { slug } = corpo as { slug?: unknown };
  if (Object.keys(corpo).length !== 1 || typeof slug !== "string") {
    return new Response("", { status: 400, headers: TEXTO });
  }

  const atual = await versaoAtual(getClient(), slug);
  if (atual === null) return new Response("", { status: 400, headers: TEXTO });

  const novo = enderecoSugerido(nomeDoRascunho(atual.doc, ""), cidadeDoDoc(atual.doc));
  if (novo === null) return new Response(SEM_CIDADE_PRA_ENDERECO, { status: 400, headers: TEXTO });
  if (novo === slug) return new Response(ENDERECO_JA_E_ESSE, { status: 400, headers: TEXTO });

  const dono = await versaoAtual(getClient(), novo);
  if (dono !== null) {
    const quem = nomeComCidade(nomeDoRascunho(dono.doc, novo), cidadeDoDoc(dono.doc));
    return new Response(enderecoOcupadoPorLugar(novo, quem), { status: 409, headers: TEXTO });
  }
  const rascunho = await lerRascunho(getClient(), novo);
  if (rascunho !== null) {
    const quem = nomeComCidade(nomeDoRascunho(rascunho.doc, novo), cidadeDoDoc(rascunho.doc));
    return new Response(enderecoOcupadoPorRascunho(novo, quem), { status: 409, headers: TEXTO });
  }

  if (!(await trocarEndereco(getClient(), slug, novo, agora))) {
    return new Response(ENDERECO_NAO_TROCOU, { status: 409, headers: TEXTO });
  }
  return Response.json({ slug: novo }, { headers: { "cache-control": "no-store" } });
}
