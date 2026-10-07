import { afterEach, describe, expect, it } from "vitest";
import {
  CHAVE_FILA,
  CHAVE_FILA_VELHA,
  diaRecife,
  guardar,
  lugarDoCorpo,
  pendentes,
  relatosDaPagina,
  remover,
  type Relato,
} from "@/lib/fila-relato";

afterEach(() => localStorage.clear());

/** 🔴 O DEFEITO QUE ESTA FILA FECHA (2026-09-10): o `✓ Fui` é a ÚNICA porta pela
 *  qual conhecimento de quem foi entra neste app sem o dono escrever uma ficha —
 *  e ela se fechava exatamente onde a pessoa está quando tem o que contar: no
 *  lugar, sem sinal. O `catch` do envio pintava uma tela de erro e o relato
 *  morria ali.
 *
 *  Nenhum teste daqui usa timer falso: **o relógio entra por parâmetro**, que é
 *  o que permite virar o dia sem mexer em estado global. */
const UM_DIA = 86_400_000;
// 2027-01-15, 14h em Recife (17h UTC) — bem longe das bordas do dia.
const AGORA = Date.UTC(2027, 0, 15, 17, 0);

const relato = (slug: string, tipo: "seco" | "barro" = "seco", ms = AGORA): Relato => ({
  slug,
  tipo,
  dia: diaRecife(ms),
});

describe("diaRecife: a conta que agora tem um dono só", () => {
  // 🔴 Ela estava escrita à mão dentro do ConfirmarFui.tsx, e passou a ser
  // precisa em dois lugares (a chave do "já contou" e o descarte da fila).
  it("o dia vira às 03h UTC, que é a meia-noite de Recife (UTC−3)", () => {
    const vespera = Date.UTC(2027, 0, 16, 2, 59); // 23h59 do dia 15, em Recife
    const virada = Date.UTC(2027, 0, 16, 3, 0); //  00h00 do dia 16, em Recife
    expect(diaRecife(virada)).toBe(diaRecife(vespera) + 1);
  });

  // 🔴 O CONTROLE DO FUSO, e ele é o que separa "a conta está certa" de "a conta
  // roda": se `diaRecife` esquecesse o offset e usasse UTC puro, o teste acima
  // continuaria passando — a virada só mudaria de hora. Esta asserção fixa QUAL
  // hora, e mata a versão sem fuso.
  it("e NÃO vira à meia-noite UTC — senão o fuso não estaria lá", () => {
    const antesUTC = Date.UTC(2027, 0, 15, 23, 59);
    const depoisUTC = Date.UTC(2027, 0, 16, 0, 0);
    expect(diaRecife(depoisUTC)).toBe(diaRecife(antesUTC));
  });

  it("a tarde inteira de um mesmo dia é o mesmo dia", () => {
    expect(diaRecife(AGORA)).toBe(diaRecife(AGORA + 3 * 3_600_000));
  });
});

describe("a fila guarda e devolve", () => {
  it("o que foi guardado volta em pendentes", () => {
    guardar(relato("rampa-do-pepe", "barro"));
    expect(pendentes(AGORA)).toEqual([{ slug: "rampa-do-pepe", tipo: "barro", dia: diaRecife(AGORA) }]);
  });

  it("trilhas diferentes convivem", () => {
    guardar(relato("rampa-do-pepe"));
    guardar(relato("veu-de-noiva-de-bonito", "barro"));
    expect(pendentes(AGORA).map((r) => r.slug).sort()).toEqual([
      "rampa-do-pepe",
      "veu-de-noiva-de-bonito",
    ]);
  });

  // 🔴 MUTAÇÃO: um `push` simples no lugar do filtro. A pessoa que erra o botão
  // e responde de novo viraria DOIS relatos, e nenhum contador de "foram"
  // aguenta contar a mesma ida duas vezes sem mentir.
  it("um relato por trilha por dia — o último ganha, e não vira dois", () => {
    guardar(relato("rampa-do-pepe", "seco"));
    guardar(relato("rampa-do-pepe", "barro"));
    expect(pendentes(AGORA)).toHaveLength(1);
    expect(pendentes(AGORA)[0].tipo).toBe("barro");
  });

  it("remover tira só o relato certo", () => {
    guardar(relato("rampa-do-pepe"));
    guardar(relato("veu-de-noiva-de-bonito"));
    remover(relato("rampa-do-pepe"));
    expect(pendentes(AGORA).map((r) => r.slug)).toEqual(["veu-de-noiva-de-bonito"]);
  });
});

