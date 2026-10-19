import { describe, expect, it } from "vitest";
import {
  CAMPOS_DA_FICHA,
  TIRE_O_HORARIO_POR_DIA_ANTES,
  aplicarCampo,
  aplicarNoRascunho,
  campoPorCaminho,
  removerCampo,
  tirarDoRascunho,
} from "@/lib/campos-da-ficha";
import {
  CAMPOS_DA_PESSOA,
  OPCIONAIS_DA_PESSOA,
  chavesForaDaPessoa,
  tirarCampoDaPessoa,
  tirarDoRascunhoDaPessoa,
} from "@/lib/campos-da-pessoa";
import { camposQueMudaram } from "@/lib/campos-mudados";
import { loadAll } from "@/lib/ficha";
import {
  GRUPO_COBRE_TUDO,
  GRUPO_DIA_FECHADO,
  GRUPO_DIA_REPETIDO,
  GRUPO_DIA_REPETIDO_NO_GRUPO,
  GRUPO_IGUAL_AO_HORARIO,
  GRUPO_SEM_DIA,
  GRUPO_SEM_HORARIO,
  problemaDasFaixas,
  type GrupoDeHorario,
} from "@/lib/horario";
import { prepararPublicacaoDaPessoa } from "@/lib/porta-da-pessoa";
import { prepararPublicacao } from "@/lib/porta-de-publicar";
import { fichaSchema } from "@/types/ficha";

// 🔴 O CAMPO NOVO NAS PORTAS DE ESCRITA (T2 da rodada "horário diferente em
// alguns dias", 18/10). A regra é `problemaDosGrupos` (Task 1); aqui se prova
// que CADA porta a chama — a do campo, a do rascunho, as duas de publicar — e
// que mudar `dias` ou `horario` com grupos presentes passa pela mesma regra.

/** Devolve a mensagem do que a chamada ESTOUROU — pra perguntar QUAL frase, e
 *  não só que estourou (`toThrow()` sobre duas portas em série é a 47ª espécie). */
function frase(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("não estourou, e devia");
}

// A Pedra Furada: horário 05:00–17:00, sem `dias` (abre todo dia).
const PEDRA = loadAll().find((f) => f.slug === "pedra-furada-de-venturosa");
if (!PEDRA || PEDRA.horario === undefined || PEDRA.dias !== undefined) {
  throw new Error("a premissa mudou: a Pedra Furada tinha horário e não tinha dias");
}
const DOC = JSON.stringify(PEDRA);
// A Rampa: sem horário.
const RAMPA = loadAll().find((f) => f.slug === "rampa-do-pepe");
if (!RAMPA || RAMPA.horario !== undefined) throw new Error("a premissa mudou: a Rampa não tinha horário");

const F = [{ abre: "07:00", fecha: "12:00" }];
// Os corpos chegam à porta como JSON, sem o tipo `Dia`: o teste os passa como
// chegariam (`as never` onde o TypeScript pediria a união).
const FIM_DE_SEMANA = [{ dias: ["sab", "dom"], faixas: F }] as never as GrupoDeHorario[];
const DOC_COM_GRUPOS = JSON.stringify({ ...PEDRA, horarioPorDia: [{ dias: ["dom", "sab"], faixas: F }] });

describe("o schema aceita a forma, e só a forma", () => {
  it("1 a 3 grupos de { dias, faixas } — e sem o campo, como sempre", () => {
    expect(fichaSchema.safeParse({ ...PEDRA, horarioPorDia: FIM_DE_SEMANA }).success).toBe(true);
    expect(fichaSchema.safeParse(PEDRA).success).toBe(true);
  });
  it.each([
    ["lista vazia", []],
    ["4 grupos", ["seg", "ter", "qua", "qui"].map((d) => ({ dias: [d], faixas: F }))],
    ["grupo sem dia", [{ dias: [], faixas: F }]],
    ["grupo sem faixa", [{ dias: ["sab"], faixas: [] }]],
    ["4 faixas", [{ dias: ["sab"], faixas: [F[0], F[0], F[0], F[0]] }]],
    ["dia inventado", [{ dias: ["sabado"], faixas: F }]],
    ["hora fora do formato", [{ dias: ["sab"], faixas: [{ abre: "7h", fecha: "12:00" }] }]],
  ])("recusa: %s", (_n, grupos) => {
    expect(fichaSchema.safeParse({ ...PEDRA, horarioPorDia: grupos }).success).toBe(false);
  });
});

