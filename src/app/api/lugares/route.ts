import { PRAZO_BUSCA_MS, lerLugares, urlBusca } from "@/lib/lugares";

export const dynamic = "force-dynamic";

/** A busca de cidade passa por aqui, e não direto do celular pro serviço:
 *  mesma disciplina de toda chamada externa deste app, e é o que deixa testar
 *  a tela sem internet. */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const cabecalho = { "cache-control": "no-store" };
  // Campo vazio não é busca: nem chama o serviço.
  if (q === "") return Response.json([], { headers: cabecalho });

  try {
    const res = await fetch(urlBusca(q), {
      cache: "no-store",
      signal: AbortSignal.timeout(PRAZO_BUSCA_MS),
    });
    if (!res.ok) throw new Error(String(res.status));
    return Response.json(lerLugares(await res.json()), { headers: cabecalho });
  } catch {
    // Lista vazia aqui seria mentira: "não achei nada" e "não consegui
    // buscar" são coisas diferentes, e a tela diz coisas diferentes pra cada.
    return new Response("", { status: 503, headers: cabecalho });
  }
}
