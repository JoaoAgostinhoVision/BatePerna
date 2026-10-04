import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { aplicarCampo, aplicarNoRascunho, removerCampo, tirarDoRascunho } from "@/lib/campos-da-ficha";
import { loadAll } from "@/lib/ficha";
import { aberturaDaFicha, fechadoAgora, rotuloAbertura } from "@/lib/horario";
import { fichaSchema } from "@/types/ficha";

// 🔴 C5 da revisão do controlador: `.find` sem guarda devolve `undefined`, e
// `JSON.stringify(undefined)` é o VALOR `undefined` — que só estoura lá na
// frente, no `JSON.parse`, com uma mensagem que não diz nada sobre a causa.
const fichaBase = loadAll().find((f) => f.slug === "rampa-do-pepe");
if (!fichaBase) throw new Error('"rampa-do-pepe" sumiu de content/fichas');
const DOC = JSON.stringify(fichaBase);

/** Devolve o que a chamada ESTOUROU, pra poder perguntar QUEM recusou — e não
 *  só que alguém recusou. Ver o comentário da M3 lá embaixo. */
function estouro(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("não estourou, e devia");
}

// A Rampa não tem `horario` — quem tem é a Pedra Furada (05:00–17:00). O
// `dias === undefined` é exigência do teste da CONSEQUÊNCIA lá embaixo: a hora
// precisa ser a ÚNICA causa de fechamento, senão tirar o horário não muda a
// resposta do motor e o teste mediria outra coisa.
const comHora = loadAll().find((f) => f.horario !== undefined && f.dias === undefined);
if (!comHora) {
  throw new Error("nenhuma ficha do acervo tem `horario` sem `dias`; o bloco H1 ficaria sem prova");
}
const DOC_HORA = JSON.stringify(comHora);

