import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "@/lib/db";
import { registrarConfirmacao } from "@/lib/confirmar";

let client: Client;
beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
});
afterEach(() => client.close());

describe("registrarConfirmacao", () => {
  it("registra com tipo e devolve o placar do dia", async () => {
    const agora = Date.UTC(2026, 7, 3, 12, 0, 0) / 1000;
    const a = await registrarConfirmacao(client, "rampa-do-pepe", "seco", agora);
    expect(a).toEqual({ foram: 1, barro: 0 });
    const b = await registrarConfirmacao(client, "rampa-do-pepe", "barro", agora);
    expect(b).toEqual({ foram: 2, barro: 1 });
  });
});
