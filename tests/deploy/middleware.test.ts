import { describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: () => () => undefined }));
const { config } = await import("@/middleware");

describe("o Clerk só roda nas rotas de quem contribui", () => {
  it.each(["/contribuir", "/contribuir/novo", "/contribuir/pedra-mandada-cidade", "/api/contribuir/rascunho"])(
    "passa pelo Clerk: %s",
    (url) => expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true),
  );

  // 🔴 "Clerk fora do ar: só a contribuição para" — o app público e o painel
  // do João não passam por ele.
  it.each(["/", "/trilhas", "/rampa-do-pepe", "/admin", "/admin/chuva", "/api/admin/ficha", "/api/carimbo", "/api/confirmar", "/contribuirx", "/sw.js"])(
    "NÃO passa pelo Clerk: %s",
    (url) => expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false),
  );
});
