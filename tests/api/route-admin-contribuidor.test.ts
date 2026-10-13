import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { versaoAtual } from "@/lib/db";
import { estaBloqueado } from "@/lib/db-contribuidor";
import { semearAcervo, semearLugarDaPessoa } from "../banco";
import { PESSOA } from "../sessao-da-pessoa";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-contribuidor";
const AGORA = 1_758_300_000;
let c: Client;
let SLUG: string;
let cookieBom: string;
let POST: typeof import("@/app/api/admin/contribuidor/route").POST;

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
  POST = (await import("@/app/api/admin/contribuidor/route")).POST;
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});
afterEach(() => { c.close(); vi.unstubAllEnvs(); vi.useRealTimers(); });

const pedido = (corpo: unknown, cookie?: string) =>
  new Request("http://x/api/admin/contribuidor", {
    method: "POST",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });

describe("POST /api/admin/contribuidor", () => {
  it("bloquear: 200 com quantos saíram do ar, e o banco concorda", async () => {
    const res = await POST(pedido({ id: PESSOA.id, bloquear: true }, cookieBom));
    expect(await res.json()).toEqual({ escondidos: 1 });
    expect(await estaBloqueado(c, PESSOA.id)).toBe(true);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  it("desbloquear: 200, e o lugar continua escondido", async () => {
    await POST(pedido({ id: PESSOA.id, bloquear: true }, cookieBom));
    expect((await POST(pedido({ id: PESSOA.id, bloquear: false }, cookieBom))).status).toBe(200);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(false);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  it("painel desligado 404; sem sessão 401; corpo torto 400 — nada muda", async () => {
    expect((await POST(pedido({ id: PESSOA.id, bloquear: true }))).status).toBe(401);
    expect((await POST(pedido({ id: PESSOA.id, bloquear: "sim" }, cookieBom))).status).toBe(400);
    expect((await POST(pedido({ id: "", bloquear: true }, cookieBom))).status).toBe(400);
    vi.stubEnv("ADMIN_SENHA", "");
    expect((await POST(pedido({ id: PESSOA.id, bloquear: true }, cookieBom))).status).toBe(404);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(false);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(false);
  });
});
