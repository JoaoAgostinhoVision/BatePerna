import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureSchema,
  upsertFreshness,
  getFreshness,
  insertConfirmacao,
  countConfirmacoes,
} from "@/lib/db";

let client: Client;

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
});
afterEach(() => client.close());

describe("db", () => {
  it("upserts and reads freshness (idempotent)", async () => {
    await upsertFreshness(client, {
      slug: "rampa-do-pepe",
      estado: "frio",
      calculadoEm: 1000,
      fonte: "open-meteo",
      previsaoBruta: "{}",
    });
    await upsertFreshness(client, {
      slug: "rampa-do-pepe",
      estado: "fresco",
      calculadoEm: 2000,
      fonte: "open-meteo",
      previsaoBruta: "{}",
    });
    const f = await getFreshness(client, "rampa-do-pepe");
    expect(f).not.toBeNull();
    expect(f!.estado).toBe("fresco");
    expect(f!.calculado_em).toBe(2000);
  });

  it("returns null freshness for unknown slug", async () => {
    expect(await getFreshness(client, "nope")).toBeNull();
  });

  it("inserts and counts confirmacoes", async () => {
    expect(await countConfirmacoes(client, "rampa-do-pepe")).toBe(0);
    await insertConfirmacao(client, "rampa-do-pepe", 1000);
    await insertConfirmacao(client, "rampa-do-pepe", 1001);
    expect(await countConfirmacoes(client, "rampa-do-pepe")).toBe(2);
  });
});
