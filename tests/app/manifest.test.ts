import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { TAMANHOS } from "@/lib/marca";
import { generateStaticParams } from "@/app/icones/[nome]/route";

describe("manifest", () => {
  const m = manifest();

  it("abre em tela cheia — é o que tira a barra de URL", () => {
    expect(m.display).toBe("standalone");
  });

  it("o ícone abre na raiz, que é o despachante da última ficha", () => {
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
  });

  it("tem ícone maskable — o Android recorta em círculo e exige um", () => {
    const maskable = (m.icons ?? []).filter((i) => i.purpose === "maskable");
    expect(maskable.length).toBeGreaterThan(0);
  });

  it("tem ícone de 512 pra tela de abertura", () => {
    expect((m.icons ?? []).some((i) => i.sizes === "512x512")).toBe(true);
  });

  it("todo ícone citado é de fato gerado no build", () => {
    const gerados = new Set(generateStaticParams().map((p) => `/icones/${p.nome}`));
    for (const icone of m.icons ?? []) {
      expect(gerados, `${icone.src} não é gerado por generateStaticParams`).toContain(icone.src);
    }
  });

  it("gera exatamente os tamanhos declarados em marca.ts", () => {
    expect(generateStaticParams().map((p) => p.nome).sort()).toEqual(Object.keys(TAMANHOS).sort());
  });
});
