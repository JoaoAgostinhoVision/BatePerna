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
    // 🔴 M1 DA REVISÃO FINAL (2026-09-26): `typeof versaoId !== "number"`
    // deixava passar `1.5`, `-1` e `1e999` — este último o `JSON.parse`
    // converte em `Infinity`, e o `@libsql/client` lança `RangeError` com
    // `Infinity` como parâmetro, uma exceção NÃO TRATADA numa rota que
    // devolve 400 controlado em todos os outros pontos. Mesma forma da rota
    // irmã (`src/app/api/admin/aviso/route.ts`).
    if (typeof versaoId !== "number" || !Number.isInteger(versaoId) || versaoId <= 0) {
      return new Response("", { status: 400 });
    }

    const versao = await versaoPorId(getClient(), versaoId);
    // 🔴 A LINHA VERMELHA: sem conferir que a versão pertence a ESTE slug, um
    // `versaoId` qualquer põe a voz de um lugar na ficha de outro — o
    // defeito que este projeto mais caça, agora com ajuda do banco.
    if (versao == null || versao.ficha_slug !== slug) return new Response("", { status: 400 });

    // 🔴 FIX ROUND 1 (2026-09-26): "voltar" grava VERBATIM, não renormalizado.
    //
    // O `fichaSchema.parse` aqui existe só pra DECIDIR (400 se a versão antiga
    // não passa mais no schema de hoje) — o resultado do parse é DESCARTADO. O
    // que vai pro `gravarVersao` é `versao.doc`, o texto exatamente como ele
    // saiu do banco.
    //
    // A primeira versão desta rota gravava `JSON.stringify(fichaSchema.parse(...))`
    // — e isso REESCREVIA o passado: `src/types/ficha.ts` (comentário de
    // `esforco`/`duracao`, 2026-08-23) documenta que o zod descarta chave
    // desconhecida EM SILÊNCIO. Uma versão antiga que ainda tivesse esses
    // campos os perderia pra sempre ao "voltar" — e a ordem das chaves passaria
    // a ser a do schema, não a do documento original. Numa tabela que existe
    // para que "nada do que já se disse sobre um lugar se perca", isso é a
    // perda entrando pela porta que deveria impedi-la.
    //
    // 🔴 POR QUE É SEGURO NUNCA RENORMALIZAR: o caminho de LEITURA
    // (`fichaSchema.parse` em `buscarFichas`/`getFicha`) já filtra campo
    // desconhecido antes de a ficha chegar em qualquer tela — é assim que
    // `esforco`/`duracao` já se comportam hoje em fichas antigas. O campo
    // morto fica GUARDADO no arquivo histórico e SOME da tela, que é o
    // certo pra um arquivo.
    //
    // 🔴 CONSEQUÊNCIA DELIBERADA: uma versão que não passa mais no schema
    // ATUAL fica IMPOSSÍVEL de restaurar — 400, nunca uma ficha quebrada no
    // ar. É a mesma régua de `aplicarCampo`: estourar é melhor que publicar
    // algo meio certo.
    try {
      fichaSchema.parse(JSON.parse(versao.doc));
    } catch {
      return new Response("", { status: 400 });
    }

    const id = await gravarVersao(getClient(), slug, versao.doc, "painel", agora);
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