describe("o registro: a entrada `horarioPorDia`", () => {
  it("é `grupos`, opcional, do bloco 'quando', LOGO DEPOIS de `dias`", () => {
    expect(campoPorCaminho("horarioPorDia")).toEqual({
      caminho: "horarioPorDia",
      especie: "grupos",
      obrigatorio: false,
      grupo: "quando",
    });
    const caminhos = CAMPOS_DA_FICHA.map((c) => c.caminho);
    expect(caminhos.indexOf("horarioPorDia")).toBe(caminhos.indexOf("dias") + 1);
  });
});

describe("aplicarCampo — a ficha no ar", () => {
  it("grava a lista inteira, só com { dias, faixas }, os dias na ordem da semana", () => {
    const depois = JSON.parse(
      aplicarCampo(DOC, "horarioPorDia", [{ dias: ["sab", "dom"], faixas: F, nota: "chave a mais" }] as never),
    );
    expect(depois.horarioPorDia).toEqual([{ dias: ["dom", "sab"], faixas: F }]);
    // o resto do documento não mudou
    expect(depois.horario).toEqual(PEDRA.horario);
    expect(depois.voz).toBe(PEDRA.voz);
  });

  it("dois grupos: cada um com os dias em ordem, na ordem em que vieram", () => {
    const grupos = [
      { dias: ["sex", "seg"], faixas: [{ abre: "09:00", fecha: "12:00" }, { abre: "14:00", fecha: "16:00" }] },
      { dias: ["sab"], faixas: F },
    ];
    expect(JSON.parse(aplicarCampo(DOC, "horarioPorDia", grupos as never)).horarioPorDia).toEqual([
      { dias: ["seg", "sex"], faixas: grupos[0].faixas },
      { dias: ["sab"], faixas: F },
    ]);
  });

  it("a lista nova SUBSTITUI a velha (não soma)", () => {
    const depois = JSON.parse(aplicarCampo(DOC_COM_GRUPOS, "horarioPorDia", [{ dias: ["qua"], faixas: F }]));
    expect(depois.horarioPorDia).toEqual([{ dias: ["qua"], faixas: F }]);
  });

  // Um caso por espécie de recusa; a lista inteira é da Task 1. Cada um diz a
  // FRASE da regra — não um ZodError cru, que a rota devolveria como 400 mudo.
  it.each([
    ["grupo sem dia", DOC, [{ dias: [], faixas: F }], GRUPO_SEM_DIA],
    ["faixas fora de ordem", DOC, [{ dias: ["sab"], faixas: [{ abre: "14:00", fecha: "16:00" }, F[0]] }],
      problemaDasFaixas([{ abre: "14:00", fecha: "16:00" }, F[0]])],
    ["o mesmo dia em dois grupos", DOC, [{ dias: ["sab"], faixas: F }, { dias: ["sab"], faixas: [{ abre: "09:00", fecha: "10:00" }] }], GRUPO_DIA_REPETIDO],
    ["o mesmo dia duas vezes num grupo", DOC, [{ dias: ["sab", "sab"], faixas: F }], GRUPO_DIA_REPETIDO_NO_GRUPO],
    ["dia em que o lugar não abre", JSON.stringify({ ...PEDRA, dias: ["seg", "sab"] }), [{ dias: ["dom"], faixas: F }], GRUPO_DIA_FECHADO],
    ["sem o horário de sempre", JSON.stringify(RAMPA), FIM_DE_SEMANA, GRUPO_SEM_HORARIO],
    ["cobre todos os dias abertos", JSON.stringify({ ...PEDRA, dias: ["sab", "dom"] }), FIM_DE_SEMANA, GRUPO_COBRE_TUDO],
    ["as mesmas horas do horário de sempre", DOC, [{ dias: ["sab"], faixas: PEDRA.horario }], GRUPO_IGUAL_AO_HORARIO],
  ])("recusa com a frase da regra: %s", (_n, doc, grupos, esperada) => {
    expect(esperada).toBeTruthy();
    expect(frase(() => aplicarCampo(doc, "horarioPorDia", grupos as never))).toBe(esperada);
  });

  // 🔴 A REGRA RODA CONTRA O DOCUMENTO JÁ COM A MUDANÇA: mudar `dias` pode
  // deixar um grupo num dia fechado; mudar o `horario` pode deixá-lo igual ao
  // de um grupo.
  it("mudar `dias` com grupos presentes passa pela regra dos grupos", () => {
    expect(frase(() => aplicarCampo(DOC_COM_GRUPOS, "dias", ["seg", "sab"]))).toBe(GRUPO_DIA_FECHADO);
    expect(frase(() => aplicarCampo(DOC_COM_GRUPOS, "dias", ["sab", "dom"]))).toBe(GRUPO_COBRE_TUDO);
    expect(JSON.parse(aplicarCampo(DOC_COM_GRUPOS, "dias", ["seg", "sab", "dom"])).dias).toEqual(["seg", "sab", "dom"]);
  });

  it("mudar o `horario` com grupos presentes passa pela regra dos grupos", () => {
    expect(frase(() => aplicarCampo(DOC_COM_GRUPOS, "horario", F))).toBe(GRUPO_IGUAL_AO_HORARIO);
    expect(JSON.parse(aplicarCampo(DOC_COM_GRUPOS, "horario", [{ abre: "08:00", fecha: "17:00" }])).horario).toEqual([
      { abre: "08:00", fecha: "17:00" },
    ]);
  });

  it("sem grupos, mudar `dias` e `horario` é como sempre foi", () => {
    expect(JSON.parse(aplicarCampo(DOC, "dias", ["sab", "dom"])).dias).toEqual(["sab", "dom"]);
    expect(JSON.parse(aplicarCampo(DOC, "horario", F)).horario).toEqual(F);
  });
});

