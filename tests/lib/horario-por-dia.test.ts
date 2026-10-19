import { describe, expect, it } from "vitest";
import {
  fechadoAgora,
  horarioDoDia,
  linhasDoHorario,
  problemaDosGrupos,
  rotuloAbertura,
  rotuloFaixa,
  aberturaDaFicha,
  type Abertura,
  type Agora,
  type GrupoDeHorario,
} from "@/lib/horario";
import { DIAS, rotuloDias } from "@/lib/semana";
import * as horario from "@/lib/horario";

// 🔴 O DEFEITO QUE ESTE ARQUIVO TRANCA (18/10): um lugar que abre 8h na semana e
// 7h no sábado. O carimbo errava num dos dois — "Pode ir" com o portão fechado
// ou "Fechado agora" com ele aberto. Toda leitura de hora passa por
// `horarioDoDia`; estes casos cravam o sábado, o domingo à noite e a ficha.
const h = (hh: number, mm = 0) => hh * 60 + mm;
const agora = (dia: number, minutos: number): Agora => ({ dia, minutos, epochS: 0 });

const L: Abertura = {
  horario: [{ abre: "08:00", fecha: "17:00" }],
  porDia: [{ dias: ["sab", "dom"], faixas: [{ abre: "07:00", fecha: "12:00" }] }],
};
const SEM_GRUPO: Abertura = { horario: L.horario };

describe("horarioDoDia: o grupo que contém o dia, senão o horário de sempre", () => {
  it("sábado (6) e domingo (0) leem o grupo; quarta (3) lê o base", () => {
    expect(horarioDoDia(L, 6)).toEqual([{ abre: "07:00", fecha: "12:00" }]);
    expect(horarioDoDia(L, 0)).toEqual([{ abre: "07:00", fecha: "12:00" }]);
    expect(horarioDoDia(L, 3)).toEqual([{ abre: "08:00", fecha: "17:00" }]);
  });
  it("sem porDia, o horário", () => {
    for (let d = 0; d < 7; d++) expect(horarioDoDia(SEM_GRUPO, d)).toEqual(L.horario);
  });
  it("sem nada, undefined", () => {
    expect(horarioDoDia({}, 2)).toBeUndefined();
  });
});

describe("fechadoAgora lê o horário DO DIA", () => {
  it("sábado 7h30: aberto (o grupo vale)", () => {
    expect(fechadoAgora(L, agora(6, h(7, 30)))).toBe(false);
  });
  it("sábado 12h30: fechado, mesmo com o base indo até 17h", () => {
    expect(fechadoAgora(L, agora(6, h(12, 30)))).toBe(true);
  });
  it("quarta 12h30: aberto (o base vale)", () => {
    expect(fechadoAgora(L, agora(3, h(12, 30)))).toBe(false);
  });
  it("quarta 7h30: fechado (o grupo NÃO vale na quarta)", () => {
    expect(fechadoAgora(L, agora(3, h(7, 30)))).toBe(true);
  });
});

describe("rotuloAbertura usa as faixas do dia certo", () => {
  it("domingo 18h: abre amanhã às 8h — a hora de SEGUNDA, não a de domingo", () => {
    expect(rotuloAbertura(L, agora(0, h(18)))).toBe("abre amanhã às 8h");
  });
  it("sexta 18h: abre amanhã às 7h — a hora de SÁBADO", () => {
    expect(rotuloAbertura(L, agora(5, h(18)))).toBe("abre amanhã às 7h");
  });
  it("sábado 6h: abre às 7h", () => {
    expect(rotuloAbertura(L, agora(6, h(6)))).toBe("abre às 7h");
  });
  it("com dias seg+sab e grupo só sab: segunda 18h → abre sábado às 7h", () => {
    const M: Abertura = { ...L, dias: ["seg", "sab"], porDia: [{ dias: ["sab"], faixas: [{ abre: "07:00", fecha: "12:00" }] }] };
    expect(rotuloAbertura(M, agora(1, h(18)))).toBe("abre sábado às 7h");
  });
  it("sem grupos, como sempre: abre amanhã às 8h", () => {
    expect(rotuloAbertura(SEM_GRUPO, agora(2, h(18)))).toBe("abre amanhã às 8h");
  });
});

describe("rotuloFaixa com o dia", () => {
  it("sábado: Fecha às 12h, abre às 7h.", () => {
    expect(rotuloFaixa(L, 6)).toBe("Fecha às 12h, abre às 7h.");
  });
  it("quarta, e sem o dia: o base, como hoje", () => {
    expect(rotuloFaixa(L, 3)).toBe("Fecha às 17h, abre às 8h.");
    expect(rotuloFaixa(L)).toBe("Fecha às 17h, abre às 8h.");
  });
});