describe("aplicarCampo", () => {
  it("alcança chave de 1º nível", () => {
    expect(JSON.parse(aplicarCampo(DOC, "voz", "a serra firmou")).voz).toBe("a serra firmou");
  });

  // 🔴 O `{...atual, [campo]: valor}` de antes NÃO fazia isto — é a mudança
  // que destrava preço, horário e a regra da chuva.
  it("alcança caminho ANINHADO sem derrubar os irmãos", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(aplicarCampo(DOC, "custo.valor", "R$ 12,00"));
    expect(depois.custo.valor).toBe("R$ 12,00");
    expect(depois.custo.tag).toBe(antes.custo.tag);
    expect(depois.custo.curto).toBe(antes.custo.curto);
  });

  it("alcança caminho de 3 degraus", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(aplicarCampo(DOC, "condicao.regra.limiar_mm", 12));
    expect(depois.condicao.regra.limiar_mm).toBe(12);
    expect(depois.condicao.regra.janela_passado_horas).toBe(antes.condicao.regra.janela_passado_horas);
    expect(depois.condicao.severidade).toBe(antes.condicao.severidade);
  });

  it("alcança índice de array", () => {
    const depois = JSON.parse(aplicarCampo(DOC, "trajeto.waypoints.0.nome", "Outro nome"));
    expect(depois.trajeto.waypoints[0].nome).toBe("Outro nome");
  });

  it("índice de waypoint que não existe é recusado, e NÃO é criado", () => {
    expect(() => aplicarCampo(DOC, "trajeto.waypoints.7.nome", "inventado")).toThrow();
  });

  // O molde é do registro; quem grava fala em índice.
  it("o MOLDE não é caminho gravável", () => {
    expect(() => aplicarCampo(DOC, "trajeto.waypoints[].nome", "x")).toThrow();
  });

  it("grava número, booleano, lista e coordenada — não só string", () => {
    expect(JSON.parse(aplicarCampo(DOC, "condicao.regra.limiar_mm", 12)).condicao.regra.limiar_mm).toBe(12);
    expect(JSON.parse(aplicarCampo(DOC, "carroComum", false)).carroComum).toBe(false);
    expect(JSON.parse(aplicarCampo(DOC, "dias", ["sab", "dom"])).dias).toEqual(["sab", "dom"]);
    const c = JSON.parse(aplicarCampo(DOC, "condicao.coords", { lat: -8.5, lng: -36.1 }));
    expect(c.condicao.coords).toEqual({ lat: -8.5, lng: -36.1 });
  });

  // 🔴 A REGRA MAIS IMPORTANTE DESTA TAREFA. Medida em `[slug]/page.tsx:105`:
  // `ficha.custo.curto ?? precoCurto` — o `??` não pega "", então gravar ""
  // deixaria o chip EM BRANCO na ficha pública em vez de cair no preço.
  it("string vazia é RECUSADA, em campo opcional e em obrigatório", () => {
    expect(() => aplicarCampo(DOC, "custo.curto", "")).toThrow();
    expect(() => aplicarCampo(DOC, "voz", "")).toThrow();
    expect(() => aplicarCampo(DOC, "secaRapido", "   ")).toThrow();
  });

  // O `z.string()` do schema aceita "" — então quem recusa é a porta, e só
  // ela. Sem esta asserção, tirar a recusa deixaria `""` chegar ao documento
  // com a suíte verde em todo o resto.
  it("a recusa de vazio é da PORTA, e o documento sai intacto quando ela dispara", () => {
    expect(() => aplicarCampo(DOC, "custo.valor", "")).toThrow();
    expect(JSON.parse(DOC).custo.valor).toBe(fichaBase.custo.valor);
    // e o vazio dentro de uma lista também não passa
    expect(() => aplicarCampo(DOC, "dias", ["sab", ""])).toThrow();
  });

  it("valor do tipo errado estoura, e NÃO devolve documento", () => {
    expect(() => aplicarCampo(DOC, "voz", 42 as never)).toThrow();
    expect(() => aplicarCampo(DOC, "condicao.regra.limiar_mm", "doze" as never)).toThrow();
    expect(() => aplicarCampo(DOC, "piso", "asfalto-de-mentira")).toThrow();
  });

  // 🔴 I3 DA REVISÃO (2026-09-26), refeito na 11c pra LISTA de faixas. A regex
  // HH:MM do schema não estava pinada por nada — e morde assim:
  // `minutosDeHHMM("8h")` dá `NaN`, `fechadoNaHora` devolve `false` (o lugar
  // nunca fecha) e o chip da ficha pública renderiza `NaNhundefined`. Agora há
  // DUAS portas em série (a regra da escrita, `problemaDasFaixas`, e o schema),
  // e cada uma é provada SOZINHA — senão arrancar uma sobrevive porque a outra
  // estoura igual (47ª espécie).
  it("o schema de LEITURA recusa `8h` nas duas formas, e aceita a hora certa", () => {
    const com = (horario: unknown) => fichaSchema.safeParse({ ...JSON.parse(DOC), horario }).success;
    expect(com([{ abre: "08:00", fecha: "17:00" }]), "o controle: a lista certa passa").toBe(true);
    expect(com({ abre: "08:00", fecha: "17:00" }), "o controle: a forma velha passa").toBe(true);
    expect(com([{ abre: "8h", fecha: "17:00" }])).toBe(false);
    expect(com({ abre: "8h", fecha: "17:00" })).toBe(false);
    expect(com([{ abre: "08:00", fecha: "17h" }])).toBe(false);
  });

  // 🔴 11c-C1 NA LEITURA: `[]` não é "sem horário" — sem horário é a chave
  // AUSENTE. Uma lista vazia lida como horário fecharia o lugar a qualquer hora.
  // E mais de 3 faixas não é forma que o app conheça.
  it("o schema de LEITURA recusa a lista vazia e a de 4 faixas", () => {
    const com = (horario: unknown) => fichaSchema.safeParse({ ...JSON.parse(DOC), horario }).success;
    const f = (abre: string, fecha: string) => ({ abre, fecha });
    expect(com([f("06:00", "07:00"), f("08:00", "09:00"), f("10:00", "11:00")]), "o controle: 3 passam").toBe(true);
    expect(com([])).toBe(false);
    expect(com([f("06:00", "07:00"), f("08:00", "09:00"), f("10:00", "11:00"), f("12:00", "13:00")])).toBe(false);
  });

  it("a porta de escrita recusa `8h` com FRASE, antes de o schema ver", () => {
    const e = estouro(() => aplicarCampo(DOC_HORA, "horario", [{ abre: "8h", fecha: "17:00" }]));
    expect(e).not.toBeInstanceOf(ZodError);
    expect((e as Error).message).toContain('"8h"');
  });

  it("caminho fora do registro é recusado", () => {
    expect(() => aplicarCampo(DOC, "slug", "outro")).toThrow();
    expect(() => aplicarCampo(DOC, "modos", ["x"])).toThrow();
    expect(() => aplicarCampo(DOC, "condicao.regra.tipo", "chuva_binaria")).toThrow();
    expect(() => aplicarCampo(DOC, "inventado", "x")).toThrow();
  });

  it("documento já podre no banco não passa por ser editado num campo bom", () => {
    expect(() => aplicarCampo('{"slug":"x"}', "voz", "qualquer")).toThrow();
  });

  // 🔴 Sem este teste, trocar o caminhar-por-caminho por `{[c]: v}` passa
  // verde no teste de cima (o campo muda mesmo) e apaga a ficha inteira.
  it("só o campo pedido muda; todo o resto sai idêntico", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(aplicarCampo(DOC, "voz", "outra coisa"));
    expect({ ...depois, voz: antes.voz }).toEqual(antes);
  });

  // O mesmo, um degrau mais fundo: o `{...atual, [caminho]: valor}` gravaria
  // uma chave literal `"custo.valor"` ao lado do `custo` e o irmão sumiria.
  it("só o campo pedido muda também quando ele é aninhado", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(aplicarCampo(DOC, "custo.valor", "R$ 12,00"));
    expect({ ...depois, custo: antes.custo }).toEqual(antes);
    expect(Object.keys(depois)).not.toContain("custo.valor");
  });

  it("não muta o documento que recebeu", () => {
    const original = JSON.parse(DOC);
    aplicarCampo(DOC, "trajeto.waypoints.0.nome", "mexido");
    expect(JSON.parse(DOC)).toEqual(original);
  });
});

