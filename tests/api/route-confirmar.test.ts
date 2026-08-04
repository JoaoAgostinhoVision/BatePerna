import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSchema } from "@/lib/db";

let client: Client;
vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => client };
});

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
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
