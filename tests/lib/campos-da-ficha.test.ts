import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CAMPOS_DA_FICHA, camposDaFicha, campoPorCaminho } from "@/lib/campos-da-ficha";
import { loadAll } from "@/lib/ficha";
import { DIAS } from "@/lib/semana";
import { PISOS } from "@/lib/piso";
import { SEVERIDADES } from "@/lib/severidade";
import { fichaSchema, type Ficha } from "@/types/ficha";

// 🔴 O GUARDA DESTA TAREFA, e a razão de o registro existir em vez de um `if`.
// Três vezes neste projeto uma lista escrita à mão ficou cega ao que cresceu.
// Aqui o registro é comparado contra a FONTE (o schema), não contra outra
// lista minha: campo novo no schema nasce editável ou nasce justificado.
//
// 🔴 E A VARREDURA VAI ATÉ A FOLHA, não até o 1º nível. Um guarda de 1º nível
// não veria `condicao.regra` ganhar um parâmetro novo nem `custo` ganhar uma
// chave — o campo nasceria invisível no painel com o teste VERDE, que é
// exatamente a espécie de defeito que este arquivo existe pra fechar.
//
// Se a varredura acusar um campo, a saída é ACRESCENTAR o caminho aqui com o
// motivo escrito. Nunca afrouxar a varredura.
const FORA_DE_PROPOSITO = new Set([
  "slug", // é o endereço do lugar: trocar quebra link, cache offline e 247 referências de teste
  "modos", // campo morto — uma única ocorrência em todo o `src/`, a linha que o declara
  "condicao.regra.tipo", // é `z.literal("chuva_binaria")`: não tem segundo valor pra escolher
]);

// Uma entrada do registro que NÃO é folha do schema: ela edita o SUBGALHO
// inteiro de uma vez. Só o mapa faz isso, e por desenho — o pin arrastado
// devolve o par, nunca uma metade. O valor é o conjunto EXATO de folhas que a
// entrada engole: se o schema ganhar uma terceira folha ali dentro (altitude,
// precisão), este teste fica vermelho em vez de a folha nova nascer invisível.
const EDITADOS_INTEIROS = new Map<string, readonly string[]>([["condicao.coords", ["lat", "lng"]]]);

type DefZod = {
  typeName: string;
  innerType?: z.ZodTypeAny;
  type?: z.ZodTypeAny;
  shape?: () => Record<string, z.ZodTypeAny>;
};

function def(tipo: z.ZodTypeAny): DefZod {
  return tipo._def as unknown as DefZod;
}

function desembrulhar(tipo: z.ZodTypeAny): z.ZodTypeAny {
  const d = def(tipo);
  if (d.typeName === "ZodOptional" || d.typeName === "ZodNullable" || d.typeName === "ZodDefault") {
    return desembrulhar(d.innerType as z.ZodTypeAny);
  }
  return tipo;
}

/** Caminha o schema até as FOLHAS e devolve os caminhos.
 *
 *  Lista DE OBJETO vira molde (`trajeto.waypoints[].nome`), porque cada item
 *  tem campos próprios. Lista de escalar (`dias`, `modos`) é UMA folha só — a
 *  lista inteira é o campo, e quem a edita escolhe o conjunto de uma vez. */
function folhasDoSchema(tipo: z.ZodTypeAny, prefixo: string, saida: string[]): string[] {
  const nu = desembrulhar(tipo);
  const d = def(nu);
  if (d.typeName === "ZodObject") {
    for (const [chave, filho] of Object.entries(d.shape!())) {
      folhasDoSchema(filho, prefixo === "" ? chave : `${prefixo}.${chave}`, saida);
    }
    return saida;
  }
  if (d.typeName === "ZodArray") {
    const dentro = desembrulhar(d.type as z.ZodTypeAny);
    if (def(dentro).typeName === "ZodObject") return folhasDoSchema(dentro, `${prefixo}[]`, saida);
    saida.push(prefixo);
    return saida;
  }
  saida.push(prefixo);
  return saida;
}

