import { describe, expect, it } from "vitest";
import { metadata, viewport } from "@/app/layout";

describe("viewport", () => {
  it("cobre o entalhe — sem isso o topo da ficha some debaixo do relógio", () => {
    expect(viewport.viewportFit).toBe("cover");
  });

  it("tem theme-color nos dois temas: a barra de status acompanha a ficha", () => {
    const cores = viewport.themeColor;
    expect(Array.isArray(cores)).toBe(true);
    const midias = (cores as { media: string; color: string }[]).map((c) => c.media);
    expect(midias).toContain("(prefers-color-scheme: light)");
    expect(midias).toContain("(prefers-color-scheme: dark)");
  });

  it("as cores são os mesmos --ground do ficha.css", () => {
    const cores = viewport.themeColor as { media: string; color: string }[];
    const porMidia = Object.fromEntries(cores.map((c) => [c.media, c.color.toUpperCase()]));
    expect(porMidia["(prefers-color-scheme: light)"]).toBe("#E7DFD0");
    expect(porMidia["(prefers-color-scheme: dark)"]).toBe("#100D08");
  });
});

describe("metadata do app instalado", () => {
  it("declara capable — o iPhone é o aparelho-alvo", () => {
    // O manifest sozinho não é garantia em toda versão de iOS. Sem esta meta o
    // ícone da tela inicial pode abrir dentro do Safari, com barra de URL — e
    // aí a moldura de app inteira desta branch não aparece.
    expect(metadata.appleWebApp).toMatchObject({ capable: true });
  });

  it("também emite a tag antiga com prefixo apple- , pra iOS anterior ao 17.4", () => {
    // O Next 15 traduz `capable` pra `mobile-web-app-capable`, a tag padrão, que
    // o WebKit só passou a ler no 17.4. Provado lendo o HTML do build.
    expect(metadata.other).toMatchObject({ "apple-mobile-web-app-capable": "yes" });
  });

  it("não pede barra de status translúcida", () => {
    // black-translucent joga a ficha por baixo do relógio e força texto claro
    // sobre o creme #E7DFD0 do tema claro. A barra opaca é a que se lê.
    const apple = metadata.appleWebApp as { statusBarStyle?: string };
    expect(apple.statusBarStyle).not.toBe("black-translucent");
  });
});