describe("removerCampo — o 'não tem'", () => {
  it("tirar o `horario` com grupos presentes é recusado com a frase própria", () => {
    expect(frase(() => removerCampo(DOC_COM_GRUPOS, "horario"))).toBe(TIRE_O_HORARIO_POR_DIA_ANTES);
  });
  it("sem grupos, tirar o `horario` é como sempre", () => {
    expect(JSON.parse(removerCampo(DOC, "horario")).horario).toBeUndefined();
  });
  it("tirar os grupos tira a chave; depois, o horário sai", () => {
    const sem = removerCampo(DOC_COM_GRUPOS, "horarioPorDia");
    expect(JSON.parse(sem).horarioPorDia).toBeUndefined();
    expect(JSON.parse(removerCampo(sem, "horario")).horario).toBeUndefined();
  });
  it("tirar `dias` com grupos presentes continua valendo (abrir todo dia não fecha grupo nenhum)", () => {
    const doc = JSON.stringify({ ...PEDRA, dias: ["seg", "sab", "dom"], horarioPorDia: FIM_DE_SEMANA });
    expect(JSON.parse(removerCampo(doc, "dias")).dias).toBeUndefined();
  });
});

describe("o rascunho — a mesma regra, sem o schema do documento", () => {
  const RASCUNHO = JSON.stringify({ slug: "x-cidade", horario: [{ abre: "08:00", fecha: "17:00" }] });
  it("grava normalizado", () => {
    const depois = JSON.parse(aplicarNoRascunho(RASCUNHO, "horarioPorDia", [{ dias: ["sab", "dom"], faixas: F, x: 1 }] as never));
    expect(depois.horarioPorDia).toEqual([{ dias: ["dom", "sab"], faixas: F }]);
  });
  it("recusa com a frase da regra", () => {
    expect(frase(() => aplicarNoRascunho(JSON.stringify({ slug: "x" }), "horarioPorDia", FIM_DE_SEMANA))).toBe(GRUPO_SEM_HORARIO);
    expect(frase(() => aplicarNoRascunho(RASCUNHO, "horarioPorDia", [{ dias: ["sab", "sab"], faixas: F }]))).toBe(
      GRUPO_DIA_REPETIDO_NO_GRUPO,
    );
  });
  it("mudar `dias`/`horario` com grupos passa pela regra; tirar o horário com grupos é recusado", () => {
    const com = aplicarNoRascunho(RASCUNHO, "horarioPorDia", FIM_DE_SEMANA);
    expect(frase(() => aplicarNoRascunho(com, "dias", ["seg"]))).toBe(GRUPO_DIA_FECHADO);
    expect(frase(() => aplicarNoRascunho(com, "horario", F))).toBe(GRUPO_IGUAL_AO_HORARIO);
    expect(frase(() => tirarDoRascunho(com, "horario"))).toBe(TIRE_O_HORARIO_POR_DIA_ANTES);
    expect(JSON.parse(tirarDoRascunho(RASCUNHO, "horario")).horario).toBeUndefined();
  });
});

