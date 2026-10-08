import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { lerRegraPadrao } from "@/lib/db";
import { JANELAS_ZERADAS } from "@/lib/porta-da-regra-padrao";
import { REGRA_PADRAO_INICIAL } from "@/lib/regra-padrao";
import { semearAcervo } from "../banco";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-regra-padrao";
const AGORA = 1_758_300_000;
let c: Client;
let cookieBom: string;
let PUT: typeof import("@/app/api/admin/regra-padrao/route").PUT;

vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  PUT = (await import("@/app/api/admin/regra-padrao/route")).PUT;
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});
afterEach(() => { c.close(); vi.unstubAllEnvs(); vi.useRealTimers(); });

const pedido = (corpo: unknown, cookie?: string) =>
  new Request("http://x/api/admin/regra-padrao", {
    method: "PUT",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });
const NOVA = { janela_previsao_horas: 2, janela_passado_horas: 12, limiar_mm: 1.5, severidade: "espera" };

describe("PUT /api/admin/regra-padrao", () => {
  it("200, devolve a regra, e o banco tem ela", async () => {
    const res = await PUT(pedido(NOVA, cookieBom));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual(NOVA);
    expect(await lerRegraPadrao(c)).toEqual(NOVA);
  });

  it("painel desligado: 404, e nada muda", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    expect((await PUT(pedido(NOVA, cookieBom))).status).toBe(404);
    expect(await lerRegraPadrao(c)).toEqual(REGRA_PADRAO_INICIAL);
  });

  it("sem sessão: 401, e nada muda", async () => {
    expect((await PUT(pedido(NOVA))).status).toBe(401);
    expect(await lerRegraPadrao(c)).toEqual(REGRA_PADRAO_INICIAL);
  });

  it("corpo torto: 400 sem frase, e nada muda", async () => {
    const res = await PUT(pedido({ ...NOVA, severidade: "talvez" }, cookieBom));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("");
    expect(await lerRegraPadrao(c)).toEqual(REGRA_PADRAO_INICIAL);
  });

  it("as duas janelas zeradas: 400 com a frase, e nada muda", async () => {
    const res = await PUT(pedido({ ...NOVA, janela_previsao_horas: 0, janela_passado_horas: 0 }, cookieBom));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(JANELAS_ZERADAS);
    expect(await lerRegraPadrao(c)).toEqual(REGRA_PADRAO_INICIAL);
  });
});
