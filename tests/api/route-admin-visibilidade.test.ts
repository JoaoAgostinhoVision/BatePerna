import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { ensureSchema, gravarVersao, historico, versaoAtual, versoesAtuais } from "@/lib/db";
import { semearAcervo } from "../banco";
import type { Ficha } from "@/types/ficha";

// Molde: `tests/api/route-admin-ficha.test.ts` — `Request` à mão, `process.env`
// por `vi.stubEnv`, `criarSessao` de verdade, acervo do BANCO por `semearAcervo`.
//
// 🔴 ASSERÇÃO DUPLA EM TODO CASO: o CÓDIGO da resposta E o efeito no banco. Um
// teste que só lê o status não distingue "recusou" de "gravou a coisa errada", e
// aqui a coisa errada é um lugar real entrando ou saindo do ar.

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-visibilidade";
const AGORA = 1_758_300_000;

let c: Client;
let SLUG: string;
let ficha: Ficha;
let cookieBom: string;
let POST: typeof import("@/app/api/admin/visibilidade/route").POST;

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => c };
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);

  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  // O acervo é semeado com UMA versão por lugar (autor "semente") — é por isso
  // que "nada foi gravado" aqui é `historico(...).toHaveLength(1)`, não 0.
  const fichas = await semearAcervo(c);
  ficha = fichas.find((f) => f.slug === "rampa-do-pepe")!;
  SLUG = ficha.slug;

  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  ({ POST } = await import("@/app/api/admin/visibilidade/route"));

  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});

