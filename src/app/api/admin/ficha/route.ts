import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient, gravarVersao, versaoAtual, versaoPorId } from "@/lib/db";
import { aplicarCampo, eCampoEditavel } from "@/lib/editar-ficha";
import { fichaSchema } from "@/types/ficha";

export const dynamic = "force-dynamic";

/** Grava um campo novo sobre a ficha de `slug`, como uma versão NOVA em
 *  `ficha_versoes` — nunca um UPDATE (a tabela é append-only, ver `db.ts`).
 *
 *  🔴 A ORDEM DAS GUARDAS é a mesma das outras rotas do admin: config → sessão
 *  → corpo → domínio (`eCampoEditavel`, `versaoAtual`) → validação do
 *  documento inteiro (`aplicarCampo`) → grava. Painel desligado nunca gasta
 *  banco; sessão ruim nunca lê o campo pedido.
 *
 *  🔴 Task 7 (2026-09-26): o corpo agora aceita DOIS formatos — `{slug,
 *  campo, valor}` (editar um campo, Task 6) OU `{slug, versaoId}` (voltar a
 *  uma versão antiga). Nunca os dois juntos, nunca nenhum dos dois — as duas
 *  guardas de cima (config, sessão) valem pros dois formatos igual. */
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

  const corpo = body as { slug?: unknown; campo?: unknown; valor?: unknown; versaoId?: unknown };
  const { slug, campo, valor, versaoId } = corpo;
  if (typeof slug !== "string") return new Response("", { status: 400 });

  // 🔴 C6 da revisão do controlador: os dois formatos são MUTUAMENTE
  // EXCLUSIVOS. `"campo" in corpo` (e não `campo !== undefined`) porque
  // `JSON.parse` nunca produz `undefined` como valor de chave presente — a
  // checagem lê exatamente o que chegou no corpo, não uma coincidência de
  // tipo. Nem os dois formatos juntos, nem nenhum dos dois: 400.
  const trazVersaoId = "versaoId" in corpo;
  const trazCampo = "campo" in corpo || "valor" in corpo;
  if (trazVersaoId === trazCampo) return new Response("", { status: 400 });

  if (trazVersaoId) {
    if (typeof versaoId !== "number") return new Response("", { status: 400 });

    const versao = await versaoPorId(getClient(), versaoId);
    // 🔴 A LINHA VERMELHA: sem conferir que a versão pertence a ESTE slug, um
    // `versaoId` qualquer põe a voz de um lugar na ficha de outro — o
    // defeito que este projeto mais caça, agora com ajuda do banco.
    if (versao == null || versao.ficha_slug !== slug) return new Response("", { status: 400 });

    // 🔴 Validação na porta de escrita vale pro voltar também: o documento
    // volta a passar pelo `fichaSchema` antes de virar linha nova, mesmo que
    // já tenha passado uma vez quando foi gravado a primeira vez.
    let docValidado: string;
    try {
      docValidado = JSON.stringify(fichaSchema.parse(JSON.parse(versao.doc)));
    } catch {
      return new Response("", { status: 400 });
    }

    const id = await gravarVersao(getClient(), slug, docValidado, "painel", agora);
    return Response.json({ id }, { headers: { "cache-control": "no-store" } });
  }

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
