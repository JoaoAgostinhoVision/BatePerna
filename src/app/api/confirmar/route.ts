import { getClient, contarHoje, type TipoRelato } from "@/lib/db";
import { getFicha } from "@/lib/ficha";
import { registrarConfirmacao } from "@/lib/confirmar";

export const dynamic = "force-dynamic";

function tiposValidos(t: unknown): t is TipoRelato {
  return t === "seco" || t === "barro";
}

export async function GET(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug || getFicha(slug) == null) {
    return new Response("ficha inválida", { status: 400 });
  }
  const agora = Math.floor(Date.now() / 1000);
  return Response.json(await contarHoje(getClient(), slug, agora));
}

export async function POST(req: Request): Promise<Response> {
  let body: { slug?: unknown; tipo?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const { slug, tipo } = body;
  if (typeof slug !== "string" || getFicha(slug) == null) {
    return new Response("ficha inválida", { status: 400 });
  }
  if (!tiposValidos(tipo)) {
    return new Response("tipo inválido", { status: 400 });
  }
  const agora = Math.floor(Date.now() / 1000);
  return Response.json(await registrarConfirmacao(getClient(), slug, tipo, agora));
}