const FOLHAS = folhasDoSchema(fichaSchema, "", []);
const NO_REGISTRO = new Set(CAMPOS_DA_FICHA.map((c) => c.caminho));

function engolidaPorEntradaInteira(folha: string): boolean {
  for (const raiz of EDITADOS_INTEIROS.keys()) if (folha.startsWith(`${raiz}.`)) return true;
  return false;
}

describe("a varredura do schema, antes de ela guardar coisa nenhuma", () => {
  // 🔴 CONTROLE DE NÃO-VACUIDADE. Um varredor que devolve pouco deixa todos os
  // guardas abaixo passarem ocos — foi assim que uma tira de comentários cegou
  // uma varredura deste projeto em 25/09 e o controle de então não acusou
  // porque media UM arquivo, não o ENUMERADOR. Aqui o enumerador é medido:
  // quantas folhas, e algumas nomeadas em cada profundidade.
  it("acha as folhas em TODA profundidade, não só o 1º nível", () => {
    expect(FOLHAS).toContain("voz"); // 1º nível
    expect(FOLHAS).toContain("custo.curto"); // 2º
    expect(FOLHAS).toContain("condicao.regra.limiar_mm"); // 3º
    expect(FOLHAS).toContain("condicao.coords.lat"); // 3º, dentro de um objeto sem nome de bloco
    expect(FOLHAS).toContain("trajeto.waypoints[].nota"); // dentro de lista de objeto
    expect(FOLHAS).toContain("dias"); // lista de escalar é UMA folha, não `dias[]`
    expect(FOLHAS).not.toContain("condicao"); // nó interno não é folha
    expect(FOLHAS).not.toContain("trajeto.waypoints"); // idem
    expect(FOLHAS).toHaveLength(33);
  });

  it("nenhuma folha repetida, e nenhuma vazia", () => {
    expect(new Set(FOLHAS).size).toBe(FOLHAS.length);
    expect(FOLHAS.filter((f) => f === "")).toEqual([]);
  });
});