describe("o descarte do dia vencido, que é a decisão mais delicada daqui", () => {
  // 🔴 O placar do app é do DIA DE HOJE. Um relato de ontem subindo hoje seria
  // contado como se a pessoa tivesse ido hoje — o app afirmando sobre um dia em
  // que ninguém foi. Enquanto a rota não carregar o dia de origem, o relato
  // vencido é descartado, e isso está anotado como pergunta no RESUME.
  it("relato de ontem não sobe", () => {
    guardar(relato("rampa-do-pepe", "seco", AGORA - UM_DIA));
    expect(pendentes(AGORA)).toEqual([]);
  });

  it("e ele some do armazenamento — fila que só cresce é lixo no aparelho", () => {
    guardar(relato("rampa-do-pepe", "seco", AGORA - UM_DIA));
    pendentes(AGORA);
    expect(localStorage.getItem(CHAVE_FILA)).toBeNull();
  });

  it("o de ontem some sem levar o de hoje junto", () => {
    guardar(relato("rampa-do-pepe", "seco", AGORA - UM_DIA));
    guardar(relato("veu-de-noiva-de-bonito", "barro"));
    expect(pendentes(AGORA).map((r) => r.slug)).toEqual(["veu-de-noiva-de-bonito"]);
  });
});

describe("corpo inválido é fila VAZIA, nunca relato inventado", () => {
  // 🔴 `localStorage` é editável por qualquer um e sobrevive a troca de versão
  // do app. Um JSON de outra época daria `undefined` nos três campos, e um
  // relato com `slug: undefined` subiria pra uma ficha que não existe. Mesma
  // régua do `ehLeitura` no Carimbo — o corpo é conferido, não assumido.
  // 🔴 TODO CORPO PODRE AQUI CARREGA O DIA DE HOJE, e isso é o teste. A
  // primeira versão deste bloco usava `dia: 20000` — um dia de 2024 — e
  // **passava por engano**: quem rejeitava era o DESCARTE POR DIA, não o
  // validador. Medido por mutação (M30): trocar `cru.filter(ehRelato)` por um
  // `cast` cru deixava a suíte VERDE. O teste dizia provar uma coisa e provava
  // outra.
  const HOJE = diaRecife(AGORA);
  it.each([
    ["JSON quebrado", "{{{"],
    ["não é lista", '{"slug":"x"}'],
    ["item sem slug", `[{"tipo":"seco","dia":${HOJE}}]`],
    ["tipo fora do par", `[{"slug":"x","tipo":"lama","dia":${HOJE}}]`],
    ["dia não é número", '[{"slug":"x","tipo":"seco","dia":"hoje"}]'],
    ["slug vazio", `[{"slug":"","tipo":"seco","dia":${HOJE}}]`],
    ["item nulo", `[null,{"slug":"x","tipo":"seco"}]`],
  ])("%s não vira relato", (_nome, cru) => {
    localStorage.setItem(CHAVE_FILA, cru);
    expect(pendentes(AGORA)).toEqual([]);
  });

  it("e o item bom sobrevive ao item podre ao lado", () => {
    const bom = { slug: "rampa-do-pepe", tipo: "seco", dia: diaRecife(AGORA) };
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: 42, tipo: "seco", dia: diaRecife(AGORA) }, bom]));
    expect(pendentes(AGORA)).toEqual([bom]);
  });
});

