import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSchema, gravarVersao, trocarEndereco, versaoAtual } from "@/lib/db";
import { esquecerMemoria } from "@/lib/ficha-fonte";
import { lugarMarcador } from "../lugar-marcador";
import { semearAcervo, base } from "../banco";

let client: Client;
vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => client };
});

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
  // A rota valida o slug contra o acervo, que vem do BANCO desde 2026-09-25 —
  // o mesmo cliente que ela usa pro placar.
  await semearAcervo(client);
});
afterEach(() => client.close());

describe("route /api/confirmar", () => {
  it("POST válido registra e retorna placar; GET lê o placar", async () => {
    const { POST, GET } = await import("@/app/api/confirmar/route");
    const post = await POST(
      new Request("http://x/api/confirmar", {
        method: "POST",
        body: JSON.stringify({ slug: "rampa-do-pepe", tipo: "barro" }),
      }),
    );
    expect(post.status).toBe(200);
    expect(await post.json()).toEqual({ foram: 1, barro: 1 });

    const get = await GET(new Request("http://x/api/confirmar?slug=rampa-do-pepe"));
    expect(get.status).toBe(200);
    expect(await get.json()).toEqual({ foram: 1, barro: 1 });
  });

  it("POST com tipo inválido → 400", async () => {
    const { POST } = await import("@/app/api/confirmar/route");
    const res = await POST(
      new Request("http://x/api/confirmar", {
        method: "POST",
        body: JSON.stringify({ slug: "rampa-do-pepe", tipo: "molhado" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("GET sem slug → 400", async () => {
    const { GET } = await import("@/app/api/confirmar/route");
    const res = await GET(new Request("http://x/api/confirmar"));
    expect(res.status).toBe(400);
  });
});

// 🔴 O ENDEREÇO VELHO, DA FILA OFFLINE (Tarefa 11e, I2 da auditoria): o relato
// guardado em /A sobe depois que o dono trocou o endereço pra /B. A rota GRAVA e
// CONTA no endereço resolvido — uma linha órfã em A seria herdada pelo lugar que
// RETOMAR A (E5): o lugar novo nasceria com o "N foram hoje" de outro.
describe("route /api/confirmar — endereço velho", () => {
  const A = "lugar-marcador-bom-marcador";
  const B = "lugar-marcador-outra-marcadora";
  const AGORA = Math.floor(Date.now() / 1000);

  beforeEach(async () => {
    await gravarVersao(client, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", AGORA - 10);
    await trocarEndereco(client, A, B, AGORA - 5, await base(client, A));
    esquecerMemoria();
  });

  const contar = async (slug: string) =>
    Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM confirmacoes WHERE ficha_slug = ?", args: [slug] })).rows[0].n);

  it("POST {slug: A} grava em B, e zero em A", async () => {
    const { POST } = await import("@/app/api/confirmar/route");
    const res = await POST(new Request("http://x/api/confirmar", { method: "POST", body: JSON.stringify({ slug: A, tipo: "seco" }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ foram: 1, barro: 0 });
    expect(await contar(B)).toBe(1);
    expect(await contar(A)).toBe(0);
  });

  it("GET ?slug=A devolve a contagem de B", async () => {
    const { POST, GET } = await import("@/app/api/confirmar/route");
    await POST(new Request("http://x/api/confirmar", { method: "POST", body: JSON.stringify({ slug: B, tipo: "barro" }) }));
    const res = await GET(new Request(`http://x/api/confirmar?slug=${A}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ foram: 1, barro: 1 });
  });

  it("o novo ESCONDIDO: 400, e nada é gravado", async () => {
    await gravarVersao(client, B, (await versaoAtual(client, B))!.doc, "painel", AGORA, true);
    esquecerMemoria();
    const { POST } = await import("@/app/api/confirmar/route");
    const res = await POST(new Request("http://x/api/confirmar", { method: "POST", body: JSON.stringify({ slug: A, tipo: "seco" }) }));
    expect(res.status).toBe(400);
    expect(await contar(A) + (await contar(B))).toBe(0);
  });
});
