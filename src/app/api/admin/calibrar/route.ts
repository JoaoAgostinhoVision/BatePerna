import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { JA_TEM_REGRA, JaTemRegra, calibrarDoc } from "@/lib/calibrar";
import { getClient, gravarEdicao, versaoAtual, versoesAtuais } from "@/lib/db";
import { LUGAR_MUDOU_DE_ENDERECO, baseIdValido } from "@/lib/endereco";
import { violacaoIntroduzida } from "@/lib/porta-de-coerencia";
import { formaDaRegra } from "@/lib/porta-da-regra-padrao";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** CALIBRAR A CHUVA DE UM LUGAR que ainda usa a regra padrão (Task 8). Uma
 *  versão nova, pelo painel, com a regra inteira — pela MESMA coerência e pela
 *  MESMA gravação condicional (`gravarEdicao`: identidade pela versão da tela,
 *  `oculto` lido no próprio INSERT) que toda edição de campo usa. */
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
  const c = corpo as { slug?: unknown; baseId?: unknown; regra?: unknown };
  const regra = typeof corpo === "object" && corpo !== null && !Array.isArray(corpo) && Object.keys(corpo).length === 3
    ? formaDaRegra(c.regra) : null;
  if (regra === null || typeof c.slug !== "string" || !baseIdValido(c.baseId)) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const slug = c.slug;
  const atual = await versaoAtual(getClient(), slug);
  if (atual === null) return new Response("", { status: 400, headers: TEXTO });

  let novo: string;
  try {
    novo = calibrarDoc(atual.doc, regra);
  } catch (erro) {
    if (erro instanceof JaTemRegra) return new Response(JA_TEM_REGRA, { status: 409, headers: TEXTO });
    return new Response("", { status: 400, headers: TEXTO });
  }
  const aDizer = violacaoIntroduzida(await versoesAtuais(getClient(), { incluirOcultos: true }), slug, atual.doc, novo);
  if (aDizer !== null) return new Response(aDizer, { status: 409, headers: TEXTO });

  if ((await gravarEdicao(getClient(), slug, novo, agora, c.baseId)) === null) {
    return new Response(LUGAR_MUDOU_DE_ENDERECO, { status: 409, headers: TEXTO });
  }
  return Response.json({ slug }, { headers: { "cache-control": "no-store" } });
}