describe("removerCampo — o 'não sei'", () => {
  it("tira a chave do documento em vez de gravar vazio", () => {
    const depois = JSON.parse(removerCampo(DOC, "piso"));
    expect("piso" in depois).toBe(false);
  });

  it("tira chave aninhada sem derrubar os irmãos", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(removerCampo(DOC, "custo.curto"));
    expect("curto" in depois.custo).toBe(false);
    expect(depois.custo.valor).toBe(antes.custo.valor);
    expect(depois.custo.tag).toBe(antes.custo.tag);
  });

  it("campo OBRIGATÓRIO não pode virar 'não sei'", () => {
    expect(() => removerCampo(DOC, "voz")).toThrow();
    expect(() => removerCampo(DOC, "custo.tag")).toThrow();
    expect(() => removerCampo(DOC, "trajeto.waypoints.0.nome")).toThrow();
    expect(() => removerCampo(DOC, "condicao.regra.limiar_mm")).toThrow();
  });

  // 🔴 M3 DO PLANO DE MUTAÇÃO, E ELA SOBREVIVEU AO TESTE DE CIMA — medido em
  // 2026-09-26, não suposto. Trocar o `if (campo.obrigatorio)` de
  // `removerCampo` por `if (false)` deixa a suíte inteira VERDE, porque o
  // `fichaSchema.parse` do fim estoura de qualquer jeito: documento sem `voz`
  // não é ficha. O `toThrow()` prova que ALGUÉM recusou, nunca QUEM — e as
  // duas recusas são coisas diferentes. A do registro diz ao dono, em
  // português, que aquele campo não tem "não sei"; a do zod é um erro de
  // schema em inglês que ele nunca deveria ver. É esta asserção que mata a M3.
  it("a recusa de obrigatório vem do REGISTRO, não do schema", () => {
    for (const caminho of ["voz", "custo.tag", "trajeto.waypoints.0.nome", "condicao.regra.limiar_mm"]) {
      const e = estouro(() => removerCampo(DOC, caminho));
      expect(e, caminho).not.toBeInstanceOf(ZodError);
      expect((e as Error).message, caminho).toContain("obrigatório");
      expect((e as Error).message, caminho).toContain(caminho);
    }
  });

  it("caminho fora do registro também é recusado na remoção", () => {
    expect(() => removerCampo(DOC, "slug")).toThrow();
    expect(() => removerCampo(DOC, "inventado")).toThrow();
  });

  // 🔴 I2 DA REVISÃO (2026-09-26). A redação de antes era
  // `expect(() => JSON.parse(removerCampo(...))).not.toThrow()`, e ela era
  // VÁCUO: `JSON.parse` de um `JSON.stringify` nunca estoura. A asserção media
  // que `removerCampo` não estourou, e NADA sobre o documento ser válido. A
  // redação veio do brief — e o brief não é a régua. Quem valida é o schema.
  it("o documento continua válido depois de remover", () => {
    expect(() => fichaSchema.parse(JSON.parse(removerCampo(DOC, "secaRapido")))).not.toThrow();
    expect(() => fichaSchema.parse(JSON.parse(removerCampo(DOC, "piso")))).not.toThrow();
    expect(() => fichaSchema.parse(JSON.parse(removerCampo(DOC, "custo.curto")))).not.toThrow();
    expect(() => fichaSchema.parse(JSON.parse(removerCampo(DOC_HORA, "horario")))).not.toThrow();
  });

  it("só a chave pedida sai; todo o resto sai idêntico", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(removerCampo(DOC, "piso"));
    expect({ ...depois, piso: antes.piso }).toEqual(antes);
  });
});

