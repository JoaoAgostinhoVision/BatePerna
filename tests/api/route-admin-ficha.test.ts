import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { ensureSchema, gravarVersao, historico, versaoAtual } from "@/lib/db";
import { semearAcervo } from "../banco";
import type { Ficha } from "@/types/ficha";

// 🔴 C1 da revisão do controlador: o molde real é `tests/api/route-admin-aviso.test.ts`
// (o brief citava um caminho em `tests/app/` que não existe) — Request à mão,
// `process.env` via `vi.stubEnv`, `criarSessao` de verdade, acervo do BANCO
// via `semearAcervo` de `tests/banco.ts`.

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-ficha";
// 🔴 C3: `AGORA` é o instante FIXO em segundos — relógio congelado, porque
// Task 7 (a próxima) monta em cima deste arquivo e precisa de determinismo
// pra comparar `criado_em` entre versões.
const AGORA = 1_758_200_000;

// 🔴 C3: nomes de contrato com a Task 7 — não renomear.
let c: Client;
let SLUG: string;
let ficha: Ficha;
let outra: Ficha;
let cookieBom: string;
let PUT: typeof import("@/app/api/admin/ficha/route").PUT;

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => c };
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);

  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  // A rota valida o slug contra a versão atual do BANCO, que é semeado com
  // uma versão por lugar (autor "semente") — é por isso que "nada foi
  // gravado" nos testes abaixo é `historico(...).toHaveLength(1)`, não 0.
  const fichas = await semearAcervo(c);
  ficha = fichas.find((f) => f.slug === "rampa-do-pepe")!;
  outra = fichas.find((f) => f.slug !== ficha.slug)!;
  SLUG = ficha.slug;

  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  ({ PUT } = await import("@/app/api/admin/ficha/route"));

  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});