describe("a chave não fica pra trás", () => {
  // Sem isto, todo aparelho que uma vez ficou sem sinal carregaria a chave pra
  // sempre — e um `localStorage` cheio de chaves mortas é o que faz o app
  // parecer que "guardou alguma coisa" quando não guardou nada.
  it("esvaziar a fila APAGA a chave, em vez de guardar uma lista vazia", () => {
    const r = relato("rampa-do-pepe");
    guardar(r);
    expect(localStorage.getItem(CHAVE_FILA)).not.toBeNull(); // controle
    remover(r);
    expect(localStorage.getItem(CHAVE_FILA)).toBeNull();
  });
});

// 🔴 A IDENTIDADE DO LUGAR NA FILA (Tarefa 12b, 12-N6). O endereço não é
// identidade: P sai de `A`, Q passa a morar em `A` no mesmo dia. O relato
// carrega o `lugar` (o menor `id` das versões de P), e é por ele que a fila
// deduplica, remove e escolhe o que cada página sobe.
describe("o relato carrega o lugar", () => {
  const A = "lugar-marcador-a";
  const B = "lugar-marcador-b";
  const P = 17;
  const Q = 23;
  const comLugar = (slug: string, lugar: number, tipo: "seco" | "barro" = "seco"): Relato => ({
    ...relato(slug, tipo),
    lugar,
  });

  it("o lugar volta inteiro em pendentes", () => {
    guardar(comLugar(A, P, "barro"));
    expect(pendentes(AGORA)).toEqual([{ slug: A, tipo: "barro", dia: diaRecife(AGORA), lugar: P }]);
  });

  // B8 — uma classe por caso (48ª espécie: regra que confere várias coisas,
  // provada por uma só). Todos com o dia de HOJE, senão quem recusa é o
  // descarte por dia (a lição do M30, acima).
  const HOJE = diaRecife(AGORA);
  it.each([
    ["texto", '"17"'],
    ["fração", "1.5"],
    ["zero", "0"],
    ["negativo", "-1"],
    ["nulo", "null"],
    ["infinito (1e999 vira Infinity no JSON.parse)", "1e999"],
    ["lista", "[17]"],
  ])("lugar %s não vira relato", (_nome, lugar) => {
    localStorage.setItem(CHAVE_FILA, `[{"slug":"${A}","tipo":"seco","dia":${HOJE},"lugar":${lugar}}]`);
    expect(pendentes(AGORA)).toEqual([]);
  });

  // O CONTROLE das classes acima: o inteiro positivo passa, e o relato sem
  // lugar (o legado) também — senão as recusas de cima seriam vácuas.
  it("lugar inteiro positivo passa, e o relato sem lugar (legado) também", () => {
    localStorage.setItem(
      CHAVE_FILA,
      `[{"slug":"${A}","tipo":"seco","dia":${HOJE},"lugar":17},{"slug":"${B}","tipo":"seco","dia":${HOJE}}]`,
    );
    expect(pendentes(AGORA)).toEqual([
      { slug: A, tipo: "seco", dia: HOJE, lugar: 17 },
      { slug: B, tipo: "seco", dia: HOJE },
    ]);
  });

  // I3 — a dedup era por (slug, dia): o relato de Q em A sobrescrevia o de P
  // em A, e remover um apagava o outro.
  it("dois lugares contados no MESMO endereço no mesmo dia convivem", () => {
    guardar(comLugar(A, P, "seco"));
    guardar(comLugar(A, Q, "barro"));
    expect(pendentes(AGORA)).toHaveLength(2);
  });

  it("e remover o de Q não leva o de P junto", () => {
    guardar(comLugar(A, P));
    guardar(comLugar(A, Q));
    remover(comLugar(A, Q));
    expect(pendentes(AGORA)).toEqual([comLugar(A, P)]);
  });

  it("o MESMO lugar contado em dois endereços no mesmo dia é um relato só — o último", () => {
    guardar(comLugar(A, P, "seco"));
    guardar(comLugar(B, P, "barro"));
    expect(pendentes(AGORA)).toEqual([comLugar(B, P, "barro")]);
  });

  it("o relato legado e o com lugar no mesmo endereço não se confundem", () => {
    guardar(relato(A));
    guardar(comLugar(A, P));
    expect(pendentes(AGORA)).toHaveLength(2);
  });
});

