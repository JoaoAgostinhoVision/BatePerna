import { getClient, contarHoje, enderecoDoLugar, identidadeDoLugar, type TipoRelato } from "@/lib/db";
import { fichaDoEnderecoAntigo, getFicha } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { registrarConfirmacao } from "@/lib/confirmar";
import { lugarDoCorpo } from "@/lib/fila-relato";

export const dynamic = "force-dynamic";

function tiposValidos(t: unknown): t is TipoRelato {
  return t === "seco" || t === "barro";
}

/** A ficha NO AR deste endereço — o de agora, ou um antigo que leva a ela
 *  (Tarefa 11e, I2 da auditoria). Desde a Tarefa 12b serve SÓ o ramo LEGADO
 *  (pedido sem `lugar`): o pedido com `lugar` é resolvido pela identidade, no
 *  próprio INSERT, e o endereço dele não decide nada. Escondido não resolve: é
 *  o mesmo 400 de um endereço que nunca existiu. */
async function fichaDoPedido(slug: string): Promise<Ficha | null> {
  return (await getFicha(slug)) ?? (await fichaDoEnderecoAntigo(slug));
}

/** `?lugar=` é TEXTO, e `"17"` não é `17` pro SQLite (M1 da auditoria da 12b):
 *  só dígitos, sem zero à esquerda, e dentro do inteiro seguro. */
function lugarDaBusca(cru: string): number | null {
  if (!/^[1-9]\d{0,15}$/.test(cru)) return null;
  const n = Number(cru);
  return Number.isSafeInteger(n) ? n : null;
}

/** O placar do dia.
 *
 *  🔴 COM `lugar` (Tarefa 12b): o placar do LUGAR, onde ele mora agora — e
 *  `200 null` se a identidade não é de lugar nenhum no ar. A página velha de P,
 *  aberta antes de Q retomar o endereço, nunca pinta o "N foram hoje" de Q.
 *  Nunca um 2xx que não seja placar ou `null`: o cliente pinta o que vier.
 *
 *  Sem `lugar`: o de antes (resolve o endereço). Não é relato, então o
 *  PENDENTE-JOÃO do legado não o alcança. */
export async function GET(req: Request): Promise<Response> {
  const busca = new URL(req.url).searchParams;
  const agora = Math.floor(Date.now() / 1000);
  const cru = busca.get("lugar");
  if (cru !== null) {
    const lugar = lugarDaBusca(cru);
    if (lugar === null) return new Response("lugar inválido", { status: 400 });
    const onde = await enderecoDoLugar(getClient(), lugar);
    return Response.json(onde === null ? null : await contarHoje(getClient(), onde, agora));
  }
  const slug = busca.get("slug");
  const ficha = slug ? await fichaDoPedido(slug) : null;
  if (ficha == null) {
    return new Response("ficha inválida", { status: 400 });
  }
  return Response.json(await contarHoje(getClient(), ficha.slug, agora));
}

/** O relato do "✓ Fui".
 *
 *  🔴 GRAVA PELA IDENTIDADE (`lugar`), onde o lugar mora no instante do INSERT
 *  (`gravarRelatoDoLugar`, Tarefa 12b). Identidade que não é de lugar nenhum
 *  no ar → **400** "lugar inválido", nunca um 2xx: o cliente novo tira da fila
 *  SÓ o 400 (a recusa definitiva), e o código velho em abas e no cache do
 *  service worker pinta como placar qualquer 2xx.
 *
 *  Sem `lugar` é o relato LEGADO — `lugarDoCorpo` decide pelo PENDENTE-JOÃO
 *  (`RELATO_LEGADO`): aceitar resolve o endereço AGORA e grava pela identidade
 *  de quem mora nele (o risco de antes desta tarefa); descartar é 400. */
export async function POST(req: Request): Promise<Response> {
  let body: { slug?: unknown; tipo?: unknown; lugar?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return new Response("bad request", { status: 400 });
  }
  const { slug, tipo } = body;
  const decisao = lugarDoCorpo(body);
  if (decisao === "recusa") {
    return new Response("lugar inválido", { status: 400 });
  }
  let lugar: number | null;
  if (decisao === "legado") {
    const ficha = typeof slug === "string" ? await fichaDoPedido(slug) : null;
    lugar = ficha == null ? null : await identidadeDoLugar(getClient(), ficha.slug);
    if (lugar === null) return new Response("ficha inválida", { status: 400 });
  } else {
    lugar = decisao.lugar;
  }
  if (!tiposValidos(tipo)) {
    return new Response("tipo inválido", { status: 400 });
  }
  const agora = Math.floor(Date.now() / 1000);
  const placar = await registrarConfirmacao(getClient(), lugar, tipo, agora);
  if (placar === null) return new Response("lugar inválido", { status: 400 });
  return Response.json(placar);
}
