import { getFicha } from "@/lib/ficha";
import { resolverEstado } from "@/lib/carimbo-estado";

export const dynamic = "force-dynamic";

/** A leitura de agora, sozinha, pra quem já tem a ficha na tela.
 *
 *  Existe porque o carimbo apodrece e o resto da ficha não: quando você volta
 *  pro app no portão, é isto que busca a resposta de agora em vez de o app dar
 *  de ombros.
 *
 *  ✅ E DESDE 2026-09-15 ELA TOCA O BANCO, igual à página — as duas chamam o
 *  mesmo `resolverEstado`, que lê o aviso do dono antes de responder. A linha
 *  daqui dizia "só-clima, não toca o banco", e a frase envelheceu no mesmo
 *  commit em que o aviso entrou na leitura. Continua valendo o que importa: a
 *  rota e a página são a MESMA função, e por isso não podem divergir. */
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
