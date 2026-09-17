import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { avisoVigente, ensureSchema } from "@/lib/db";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste";
let client: Client;

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => client };
});

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
});
afterEach(() => {
  client.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const comSessao = (body: unknown) => {
  const t = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  return new Request("http://x/api/admin/aviso", {
    method: "POST",
    headers: { cookie: `${COOKIE_ADMIN}=${t}` },
    body: JSON.stringify(body),
  });
};

const daquiAUmaHora = () => Math.floor(Date.now() / 1000) + 3600;

describe("POST /api/admin/aviso", () => {
  it("com sessão, publica o aviso", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(
      comSessao({ slug: "rampa-do-pepe", texto: "em reforma", efeito: "fechado", venceEm: daquiAUmaHora() }),
    );
    expect(res.status).toBe(200);
    const a = await avisoVigente(client, "rampa-do-pepe", Math.floor(Date.now() / 1000));
    expect(a?.texto).toBe("em reforma");
  });

  // 🔴 A rota que MUDA o que o app afirma sobre um lugar real nao pode aceitar
  // ninguem sem sessao. Este e o teste mais importante do arquivo.
  it("sem cookie, 401 — e nada e gravado", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(
      new Request("http://x/api/admin/aviso", {
        method: "POST",
        body: JSON.stringify({ slug: "rampa-do-pepe", texto: "x", efeito: "frio", venceEm: daquiAUmaHora() }),
      }),
    );
    expect(res.status).toBe(401);
    expect(await avisoVigente(client, "rampa-do-pepe", Math.floor(Date.now() / 1000))).toBeNull();
  });

  it("cookie assinado com outro segredo é recusado", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const t = criarSessao("outro-segredo-qualquer", Math.floor(Date.now() / 1000), 3600);
    const res = await POST(
      new Request("http://x/api/admin/aviso", {
        method: "POST",
        headers: { cookie: `${COOKIE_ADMIN}=${t}` },
        body: JSON.stringify({ slug: "rampa-do-pepe", texto: "x", efeito: "frio", venceEm: daquiAUmaHora() }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("slug que não existe no acervo → 400", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(comSessao({ slug: "morro-inventado", texto: "x", efeito: "frio", venceEm: daquiAUmaHora() }));
    expect(res.status).toBe(400);
  });

  it("efeito fora do vocabulário → 400", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(comSessao({ slug: "rampa-do-pepe", texto: "x", efeito: "molhado", venceEm: daquiAUmaHora() }));
    expect(res.status).toBe(400);
  });

  it("texto vazio → 400: aviso sem palavra não é aviso", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(comSessao({ slug: "rampa-do-pepe", texto: "   ", efeito: "frio", venceEm: daquiAUmaHora() }));
    expect(res.status).toBe(400);
  });

  // 🔴 O PRAZO E OBRIGATORIO, e no passado nao e prazo: seria publicar um
  // aviso que ja nasce vencido, invisivel, com o dono achando que publicou.
  it("prazo ausente ou no passado → 400", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const agora = Math.floor(Date.now() / 1000);
    expect((await POST(comSessao({ slug: "rampa-do-pepe", texto: "x", efeito: "frio" }))).status).toBe(400);
    expect((await POST(comSessao({ slug: "rampa-do-pepe", texto: "x", efeito: "frio", venceEm: agora - 1 }))).status).toBe(400);
  });

  // 🔴 RULING 2: `venceEm <= agora` e `venceEm < agora` só discordam quando
  // `venceEm === agora` — e a rota lê `Date.now()`, então só um relógio
  // congelado torna este instante determinístico. Mesma regra do
  // `avisoVigente`: `vence_em > agora`, não `>=`.
  it("prazo igual ao agora exato (relógio congelado) → 400", async () => {
    const AGORA_MS = Date.UTC(2027, 0, 15, 11, 0);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AGORA_MS);
    const agora = Math.floor(AGORA_MS / 1000);
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(comSessao({ slug: "rampa-do-pepe", texto: "x", efeito: "frio", venceEm: agora }));
    expect(res.status).toBe(400);
  });

  // 🔴 RULING 1: FALHA FECHADA. Sem ADMIN_SENHA o painel não existe — 404,
  // nunca 401 e nunca 200. Mesma regra de /entrar e /sair.
  it("sem ADMIN_SENHA configurada, a rota é 404 — e nada é gravado", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.resetModules();
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(
      comSessao({ slug: "rampa-do-pepe", texto: "x", efeito: "frio", venceEm: daquiAUmaHora() }),
    );
    expect(res.status).toBe(404);
    expect(await avisoVigente(client, "rampa-do-pepe", Math.floor(Date.now() / 1000))).toBeNull();
  });
});

describe("DELETE /api/admin/aviso", () => {
  it("com sessão, retira o aviso publicado — e ele deixa de ser vigente", async () => {
    const { POST, DELETE } = await import("@/app/api/admin/aviso/route");
    const pub = await POST(
      comSessao({ slug: "rampa-do-pepe", texto: "em reforma", efeito: "fechado", venceEm: daquiAUmaHora() }),
    );
    const { id } = await pub.json();
    expect(await avisoVigente(client, "rampa-do-pepe", Math.floor(Date.now() / 1000))).not.toBeNull();

    const t = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
    const res = await DELETE(
      new Request(`http://x/api/admin/aviso?id=${id}`, {
        method: "DELETE",
        headers: { cookie: `${COOKIE_ADMIN}=${t}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(await avisoVigente(client, "rampa-do-pepe", Math.floor(Date.now() / 1000))).toBeNull();
  });

  it("sem cookie, 401 — e o aviso continua vigente", async () => {
    const { POST, DELETE } = await import("@/app/api/admin/aviso/route");
    const pub = await POST(
      comSessao({ slug: "rampa-do-pepe", texto: "em reforma", efeito: "fechado", venceEm: daquiAUmaHora() }),
    );
    const { id } = await pub.json();

    const res = await DELETE(new Request(`http://x/api/admin/aviso?id=${id}`, { method: "DELETE" }));
    expect(res.status).toBe(401);
    expect(await avisoVigente(client, "rampa-do-pepe", Math.floor(Date.now() / 1000))).not.toBeNull();
  });

  it("id que não é número → 400", async () => {
    const { DELETE } = await import("@/app/api/admin/aviso/route");
    const t = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
    const res = await DELETE(
      new Request("http://x/api/admin/aviso?id=abc", {
        method: "DELETE",
        headers: { cookie: `${COOKIE_ADMIN}=${t}` },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("id ausente → 400", async () => {
    const { DELETE } = await import("@/app/api/admin/aviso/route");
    const t = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
    const res = await DELETE(
      new Request("http://x/api/admin/aviso", {
        method: "DELETE",
        headers: { cookie: `${COOKIE_ADMIN}=${t}` },
      }),
    );
    expect(res.status).toBe(400);
  });

  // 🔴 RULING 1: FALHA FECHADA também na retirada.
  it("sem ADMIN_SENHA configurada, DELETE também é 404", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.resetModules();
    const { DELETE } = await import("@/app/api/admin/aviso/route");
    const res = await DELETE(new Request("http://x/api/admin/aviso?id=1", { method: "DELETE" }));
    expect(res.status).toBe(404);
  });
});
