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
  "slug", // é o endereço do lugar: a troca é OUTRA porta (`api/admin/endereco`, Tarefa 11e), que guarda o velho e o redireciona
  "modos", // campo morto — uma única ocorrência em todo o `src/`, a linha que o declara
  "condicao.regra.tipo", // é `z.literal("chuva_binaria")`: não tem segundo valor pra escolher
]);

// Uma entrada do registro que NÃO é folha do schema: ela edita o SUBGALHO
// inteiro de uma vez. O mapa faz isso por desenho — o pin arrastado devolve o
// par, nunca uma metade. O valor é o conjunto EXATO de folhas que a entrada
// engole, e a ESPÉCIE que a engole: se o schema ganhar uma terceira folha ali
// dentro (altitude, precisão), este teste fica vermelho em vez de a folha nova
// nascer invisível.
//
// 🔴 E DESDE 18/10 OS GRUPOS DO HORÁRIO DIFERENTE (`horarioPorDia`): uma LISTA
// de objetos, que a varredura vira molde (`horarioPorDia[].dias`, e as duas
// horas das faixas de dentro). Nenhuma dessas folhas é campo sozinha — os dias
// de um grupo e as horas dele só fazem sentido juntos, e a regra
// (`problemaDosGrupos`) compara grupos entre si — então a entrada é a lista
// inteira, com a espécie que a grava de uma vez. As folhas ficam EXATAS aqui.
const EDITADOS_INTEIROS = new Map<string, { folhas: readonly string[]; especie: string }>([
  ["condicao.coords", { folhas: ["lat", "lng"], especie: "coord" }],
  ["horarioPorDia", { folhas: ["[].dias", "[].faixas[].abre", "[].faixas[].fecha"], especie: "grupos" }],
]);

/** A folha `f` mora DENTRO da entrada-inteira `raiz`: um degrau abaixo
 *  (`raiz.x`) ou dentro do molde da lista (`raiz[]…`). Nunca só o prefixo do
 *  texto — `horarioPorDiaX` não é de `horarioPorDia`. */
const dentroDe = (f: string, raiz: string): boolean => f.startsWith(`${raiz}.`) || f.startsWith(`${raiz}[]`);

// 🔴 A ÚNICA DIVERGÊNCIA DECLARADA ENTRE A COLUNA `obrigatorio` E O SCHEMA
// (Tarefa 11b, 2026-10-04, 11b-I1 da auditoria do plano). Cada chave aqui é
// OBRIGATÓRIA NO REGISTRO (sem "não sei", e o formulário de lugar novo a pede)
// e OPCIONAL NO SCHEMA, com o motivo escrito ao lado. Consumida pelo caso
// "nenhuma entrada diverge" — que continua recusando qualquer OUTRA divergência
// — e vigiada pelo caso "nenhuma exceção fantasma", que exige as duas metades
// do motivo valendo de verdade.
//
// Desde 07/10 (o lugar mandado por quem usa o app) ela ganhou os campos que a
// pessoa não responde, com UM motivo compartilhado. As folhas de
// `condicao.regra.*` NÃO entram: dentro do objeto `regra` elas continuam
// obrigatórias, e registro e schema concordam.
const SO_DO_JOAO =
  "opcional no schema desde 07/10: o lugar mandado por quem usa o app não tem este campo, e a página " +
  "cala o bloco; obrigatório no registro porque é o registro que a porta de publicar do JOÃO lê";
const OBRIGATORIO_SO_NO_REGISTRO = new Map<string, string>([
  [
    "cidade",
    "as 3 fichas no ar nasceram sem cidade, e quem a responde é o João, pelo painel; " +
      "obrigatória no schema, `fichaSchema.parse` estouraria na leitura pública e " +
      "`buscarFichas` derrubaria a lista inteira, não uma ficha",
  ],
  ...["rotulo_escaneio", "voz", "premio", "avisos", "condicao.severidade", "condicao.regra_texto",
      "condicao.ressalva_proxy", "discriminador.formato", "discriminador.como_ler",
      "discriminador.permissao_abortar"].map((c) => [c, SO_DO_JOAO] as [string, string]),
]);

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

/** Toda chave OPCIONAL do schema que é um OBJETO — isto é, todo bloco que pode
 *  faltar inteiro e cujas folhas são obrigatórias por dentro. É a espécie de
 *  campo que o ruling H1 abriu, e a varredura existe pra ninguém ter que
 *  procurar de novo à mão. */
