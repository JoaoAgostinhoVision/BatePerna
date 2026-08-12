import { describe, expect, it } from "vitest";
import { ehCaminhoDeFicha } from "@/lib/despacho";

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

  it("ehCaminhoDeFicha sobrevive: é o service worker que depende dela", () => {
    expect(ehCaminhoDeFicha("/rampa-do-pepe")).toBe(true);
    expect(ehCaminhoDeFicha("/trilhas")).toBe(false);
    expect(ehCaminhoDeFicha("/")).toBe(false);
  });

  it("o cookie da última ficha não existe mais em lugar nenhum do módulo", async () => {
    const mod = await import("@/lib/despacho");
    expect("COOKIE_ULTIMA" in mod).toBe(false);
    expect("destinoDe" in mod).toBe(false);
  });
});
