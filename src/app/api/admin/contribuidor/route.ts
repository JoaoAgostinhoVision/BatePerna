import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient } from "@/lib/db";
import { bloquearContribuidor, desbloquearContribuidor } from "@/lib/db-contribuidor";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** BLOQUEAR / DESBLOQUEAR quem mandou (spec de 07/10, Parte 3). Falha fechada
 *  como toda rota do painel. */
export async function POST(req: Request): Promise<Response> {
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
  const c = corpo as { id?: unknown; bloquear?: unknown };
  if (
    typeof corpo !== "object" || corpo === null || Array.isArray(corpo) || Object.keys(corpo).length !== 2 ||
    typeof c.id !== "string" || c.id.trim() === "" || typeof c.bloquear !== "boolean"
  ) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  if (c.bloquear) {
    const escondidos = await bloquearContribuidor(getClient(), c.id, agora);
    return Response.json({ escondidos }, { headers: { "cache-control": "no-store" } });
  }
  await desbloquearContribuidor(getClient(), c.id);
  return Response.json({ escondidos: 0 }, { headers: { "cache-control": "no-store" } });
}
