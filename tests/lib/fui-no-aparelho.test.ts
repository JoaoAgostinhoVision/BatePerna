import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAVE_FUI, MAX_FUIS, anotarFui, esquecerFuis, lerFuis } from "@/lib/fui-no-aparelho";

/** O "✓ FUI" ANOTADO NO APARELHO (25/10, desenho aprovado pelo João): a ficha é
 *  pública e sem login, então o aparelho guarda ONDE e QUANDO ela tocou "Fui";
 *  a área dela, logada, leva isso pra conta (`/api/contribuir/fui`). */
beforeEach(() => localStorage.clear());
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe("a lista do aparelho", () => {
  it("anota com a identidade do lugar e devolve na ordem", () => {
    anotarFui({ slug: "a", lugar: 7, em: 1000 });
    anotarFui({ slug: "b", em: 2000 });
    expect(lerFuis()).toEqual([{ slug: "a", lugar: 7, em: 1000 }, { slug: "b", em: 2000 }]);
  });

  it("o mesmo lugar no mesmo dia não repete: fica uma anotação, com a hora mais nova", () => {
    anotarFui({ slug: "a", lugar: 7, em: 1000 });
    anotarFui({ slug: "a", lugar: 7, em: 5000 });
    expect(lerFuis()).toEqual([{ slug: "a", lugar: 7, em: 5000 }]);
  });

  it("esquecer tira só as que subiram", () => {
    anotarFui({ slug: "a", lugar: 7, em: 1000 });
    anotarFui({ slug: "b", lugar: 8, em: 2000 });
    esquecerFuis([{ slug: "a", lugar: 7, em: 1000 }]);
    expect(lerFuis()).toEqual([{ slug: "b", lugar: 8, em: 2000 }]);
  });

  it(`tem teto: guarda as ${MAX_FUIS} mais novas`, () => {
    for (let i = 0; i < MAX_FUIS + 5; i++) anotarFui({ slug: `s${i}`, lugar: i + 1, em: i });
    const l = lerFuis();
    expect(l).toHaveLength(MAX_FUIS);
    expect(l[0].em).toBe(5);
  });

  it("lixo no aparelho vira lista vazia, e anotação torta é ignorada", () => {
    localStorage.setItem(CHAVE_FUI, "{não é json");
    expect(lerFuis()).toEqual([]);
    localStorage.setItem(CHAVE_FUI, JSON.stringify([{ slug: "a", em: "x" }, { slug: 3, em: 1 }, { slug: "ok", em: 9 }]));
    expect(lerFuis()).toEqual([{ slug: "ok", em: 9 }]);
  });

  it("aparelho que nega o armazenamento não quebra", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("cheio"); });
    expect(() => anotarFui({ slug: "a", em: 1 })).not.toThrow();
  });
});