describe("o registro cobre o schema", () => {
  it("toda FOLHA do fichaSchema está no registro ou na lista de exceções", () => {
    const descobertas = FOLHAS.filter(
      (f) => !NO_REGISTRO.has(f) && !FORA_DE_PROPOSITO.has(f) && !engolidaPorEntradaInteira(f),
    );
    expect(
      descobertas,
      "campo no schema e fora do painel: ou entra no registro, ou entra em " +
        "FORA_DE_PROPOSITO com o motivo escrito na spec §2.1",
    ).toEqual([]);
  });

  it("nenhuma exceção é fantasma — tudo em FORA_DE_PROPOSITO é folha do schema", () => {
    const folhas = new Set(FOLHAS);
    expect([...FORA_DE_PROPOSITO].filter((k) => !folhas.has(k))).toEqual([]);
  });

  // 🔴 M5 DO PLANO DE MUTAÇÃO. Acrescentar `piso` a FORA_DE_PROPOSITO não é
  // pego pelo teste de cima (`piso` É folha do schema) nem pelo de cobertura
  // (a exceção cobre a folha). Quem mata é este: exceção e registro são
  // DISJUNTOS — um campo é editável ou é justificado, nunca os dois.
  it("nenhuma exceção está TAMBÉM no registro", () => {
    const nos_dois = [...FORA_DE_PROPOSITO].filter((k) => NO_REGISTRO.has(k) || engolidaPorEntradaInteira(k));
    expect(nos_dois, "campo justificado como fora do painel e editável ao mesmo tempo").toEqual([]);
  });

  it("nenhuma entrada do registro é fantasma — ou é folha do schema, ou é entrada-inteira declarada", () => {
    const folhas = new Set(FOLHAS);
    const fantasmas = CAMPOS_DA_FICHA.map((c) => c.caminho).filter(
      (p) => !folhas.has(p) && !EDITADOS_INTEIROS.has(p),
    );
    expect(fantasmas, "entrada do registro que não corresponde a nada no schema").toEqual([]);
  });

  it("toda entrada-inteira engole EXATAMENTE as folhas declaradas, e é do mapa", () => {
    for (const [raiz, esperadas] of EDITADOS_INTEIROS) {
      const dentro = FOLHAS.filter((f) => f.startsWith(`${raiz}.`)).map((f) => f.slice(raiz.length + 1));
      expect(dentro.sort(), raiz).toEqual([...esperadas].sort());
      expect(campoPorCaminho(raiz)?.especie, raiz).toBe("coord");
    }
  });

  it("o registro não está vazio nem é só a voz — senão os guardas acima passam ocos", () => {
    expect(CAMPOS_DA_FICHA.length).toBeGreaterThan(12);
    expect(new Set(CAMPOS_DA_FICHA.map((c) => c.especie)).size).toBeGreaterThan(4);
    expect(new Set(CAMPOS_DA_FICHA.map((c) => c.grupo)).size).toBe(6);
  });

  it("nenhum caminho repetido no registro", () => {
    expect(NO_REGISTRO.size).toBe(CAMPOS_DA_FICHA.length);
  });

  it("toda lista fechada declara opções, e nenhuma outra espécie declara", () => {
    for (const c of CAMPOS_DA_FICHA) {
      if (c.especie === "lista") expect(c.opcoes, c.caminho).toBeDefined();
      else expect(c.opcoes, c.caminho).toBeUndefined();
    }
  });

  // 🔴 As opções vêm dos módulos que já existem, nunca de uma cópia repetida
  // no registro — mesma régua que o `z.enum(PISOS)` do schema já segue.
  it("as listas fechadas usam as constantes do código, não uma cópia", () => {
    expect(campoPorCaminho("piso")?.opcoes).toBe(PISOS);
    expect(campoPorCaminho("dias")?.opcoes).toBe(DIAS);
    expect(campoPorCaminho("condicao.severidade")?.opcoes).toBe(SEVERIDADES);
  });

  it("campoPorCaminho acha o que existe e devolve undefined pro que não", () => {
    expect(campoPorCaminho("voz")?.especie).toBe("prosa");
    expect(campoPorCaminho("custo.valor")?.especie).toBe("prosa");
    expect(campoPorCaminho("piso")?.opcoes).toContain("barro");
    expect(campoPorCaminho("slug")).toBeUndefined();
    expect(campoPorCaminho("modos")).toBeUndefined();
    expect(campoPorCaminho("condicao.regra.tipo")).toBeUndefined();
    expect(campoPorCaminho("inventado")).toBeUndefined();
  });

  // 🔴 `piso` DEIXOU DE SER A ISCA de "campo fora da lista editável" nesta
  // tarefa — ele é editável agora. Quem guarda essa trava é o `slug`.
  it("piso é editável, e slug não", () => {
    expect(campoPorCaminho("piso")).toBeDefined();
    expect(campoPorCaminho("slug")).toBeUndefined();
  });
});

describe("campoPorCaminho resolve o waypoint pelo MOLDE", () => {
  it("qualquer índice cai na mesma entrada", () => {
    expect(campoPorCaminho("trajeto.waypoints.0.nome")?.especie).toBe("prosa");
    expect(campoPorCaminho("trajeto.waypoints.2.nome")?.caminho).toBe("trajeto.waypoints[].nome");
    expect(campoPorCaminho("trajeto.waypoints.17.lat")?.especie).toBe("coord");
    expect(campoPorCaminho("trajeto.waypoints.0.nota")?.obrigatorio).toBe(false);
    expect(campoPorCaminho("trajeto.waypoints.0.nome")?.obrigatorio).toBe(true);
  });

  it("campo que não existe no waypoint continua fora", () => {
    expect(campoPorCaminho("trajeto.waypoints.0.altitude")).toBeUndefined();
  });

  // 🔴 O registro NÃO pode listar `trajeto.waypoints.7.nome` cravado: quantos
  // waypoints uma ficha tem é DADO, não código.
  it("o registro guarda molde, não índice", () => {
    const comIndice = CAMPOS_DA_FICHA.filter((c) => /\.\d+(\.|$)/.test(c.caminho));
    expect(comIndice.map((c) => c.caminho), "índice de waypoint cravado no registro").toEqual([]);
    expect(CAMPOS_DA_FICHA.filter((c) => c.caminho.includes("[]")).length).toBe(4);
  });
});

