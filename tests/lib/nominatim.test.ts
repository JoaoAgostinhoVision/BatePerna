import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  achadosDaResposta,
  chaveDaBusca,
  chaveDoPonto,
  municipioDaResposta,
  pontoArredondado,
  urlBuscaNoMapa,
  urlCidadeDoPonto,
} from "@/lib/nominatim";

const fx = (nome: string): unknown => JSON.parse(readFileSync(`tests/fixtures/${nome}.json`, "utf8"));
const PE = "Lugar Marcador PE";
const SC = "Lugar Marcador SC";
const BA = "Lugar Marcador BA";

describe("o reverse lê o município", () => {
  it("o reverse lê o município: town", () => expect(municipioDaResposta(fx("nominatim-reverso-town"))).toBe("Cidade Marcador Um"));
  it("municipality ganha de village (o povoado não é o município)", () =>
    expect(municipioDaResposta(fx("nominatim-reverso-municipality"))).toBe("Cidade Marcador Dois"));
  it("só village também serve", () => expect(municipioDaResposta(fx("nominatim-reverso-village"))).toBe("Cidade Marcador Três"));
  it("o mar não tem município", () => expect(municipioDaResposta(fx("nominatim-reverso-mar"))).toBeNull());
  it("município só de espaços é nenhum", () => expect(municipioDaResposta({ address: { town: "  " } })).toBeNull());
  it("lixo não estoura", () => {
    expect(municipioDaResposta(null)).toBeNull();
    expect(municipioDaResposta("x")).toBeNull();
    expect(municipioDaResposta({ address: 3 })).toBeNull();
  });
  it("city vale e vem antes de town", () =>
    expect(municipioDaResposta({ address: { town: "Cidade Marcador B", city: "Cidade Marcador A" } })).toBe("Cidade Marcador A"));
});

describe("a busca", () => {
  it("Pernambuco primeiro, sem tirar os outros, na ordem estável", () => {
    const a = achadosDaResposta(fx("nominatim-busca")); // SC, PE, BA
    expect(a.map((x) => x.nome)).toEqual([PE, SC, BA]);
    expect(a[0]).toEqual({ nome: PE, lat: -8.1, lng: -35.2 });
  });
  it("item sem coordenada finita ou sem nome sai", () => {
    const a = achadosDaResposta([
      { display_name: "Lugar Marcador A", lat: "x", lon: "-35" },
      { display_name: "Lugar Marcador B", lat: "-8", lon: null },
      { display_name: "  ", lat: "-8", lon: "-35" },
      { lat: "-8", lon: "-35" },
      { display_name: "Lugar Marcador C", lat: -8, lon: "-35.5" },
    ]);
    expect(a).toEqual([{ nome: "Lugar Marcador C", lat: -8, lng: -35.5 }]);
  });
  it("o que não é lista é lista vazia", () => expect(achadosDaResposta({ error: "x" })).toEqual([]));
});

describe("as URLs e as chaves", () => {
  it("as URLs: jsonv2, Brasil, sem pedir mais do que 10, zoom 10 no reverse, ponto arredondado", () => {
    const b = new URL(urlBuscaNoMapa("  Lugar  Marcador "));
    expect(b.origin + b.pathname).toBe("https://nominatim.openstreetmap.org/search");
    expect(Object.fromEntries(b.searchParams)).toEqual({ q: "Lugar  Marcador", countrycodes: "br", format: "jsonv2", limit: "10", addressdetails: "1" });
    const r = new URL(urlCidadeDoPonto(-8.123456, -35.987654));
    expect(r.origin + r.pathname).toBe("https://nominatim.openstreetmap.org/reverse");
    expect(Object.fromEntries(r.searchParams)).toEqual({ lat: "-8.1235", lon: "-35.9877", format: "jsonv2", zoom: "10" });
  });
  it("a chave: caixa e espaço não contam; acento conta", () => {
    expect(chaveDaBusca(" Lugar   MARCADOR ")).toBe(chaveDaBusca("lugar marcador"));
    expect(chaveDaBusca("lugar marcador")).not.toBe(chaveDaBusca("lugár marcador"));
    expect(chaveDaBusca("lugar marcador")).toBe("busca:lugar marcador");
    expect(chaveDoPonto(-8.12341, -35.1)).toBe(chaveDoPonto(-8.12344, -35.10002));
    expect(chaveDoPonto(-8.1, -35.2)).toBe("ponto:-8.1,-35.2");
  });
  it("o ponto arredondado tem 4 casas", () => expect(pontoArredondado(-8.123456, -35.987654)).toEqual({ lat: -8.1235, lng: -35.9877 }));
});
