import { gravarFuiDaPessoa, type IdaDaPessoa } from "@/lib/db-contribuidor";
import { getClient } from "@/lib/db";
import { portaDaPessoa } from "@/lib/porta-da-pessoa";
import { MAX_FUIS } from "@/lib/fui-no-aparelho";

export const dynamic = "force-dynamic";

const TEXTO = { "Content-Type": "text/plain; charset=utf-8" };

/** Uma ida do corpo, ou `null` se torta. A hora chega em ms (a do aparelho). */
function idaDoCorpo(x: unknown): IdaDaPessoa | null {
  if (typeof x !== "object" || x === null) return null;
  const { slug, lugar, em } = x as Record<string, unknown>;
  if (typeof slug !== "string" || typeof em !== "number" || !Number.isFinite(em)) return null;
  if (lugar !== undefined && !(typeof lugar === "number" && Number.isSafeInteger(lugar) && lugar > 0)) return null;
  return lugar === undefined ? { slug, em: Math.floor(em / 1000) } : { slug, lugar, em: Math.floor(em / 1000) };
}

/** POST /api/contribuir/fui (25/10): a área dela, logada, leva pra CONTA as
 *  idas que o aparelho anotou no "✓ Fui" da ficha pública
 *  (`src/lib/fui-no-aparelho.ts`). A porta é a dela (503/401/403). Corpo
 *  `{ itens: [{ slug, lugar?, em }] }`, no máximo o teto do aparelho; ida torta
 *  ou de lugar que não está no ar é ignorada sem derrubar as outras — e o
 *  aparelho as esquece do mesmo jeito, porque não há o que tentar de novo. */
export async function POST(req: Request): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const porta = await portaDaPessoa(agora, "gravar");
  if ("resposta" in porta) return porta.resposta;
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const itens = (corpo as { itens?: unknown } | null)?.itens;
  if (!Array.isArray(itens) || itens.length > MAX_FUIS) return new Response("", { status: 400, headers: TEXTO });
  const idas = itens.map(idaDoCorpo).filter((i): i is IdaDaPessoa => i !== null);
  const gravados = await gravarFuiDaPessoa(getClient(), porta.pessoa.id, idas, agora);
  return Response.json({ gravados });
}
