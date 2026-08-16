import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lerLugares, urlBusca } from "@/lib/lugares";

const bruto = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "fixtures", "geocoding-gravata.json"), "utf8"),
);

describe("urlBusca", () => {
  it("escapa o que a pessoa digitou", () => {
    expect(urlBusca("São José")).toContain("name=S%C3%A3o+Jos%C3%A9");
  });
  it("pede em português", () => {
    expect(urlBusca("Recife")).toContain("language=pt");
  });
  it("pede cinco resultados — o bastante pra desambiguar homônimo", () => {
    expect(urlBusca("Gravatá")).toContain("count=5");
  });
});

describe("lerLugares: sobre a resposta REAL do serviço", () => {
  it("o primeiro resultado de 'Gravatá' vem com nome, região e coordenada", () => {
    const [primeiro] = lerLugares(bruto);
    expect(primeiro.nome).toBe("Gravatá");
    expect(primeiro.regiao).toBe("Pernambuco");
    expect(typeof primeiro.lat).toBe("number");
    expect(typeof primeiro.lng).toBe("number");
  });

  // A resposta real traz Gravatal/SC e um Novo Cruzeiro/MG junto. Sem a
  // região na tela, o dedo acerta o lugar errado e todo km da home fica errado.
  it("traz mais de um resultado, e cada um com sua região", () => {
    const lista = lerLugares(bruto);
    expect(lista.length).toBeGreaterThan(1);
    for (const l of lista) expect(l.regiao.length).toBeGreaterThan(0);
  });

  it("busca sem resultado devolve lista vazia, não estoura", () => {
    expect(lerLugares({})).toEqual([]);
    expect(lerLugares({ results: [] })).toEqual([]);
  });

  it("item sem coordenada é descartado, não vira NaN na tela", () => {
    const lista = lerLugares({ results: [{ name: "X", admin1: "Y", country: "Z" }] });
    expect(lista).toEqual([]);
  });

  it("item sem região ainda serve — vira string vazia, não 'undefined'", () => {
    const lista = lerLugares({
      results: [{ name: "X", country: "Brasil", latitude: -8, longitude: -35 }],
    });
    expect(lista[0].regiao).toBe("");
  });

  it("resposta que não é objeto não derruba a rota", () => {
    expect(lerLugares(null)).toEqual([]);
    expect(lerLugares("erro")).toEqual([]);
  });

  // ——— daqui pra baixo, o pré-voo desta task. O `if` de descarte em
  // `lerLugares` é um OU de CINCO sub-cláusulas, e num OU a primeira que
  // dispara esconde as outras: o teste "item sem coordenada" acima manda um
  // item SEM latitude E SEM longitude, então a cláusula da latitude morde
  // primeiro e as quatro seguintes podiam ser apagadas com a suíte verde.
  // Um item por sub-cláusula, cada um faltando SÓ uma coisa.

  it("item sem nome é descartado", () => {
    expect(lerLugares({ results: [{ admin1: "Y", country: "Z", latitude: -8, longitude: -35 }] }))
      .toEqual([]);
  });

  it("item sem longitude é descartado — não só sem latitude", () => {
    expect(lerLugares({ results: [{ name: "X", country: "Z", latitude: -8 }] })).toEqual([]);
  });

  // `typeof NaN === "number"`, então a checagem de tipo deixa NaN passar e só
  // o Number.isFinite o pega. É o caso que o comentário da implementação
  // promete tratar ("todo km da home sai NaN, sem erro nenhum, só números
  // sumindo da tela") — e é justamente o que nenhum teste cobria.
  it("latitude NaN é descartada — o typeof sozinho deixa passar", () => {
    expect(lerLugares({ results: [{ name: "X", country: "Z", latitude: NaN, longitude: -35 }] }))
      .toEqual([]);
  });

  it("longitude infinita é descartada", () => {
    expect(lerLugares({ results: [{ name: "X", country: "Z", latitude: -8, longitude: Infinity }] }))
      .toEqual([]);
  });

  it("item sem país ainda serve — vira string vazia, não 'undefined'", () => {
    const [l] = lerLugares({ results: [{ name: "X", latitude: -8, longitude: -35 }] });
    expect(l.pais).toBe("");
  });

  // Os bons passam: sem isto, um `lerLugares` que devolvesse sempre `[]`
  // passaria em todos os testes de descarte acima.
  it("item completo passa inteiro", () => {
    expect(lerLugares({
      results: [{ name: "X", admin1: "Y", country: "Z", latitude: -8, longitude: -35 }],
    })).toEqual([{ nome: "X", regiao: "Y", pais: "Z", lat: -8, lng: -35 }]);
  });
});