describe("quem usa o app também responde", () => {
  it("`horarioPorDia` é pergunta dela, opcional, e não é sobra na porta dela", () => {
    expect(CAMPOS_DA_PESSOA).toContain("horarioPorDia");
    expect(CAMPOS_DA_PESSOA.indexOf("horarioPorDia")).toBe(CAMPOS_DA_PESSOA.indexOf("dias") + 1);
    expect(OPCIONAIS_DA_PESSOA.has("horarioPorDia")).toBe(true);
    expect(chavesForaDaPessoa({ slug: "x", horarioPorDia: FIM_DE_SEMANA })).toEqual([]);
  });
  it("o 'não tem' dela no horário com grupos é recusado; nos grupos, tira", () => {
    const rascunho = JSON.stringify({ slug: "x", horario: [{ abre: "08:00", fecha: "17:00" }], horarioPorDia: FIM_DE_SEMANA });
    expect(frase(() => tirarDoRascunhoDaPessoa(rascunho, "horario"))).toBe(TIRE_O_HORARIO_POR_DIA_ANTES);
    expect(JSON.parse(tirarDoRascunhoDaPessoa(rascunho, "horarioPorDia")).horarioPorDia).toBeUndefined();
    expect(frase(() => tirarCampoDaPessoa(DOC_COM_GRUPOS, "horario"))).toBe(TIRE_O_HORARIO_POR_DIA_ANTES);
  });
});

describe("as duas portas de publicar", () => {
  const DO_JOAO = { ...PEDRA, cidade: PEDRA.cidade ?? "Venturosa" };
  const SLUG_DELA = "pedra-mandada-cidade-teste";
  const DELA = {
    slug: SLUG_DELA, modos: [], cidade: "Cidade Teste", promessa: "Uma pedra.", acesso: "De carro.",
    trajeto: { waypoints: [{ nome: "Pedra Mandada", lat: -8.31, lng: -35.97 }] },
    condicao: { coords: { lat: -8.31, lng: -35.97 } }, custo: { tag: "gratis" },
    horario: [{ abre: "08:00", fecha: "17:00" }],
  };
  const ruim = [{ dias: ["sab"], faixas: [{ abre: "08:00", fecha: "17:00" }] }];

  it("a do João: grupos inválidos → a frase da regra; válidos → publica", () => {
    // A Pedra abre 05:00–17:00: um grupo com essas horas não é diferente.
    const ruimDaPedra = [{ dias: ["sab"], faixas: PEDRA.horario }];
    expect(prepararPublicacao(JSON.stringify({ ...DO_JOAO, horarioPorDia: ruimDaPedra }), PEDRA.slug)).toEqual({
      frase: GRUPO_IGUAL_AO_HORARIO,
    });
    const r = prepararPublicacao(JSON.stringify({ ...DO_JOAO, horarioPorDia: FIM_DE_SEMANA }), PEDRA.slug);
    expect("doc" in r, JSON.stringify(r)).toBe(true);
    expect(JSON.parse((r as { doc: string }).doc).horarioPorDia).toEqual(FIM_DE_SEMANA);
  });

  it("a dela: grupos inválidos → a frase da regra; válidos → publica", () => {
    expect(prepararPublicacaoDaPessoa(JSON.stringify({ ...DELA, horarioPorDia: ruim }), SLUG_DELA)).toEqual({
      frase: GRUPO_IGUAL_AO_HORARIO,
    });
    const r = prepararPublicacaoDaPessoa(JSON.stringify({ ...DELA, horarioPorDia: FIM_DE_SEMANA }), SLUG_DELA);
    expect("doc" in r, JSON.stringify(r)).toBe(true);
    expect(JSON.parse((r as { doc: string }).doc).horarioPorDia).toEqual(FIM_DE_SEMANA);
  });

  it("sem horário de sempre, os grupos não publicam (nas duas)", () => {
    const { horario: _h, ...semHora } = DELA;
    expect(prepararPublicacaoDaPessoa(JSON.stringify({ ...semHora, horarioPorDia: FIM_DE_SEMANA }), SLUG_DELA)).toEqual({
      frase: GRUPO_SEM_HORARIO,
    });
    const { horario: _h2, ...joaoSemHora } = DO_JOAO;
    expect(prepararPublicacao(JSON.stringify({ ...joaoSemHora, horarioPorDia: FIM_DE_SEMANA }), PEDRA.slug)).toEqual({
      frase: GRUPO_SEM_HORARIO,
    });
  });
});

describe("campos-mudados", () => {
  // O horário no OBJETO de antes da 11c (`{abre, fecha}`) e a lista são o mesmo
  // dado: gravar os grupos sobre um documento assim muda SÓ os grupos.
  it("horário na forma antiga + gravar `horarioPorDia` → só `horarioPorDia` mudou", () => {
    const antigo = JSON.stringify({ ...PEDRA, horario: { abre: "05:00", fecha: "17:00" } });
    const depois = aplicarCampo(antigo, "horarioPorDia", FIM_DE_SEMANA);
    expect(camposQueMudaram(antigo, depois)).toEqual(["horarioPorDia"]);
  });
});
