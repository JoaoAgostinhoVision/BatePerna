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

/** 🔴 O MESMO CADEADO, achado em revisão (2026-09-13): excluir o painel de
 *  admin da NOSSA estratégia (podeGuardarPagina) não bastava. Uma request sob
 *  /admin que não é navegação (fetch de API do próprio painel) não passa por
 *  ehNavegacaoNossa nem pela rota do podeGuardarPagina — cai direto no
 *  roteador do serwist, e o catch-all "others" do ...defaultCache é
 *  `sameOrigin && !pathname.startsWith("/api/")`: bate em /admin igual a
 *  qualquer outra página same-origin. O painel acabava guardado do mesmo
 *  jeito, só que sob outro nome de cache — o defeito que Task 2 existe pra
 *  fechar, sobrevivendo por baixo do próprio conserto. */
describe("service worker: /admin nunca vira cache", () => {
  it("a rota do /admin vem antes de ...defaultCache", () => {
    const bloco = SW.slice(SW.indexOf("runtimeCaching:"));
    const nossa = bloco.indexOf('"/admin"');
    const padrao = bloco.indexOf("...defaultCache");

    expect(nossa).toBeGreaterThan(-1);
    expect(padrao).toBeGreaterThan(-1);
    expect(
      nossa,
      "a rota do /admin precisa ser registrada antes de ...defaultCache: depois do spread, " +
        "quem responderia pelo painel seria o catch-all 'others' do serwist — same-origin e " +
        "sem /api/, ele bate, e o painel vira cache sob outro nome (mesmo defeito, cache diferente)",
    ).toBeLessThan(padrao);
  });

  // 🔴 I6 DA REVISÃO FINAL (2026-09-16): a guarda de cima trava a ORDEM, e só
  // ela. Trocar `new NetworkOnly()` por `new NetworkFirst(...)` na rota do
  // /admin passaria nela — a rota continuaria antes do spread, e o painel
  // passaria a virar cache do mesmo jeito. Esta trava o HANDLER: o matcher do
  // /admin e, dentro do mesmo objeto (até 200 caracteres, sem cruzar outro
  // `matcher:`), `handler: new NetworkOnly()` — sem argumentos, porque
  // NetworkOnly com opções é outra coisa.
  it("e a rota do /admin responde com NetworkOnly — não é só a ordem, é o handler", () => {
    const bloco = SW.slice(SW.indexOf("runtimeCaching:"));
    expect(bloco).toMatch(
      /matcher: \(\{ url \}\) => url\.pathname\.startsWith\("\/admin"\),\s*handler: new NetworkOnly\(\),/,
    );
    // E o par de cima é o ÚNICO uso de "/admin" no roteador — um segundo
    // objeto com o mesmo matcher e outro handler não pode passar escondido.
    expect(bloco.match(/startsWith\("\/admin"\)/g)).toHaveLength(1);
  });

  it("e a ordem é load-bearing: o defaultCache de produção guardaria /admin como qualquer outra página", async () => {
    // Mesma razão do teste irmão acima: o defaultCache muda com o NODE_ENV, e
    // é o de produção que vai pro celular.
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { defaultCache } = await import("@serwist/next/worker");

    const pedido = {
      sameOrigin: true,
      url: new URL("https://bateperna.vercel.app/admin"),
      request: new Request("https://bateperna.vercel.app/admin"),
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
