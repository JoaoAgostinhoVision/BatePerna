import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { historico, lerAcervoComOrigem, versaoAtual } from "@/lib/db";
import { JA_TEM_REGRA } from "@/lib/calibrar";
import { base, semearAcervo, semearLugarDaPessoa } from "../banco";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-calibrar";
const AGORA = 1_758_300_000;
let c: Client;
let SLUG: string;
let cookieBom: string;
let POST: typeof import("@/app/api/admin/calibrar/route").POST;

vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  SLUG = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  POST = (await import("@/app/api/admin/calibrar/route")).POST;
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});
afterEach(() => { c.close(); vi.unstubAllEnvs(); vi.useRealTimers(); });

const R = { janela_previsao_horas: 2, janela_passado_horas: 5, limiar_mm: 1.2, severidade: "espera" };
const pedido = (corpo: unknown, cookie?: string) =>
  new Request("http://x/api/admin/calibrar", {
    method: "POST",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });
const versoes = async () => (await historico(c, SLUG)).length;

describe("POST /api/admin/calibrar", () => {
  it("200: o documento ganha a regra, numa versão nova, pelo painel", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }, cookieBom));
    expect(res.status, await res.clone().text()).toBe(200);
    const atual = (await versaoAtual(c, SLUG))!;
    expect(JSON.parse(atual.doc).condicao.regra.limiar_mm).toBe(1.2);
    expect(atual.autor).toBe("painel");
    expect(await versoes()).toBe(2);
  });

  // 🔴 Calibrar NÃO confere: a marca de "não conferido" é outro ato (spec,
  // Parte 2 — e vice-versa: conferir não calibra).
  it("calibrar não confere o lugar", async () => {
    await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }, cookieBom));
    expect((await lerAcervoComOrigem(c)).linhas.get(SLUG)?.conferido).toBe(false);
  });

  it("calibrar não muda a visibilidade (lugar escondido continua escondido)", async () => {
    await c.execute({ sql: "UPDATE ficha_versoes SET oculto = 1 WHERE ficha_slug = ?", args: [SLUG] });
    await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }, cookieBom));
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  it("lugar que já tem regra: 409 com a frase, nada gravado", async () => {
    const antes = (await historico(c, "rampa-do-pepe")).length;
    const res = await POST(pedido({ slug: "rampa-do-pepe", baseId: await base(c, "rampa-do-pepe"), regra: R }, cookieBom));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_TEM_REGRA);
    expect((await historico(c, "rampa-do-pepe")).length).toBe(antes);
  });

  it("as duas janelas zeradas: 409 com a frase da coerência, nada gravado", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: { ...R, janela_previsao_horas: 0, janela_passado_horas: 0 } }, cookieBom));
    expect(res.status).toBe(409);
    expect((await res.text()).length).toBeGreaterThan(20);
    expect(await versoes()).toBe(1);
  });

  it("a aba velha (versão que não mora aqui): 409, nada gravado", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, "rampa-do-pepe"), regra: R }, cookieBom));
    expect(res.status).toBe(409);
    expect(await versoes()).toBe(1);
  });

  // 🔴 CADA CORPO TORTO POR UM MOTIVO SÓ, sobre o lugar SEMEADO e a versão
  // REAL dele (onda de fix da Task 8): com `slug: "x"` a rota dava 400 no
  // `versaoAtual === null` de qualquer jeito, e as três checagens de forma
  // ficavam sem prova. Cada caso abaixo foi medido apagando a SUA checagem:
  // - chave a mais no corpo: sem o `Object.keys(...).length === 3`, 200;
  // - chave a mais DENTRO da regra: sem `formaDaRegra`, o `calibrarDoc` pega
  //   só as quatro folhas e grava (200) — `severidade: "talvez"` NÃO servia de
  //   prova, porque o schema recusa sozinho e o 400 sairia igual;
  // - `baseId: 0`: sem `baseIdValido`, a gravação condicional não acha a
  //   versão e responde 409, não 400.
  it.each([
    ["chave a mais no corpo", (b: number) => ({ slug: SLUG, baseId: b, regra: R, extra: 1 })],
    ["chave a mais dentro da regra", (b: number) => ({ slug: SLUG, baseId: b, regra: { ...R, outra: 1 } })],
    ["baseId que não é id de versão", () => ({ slug: SLUG, baseId: 0, regra: R })],
    ["número que não é número", (b: number) => ({ slug: SLUG, baseId: b, regra: { ...R, limiar_mm: "1.2" } })],
  ])("corpo torto (%s): 400, nada gravado", async (_, corpo) => {
    const res = await POST(pedido(corpo(await base(c, SLUG)), cookieBom));
    expect(res.status, await res.clone().text()).toBe(400);
    expect(await versoes()).toBe(1);
  });

  // ⚠️ Este caso NÃO prova o `if (atual === null)` da rota, e não tem como:
  // medido, apagá-lo deixa tudo verde — o `atual.doc` estoura TypeError DENTRO
  // do `try` do `calibrarDoc`, que responde o mesmo 400 (mutação equivalente).
  // O caso crava o contrato (slug desconhecido = 400, nada gravado), não a linha.
  it("slug que não existe: 400, nada gravado", async () => {
    const res = await POST(pedido({ slug: "lugar-que-nao-existe", baseId: await base(c, SLUG), regra: R }, cookieBom));
    expect(res.status).toBe(400);
    expect(await versoes()).toBe(1);
  });

  // `limiar_mm: 0` tem FORMA boa: quem julga o número é a coerência (a mesma
  // régua do acervo), e a resposta é 409 com a frase dela — não 400 mudo.
  it("limite de chuva 0: 409 com a frase da coerência, nada gravado", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: { ...R, limiar_mm: 0 } }, cookieBom));
    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase).toContain("Pedra Mandada");
    expect(frase).toContain("0 mm");
    expect(await versoes()).toBe(1);
  });

  it("sem sessão 401; painel desligado 404", async () => {
    expect((await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }))).status).toBe(401);
    vi.stubEnv("ADMIN_SENHA", "");
    expect((await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }, cookieBom))).status).toBe(404);
    expect(await versoes()).toBe(1);
  });
});