afterEach(() => {
  c.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function pedido(corpo: unknown, cookie?: string): Request {
  return new Request("http://x/api/admin/ficha", {
    method: "PUT",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });
}

describe("PUT /api/admin/ficha", () => {
  // 🔴 RULING equivalente ao da rota de aviso: FALHA FECHADA. Sem
  // ADMIN_SENHA o painel não existe — 404, nunca 401, nunca 200 — e a
  // guarda vem antes de tocar o banco.
  it("sem ADMIN_SENHA no env: 404, e nada é gravado", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.resetModules();
    const { PUT: putSemSenha } = await import("@/app/api/admin/ficha/route");
    const res = await putSemSenha(pedido({ slug: SLUG, campo: "voz", valor: "texto novo" }, cookieBom));
    expect(res.status).toBe(404);
    expect(await historico(c, SLUG)).toHaveLength(1); // ⬅ só a semente
  });

  // 🔴 M3 do plano de mutação: gravar antes de checar sessão tem que morrer
  // aqui — o código (401) E o efeito (nada gravado) são os dois provados.
  it("painel ligado, sem cookie: 401, e nada é gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "texto novo" }));
    expect(res.status).toBe(401);
    expect(await historico(c, SLUG)).toHaveLength(1); // ⬅ só a semente
  });

  // 🔴 M4 do plano de mutação ("um teste que lê o autor da versão nova"):
  // este é ele — `gravarVersao(..., "semente", ...)` no lugar de "painel"
  // tem que morrer NESTA asserção.
  it("cookie válido: grava a voz nova com autor painel, e a versão antiga fica no histórico", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "texto novo" }, cookieBom));
    expect(res.status).toBe(200);
    const atual = await versaoAtual(c, SLUG);
    expect(JSON.parse(atual!.doc).voz).toBe("texto novo");
    expect(atual!.autor).toBe("painel");
    expect(await historico(c, SLUG)).toHaveLength(2); // ⬅ a antiga ficou
  });

  // 🔴 M1 do plano de mutação: sem o segundo `fichaSchema.parse` dentro de
  // `aplicarCampo`, um número passaria como "voz" e este teste é quem morre.
  it("valor inválido (número em vez de texto): 400, e nada é gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: 42 }, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("slug que não existe no acervo: 400", async () => {
    const res = await PUT(pedido({ slug: "morro-inventado", campo: "voz", valor: "x" }, cookieBom));
    expect(res.status).toBe(400);
  });

  // 🔴 C2 da revisão do controlador: no nível da ROTA quem mata a M2
  // (`CAMPOS_EDITAVEIS` ganhar "slug") é este teste com `campo: "piso"`, não
  // um `campo: "slug"` — o teste de unidade em `editar-ficha.test.ts` é quem
  // cobre "slug" diretamente.
  it("campo fora da lista editável (piso): 400, e nada é gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "piso", valor: "asfalto" }, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // 🔴 M5 do plano de mutação, medido no nível da ROTA com um SEGUNDO lugar
  // (`outra`): trocar o spread por `{ [campo]: valor }` em `aplicarCampo`
  // apagaria a ficha de `outra` inteira — mas como cada gravação é por slug,
  // este teste garante que editar UM lugar não escreve versão nenhuma pro
  // outro.
  it("editar a voz de um lugar não grava versão nenhuma pra outro lugar", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "só esta muda" }, cookieBom));
    expect(res.status).toBe(200);
    expect(await historico(c, outra.slug)).toHaveLength(1); // ⬅ intocado
    const versaoOutra = await versaoAtual(c, outra.slug);
    expect(JSON.parse(versaoOutra!.doc).voz).toBe(outra.voz);
  });

  // 🔴 FIX ROUND 1, item 2: só o status não prova nada — todo irmão de
  // recusa deste arquivo prova código E efeito. Sem `historico`, um bug que
  // gravasse por engano antes de devolver 400 passaria verde aqui.
  it("corpo JSON malformado: 400, e nada é gravado", async () => {
    const res = await PUT(
      new Request("http://x/api/admin/ficha", {
        method: "PUT",
        headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("corpo null: 400, não exceção — e nada é gravado", async () => {
    const res = await PUT(pedido(null, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });
});

describe("PUT /api/admin/ficha — voltar a uma versão (versaoId)", () => {
  // 🔴 O teste central da escolha 3 dele: voltar GRAVA, não apaga.
  //
  // 🔴 C1 da revisão do controlador: o brief cravava `toHaveLength(3)`, e a
  // conta certa é 4 (semente + "a primeira" + "a segunda" + o voltar) — mas
  // cravar QUALQUER número trava de novo se o `beforeEach` mudar de tamanho.
  // A asserção é RELATIVA (`antes + 1`), estritamente mais forte, e a
  // absoluta que prova que "a segunda" continua lá fica intacta.
  it("voltar a uma versão antiga grava versão nova, e a atual continua no histórico", async () => {
    const v1 = await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a primeira" }), "semente", AGORA);
    await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a segunda" }), "painel", AGORA + 10);

    const antes = await historico(c, SLUG);

    const r = await PUT(pedido({ slug: SLUG, versaoId: v1 }, cookieBom));

    expect(r.status).toBe(200);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).voz).toBe("a primeira");
    const h = await historico(c, SLUG);
    expect(h, "voltar tem que INSERIR, nunca apagar").toHaveLength(antes.length + 1);
    expect(JSON.parse(h[1].doc).voz, "a versão de onde voltamos continua lá").toBe("a segunda");
  });

  // 🔴 A LINHA VERMELHA EM FORMA DE TESTE. Sem conferir que a versão é DAQUELE
  // lugar, um `versaoId` qualquer põe a voz da Rampa na ficha da Pedra Furada —
  // exatamente o defeito que este projeto mais caça, agora com ajuda do banco.
  it("versaoId de OUTRO lugar: 400, e a ficha não é tocada", async () => {
    const daRampa = await gravarVersao(c, "rampa-do-pepe", JSON.stringify({ ...ficha, voz: "voz da Rampa" }), "painel", AGORA);
    await gravarVersao(c, "pedra-furada-de-venturosa", JSON.stringify({ ...outra, voz: "voz da Pedra" }), "semente", AGORA);

    const r = await PUT(pedido({ slug: "pedra-furada-de-venturosa", versaoId: daRampa }, cookieBom));

    expect(r.status).toBe(400);
    expect(JSON.parse((await versaoAtual(c, "pedra-furada-de-venturosa"))!.doc).voz).toBe("voz da Pedra");
  });

  it("versaoId que não existe: 400", async () => {
    expect((await PUT(pedido({ slug: SLUG, versaoId: 99_999 }, cookieBom))).status).toBe(400);
  });

  // 🔴 FIX ROUND 1 (2026-09-26): "voltar" grava VERBATIM, não renormalizado.
  // Sem isto, `fichaSchema.parse` reescreve o passado — descarta chave
  // desconhecida em silêncio (mesma régua documentada em `src/types/ficha.ts`
  // pra `esforco`/`duracao`) e reordena as chaves pela ordem do schema, não a
  // do documento original. O doc de teste carrega os DOIS defeitos ao mesmo
  // tempo — chave a mais e ordem diferente — porque só assim "gravou o
  // antigo" se distingue de "gravou o renormalizado".
  it("voltar grava o doc EXATAMENTE como estava — nunca renormalizado pelo schema", async () => {
    const chaveDesconhecida = "campoQueOSchemaNaoConheceMais";
    const invertido = Object.fromEntries([...Object.entries(ficha)].reverse());
    const docAntigo = JSON.stringify({ ...invertido, [chaveDesconhecida]: "só sobrevive se gravar verbatim" });

    const v1 = await gravarVersao(c, SLUG, docAntigo, "semente", AGORA);
    await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a mais nova" }), "painel", AGORA + 10);

    const r = await PUT(pedido({ slug: SLUG, versaoId: v1 }, cookieBom));

    expect(r.status).toBe(200);
    expect(
      (await versaoAtual(c, SLUG))!.doc,
      "verbatim: a mesma string byte a byte, não reserializada pelo schema",
    ).toBe(docAntigo);
  });

  // 🔴 C6 da revisão do controlador: o ramo novo não pode virar porta lateral —
  // nem os dois formatos juntos, nem nenhum dos dois, é gravação nenhuma.
  it("corpo sem campo/valor e sem versaoId: 400, e nada é gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG }, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("corpo com campo e versaoId ao mesmo tempo: 400, e nada é gravado", async () => {
    const v1 = await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a primeira" }), "semente", AGORA);
    const antes = await historico(c, SLUG);
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "x", versaoId: v1 }, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(antes.length);
  });
});
