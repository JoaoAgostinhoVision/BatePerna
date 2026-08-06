import { describe, expect, it } from "vitest";
import { COOKIE_ULTIMA, destinoDe } from "@/lib/despacho";

const EXISTENTES = ["rampa-do-pepe", "monte-das-tabocas"];

describe("destinoDe", () => {
  it("manda pra última ficha quando ela ainda existe", () => {
    expect(destinoDe("rampa-do-pepe", EXISTENTES)).toBe("/rampa-do-pepe");
  });

  it("manda pra lista quando não há cookie", () => {
    expect(destinoDe(undefined, EXISTENTES)).toBe("/trilhas");
  });

  it("manda pra lista quando o cookie aponta pra ficha que não existe mais", () => {
    expect(destinoDe("ficha-apagada", EXISTENTES)).toBe("/trilhas");
  });

  it("manda pra lista quando não existe ficha nenhuma", () => {
    expect(destinoDe("rampa-do-pepe", [])).toBe("/trilhas");
  });
});

describe("COOKIE_ULTIMA", () => {
  it("não usa dois-pontos — é separador na RFC 6265 e não vale em nome de cookie", () => {
    expect(COOKIE_ULTIMA).not.toContain(":");
    expect(COOKIE_ULTIMA).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
