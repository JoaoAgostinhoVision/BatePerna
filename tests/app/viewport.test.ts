import { describe, expect, it } from "vitest";
import { viewport } from "@/app/layout";

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
