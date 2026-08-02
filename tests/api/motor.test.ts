import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSchema, getFreshness } from "@/lib/db";
import { runMotor } from "@/lib/runMotor";

let client: Client;
beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
});
afterEach(() => client.close());

describe("runMotor", () => {
  it("writes 'frio' when the injected forecast has rain", async () => {
    const fakeFetch = async () => ({
      precips: [{ time: 1000 + 3600, mm: 1.0 }], // 1h ahead of agora=1000
      raw: { hourly: { time: [], precipitation: [] } },
    });
    const res = await runMotor({ client, agora: 1000, fetchPrecipFn: fakeFetch as never });
    expect(res.atualizadas).toBeGreaterThanOrEqual(1);
    const f = await getFreshness(client, "rampa-do-pepe");
    expect(f!.estado).toBe("frio");
    expect(f!.calculado_em).toBe(1000);
  });

  it("writes 'fresco' when the injected forecast is dry", async () => {
    const fakeFetch = async () => ({
      precips: [{ time: 1000 + 3600, mm: 0 }],
      raw: { hourly: { time: [], precipitation: [] } },
    });
    await runMotor({ client, agora: 1000, fetchPrecipFn: fakeFetch as never });
    const f = await getFreshness(client, "rampa-do-pepe");
    expect(f!.estado).toBe("fresco");
  });
});
