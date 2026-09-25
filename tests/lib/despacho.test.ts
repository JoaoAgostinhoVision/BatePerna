import { describe, expect, it } from "vitest";
import { ehCaminhoDeFicha } from "@/lib/despacho";
import { ehNavegacaoNossa } from "@/lib/cache-rotas";

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

  // 🔴 O DEFEITO QUE ISTO TRANCA, achado no levantamento de 2026-09-13 e nunca
  // chegou ao ar. `/admin` é um segmento, sem ponto — então `ehCaminhoDeFicha`
  // o aprovava, e `ehNavegacaoNossa` junto. O service worker trataria o PAINEL
  // DE ADMIN como ficha: guardaria em CACHE_ULTIMA_FICHA **e sob CHAVE_ULTIMA**,
  // o ponteiro da última ficha aberta. Abrir o app sem rede cairia no painel de
  // admin em vez da home.
  //
  // O próprio RESERVADOS já avisava: "Se nascer outra, entra aqui."
  it("o painel de admin NAO e ficha — senao o service worker o guarda offline", () => {
    expect(ehCaminhoDeFicha("/admin")).toBe(false);
    expect(ehNavegacaoNossa("/admin")).toBe(false);
  });
});
