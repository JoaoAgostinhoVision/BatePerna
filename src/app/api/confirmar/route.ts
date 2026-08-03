import { getClient } from "@/lib/db";
import { getFicha } from "@/lib/ficha";
import { registrarConfirmacao } from "@/lib/confirmar";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let slug: unknown;
  try {
    slug = (await req.json())?.slug;
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (typeof slug !== "string" || getFicha(slug) == null) {
    return new Response("ficha inválida", { status: 400 });
  }
  const agora = Math.floor(Date.now() / 1000);
  const result = await registrarConfirmacao(getClient(), slug, agora);
  return Response.json(result);
}