afterEach(() => {
  c.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function pedido(corpo: unknown, cookie?: string): Request {
  return new Request("http://x/api/admin/visibilidade", {
    method: "POST",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });
}

describe("POST /api/admin/visibilidade — esconder e mostrar", () => {
  it("esconder: 200, some do público, e continua inteiro no painel", async () => {
    const res = await POST(pedido({ slug: SLUG, oculto: true }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect((await versoesAtuais(c)).has(SLUG), "o público não vê mais").toBe(false);
    expect(
      (await versoesAtuais(c, { incluirOcultos: true })).has(SLUG),
      "e o painel continua vendo — esconder não apaga",
    ).toBe(true);
    // A versão antiga ficou: esconder é INSERT, nunca UPDATE nem DELETE.
    const h = await historico(c, SLUG);
    expect(h).toHaveLength(2);
    expect(h[0].oculto).toBe(true);
    expect(h[1].oculto).toBe(false);
  });

  it("mostrar de novo: 200, volta ao público, e são TRÊS versões", async () => {
    await POST(pedido({ slug: SLUG, oculto: true }, cookieBom));

    const res = await POST(pedido({ slug: SLUG, oculto: false }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect((await versoesAtuais(c)).has(SLUG)).toBe(true);
    expect(await historico(c, SLUG)).toHaveLength(3); // semente + esconder + mostrar
  });

  // 🔴 A PORTA DE MÃO ÚNICA QUE ESTE CASO EXISTE PRA IMPEDIR. A rota irmã de
  // aviso confere a existência do lugar com `getFicha(slug)`, que sai de
  // `versoesAtuais` — e desde esta tarefa `versoesAtuais` esconde os ocultos por
  // padrão. Se esta rota fizesse o mesmo, o lugar escondido "não existiria" pra
  // ela: `{oculto:false}` levaria 400 e o dono NUNCA mais devolveria o lugar ao
  // ar sem um desenvolvedor mexendo no banco, que é exatamente o que a lei dele
  // proíbe. A premissa está medida no meio do caso, pra ninguém achar que o
  // primeiro POST não fez nada.
  it("o lugar escondido continua alcançável por ESTA porta — é ela que o traz de volta", async () => {
    expect((await POST(pedido({ slug: SLUG, oculto: true }, cookieBom))).status).toBe(200);
    expect(
      (await versoesAtuais(c)).has(SLUG),
      "a premissa: pro leitor público este lugar já não existe",
    ).toBe(false);

    const volta = await POST(pedido({ slug: SLUG, oculto: false }, cookieBom));

    expect(volta.status, await volta.text()).toBe(200);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(false);
  });

  // 🔴 O DOCUMENTO VAI VERBATIM. Se esta rota renormalizasse pelo `fichaSchema`,
  // uma chave desconhecida que a ficha ainda carregue MORRERIA ao esconder — o
  // zod descarta chave desconhecida em silêncio (ver `src/types/ficha.ts`), e
  // numa tabela que existe pra que nada do que já se disse se perca, isso é a
  // perda entrando pela porta que devia impedi-la.
  it("esconder não reescreve o documento: byte por byte, inclusive campo que o schema de hoje não conhece", async () => {
    const comCampoMorto = JSON.stringify({ ...ficha, esforco: "moderado" });
    await gravarVersao(c, SLUG, comCampoMorto, "painel", AGORA);

    expect((await POST(pedido({ slug: SLUG, oculto: true }, cookieBom))).status).toBe(200);

    const atual = await versaoAtual(c, SLUG);
    expect(atual!.doc).toBe(comCampoMorto);
    expect(atual!.oculto).toBe(true);
  });

  // 🔴 E ESCONDER UM LUGAR QUEBRADO TEM DE FUNCIONAR — é justamente quando ele
  // mais precisa desta porta. Uma rota que exigisse `fichaSchema.parse` recusaria
  // tirar do ar a ficha que está no ar dando erro.
  it("esconder um lugar cujo documento nem abre: 200", async () => {
    await gravarVersao(c, SLUG, JSON.stringify({ slug: SLUG }), "painel", AGORA);

    const res = await POST(pedido({ slug: SLUG, oculto: true }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  // 🔴 Pedir o estado que JÁ vale não grava linha nenhuma. Toda linha de
  // `ficha_versoes` é uma coisa que alguém DISSE sobre um lugar, e o histórico é
  // tela do dono: um "esconder" sobre um lugar já escondido não disse nada de
  // novo. O 200 é honesto — o estado pedido é o que vale.
  it("esconder duas vezes grava UMA versão só, e o segundo pedido ainda é 200", async () => {
    expect((await POST(pedido({ slug: SLUG, oculto: true }, cookieBom))).status).toBe(200);

    const denovo = await POST(pedido({ slug: SLUG, oculto: true }, cookieBom));

    expect(denovo.status, await denovo.text()).toBe(200);
    expect(await historico(c, SLUG)).toHaveLength(2); // semente + UM esconder
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  it("mostrar um lugar que já está no ar grava UMA versão nenhuma", async () => {
    const res = await POST(pedido({ slug: SLUG, oculto: false }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect(await historico(c, SLUG)).toHaveLength(1); // só a semente
  });

  it("esconder um lugar não esconde os outros", async () => {
    await POST(pedido({ slug: SLUG, oculto: true }, cookieBom));

    const publico = await versoesAtuais(c);
    expect(publico.has(SLUG)).toBe(false);
    expect(publico.size, "os outros lugares do acervo continuam no ar").toBeGreaterThan(0);
  });
});

describe("POST /api/admin/visibilidade — as guardas", () => {
  // 🔴 FALHA FECHADA: sem ADMIN_SENHA o painel não existe — 404, nunca 401,
  // nunca 200 — e a guarda vem antes de tocar o banco.
  it("sem ADMIN_SENHA no env: 404, e nada é gravado", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.resetModules();
    const { POST: semSenha } = await import("@/app/api/admin/visibilidade/route");

    const res = await semSenha(pedido({ slug: SLUG, oculto: true }, cookieBom));

    expect(res.status).toBe(404);
    expect(await historico(c, SLUG)).toHaveLength(1);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(false);
  });

  // 🔴 A rota que tira um lugar real do ar não pode aceitar ninguém sem sessão.
  // É o caso mais importante do arquivo.
  it("painel ligado, sem cookie: 401, e o lugar continua no ar", async () => {
    const res = await POST(pedido({ slug: SLUG, oculto: true }));

    expect(res.status).toBe(401);
    expect(await historico(c, SLUG)).toHaveLength(1);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(false);
    expect((await versoesAtuais(c)).has(SLUG)).toBe(true);
  });

  it("cookie assinado com outro segredo: 401, e nada é gravado", async () => {
    const forjado = criarSessao("outro-segredo-qualquer", AGORA, DURACAO_SESSAO_S);

    const res = await POST(pedido({ slug: SLUG, oculto: true }, forjado));

    expect(res.status).toBe(401);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("slug que não existe no acervo: 400, e nada é gravado", async () => {
    const res = await POST(pedido({ slug: "morro-inventado", oculto: true }, cookieBom));

    expect(res.status).toBe(400);
    expect(await versaoAtual(c, "morro-inventado")).toBeNull();
  });

  // 🔴 `oculto` SÓ VALE BOOLEANO. Esta é a bandeira que decide se um lugar real
  // está no ar; `1`, `"true"` e ausente são corpo malformado, e coagir qualquer
  // um deles faria uma tela mal escrita tirar um lugar do ar sem pedir. Falha
  // fechada, como o `naoSei !== true` da rota de ficha.
  for (const [nome, corpo] of [
    ["o número 1", { oculto: 1 }],
    ['a string "true"', { oculto: "true" }],
    ["o número 0", { oculto: 0 }],
    ["null", { oculto: null }],
    ["ausente", {}],
  ] as const) {
    it(`oculto como ${nome}: 400, e nada é gravado`, async () => {
      const res = await POST(pedido({ slug: SLUG, ...corpo }, cookieBom));

      expect(res.status).toBe(400);
      expect(await historico(c, SLUG)).toHaveLength(1);
      expect((await versaoAtual(c, SLUG))!.oculto).toBe(false);
    });
  }

  it("slug que não é string: 400", async () => {
    expect((await POST(pedido({ slug: 42, oculto: true }, cookieBom))).status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("corpo que não é JSON: 400", async () => {
    const res = await POST(
      new Request("http://x/api/admin/visibilidade", {
        method: "POST",
        headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
        body: "isto nao e json",
      }),
    );
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // `null` é JSON válido e não estoura o `catch` do `req.json()` — destructurar
  // `null` estouraria. Mesma guarda das rotas irmãs.
  it("corpo JSON `null`: 400, sem exceção", async () => {
    const res = await POST(pedido(null, cookieBom));
    expect(res.status).toBe(400);
  });
});
