import { describe, expect, it } from "vitest";
import { COOKIE_ULTIMA, destinoDe, ehCaminhoDeFicha } from "@/lib/despacho";

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

describe("ehCaminhoDeFicha", () => {
  it("reconhece um slug de um segmento só", () => {
    expect(ehCaminhoDeFicha("/rampa-do-pepe")).toBe(true);
  });

  it("não confunde a lista com uma ficha", () => {
    expect(ehCaminhoDeFicha("/trilhas")).toBe(false);
  });

  it("não confunde a raiz com uma ficha", () => {
    expect(ehCaminhoDeFicha("/")).toBe(false);
  });

  it("ignora rotas de mais de um segmento", () => {
    expect(ehCaminhoDeFicha("/api/confirmar")).toBe(false);
    expect(ehCaminhoDeFicha("/icones/512")).toBe(false);
  });

  it("ignora arquivo com extensão", () => {
    expect(ehCaminhoDeFicha("/favicon.ico")).toBe(false);
    expect(ehCaminhoDeFicha("/sw.js")).toBe(false);
    expect(ehCaminhoDeFicha("/manifest.webmanifest")).toBe(false);
  });
});
