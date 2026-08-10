// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { COOKIE_ULTIMA } from "@/lib/despacho";

function req(caminho: string): NextRequest {
  return new NextRequest(new URL(caminho, "https://bateperna.vercel.app"));
}

describe("middleware", () => {
  it("grava a ficha aberta no cookie", () => {
    const res = middleware(req("/rampa-do-pepe"));
    expect(res.cookies.get(COOKIE_ULTIMA)?.value).toBe("rampa-do-pepe");
  });

  it("não grava nada quando a rota não é ficha", () => {
    expect(middleware(req("/trilhas")).cookies.get(COOKIE_ULTIMA)).toBeUndefined();
    expect(middleware(req("/")).cookies.get(COOKIE_ULTIMA)).toBeUndefined();
  });

  it("o cookie sobrevive a fechar o app — tem prazo longo e vale no site todo", () => {
    const c = middleware(req("/rampa-do-pepe")).cookies.get(COOKIE_ULTIMA);
    expect(c?.path).toBe("/");
    expect(c?.maxAge).toBeGreaterThan(60 * 60 * 24 * 30);
  });
});