describe("camposDaFicha expande o molde pra ficha que chegou", () => {
  const base = loadAll().find((f) => f.slug === "rampa-do-pepe");
  if (!base) throw new Error('"rampa-do-pepe" sumiu de content/fichas');

  const comN = (n: number): Ficha => ({
    ...base,
    trajeto: {
      waypoints: Array.from({ length: n }, (_, i) => ({ ...base.trajeto.waypoints[0], nome: `parada ${i}` })),
    },
  });

  it("nenhum `[]` sobra na saída", () => {
    expect(camposDaFicha(comN(3)).filter((c) => c.caminho.includes("[]"))).toEqual([]);
  });

  it("uma ficha com 1 waypoint expande 1 conjunto", () => {
    const caminhos = camposDaFicha(comN(1)).map((c) => c.caminho);
    expect(caminhos).toContain("trajeto.waypoints.0.nome");
    expect(caminhos).not.toContain("trajeto.waypoints.1.nome");
    expect(caminhos.filter((c) => c.startsWith("trajeto.waypoints."))).toHaveLength(4);
  });

  it("uma ficha com 3 waypoints expande 3", () => {
    const caminhos = camposDaFicha(comN(3)).map((c) => c.caminho);
    expect(caminhos.filter((c) => c.startsWith("trajeto.waypoints."))).toHaveLength(12);
    for (const i of [0, 1, 2]) {
      for (const folha of ["nome", "lat", "lng", "nota"]) {
        expect(caminhos).toContain(`trajeto.waypoints.${i}.${folha}`);
      }
    }
  });

  it("os quatro campos de um waypoint saem JUNTOS, na ordem do waypoint", () => {
    const caminhos = camposDaFicha(comN(2))
      .map((c) => c.caminho)
      .filter((c) => c.startsWith("trajeto.waypoints."));
    expect(caminhos).toEqual([
      "trajeto.waypoints.0.nome",
      "trajeto.waypoints.0.lat",
      "trajeto.waypoints.0.lng",
      "trajeto.waypoints.0.nota",
      "trajeto.waypoints.1.nome",
      "trajeto.waypoints.1.lat",
      "trajeto.waypoints.1.lng",
      "trajeto.waypoints.1.nota",
    ]);
  });

  it("os campos que não são molde saem inteiros e uma vez só", () => {
    const caminhos = camposDaFicha(comN(3)).map((c) => c.caminho);
    const semMolde = CAMPOS_DA_FICHA.filter((c) => !c.caminho.includes("[]"));
    expect(caminhos).toHaveLength(semMolde.length + 12);
    for (const c of semMolde) expect(caminhos.filter((x) => x === c.caminho)).toHaveLength(1);
  });

  // Espécie, grupo e obrigatoriedade viajam do molde pro caminho concreto —
  // senão a tela expandida perderia o instrumento de cada campo.
  it("a entrada expandida guarda a espécie e o grupo do molde", () => {
    const nome = camposDaFicha(comN(1)).find((c) => c.caminho === "trajeto.waypoints.0.nome");
    expect(nome).toEqual({ caminho: "trajeto.waypoints.0.nome", especie: "prosa", obrigatorio: true, grupo: "chegar" });
  });
});