function blocosOpcionaisDoSchema(tipo: z.ZodTypeAny, prefixo: string, saida: string[]): string[] {
  const nu = desembrulhar(tipo);
  const d = def(nu);
  if (d.typeName === "ZodObject") {
    for (const [chave, filho] of Object.entries(d.shape!())) {
      const caminho = prefixo === "" ? chave : `${prefixo}.${chave}`;
      const dentro = desembrulhar(filho);
      if (def(filho).typeName === "ZodOptional" && def(dentro).typeName === "ZodObject") saida.push(caminho);
      blocosOpcionaisDoSchema(filho, caminho, saida);
    }
    return saida;
  }
  if (d.typeName === "ZodArray") {
    const dentro = desembrulhar(d.type as z.ZodTypeAny);
    if (def(dentro).typeName === "ZodObject") return blocosOpcionaisDoSchema(dentro, `${prefixo}[]`, saida);
  }
  return saida;
}

/** A marca de "qualquer índice" dentro de um caminho do registro. */
const MOLDE = "[]";

/** O tipo Zod que o `fichaSchema` declara para UM caminho concreto.
 *
 *  🔴 O MÓDULO TEM UM RESOLVEDOR IGUAL A ESTE, e a duplicação é de propósito:
 *  lá ele é COMPORTAMENTO (a conferência de uma folha, em `validarFolha`), aqui
 *  ele é o GUARDA. Um guarda que chama a função do módulo que ele guarda mede
 *  o módulo contra ele mesmo. São 10 linhas; a independência vale mais. */
function tipoNoCaminho(caminho: string): z.ZodTypeAny | undefined {
  let atual: z.ZodTypeAny | undefined = fichaSchema;
  for (const degrau of caminho.split(".")) {
    if (!atual) return undefined;
    const d = def(desembrulhar(atual));
    if (d.typeName === "ZodObject") atual = d.shape!()[degrau];
    else if (d.typeName === "ZodArray") atual = /^\d+$/.test(degrau) ? d.type : undefined;
    else return undefined;
  }
  return atual;
}

const eOpcionalNoSchema = (tipo: z.ZodTypeAny) => def(tipo).typeName === "ZodOptional";

const FOLHAS = folhasDoSchema(fichaSchema, "", []);
const BLOCOS_DO_SCHEMA = blocosOpcionaisDoSchema(fichaSchema, "", []);
const NO_REGISTRO = new Set(CAMPOS_DA_FICHA.map((c) => c.caminho));

