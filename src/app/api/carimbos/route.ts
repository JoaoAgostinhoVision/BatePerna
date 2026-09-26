import { getFichasComCondicao } from "@/lib/ficha";
import { resolverEstados } from "@/lib/carimbo-estado";

export const dynamic = "force-dynamic";

/** As leituras de agora de todas as trilhas da home, de uma vez.
 *
 *  Existe pelo mesmo motivo que /api/carimbo existe pra ficha: o carimbo
 *  apodrece e o resto não. A diferença é o número — a home tem N carimbos e
 *  buscá-los um a um seria N requisições saindo do celular no portão.
 *
 *  Objeto, não lista: a chave é o slug, então não existe ordem pra desalinhar. */
export async function GET(): Promise<Response> {
  const leituras = await resolverEstados(await getFichasComCondicao());
  // no-store explícito: o service worker já trata /api/* como NetworkOnly, mas
  // não é o único cache no caminho (navegador, CDN). Leitura de chuva guardada
  // é leitura mentirosa.
  return Response.json(Object.fromEntries(leituras), {
    headers: { "cache-control": "no-store" },
  });
}
