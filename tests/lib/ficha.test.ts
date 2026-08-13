import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getFicha, getAllFichas, getFichasComCondicao, loadAll, ordenarPorNome } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";

// Ficha mínima e sintética — só o que ordenarPorNome lê (o nome do primeiro
// waypoint). O resto do schema não importa pra este teste, e não depende do
// que existe em content/fichas (que é conteúdo real do projeto, não fixture).
function fichaComNome(nome: string): Ficha {
  return {
    slug: nome.toLowerCase(),
    modos: [],
    rotulo_escaneio: "",
    promessa: "",
    voz: "",
    premio: "",
    trajeto: { waypoints: [{ nome, lat: 0, lng: 0 }] },
    acesso: "",
    avisos: "",
    condicao: {
      coords: { lat: 0, lng: 0 },
      regra: { tipo: "chuva_binaria", janela_previsao_horas: 0, janela_passado_horas: 0, limiar_mm: 0 },
      regra_texto: "",
      ressalva_proxy: "",
    },
    discriminador: { formato: "", como_ler: "", permissao_abortar: "" },
    custo: { tag: "gratis" },
  };
}

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

  it("ordenarPorNome ordena de verdade — inclusive acento, que localeCompare pt-BR resolve", () => {
    // Fora de ordem de propósito, e com "Ávila" testando que o acento não vira
    // bagunça: comparação de bytes puta colocaria "Boa Vista" antes de "Ávila"
    // (o 'Á' tem code point maior que 'B' em UTF-16), localeCompare("pt-BR") não.
    const fora_de_ordem = [
      fichaComNome("Cachoeira do Urubu"),
      fichaComNome("Boa Vista"),
      fichaComNome("Ávila"),
    ];
    const nomes = ordenarPorNome(fora_de_ordem).map((f) => f.trajeto.waypoints[0].nome);
    expect(nomes).toEqual(["Ávila", "Boa Vista", "Cachoeira do Urubu"]);
  });
});

// JSON bruto (não Ficha já validada) — precisa ser o que fs.readFileSync +
// JSON.parse produziria, pra exercitar loadAll de ponta a ponta (leitura de
// diretório + parse + checagem de slug), não só a validação do schema.
function fichaJSON(slug: string, nome = slug): unknown {
  return {
    slug,
    modos: [],
    rotulo_escaneio: "",
    promessa: "",
    voz: "",
    premio: "",
    trajeto: { waypoints: [{ nome, lat: 0, lng: 0 }] },
    acesso: "",
    avisos: "",
    condicao: {
      coords: { lat: 0, lng: 0 },
      regra: { tipo: "chuva_binaria", janela_previsao_horas: 0, janela_passado_horas: 0, limiar_mm: 0 },
      regra_texto: "",
      ressalva_proxy: "",
    },
    discriminador: { formato: "", como_ler: "", permissao_abortar: "" },
    custo: { tag: "gratis" },
  };
}

/** Diretório sintético descartável — nunca content/fichas, que é conteúdo
 *  real do dono do projeto, não fixture de teste. */
function dirSintetico(arquivos: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-fichas-teste-"));
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    fs.writeFileSync(path.join(dir, nome), JSON.stringify(conteudo));
  }
  return dir;
}

describe("loadAll: slug repetido não pode divergir entre telas", () => {
  it("dois JSONs com o mesmo slug estouram, citando o slug e os dois arquivos", () => {
    const dir = dirSintetico({
      "a-arquivo.json": fichaJSON("morro-x", "Morro X (versão A)"),
      "b-arquivo.json": fichaJSON("morro-x", "Morro X (versão B)"),
    });

    expect(() => loadAll(dir)).toThrow(/morro-x/);
    expect(() => loadAll(dir)).toThrow(/a-arquivo\.json/);
    expect(() => loadAll(dir)).toThrow(/b-arquivo\.json/);
  });

  it("o caminho normal — slugs distintos — continua carregando", () => {
    const dir = dirSintetico({
      "a.json": fichaJSON("morro-a", "Morro A"),
      "b.json": fichaJSON("morro-b", "Morro B"),
    });

    expect(loadAll(dir).map((f) => f.slug)).toEqual(["morro-a", "morro-b"]);
  });
});