describe("relatosDaPagina: o que cada página sobe", () => {
  const A = "lugar-marcador-a";
  const B = "lugar-marcador-b";
  const P = 17;
  const Q = 23;
  const dia = diaRecife(AGORA);

  // 🔴 C2 da auditoria da 12b: a página de Q, que mora hoje no endereço onde P
  // foi contado, NÃO sobe o relato de P — ele fica esperando a página de P.
  it("a página de Q em A não sobe o relato de P contado em A", () => {
    const fila: Relato[] = [{ slug: A, tipo: "seco", dia, lugar: P }];
    expect(relatosDaPagina(fila, { slug: A, antigos: [], lugar: Q })).toEqual([]);
  });

  it("a página de P sobe o relato de P em QUALQUER endereço", () => {
    const fila: Relato[] = [{ slug: A, tipo: "seco", dia, lugar: P }];
    expect(relatosDaPagina(fila, { slug: B, antigos: [], lugar: P })).toEqual(fila);
  });

  it("página sem identidade (a leitura falhou) não sobe relato COM lugar", () => {
    const fila: Relato[] = [{ slug: A, tipo: "seco", dia, lugar: P }];
    expect(relatosDaPagina(fila, { slug: A, antigos: [], lugar: null })).toEqual([]);
  });

  // O relato LEGADO é aceito como hoje (decisão do João, 06/10: "aceitar
  // como hoje"): sobe pela página do endereço dele, ou de um antigo — e só.
  const legado: Relato = { slug: A, tipo: "seco", dia };
  it("o legado sobe pela página do endereço dele (ou de um antigo), e não por outra", () => {
    expect(relatosDaPagina([legado], { slug: A, antigos: [], lugar: P })).toEqual([legado]);
    expect(relatosDaPagina([legado], { slug: A, antigos: [], lugar: null })).toEqual([legado]);
    expect(relatosDaPagina([legado], { slug: B, antigos: [A], lugar: P })).toEqual([legado]);
    expect(relatosDaPagina([legado], { slug: B, antigos: [], lugar: P })).toEqual([]);
  });
});

describe("lugarDoCorpo: o que o servidor faz com a identidade do POST", () => {
  it("lugar inteiro positivo: grava por ele", () => {
    expect(lugarDoCorpo({ lugar: 17 })).toEqual({ lugar: 17 });
  });

  it.each([["texto", "17"], ["fração", 1.5], ["zero", 0], ["negativo", -1], ["nulo", null], ["NaN", Number.NaN]])(
    "lugar %s: recusa",
    (_nome, lugar) => {
      expect(lugarDoCorpo({ lugar })).toBe("recusa");
    },
  );

  it("sem lugar é o legado (aceito como hoje)", () => {
    expect(lugarDoCorpo({})).toBe("legado");
  });
});