function engolidaPorEntradaInteira(folha: string): boolean {
  for (const raiz of EDITADOS_INTEIROS.keys()) if (dentroDe(folha, raiz)) return true;
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
    expect(FOLHAS).toContain("horario"); // a lista de faixas é UMA folha (Tarefa 11c)
    // 36 = as 33 de até 17/10 + as 3 dos grupos do horário diferente (18/10):
    // `horarioPorDia[].dias`, `horarioPorDia[].faixas[].abre` e `.fecha`.
    expect(FOLHAS).toHaveLength(36);
  });

  it("nenhuma folha repetida, e nenhuma vazia", () => {
    expect(new Set(FOLHAS).size).toBe(FOLHAS.length);
    expect(FOLHAS.filter((f) => f === "")).toEqual([]);
  });

  // 🔴 CONTROLE POSITIVO DO GUARDA DOS BLOCOS OPCIONAIS (I-1 da revisão da 11d).
  // Contra o `fichaSchema` de então a expectativa era `[]` (desde 07/10 são os
  // dois blocos de lá, ver o guarda) — e um `[]` é o que um guarda CEGO também
  // devolve: arrancar o `saida.push(caminho)` ficava verde na
  // suíte inteira (52ª espécie: a condição ficou inalcançável quando o `horario`
  // virou lista). Este schema sintético TEM o que o guarda procura, nos três
  // lugares onde ele sabe procurar: no 1º nível, aninhado num objeto, e dentro
  // de uma lista de objetos. Os nomes são marcadores, não campos de ficha.
  it("o guarda dos blocos opcionais ACHA um bloco quando ele existe — no 1º nível, aninhado e em lista", () => {
    const sintetico = z.object({
      raso: z.object({ a: z.string() }).optional(),
      fundo: z.object({ dentro: z.object({ b: z.string() }).optional(), c: z.string() }),
      lista: z.array(z.object({ item: z.object({ d: z.string() }).optional() })),
      solto: z.string().optional(),
    });
    expect(blocosOpcionaisDoSchema(sintetico, "", [])).toEqual(["raso", "fundo.dentro", "lista[].item"]);
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

  it("toda entrada-inteira engole EXATAMENTE as folhas declaradas, com a espécie declarada", () => {
    for (const [raiz, { folhas, especie }] of EDITADOS_INTEIROS) {
      const dentro = FOLHAS.filter((f) => dentroDe(f, raiz)).map((f) => f.slice(raiz.length).replace(/^\./, ""));
      expect(dentro.sort(), raiz).toEqual([...folhas].sort());
      expect(campoPorCaminho(raiz)?.especie, raiz).toBe(especie);
    }
  });

  // 🔴 O GUARDA DOS BLOCOS OPCIONAIS FICA, COM A EXPECTATIVA VAZIA ATÉ 07/10 (Tarefa
  // 11c; 11d-I1 da auditoria). Ele nasceu do ruling H1: um OBJETO opcional no
  // schema, com folhas obrigatórias por dentro, é um campo cujo "não sei" só
  // existe no nível do objeto — e por 9 dias o `horario` foi um assim, sem
  // caminho nenhum até "não fecha". Desde a 11c o `horario` é uma LISTA (uma
  // folha só, editada inteira), e o schema não tem bloco opcional nenhum. Quem
  // acrescentar um recebe o vermelho aqui, em vez de o campo nascer sem "não
  // sei". Sem esta varredura, "não há bloco opcional" seria uma frase minha.
  //
  // 🔴 E DESDE 07/10 O SCHEMA TEM DOIS (C1 da pré-auditoria da rodada do lugar
  // de quem usa): `condicao.regra` e `discriminador` são OBJETOS opcionais, por
  // decisão da spec — o lugar mandado por quem usa não os tem. O "não sei" de
  // cada um, escrito, como a mensagem abaixo exige:
  //  - `condicao.regra`: não há "não sei" de folha. A regra entra INTEIRA pelo
  //    "Calibrar" (Task 8), e meia regra continua recusada pelo schema;
  //  - `discriminador`: nasce folha a folha pelo painel (`BLOCOS_QUE_NASCEM`,
  //    Task 8), e as três folhas são opcionais no schema.
  // Nos lugares do JOÃO, o "não sei" de cada folha dos dois continua recusado
  // pelo REGISTRO (`obrigatorio: true`; `OBRIGATORIO_SO_NO_REGISTRO`, acima).
  // A lista é EXATA: um terceiro bloco opcional continua vermelho aqui.
  it("o schema tem EXATAMENTE os dois blocos opcionais de 07/10 — `condicao.regra` e `discriminador`", () => {
    expect(
      [...BLOCOS_DO_SCHEMA].sort(),
      "bloco opcional novo no schema: decida como o \"não sei\" dele chega à tela, e escreva o motivo",
    ).toEqual(["condicao.regra", "discriminador"]);
  });

  // 🔴 O HORÁRIO É UMA FOLHA SÓ — a lista inteira de faixas —, e é ela que o
  // registro edita, com a espécie que grava a lista de uma vez. As duas horas
  // de dentro NÃO são campos: com intervalo, abre e fecha de cada faixa
  // dependem um do outro (o I-B da Tarefa 11).
  it("o `horario` é uma folha do schema, e o registro o edita inteiro, como `faixas`", () => {
    expect(FOLHAS).toContain("horario");
    expect(FOLHAS.filter((f) => f.startsWith("horario."))).toEqual([]);
    expect(campoPorCaminho("horario")?.especie).toBe("faixas");
    expect(campoPorCaminho("horario")?.obrigatorio, "sem o \"não sei\" o horário não tem volta").toBe(false);
    expect(campoPorCaminho("horario.abre")).toBeUndefined();
    expect(campoPorCaminho("horario.fecha")).toBeUndefined();
  });

  // 🔴 I1 DA REVISÃO (2026-09-26), E É O FURO MAIS SÉRIO QUE ESTE ARQUIVO
  // TINHA. O arquivo inteiro existe pra matar "lista à mão cega ao que
  // cresceu" — e o guarda de cobertura confere só a coluna `caminho`. A coluna
  // `obrigatorio`, que é a que DECIDE se o "não sei" existe, era escrita à mão
  // sem guarda nenhum. O revisor mediu duas mutações sobrevivendo à suíte
  // inteira, 1244/1244 verde:
  //
  //   `avisos` (o schema exige) vira `obrigatorio: false`
  //      → o João toca "não sei" e leva um 400 mudo da rota.
  //   `custo.valor` (opcional) vira `obrigatorio: true`
  //      → ele não consegue mais tirar o preço de um lugar que virou grátis,
  //        e o app segue afirmando um preço que não vale.
  //
  // Quem responde "este campo é obrigatório?" é o SCHEMA, não eu. O varredor
  // resolve o tipo de cada caminho do registro e compara.
  describe("a coluna `obrigatorio` bate com o schema", () => {
    const resolvidos = CAMPOS_DA_FICHA.map((c) => ({
      caminho: c.caminho,
      obrigatorio: c.obrigatorio,
      // O molde vale pra qualquer índice, e o tipo do item não depende de qual.
      tipo: tipoNoCaminho(c.caminho.replace(MOLDE, ".0")),
    }));

    // NÃO-VACUIDADE: se o resolvedor devolvesse `undefined` em tudo, o laço
    // abaixo compararia nada e passaria verde. Aqui ele é medido antes.
    it("todo caminho do registro resolve num tipo do schema", () => {
      expect(resolvidos.filter((r) => r.tipo === undefined).map((r) => r.caminho)).toEqual([]);
      expect(resolvidos).toHaveLength(CAMPOS_DA_FICHA.length);
      // e o resolvedor não é constante: o schema tem dos dois
      const opcionais = resolvidos.filter((r) => eOpcionalNoSchema(r.tipo!));
      expect(opcionais.length).toBeGreaterThan(0);
      expect(opcionais.length).toBeLessThan(resolvidos.length);
    });

    it("nenhuma entrada diverge — `obrigatorio` é o que o schema diz, não o que eu escrevi", () => {
      const divergentes = resolvidos
        .filter((r) => !OBRIGATORIO_SO_NO_REGISTRO.has(r.caminho))
        .filter((r) => r.tipo !== undefined && r.obrigatorio === eOpcionalNoSchema(r.tipo))
        .map((r) => `${r.caminho}: registro diz obrigatorio=${r.obrigatorio}, schema diz o contrário`);
      expect(
        divergentes,
        "a coluna que decide se o 'não sei' existe tem que vir do schema. Se algum " +
          "campo precisar divergir, ele entra com o motivo escrito — nunca afrouxando isto",
      ).toEqual([]);
    });

    // A exceção de cima não é um buraco aberto: toda chave dela tem de ser
    // obrigatória no REGISTRO e opcional no SCHEMA — as duas metades do motivo.
    // Exceção que deixou de divergir (alguém tornou o campo obrigatório no
    // schema, ou opcional no registro) fica vermelha aqui, em vez de continuar
    // escondendo uma divergência que não existe mais.
    it("nenhuma exceção fantasma — toda chave de OBRIGATORIO_SO_NO_REGISTRO diverge de verdade", () => {
      expect(OBRIGATORIO_SO_NO_REGISTRO.size, "a exceção foi lida vazia").toBeGreaterThan(0);
      for (const [caminho, motivo] of OBRIGATORIO_SO_NO_REGISTRO) {
        expect(motivo.trim().length, `${caminho}: exceção sem motivo escrito`).toBeGreaterThan(20);
        expect(campoPorCaminho(caminho)?.obrigatorio, `${caminho}: não é obrigatório no registro`).toBe(true);
        const tipo = tipoNoCaminho(caminho);
        expect(tipo, `${caminho}: não existe no schema`).toBeDefined();
        expect(eOpcionalNoSchema(tipo!), `${caminho}: não é opcional no schema`).toBe(true);
      }
    });

    it("o horário é opcional no schema — e o varredor o enxerga", () => {
      expect(eOpcionalNoSchema(tipoNoCaminho("horario")!)).toBe(true);
    });
  });

  it("o registro não está vazio nem é só a voz — senão os guardas acima passam ocos", () => {
    expect(CAMPOS_DA_FICHA.length).toBeGreaterThan(12);
    // 7: as 6 de até 17/10 (`hora` e `bloco` saíram na 11c/11d) + `grupos`, o
    // horário diferente em alguns dias (18/10).
    expect(new Set(CAMPOS_DA_FICHA.map((c) => c.especie)).size).toBe(7);
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
