import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { getClient, gravarVersao, versaoAtual } from "@/lib/db";
import { aplicarCampo, eCampoEditavel } from "@/lib/editar-ficha";

export const dynamic = "force-dynamic";

function tokenDoCookie(req: Request): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_ADMIN}=`))
    ?.slice(COOKIE_ADMIN.length + 1);
}

/** Grava um campo novo sobre a ficha de `slug`, como uma versão NOVA em
 *  `ficha_versoes` — nunca um UPDATE (a tabela é append-only, ver `db.ts`).
 *
 *  🔴 A ORDEM DAS GUARDAS é a mesma das outras rotas do admin: config → sessão
 *  → corpo → domínio (`eCampoEditavel`, `versaoAtual`) → validação do
 *  documento inteiro (`aplicarCampo`) → grava. Painel desligado nunca gasta
 *  banco; sessão ruim nunca lê o campo pedido. */
export async function PUT(req: Request): Promise<Response> {
  // 🔴 404, não 401: painel desligado não anuncia que existe. Mesma regra da
  // rota de aviso, e vem ANTES da sessão pela mesma razão — sem ADMIN_SENHA
  // não existe segredo pra validar sessão nenhuma.
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }

  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) {
    return new Response("", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("", { status: 400 });
  }
  // 🔴 `null` é JSON válido — não estoura o catch acima — mas destructurar
  // `null` estoura na hora. Mesma guarda da rota de aviso.
  if (typeof body !== "object" || body === null) return new Response("", { status: 400 });

  const { slug, campo, valor } = body as { slug?: unknown; campo?: unknown; valor?: unknown };
  if (typeof slug !== "string") return new Response("", { status: 400 });
  if (typeof campo !== "string" || !eCampoEditavel(campo)) return new Response("", { status: 400 });

  const versao = await versaoAtual(getClient(), slug);
  if (versao == null) return new Response("", { status: 400 });

  // 🔴 `valor` chega como `unknown` e NÃO é coagido pra string aqui — se
  // fosse `String(valor)`, um número viraria texto válido e passaria pelo
  // schema, escondendo exatamente o defeito que `aplicarCampo` existe pra
  // pegar. O estouro do schema (valor errado) é traduzido em 400 aqui.
  let novoDoc: string;
  try {
    novoDoc = aplicarCampo(versao.doc, campo, valor as string);
  } catch {
    return new Response("", { status: 400 });
  }

  const id = await gravarVersao(getClient(), slug, novoDoc, "painel", agora);
  return Response.json({ id }, { headers: { "cache-control": "no-store" } });
}