// 🔴 A CHAVE NOVA (M1 da revisão da 12b). Uma aba aberta antes do deploy roda
// o código velho, que lê e escreve SÓ `bp:fila-relato` e sobe `{slug, tipo}`
// sem o `lugar`: se o relato novo morasse ali, ela o subiria sem identidade
// (contaria pra quem retomou o endereço) e o apagaria da fila.
describe("a fila nova mora numa chave que o código velho não lê", () => {
  const A = "lugar-marcador-a";
  const B = "lugar-marcador-b";
  const P = 17;
  const HOJE = diaRecife(AGORA);
  const velha = () => JSON.parse(localStorage.getItem(CHAVE_FILA_VELHA) ?? "null");

  it("as duas chaves são diferentes, e a velha é a de antes", () => {
    expect(CHAVE_FILA_VELHA).toBe("bp:fila-relato");
    expect(CHAVE_FILA).not.toBe(CHAVE_FILA_VELHA);
  });

  it("relato novo gravado: a chave velha não o contém (nem nasce)", () => {
    guardar({ slug: A, tipo: "barro", dia: HOJE, lugar: P });
    expect(localStorage.getItem(CHAVE_FILA_VELHA)).toBeNull();
    expect(JSON.parse(localStorage.getItem(CHAVE_FILA) ?? "[]")).toEqual([
      { slug: A, tipo: "barro", dia: HOJE, lugar: P },
    ]);
  });

  it("com um legado na chave velha, o relato novo vai pra nova e a velha fica como estava", () => {
    localStorage.setItem(CHAVE_FILA_VELHA, JSON.stringify([{ slug: B, tipo: "seco", dia: HOJE }]));
    guardar({ slug: A, tipo: "barro", dia: HOJE, lugar: P });
    expect(velha()).toEqual([{ slug: B, tipo: "seco", dia: HOJE }]);
  });

  it("o legado da chave velha é lido, e sobe pela página do endereço dele", () => {
    localStorage.setItem(CHAVE_FILA_VELHA, JSON.stringify([{ slug: A, tipo: "seco", dia: HOJE }]));
    const fila = pendentes(AGORA);
    expect(fila).toEqual([{ slug: A, tipo: "seco", dia: HOJE }]);
    expect(relatosDaPagina(fila, { slug: A, antigos: [], lugar: P })).toEqual(fila);
  });

  it("removido o último legado, a chave velha é APAGADA", () => {
    localStorage.setItem(
      CHAVE_FILA_VELHA,
      JSON.stringify([
        { slug: A, tipo: "seco", dia: HOJE },
        { slug: B, tipo: "barro", dia: HOJE },
      ]),
    );
    remover({ slug: A, tipo: "seco", dia: HOJE });
    expect(velha(), "removeu o relato errado, ou nenhum").toEqual([{ slug: B, tipo: "barro", dia: HOJE }]);
    remover({ slug: B, tipo: "barro", dia: HOJE });
    expect(localStorage.getItem(CHAVE_FILA_VELHA)).toBeNull();
  });

  it("o legado vencido da chave velha some, e a chave junto", () => {
    localStorage.setItem(CHAVE_FILA_VELHA, JSON.stringify([{ slug: A, tipo: "seco", dia: HOJE - 1 }]));
    expect(pendentes(AGORA)).toEqual([]);
    expect(localStorage.getItem(CHAVE_FILA_VELHA)).toBeNull();
  });

  // O mesmo relato nas duas chaves (a aba velha e a página sem identidade
  // guardaram o mesmo endereço no mesmo dia) subiria duas vezes.
  it("o mesmo relato nas duas chaves aparece UMA vez — o da chave nova", () => {
    localStorage.setItem(CHAVE_FILA_VELHA, JSON.stringify([{ slug: A, tipo: "seco", dia: HOJE }]));
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: A, tipo: "barro", dia: HOJE }]));
    expect(pendentes(AGORA)).toEqual([{ slug: A, tipo: "barro", dia: HOJE }]);
  });

  it("guardar o mesmo relato tira a cópia da chave velha", () => {
    localStorage.setItem(CHAVE_FILA_VELHA, JSON.stringify([{ slug: A, tipo: "seco", dia: HOJE }]));
    guardar({ slug: A, tipo: "barro", dia: HOJE });
    expect(localStorage.getItem(CHAVE_FILA_VELHA)).toBeNull();
    expect(pendentes(AGORA)).toEqual([{ slug: A, tipo: "barro", dia: HOJE }]);
  });
});
