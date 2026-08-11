import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const SW = readFileSync(path.join(process.cwd(), "src", "app", "sw.ts"), "utf8");

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

/** O roteador do serwist devolve a PRIMEIRA rota que casa. Isso faz da ordem do
 *  array uma regra de produto disfarçada de detalhe de arrumação — e uma regra
 *  que nenhum tipo, lint ou build protege. Daí este cadeado. */
describe("service worker: /api/* nunca sai do cache", () => {
  it("a regra do nuncaCachear vem antes de ...defaultCache", () => {
    const bloco = SW.slice(SW.indexOf("runtimeCaching:"));
    const nossa = bloco.indexOf("nuncaCachear");
    const padrao = bloco.indexOf("...defaultCache");

    expect(nossa).toBeGreaterThan(-1);
    expect(padrao).toBeGreaterThan(-1);
    expect(
      nossa,
      "nuncaCachear/NetworkOnly precisa ser a primeira rota do runtimeCaching: " +
        "depois do ...defaultCache, quem responderia por /api/ seria o NetworkFirst " +
        "de 24h do serwist — carimbo velho servido em silêncio numa rede lenta no portão",
    ).toBeLessThan(padrao);
  });

  it("e a ordem é load-bearing: o defaultCache de produção guardaria /api/ por 24h", async () => {
    // O defaultCache do @serwist/next muda com o NODE_ENV (em dev é um
    // NetworkOnly pra tudo). O que vai pro celular é o de produção — é esse que
    // este teste precisa olhar, senão ele mede a lista errada e não prova nada.
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { defaultCache } = await import("@serwist/next/worker");

    const pedido = {
      sameOrigin: true,
      url: new URL("https://bateperna.vercel.app/api/carimbo?slug=rampa-do-pepe"),
      request: new Request("https://bateperna.vercel.app/api/carimbo?slug=rampa-do-pepe"),
    };
    const casam = defaultCache.filter((rota) => {
      const m = rota.matcher;
      if (typeof m === "function") { try { return !!m(pedido as never); } catch { return false; } }
      return m instanceof RegExp && m.test(pedido.url.href);
    });

    expect(casam.length).toBeGreaterThan(0);
    const primeira = casam[0].handler as { constructor: { name: string } };
    expect(primeira.constructor.name).toBe("NetworkFirst");
  });
});