// 🔴 RULING H1 (2026-09-26), e desde a Tarefa 11c o horário é UMA entrada do
// registro, de espécie `faixas`: a lista inteira de 1 a 3 faixas, gravada de
// uma vez — a gravação SUBSTITUI a lista (11c-I1 da auditoria). O "não sei"
// (que o painel diz "não tem") tira a chave, e é o ÚNICO caminho até "sem
// horário": `[]` é recusado (11c-C1).
describe("o horário inteiro — a lista de faixas e o 'não sei'", () => {
  const ALMOCO = [
    { abre: "08:00", fecha: "10:00" },
    { abre: "14:00", fecha: "17:00" },
  ];

  it("remover o horário tira a chave, e o documento continua válido", () => {
    const depois = JSON.parse(removerCampo(DOC_HORA, "horario"));
    expect("horario" in depois).toBe(false);
    expect(() => fichaSchema.parse(depois)).not.toThrow();
  });

  // 🔴 A CONSEQUÊNCIA DE VERDADE, medida no motor que a tela usa
  // (`fechadoAgora`, `src/lib/horario.ts:246`) — não na presença da chave.
  // Sem esta asserção, o teste de cima prova que uma chave sumiu do JSON e
  // nada sobre o que o app passa a dizer.
  it("o lugar DEIXA DE FECHAR por horário depois do 'não sei'", () => {
    const seisDaTarde = { minutos: 18 * 60, dia: 3, epochS: 0 }; // 18h, quarta
    const antes = fichaSchema.parse(JSON.parse(DOC_HORA));
    expect(fechadoAgora(aberturaDaFicha(antes), seisDaTarde), "a premissa: às 18h ele fecha").toBe(true);

    const depois = fichaSchema.parse(JSON.parse(removerCampo(DOC_HORA, "horario")));
    expect(fechadoAgora(aberturaDaFicha(depois), seisDaTarde)).toBe(false);
  });

  it("só o horário sai; todo o resto sai idêntico", () => {
    const antes = JSON.parse(DOC_HORA);
    const depois = JSON.parse(removerCampo(DOC_HORA, "horario"));
    expect({ ...depois, horario: antes.horario }).toEqual(antes);
  });

  it("tirar o horário de quem já não tem é inofensivo, e não inventa a chave", () => {
    const depois = JSON.parse(removerCampo(DOC, "horario"));
    expect("horario" in depois).toBe(false);
    expect(depois).toEqual(JSON.parse(DOC));
  });

  // 🔴 A GRAVAÇÃO SUBSTITUI A LISTA INTEIRA, com o horário presente — o
  // contrário do bloco de antes, que recusava. O intervalo do almoço entra
  // numa versão só: abre e fecha de cada faixa dependem um do outro.
  it("com o horário PRESENTE, gravar a lista substitui a lista inteira", () => {
    const depois = JSON.parse(aplicarCampo(DOC_HORA, "horario", ALMOCO));
    expect(depois.horario).toEqual(ALMOCO);
    expect({ ...depois, horario: comHora.horario }).toEqual(JSON.parse(DOC_HORA));
  });

  it("com o horário AUSENTE, gravar a lista GRAVA — o 'não sei' tem volta", () => {
    const depois = JSON.parse(aplicarCampo(DOC, "horario", [{ abre: "05:00", fecha: "17:00" }]));
    expect(depois.horario).toEqual([{ abre: "05:00", fecha: "17:00" }]);
    expect(() => fichaSchema.parse(depois)).not.toThrow();
  });

  // A CONSEQUÊNCIA, medida no motor da tela — e a ida e volta inteira: a Rampa
  // não fecha por hora, passa a fechar, e volta a não fechar.
  it("o lugar que não fechava PASSA A FECHAR às 18h, e o 'não sei' desfaz", () => {
    const seisDaTarde = { minutos: 18 * 60, dia: 6, epochS: 0 }; // 18h, sábado (a Rampa abre sáb/dom)
    const antes = fichaSchema.parse(JSON.parse(DOC));
    expect(fechadoAgora(aberturaDaFicha(antes), seisDaTarde), "a premissa: sem horário ela não fecha").toBe(false);

    const comHorario = aplicarCampo(DOC, "horario", [{ abre: "05:00", fecha: "17:00" }]);
    expect(fechadoAgora(aberturaDaFicha(fichaSchema.parse(JSON.parse(comHorario))), seisDaTarde)).toBe(true);

    const semDeNovo = removerCampo(comHorario, "horario");
    expect(fechadoAgora(aberturaDaFicha(fichaSchema.parse(JSON.parse(semDeNovo))), seisDaTarde)).toBe(false);
  });

  it("o intervalo gravado chega ao motor: ao meio-dia fechado, abre às 14h", () => {
    const meioDia = { minutos: 12 * 60, dia: 3, epochS: 0 };
    const f = fichaSchema.parse(JSON.parse(aplicarCampo(DOC_HORA, "horario", ALMOCO)));
    expect(fechadoAgora(aberturaDaFicha(f), meioDia)).toBe(true);
    expect(rotuloAbertura(aberturaDaFicha(f), meioDia)).toBe("abre às 14h");
  });

  // 🔴 "GRAVAR SEMPRE NA FORMA NOVA" vale pra esta porta (11c-I4): a ficha
  // gravada no objeto de antes sai em lista na PRIMEIRA edição de qualquer
  // campo, porque o documento inteiro passa pelo schema.
  it("a ficha na forma VELHA sai em lista na primeira edição de outro campo", () => {
    const velho = JSON.stringify({ ...JSON.parse(DOC), horario: { abre: "05:00", fecha: "17:00" } });
    const depois = JSON.parse(aplicarCampo(velho, "voz", "outra voz"));
    expect(depois.horario).toEqual([{ abre: "05:00", fecha: "17:00" }]);
  });

  // 🔴 AS RECUSAS SÃO DA PORTA, COM FRASE — nunca um ZodError cru (que a rota
  // devolveria como 400 mudo). `problemaDasFaixas` é a fonte das regras.
  it("lista vazia é recusada, e a frase manda usar o 'não tem'", () => {
    const e = estouro(() => aplicarCampo(DOC_HORA, "horario", []));
    expect(e).not.toBeInstanceOf(ZodError);
    expect((e as Error).message).toContain("não tem");
  });

  it("sobreposta, fora de ordem, 4 faixas, ou meia faixa: recusada com frase", () => {
    const casos: [unknown, RegExp][] = [
      [[{ abre: "08:00", fecha: "11:00" }, { abre: "10:00", fecha: "17:00" }], /sobrep/],
      [[ALMOCO[1], ALMOCO[0]], /ordem/],
      [[...ALMOCO, { abre: "18:00", fecha: "19:00" }, { abre: "20:00", fecha: "21:00" }], /3/],
      [[{ abre: "06:00" }], /abrir e da hora de fechar/],
      [[{ abre: "06:00", fecha: "18:00", almoco: "12:00" }], /almoco/],
      [{ abre: "06:00", fecha: "18:00" }, /lista/],
    ];
    for (const [valor, frase] of casos) {
      const e = estouro(() => aplicarCampo(DOC_HORA, "horario", valor as never));
      expect(e, JSON.stringify(valor)).not.toBeInstanceOf(ZodError);
      expect((e as Error).message, JSON.stringify(valor)).toMatch(frase);
    }
  });

  // As folhas de antes NÃO SÃO MAIS CAMPOS: a hora de abrir sozinha não se
  // grava nem se tira — a lista é que é o campo.
  it("`horario.abre` e `horario.fecha` saíram do registro", () => {
    for (const caminho of ["horario.abre", "horario.fecha"]) {
      expect((estouro(() => aplicarCampo(DOC_HORA, caminho, "06:00")) as Error).message, caminho).toContain(
        "fora do registro",
      );
      expect((estouro(() => removerCampo(DOC_HORA, caminho)) as Error).message, caminho).toContain(
        "fora do registro",
      );
    }
  });
});

