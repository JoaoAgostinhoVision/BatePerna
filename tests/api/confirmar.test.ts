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
  it("inserts a confirmation and returns the running count", async () => {
    const a = await registrarConfirmacao(client, "rampa-do-pepe", 1000);
    expect(a.count).toBe(1);
    const b = await registrarConfirmacao(client, "rampa-do-pepe", 1001);
    expect(b.count).toBe(2);
  });
});
