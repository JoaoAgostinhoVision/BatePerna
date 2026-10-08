import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { lerAcervoComOrigem, versaoAtual } from "@/lib/db";
import { base, semearAcervo, semearLugarDaPessoa } from "../banco";

// Molde: `tests/api/route-admin-visibilidade.test.ts` — `Request` à mão,
// `vi.stubEnv`, `criarSessao` de verdade, `getClient` dublado. ASSERÇÃO DUPLA
// em todo caso: o código da resposta E o banco.

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-conferir";
const AGORA = 1_758_300_000;
/** O endereço que `semearLugarDaPessoa` dá à "Pedra Mandada" de "Cidade
 *  Teste" — escrito à mão porque o `it.each` lê a tabela ANTES do `beforeEach`:
 *  com `SLUG` ali, o corpo sairia `{}` e o caso "sem baseId" provaria outra
 *  coisa. O `beforeEach` confere que bate. */
const SLUG_DA_TABELA = "pedra-mandada-cidade-teste";
let c: Client;
let SLUG: string;
let cookieBom: string;
let POST: typeof import("@/app/api/admin/conferir/route").POST;

vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  SLUG = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  expect(SLUG, "a premissa da tabela dos corpos tortos").toBe(SLUG_DA_TABELA);
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  POST = (await import("@/app/api/admin/conferir/route")).POST;
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});
afterEach(() => { c.close(); vi.unstubAllEnvs(); vi.useRealTimers(); });

const pedido = (corpo: unknown, cookie?: string) =>
  new Request("http://x/api/admin/conferir", {
    method: "POST",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });
const conferido = async () => (await lerAcervoComOrigem(c)).linhas.get(SLUG)?.conferido;

describe("POST /api/admin/conferir", () => {
  it("200, e o lugar passa a conferido", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG) }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
    expect(await conferido()).toBe(true);
  });

  it("painel desligado: 404, antes de tudo, e nada muda", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG) }, cookieBom));
    expect(res.status).toBe(404);
    expect(await conferido()).toBe(false);
  });

  it("sem sessão: 401, e nada muda", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG) }));
    expect(res.status).toBe(401);
    expect(await conferido()).toBe(false);
  });

  it.each([
    [{ slug: SLUG_DA_TABELA }],
    [{ baseId: 1 }],
    [{ slug: 3, baseId: 1 }],
    [{ slug: "x", baseId: 0 }],
    [{ slug: "x", baseId: 1, extra: true }],
  ])("corpo torto %j: 400, e nada muda", async (corpo) => {
    expect((await POST(pedido(corpo, cookieBom))).status).toBe(400);
    expect(await conferido()).toBe(false);
  });

  it("lugar do João: 409 com frase, e nenhuma origem nasce", async () => {
    const res = await POST(pedido({ slug: "rampa-do-pepe", baseId: await base(c, "rampa-do-pepe") }, cookieBom));
    expect(res.status).toBe(409);
    expect((await res.text()).length).toBeGreaterThan(20);
    expect((await lerAcervoComOrigem(c)).linhas.get("rampa-do-pepe")?.contribuidor).toBeNull();
  });

  it("a versão da tela que não mora mais aqui: 409", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: (await versaoAtual(c, "rampa-do-pepe"))!.id }, cookieBom));
    expect(res.status).toBe(409);
    expect(await conferido()).toBe(false);
  });
});