describe("aberturaDaFicha carrega o horarioPorDia", () => {
  it("porDia vem de f.horarioPorDia", () => {
    const g: GrupoDeHorario[] = [{ dias: ["sab"], faixas: [{ abre: "07:00", fecha: "12:00" }] }];
    expect(aberturaDaFicha({ horario: L.horario, horarioPorDia: g }).porDia).toEqual(g);
    expect(aberturaDaFicha({ horario: L.horario }).porDia).toBeUndefined();
  });
});

describe("linhasDoHorario", () => {
  it("com grupo: a linha do base (dias abertos menos os do grupo) e uma por grupo", () => {
    const l = linhasDoHorario({ horario: L.horario, horarioPorDia: L.porDia });
    expect(l).toHaveLength(2);
    expect(l[0].faixas).toBe("8h–17h");
    expect(l[0].dias).toBe(rotuloDias(["seg", "ter", "qua", "qui", "sex"]));
    expect(l[1].faixas).toBe("7h–12h");
    expect(l[1].dias).toBe(rotuloDias(["sab", "dom"]));
  });
  it("com dias: o base são os dias abertos menos os do grupo", () => {
    const l = linhasDoHorario({
      horario: L.horario,
      dias: ["seg", "qua", "sab"],
      horarioPorDia: [{ dias: ["sab"], faixas: [{ abre: "07:00", fecha: "12:00" }] }],
    });
    expect(l[0].dias).toBe(rotuloDias(["seg", "qua"]));
    expect(l[1].dias).toBe(rotuloDias(["sab"]));
  });
  it("sem grupos: []", () => {
    expect(linhasDoHorario({ horario: L.horario })).toEqual([]);
  });
});

describe("problemaDosGrupos: a regra de escrita", () => {
  const F = [{ abre: "07:00", fecha: "12:00" }];
  const doc = { horario: L.horario };
  it("o grupo de L é válido", () => {
    expect(problemaDosGrupos(L.porDia, doc)).toBeNull();
  });
  it("dois grupos válidos e dias respondidos também", () => {
    expect(
      problemaDosGrupos(
        [{ dias: ["sab"], faixas: F }, { dias: ["dom"], faixas: [{ abre: "09:00", fecha: "13:00" }] }],
        { ...doc, dias: ["seg", "sab", "dom"] },
      ),
    ).toBeNull();
  });

  const casos: [string, unknown, { horario?: unknown; dias?: unknown }][] = [
    ["grupo sem dia", [{ dias: [], faixas: F }], doc],
    ["grupo sem faixa", [{ dias: ["sab"], faixas: [] }], doc],
    ["faixa inválida", [{ dias: ["sab"], faixas: [{ abre: "7h", fecha: "12:00" }] }], doc],
    ["mesmo dia em dois grupos", [{ dias: ["sab"], faixas: F }, { dias: ["sab", "dom"], faixas: [{ abre: "09:00", fecha: "10:00" }] }], doc],
    ["dia fora de dias", [{ dias: ["seg"], faixas: F }], { ...doc, dias: ["sab", "dom"] }],
    ["sem horario", L.porDia, {}],
    ["grupo cobre todos os dias abertos", [{ dias: ["sab", "dom"], faixas: F }], { ...doc, dias: ["sab", "dom"] }],
    ["faixas iguais às do horario", [{ dias: ["sab"], faixas: [{ abre: "08:00", fecha: "17:00" }] }], doc],
    ["mais de 3 grupos", ["seg", "ter", "qua", "qui"].map((d) => ({ dias: [d], faixas: F })), doc],
    ["não-lista", "sab", doc],
    ["lista vazia", [], doc],
  ];

  it.each(casos)("recusa com frase: %s", (_n, grupos, d) => {
    const p = problemaDosGrupos(grupos, d);
    expect(typeof p).toBe("string");
    expect((p as string).length).toBeGreaterThan(0);
  });

  it("grupo com os 7 dias (sem dias no lugar) é recusado com a MESMA frase do que cobre todos os abertos", () => {
    const todos = problemaDosGrupos([{ dias: [...DIAS], faixas: F }], doc);
    expect(todos).toBeTruthy();
    expect(todos).toBe(problemaDosGrupos([{ dias: ["sab", "dom"], faixas: F }], { ...doc, dias: ["sab", "dom"] }));
  });

  it("cada causa tem frase DIFERENTE (nenhuma serve a duas)", () => {
    const frases = casos.map(([, g, d]) => problemaDosGrupos(g, d));
    expect(new Set(frases).size).toBe(casos.length);
  });

  it("a faixa inválida diz a frase de problemaDasFaixas", async () => {
    const { problemaDasFaixas } = await import("@/lib/horario");
    const ruim = [{ abre: "7h", fecha: "12:00" }];
    expect(problemaDosGrupos([{ dias: ["sab"], faixas: ruim }], doc)).toBe(problemaDasFaixas(ruim));
  });

  it("as frases são constantes exportadas (GRUPO_*), uma por causa própria", () => {
    const nomes = Object.keys(horario).filter((k) => k.startsWith("GRUPO_"));
    expect(nomes.length).toBeGreaterThanOrEqual(9);
  });
});
