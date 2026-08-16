import fs, { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatarDuracao,
  getFicha,
  getAllFichas,
  getFichasComCondicao,
  loadAll,
  ordenarPorNome,
} from "@/lib/ficha";
import { fichaSchema } from "@/types/ficha";
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

describe("esforço e duração", () => {
  const base = JSON.parse(readFileSync(
    path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"), "utf8"));

  it("são opcionais — a ficha que existe hoje não os tem e tem que carregar", () => {
    expect(() => fichaSchema.parse(base)).not.toThrow();
  });

  it("aceita os três esforços", () => {
    for (const e of ["leve", "media", "puxada"]) {
      expect(() => fichaSchema.parse({ ...base, esforco: e })).not.toThrow();
    }
  });

  it("recusa esforço inventado — o filtro compara contra estes três e mais nenhum", () => {
    expect(() => fichaSchema.parse({ ...base, esforco: "moderada" })).toThrow();
  });

  // Minutos, não texto: o filtro compara número. "1h30" obrigaria a
  // interpretar português na hora de filtrar.
  it("duração é número de minutos, positivo", () => {
    expect(() => fichaSchema.parse({ ...base, duracao: 90 })).not.toThrow();
    expect(() => fichaSchema.parse({ ...base, duracao: "1h30" })).toThrow();
    expect(() => fichaSchema.parse({ ...base, duracao: 0 })).toThrow();
    expect(() => fichaSchema.parse({ ...base, duracao: -30 })).toThrow();
  });

  // ——— os dois abaixo vieram do pré-voo desta task.

  // O `.int()` não tinha prova: 90, "1h30", 0 e -30 são pegos por `z.number()`
  // e `.positive()`, então apagar `.int()` deixava a suíte verde. E meia hora
  // vira 30 na tela, mas 90,5 minutos viraria "90,5 min" — número quebrado
  // numa linha que a pessoa lê de relance no portão.
  it("duração fracionada é recusada — minuto quebrado não existe pra quem lê", () => {
    expect(() => fichaSchema.parse({ ...base, duracao: 90.5 })).toThrow();
  });

  // TODOS os testes acima usam `not.toThrow()` / `toThrow()`, e NENHUM olha o
  // que sai do parse. Isso importa porque o Zod, por padrão, DESCARTA chave
  // desconhecida em silêncio em vez de reclamar: se alguém escrever o campo
  // errado no schema (ou esquecê-lo), `parse({...base, esforco: "leve"})`
  // continua não estourando — só devolve um objeto sem `esforco`. E é o valor
  // que sai daqui que a Task 7 vai ler pra desenhar a linha do cartão.
  it("os dois campos SOBREVIVEM ao parse — não basta não estourar", () => {
    const lido = fichaSchema.parse({ ...base, esforco: "puxada", duracao: 90 });
    expect(lido.esforco).toBe("puxada");
    expect(lido.duracao).toBe(90);
  });
});

describe("formatarDuracao: a linha do cartão", () => {
  it("abaixo de uma hora, em minutos", () => {
    expect(formatarDuracao(45)).toBe("~45min");
  });
  it("hora cheia não mostra minuto zero", () => {
    expect(formatarDuracao(60)).toBe("~1h");
    expect(formatarDuracao(120)).toBe("~2h");
  });
  it("hora e minuto", () => {
    expect(formatarDuracao(90)).toBe("~1h30");
  });
  // Duas casas: "~2h5" se lê como 2h5min ou 2h50? O zero à esquerda desfaz.
  it("minuto de um dígito ganha zero à esquerda", () => {
    expect(formatarDuracao(125)).toBe("~2h05");
  });
});

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
