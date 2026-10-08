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

  it.each([
    [{ slug: "x", baseId: 1 }],
    [{ slug: "x", baseId: 1, regra: { ...R, severidade: "talvez" } }],
    [{ slug: "x", baseId: 1, regra: R, extra: 1 }],
  ])("corpo torto %j: 400", async (corpo) => {
    expect((await POST(pedido(corpo, cookieBom))).status).toBe(400);
  });

  it("sem sessão 401; painel desligado 404", async () => {
    expect((await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }))).status).toBe(401);
    vi.stubEnv("ADMIN_SENHA", "");
    expect((await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }, cookieBom))).status).toBe(404);
    expect(await versoes()).toBe(1);
  });
});
