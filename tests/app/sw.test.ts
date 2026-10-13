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

/** 🔴 TAREFA 11f, I7 DA AUDITORIA: os tiles do PAINEL não entram no cache
 *  offline dos tiles (`bp-tiles-osm`, 120 entradas). O mapa de pôr o pin anda e
 *  aproxima; dez gestos do dono despejariam os tiles das fichas que ele guardou
 *  pra estrada. Quem decide é a JANELA que pediu (`clientId` →
 *  `tilePodeIrProCache`, testada em `tests/lib/cache-rotas.test.ts`); aqui se
 *  trava a FIAÇÃO, lendo o arquivo (o `sw.ts` não é importável). */
describe("service worker: os tiles do painel não vão pro cache offline", () => {
  const bloco = SW.slice(SW.indexOf("runtimeCaching:"));
  const rotaDosTiles = (): string => {
    const i = bloco.indexOf("ehTileOsm(url.href)");
    expect(i, "a rota dos tiles sumiu").toBeGreaterThan(-1);
    return bloco.slice(i, bloco.indexOf("},", bloco.indexOf("handler:", i)));
  };

  it("a rota dos tiles pergunta à janela e escolhe entre o cache e a rede", () => {
    expect(rotaDosTiles()).toMatch(
      /self\.clients\.get\(evento\.clientId\)[\s\S]*tilePodeIrProCache\(janela\?\.url\) \? tilesGuardados : tilesDoPainel/,
    );
  });

  it("o cache dos tiles é o de sempre, e o do painel é só rede", () => {
    expect(SW).toMatch(/const tilesGuardados = new CacheFirst\(\{\s*cacheName: "bp-tiles-osm"/);
    expect(SW).toMatch(/const tilesDoPainel = new NetworkOnly\(\);/);
    // um cache de tiles só — o painel não ganhou um cache novo (M6)
    expect(SW.match(/cacheName: "bp-tiles/g)).toHaveLength(1);
  });
});

/** 🔴 /contribuir (07/10): a tela de quem manda um lugar, logada pelo Clerk.
 *  Mesma razão e mesmo molde do /admin acima — a ordem E o handler. */
describe("service worker: /contribuir nunca vira cache", () => {
  it("a rota do /contribuir vem antes de ...defaultCache, e responde com NetworkOnly", () => {
    const bloco = SW.slice(SW.indexOf("runtimeCaching:"));
    expect(bloco.indexOf('"/contribuir"')).toBeGreaterThan(-1);
    expect(bloco.indexOf('"/contribuir"')).toBeLessThan(bloco.indexOf("...defaultCache"));
    expect(bloco).toMatch(
      /matcher: \(\{ url \}\) => url\.pathname\.startsWith\("\/contribuir"\),\s*handler: new NetworkOnly\(\),/,
    );
    expect(bloco.match(/startsWith\("\/contribuir"\)/g)).toHaveLength(1);
  });
});
