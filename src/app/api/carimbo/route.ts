import { getFicha } from "@/lib/ficha";
import { resolverEstado } from "@/lib/carimbo-estado";

export const dynamic = "force-dynamic";

/** A leitura de agora, sozinha, pra quem já tem a ficha na tela.
 *
 *  Existe porque o carimbo apodrece e o resto da ficha não: quando você volta
 *  pro app no portão, é isto que busca a resposta de agora em vez de o app dar
 *  de ombros. Só-clima — não toca o banco, igual à página. */
export async function GET(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get("slug");
  const ficha = slug ? getFicha(slug) : null;
  if (!ficha) return Response.json({ erro: "ficha não encontrada" }, { status: 404 });

  // no-store explícito: o service worker já trata /api/* como NetworkOnly, mas
  // ele não é o único cache no caminho (navegador, CDN). Leitura de chuva
  // guardada é leitura mentirosa.
  return Response.json(await resolverEstado(ficha), {
    headers: { "cache-control": "no-store" },
  });
}