describe("o horário no RASCUNHO — a mesma regra, sem o schema do documento", () => {
  const RASCUNHO = JSON.stringify({ slug: "lugar-marcador", modos: [], trajeto: { waypoints: [] } });

  it("grava a lista inteira, e só as duas horas de cada faixa", () => {
    const lista = [{ abre: "08:00", fecha: "10:00" }, { abre: "14:00", fecha: "17:00" }];
    expect(JSON.parse(aplicarNoRascunho(RASCUNHO, "horario", lista)).horario).toEqual(lista);
  });

  it("recusa o que a ficha no ar recusa, com a mesma frase", () => {
    for (const valor of [[], [{ abre: "14:00", fecha: "17:00" }, { abre: "08:00", fecha: "10:00" }]]) {
      const noAr = (estouro(() => aplicarCampo(DOC_HORA, "horario", valor)) as Error).message;
      const noRascunho = (estouro(() => aplicarNoRascunho(RASCUNHO, "horario", valor)) as Error).message;
      expect(noRascunho).toBe(noAr);
    }
  });

  it("o 'não sei' tira a chave", () => {
    const com = aplicarNoRascunho(RASCUNHO, "horario", [{ abre: "08:00", fecha: "10:00" }]);
    expect("horario" in JSON.parse(tirarDoRascunho(com, "horario"))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
/** 🔴 O `.finite()` DO `regraSchema` (Task 7, 2026-09-30) — e este bloco existe
 *  porque a restrição nasceu SEM PROVA: medido, apagar o `.finite()` deixava a
 *  suíte inteira verde.
 *
 *  O estado que ele fecha ficou ALCANÇÁVEL DO CELULAR quando a Task 7 pôs um
 *  `<input type="number">` na tela do dono: `1e999` é sintaxe válida de número de
 *  ponto flutuante, e `JSON.parse` o entrega como `Infinity`. O que isso fazia,
 *  medido ponta a ponta antes do `.finite()`: `aplicarCampo` ACEITAVA, o
 *  documento novo ficava com `"janela_previsao_horas":null` (é o que
 *  `JSON.stringify` faz com infinito) e esse documento NÃO RELIA — o lugar saía
 *  do ar (o caminho de leitura é `fichaSchema.parse`) e o dono não conseguia
 *  consertar pelo painel, que precisa ler a ficha pra mostrá-la. É a porta de mão
 *  única que o ruling C1 da Tarefa 1 desta rodada já pagou uma vez. E o portão de
 *  coerência não alcança: `!(Infinity > 0)` é `false`, então `janela-nao-zerada`
 *  não acusa e a gravação sairia com 200. */
describe("os três números do motor: `.finite()` e só", () => {
  const NUMEROS = [
    "condicao.regra.janela_previsao_horas",
    "condicao.regra.janela_passado_horas",
    "condicao.regra.limiar_mm",
  ];
  /** Infinito como ele CHEGA de verdade: pelo corpo de uma requisição. Escrever
   *  `Infinity` à mão aqui mediria um valor que o JSON nunca transporta. */
  const infinito = JSON.parse('{"v":1e999}').v as number;
  const menosInfinito = JSON.parse('{"v":-1e999}').v as number;

  it("infinito é RECUSADO nos três, e é a porta que recusa", () => {
    expect(Number.isFinite(infinito), "a premissa: 1e999 chega como infinito").toBe(false);
    for (const caminho of NUMEROS) {
      for (const valor of [infinito, menosInfinito]) {
        expect(
          () => aplicarCampo(DOC, caminho, valor),
          `${caminho} aceitou ${valor}: o documento ficaria com \`null\` e o lugar sairia do ar`,
        ).toThrow();
      }
    }
  });

  // 🔴 E O CUSTO DE DEIXAR PASSAR, MEDIDO AQUI em vez de narrado num comentário:
  // é este par que torna o caso de cima não-vácuo. Sem ele, "recusou" não diria
  // POR QUE recusar importa.
  it("o custo de aceitar infinito: viraria `null` no documento, e `null` não relê", () => {
    expect(JSON.stringify({ janela_previsao_horas: infinito })).toBe('{"janela_previsao_horas":null}');
    const quebrado = {
      ...fichaBase,
      condicao: { ...fichaBase.condicao, regra: { ...fichaBase.condicao.regra, janela_previsao_horas: null } },
    };
    expect(
      () => fichaSchema.parse(JSON.parse(JSON.stringify(quebrado))),
      "o documento com `null` na janela ainda relê: o custo acima não é o que está escrito",
    ).toThrow(ZodError);
  });

  // 🔴 A DIREÇÃO QUE IMPORTA MAIS, e ela fica VERMELHA no dia em que alguém puser
  // `.min(1)`/`.int()`/`.gt(0)` no `regraSchema` por zelo. Medido: aquela
  // restrição deixa QUATRO casos vermelhos (dois do portão de coerência, dois de
  // `loadAll`) e piora a tela — hoje zerar o limiar pelo painel devolve 409 com a
  // frase da regra `janela-nao-zerada` (*"qualquer orvalho fecha o lugar…"*); com
  // a restrição no schema, `aplicarCampo` estoura ANTES do portão e a rota
  // devolve 400 de CORPO VAZIO, que na tela dele é "Não consegui salvar.".
  // O guarda do zero pertence ao ACERVO, não ao schema — está escrito desde a
  // Tarefa 2 no comentário de `janela-nao-zerada`.
  for (const [nome, valor] of [
    ["zero", 0],
    ["negativo", -5],
    ["fracionário", 2.5],
    ["fração pequena", 0.05],
    ["grande", 240],
  ] as const) {
    it(`${nome} PASSA pelo schema: quem recusa o que mente é o portão de coerência, com frase`, () => {
      for (const caminho of NUMEROS) {
        const novo = aplicarCampo(DOC, caminho, valor);
        expect(
          caminho.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], JSON.parse(novo)),
          `${caminho} não gravou ${valor}`,
        ).toBe(valor);
      }
    });
  }
});
