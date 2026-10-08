import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient, gravarRegraPadrao } from "@/lib/db";
import { lerRegraDoCorpo } from "@/lib/porta-da-regra-padrao";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** A REGRA PADRÃO DA CHUVA, gravada pelo celular dele (spec de 07/10, Parte
 *  4). Mudar não pede código nem deploy: o próximo carimbo de todo lugar sem
 *  regra própria já lê a nova (`lerAcervoComOrigem`). Uma linha só, que
 *  sobrescreve — a regra padrão não afirma nada sobre um lugar. */
export async function PUT(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }
  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) return new Response("", { status: 401 });
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const lido = lerRegraDoCorpo(corpo);
  if (lido === null) return new Response("", { status: 400, headers: TEXTO });
  if ("frase" in lido) return new Response(lido.frase, { status: 400, headers: TEXTO });
  await gravarRegraPadrao(getClient(), lido.regra, agora);
  return Response.json(lido.regra, { headers: { "cache-control": "no-store" } });
}
