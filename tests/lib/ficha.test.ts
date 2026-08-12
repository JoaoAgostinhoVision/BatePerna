import { describe, expect, it } from "vitest";
import { getFicha, getAllFichas, getFichasComCondicao } from "@/lib/ficha";

describe("ficha loader", () => {
  it("loads and validates the real Rampa do Pepê ficha", () => {
    const f = getFicha("rampa-do-pepe");
    expect(f).not.toBeNull();
    expect(f!.slug).toBe("rampa-do-pepe");
    expect(f!.modos).toContain("condicional");
    expect(f!.condicao.regra.tipo).toBe("chuva_binaria");
    expect(typeof f!.condicao.coords.lat).toBe("number");
    expect(f!.trajeto.waypoints.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown slug", () => {
    expect(getFicha("nao-existe")).toBeNull();
  });

  it("lists all fichas and those with condicao", () => {
    expect(getAllFichas().length).toBeGreaterThan(0);
    expect(getFichasComCondicao().every((f) => f.condicao != null)).toBe(true);
  });

  it("as fichas saem ordenadas por nome, não pela ordem do sistema de arquivos", () => {
    const nomes = getAllFichas().map((f) => f.trajeto.waypoints[0].nome);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });
});
