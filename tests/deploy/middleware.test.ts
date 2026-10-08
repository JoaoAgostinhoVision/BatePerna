import { afterEach, describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest, type NextFetchEvent } from "next/server";

// O handler que o `clerkMiddleware()` devolveria: um dublê que responde algo
// reconhecível, pra provar QUEM respondeu o pedido.
const clerk = vi.hoisted(() => ({ handler: vi.fn(() => new Response("do clerk", { status: 299 })) }));
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: () => clerk.handler }));
const { config, default: middleware } = await import("@/middleware");

afterEach(() => { vi.unstubAllEnvs(); clerk.handler.mockClear(); });

describe("o Clerk só roda nas rotas de quem contribui", () => {
  it.each(["/contribuir", "/contribuir/novo", "/contribuir/pedra-mandada-cidade", "/api/contribuir", "/api/contribuir/rascunho"])(
    "passa pelo Clerk: %s",
    (url) => expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true),
  );

  // 🔴 "Clerk fora do ar: só a contribuição para" — o app público e o painel
  // do João não passam por ele.
  it.each(["/", "/trilhas", "/rampa-do-pepe", "/admin", "/admin/chuva", "/api/admin/ficha", "/api/carimbo", "/api/confirmar", "/contribuirx", "/api/contribuirx", "/sw.js"])(
    "NÃO passa pelo Clerk: %s",
    (url) => expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false),
  );
});

// 🔴 O `clerkMiddleware` 7.9.12 estoura sem as duas chaves, no começo de cada
// pedido: sem o desvio, `/contribuir` sem chave seria 500 cru antes da rota, e
// o 503 com frase (via `ClerkFora`) nunca sairia.
describe("sem chave, o middleware deixa passar sem chamar o Clerk", () => {
  const pedido = () => new NextRequest("http://localhost/contribuir/novo");
  const evento = {} as NextFetchEvent;

  it.each([
    ["sem nenhuma", undefined, undefined],
    ["só a pública", "pk_test_x", undefined],
    ["só a secreta", undefined, "sk_test_x"],
  ])("%s: passagem, e o Clerk não é chamado", async (_nome, pub, sec) => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", pub);
    vi.stubEnv("CLERK_SECRET_KEY", sec);
    const res = await middleware(pedido(), evento);
    expect(clerk.handler).not.toHaveBeenCalled();
    expect(res?.headers.get("x-middleware-next")).toBe("1");
  });

  it("com as duas: o Clerk é chamado e a resposta é dele", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    const p = pedido();
    const res = await middleware(p, evento);
    expect(clerk.handler).toHaveBeenCalledTimes(1);
    expect(clerk.handler).toHaveBeenCalledWith(p, evento);
    expect(res?.status).toBe(299);
  });
});
