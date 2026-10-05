import { getClient, contarHoje, type TipoRelato } from "@/lib/db";
import { fichaDoEnderecoAntigo, getFicha } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { registrarConfirmacao } from "@/lib/confirmar";

export const dynamic = "force-dynamic";

function tiposValidos(t: unknown): t is TipoRelato {
  return t === "seco" || t === "barro";
}

/** A ficha NO AR deste endereço — o de agora, ou um antigo que leva a ela
 *  (Tarefa 11e, I2 da auditoria). A fila offline do "✓ Fui" guarda o slug com
 *  que o relato foi contado, e o dono pode ter trocado o endereço depois.
 *
 *  🔴 QUEM GRAVA E QUEM CONTA É O SLUG DA FICHA RESOLVIDA, nunca o do pedido:
 *  uma linha em A, depois de A virar B, ficaria órfã — e o lugar que RETOMAR A
 *  nasceria com o "N foram hoje" de quem foi ao outro. Escondido não resolve:
 *  é o mesmo 400 de um endereço que nunca existiu. */
async function fichaDoPedido(slug: string): Promise<Ficha | null> {
  return (await getFicha(slug)) ?? (await fichaDoEnderecoAntigo(slug));
}

export async function GET(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get("slug");
  const ficha = slug ? await fichaDoPedido(slug) : null;
  if (ficha == null) {
    return new Response("ficha inválida", { status: 400 });
  }
  const agora = Math.floor(Date.now() / 1000);
  return Response.json(await contarHoje(getClient(), ficha.slug, agora));
}

export async function POST(req: Request): Promise<Response> {
  let body: { slug?: unknown; tipo?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const { slug, tipo } = body;
  const ficha = typeof slug === "string" ? await fichaDoPedido(slug) : null;
  if (ficha == null) {
    return new Response("ficha inválida", { status: 400 });
  }
  if (!tiposValidos(tipo)) {
    return new Response("tipo inválido", { status: 400 });
  }
  const agora = Math.floor(Date.now() / 1000);
  return Response.json(await registrarConfirmacao(getClient(), ficha.slug, tipo, agora));
}
