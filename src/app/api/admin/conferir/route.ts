import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient } from "@/lib/db";
import { conferirLugar } from "@/lib/db-contribuidor";
import { baseIdValido } from "@/lib/endereco";
import { NAO_CONFERIU } from "@/app/admin/campos/palavras";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** "CONFERI" (spec de 07/10, Parte 3): o lugar mandado por quem usa perde a
 *  marca, e ela perde a edição. Falha fechada como toda rota do painel. A
 *  condição inteira mora em `conferirLugar`, num UPDATE só. */
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
  if (
    typeof corpo !== "object" || corpo === null || Array.isArray(corpo) ||
    Object.keys(corpo).length !== 2 ||
    typeof (corpo as { slug?: unknown }).slug !== "string" ||
    !baseIdValido((corpo as { baseId?: unknown }).baseId)
  ) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const { slug, baseId } = corpo as { slug: string; baseId: number };
  if (await conferirLugar(getClient(), slug, baseId, agora)) {
    return Response.json({ slug }, { headers: { "cache-control": "no-store" } });
  }
  return new Response(NAO_CONFERIU, { status: 409, headers: TEXTO });
}
