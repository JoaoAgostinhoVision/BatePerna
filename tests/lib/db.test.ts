import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureSchema,
  upsertFreshness,
  getFreshness,
  insertConfirmacao,
  countConfirmacoes,
  contarHoje,
  inicioDoDiaRecife,
  type TipoRelato,
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

  it("inserts confirmacoes com tipo e conta o total", async () => {
    await insertConfirmacao(client, "rampa-do-pepe", 1000, "seco");
    await insertConfirmacao(client, "rampa-do-pepe", 1001, "barro");
    expect(await countConfirmacoes(client, "rampa-do-pepe")).toBe(2);
  });

  it("inicioDoDiaRecife: meia-noite local em UTC-3", () => {
    // 2026-08-03 12:00Z → local 09:00 → início do dia local = 2026-08-03 03:00Z
    const agora = Date.UTC(2026, 7, 3, 12, 0, 0) / 1000;
    expect(inicioDoDiaRecife(agora)).toBe(Date.UTC(2026, 7, 3, 3, 0, 0) / 1000);
  });

  it("contarHoje: conta só o dia de Recife, separa barro", async () => {
    const agora = Date.UTC(2026, 7, 3, 12, 0, 0) / 1000; // hoje (Recife)
    const ontem = Date.UTC(2026, 7, 3, 2, 59, 0) / 1000; // 23:59 de ontem em Recife
    const hojeCedo = Date.UTC(2026, 7, 3, 3, 1, 0) / 1000; // 00:01 hoje em Recife
    await insertConfirmacao(client, "rampa-do-pepe", ontem, "barro");
    await insertConfirmacao(client, "rampa-do-pepe", hojeCedo, "seco");
    await insertConfirmacao(client, "rampa-do-pepe", agora, "barro");
    const p = await contarHoje(client, "rampa-do-pepe", agora);
    expect(p).toEqual({ foram: 2, barro: 1 });
  });
});
