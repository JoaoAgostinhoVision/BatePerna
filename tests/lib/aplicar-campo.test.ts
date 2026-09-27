import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { aplicarCampo, removerCampo } from "@/lib/campos-da-ficha";
import { loadAll } from "@/lib/ficha";
import { aberturaDaFicha, fechadoAgora } from "@/lib/horario";
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
    expect(() => aplicarCampo(DOC, "horario.abre", "8h")).toThrow();
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

  it("o documento continua válido depois de remover", () => {
    expect(() => JSON.parse(removerCampo(DOC, "secaRapido"))).not.toThrow();
  });

  it("só a chave pedida sai; todo o resto sai idêntico", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(removerCampo(DOC, "piso"));
    expect({ ...depois, piso: antes.piso }).toEqual(antes);
  });
});

// 🔴 RULING H1 (2026-09-26). Antes disto não existia caminho nenhum pra dizer
// "este lugar não fecha por horário": `horario` é opcional no schema, mas
// `abre` e `fecha` são obrigatórios DENTRO dele, então nenhuma remoção de
// campo alcançava a régua "ficha sem horário NUNCA fecha". O bloco inteiro
// virou entrada do registro, de espécie `bloco`.
describe("o bloco opcional inteiro — o 'não sei' do horário", () => {
  it("remover o bloco tira a chave, e o documento continua válido", () => {
    const depois = JSON.parse(removerCampo(DOC_HORA, "horario"));
    expect("horario" in depois).toBe(false);
    expect(() => fichaSchema.parse(depois)).not.toThrow();
  });

  // 🔴 A CONSEQUÊNCIA DE VERDADE, medida no motor que a tela usa
  // (`fechadoAgora`, `src/lib/horario.ts:117`) — não na presença da chave.
  // Sem esta asserção, o teste de cima prova que uma chave sumiu do JSON e
  // nada sobre o que o app passa a dizer.
  it("o lugar DEIXA DE FECHAR por horário depois do 'não sei'", () => {
    const seisDaTarde = { minutos: 18 * 60, dia: 3, epochS: 0 }; // 18h, quarta
    const antes = fichaSchema.parse(JSON.parse(DOC_HORA));
    expect(fechadoAgora(aberturaDaFicha(antes), seisDaTarde), "a premissa: às 18h ele fecha").toBe(true);

    const depois = fichaSchema.parse(JSON.parse(removerCampo(DOC_HORA, "horario")));
    expect(fechadoAgora(aberturaDaFicha(depois), seisDaTarde)).toBe(false);
  });

  it("só o bloco sai; todo o resto sai idêntico", () => {
    const antes = JSON.parse(DOC_HORA);
    const depois = JSON.parse(removerCampo(DOC_HORA, "horario"));
    expect({ ...depois, horario: antes.horario }).toEqual(antes);
  });

  it("tirar o bloco de quem já não tem é inofensivo, e não inventa a chave", () => {
    const depois = JSON.parse(removerCampo(DOC, "horario"));
    expect("horario" in depois).toBe(false);
    expect(depois).toEqual(JSON.parse(DOC));
  });

  // 🔴 ESTA É A RECUSA QUE O SCHEMA NÃO FARIA. `{abre, fecha}` bem formado
  // PASSA no `fichaSchema` — se a guarda do registro sumir, esta chamada não
  // estoura de jeito nenhum, e a mutação morre no `estouro()` e não num
  // `toThrow()` de fachada.
  it("gravar o bloco inteiro é RECUSADO, e quem recusa é o registro", () => {
    const e = estouro(() => aplicarCampo(DOC_HORA, "horario", { abre: "06:00", fecha: "18:00" } as never));
    expect(e).not.toBeInstanceOf(ZodError);
    expect((e as Error).message).toContain("bloco");
    expect((e as Error).message).toContain("horario");
    // e o documento não mudou
    expect(JSON.parse(DOC_HORA).horario).toEqual(comHora.horario);
  });

  it("gravar meia hora do bloco continua valendo — o bloco não trancou os campos", () => {
    const depois = JSON.parse(aplicarCampo(DOC_HORA, "horario.abre", "06:00"));
    expect(depois.horario.abre).toBe("06:00");
    expect(depois.horario.fecha).toBe(comHora.horario!.fecha);
  });

  // 🔴 E A ARMADILHA DA M3 DE NOVO, no caso mais escorregadio do arquivo:
  // `horario` sem `abre` TAMBÉM estoura no Zod. Um `toThrow()` aqui ficaria
  // verde com a guarda do registro apagada, e o dono receberia um ZodError em
  // inglês em vez de "o 'não sei' aqui é tirar o horario inteiro".
  it("remover MEIA hora é recusado pelo REGISTRO, e a recusa aponta o bloco", () => {
    for (const caminho of ["horario.abre", "horario.fecha"]) {
      const e = estouro(() => removerCampo(DOC_HORA, caminho));
      expect(e, caminho).not.toBeInstanceOf(ZodError);
      expect((e as Error).message, caminho).toContain("obrigatório");
      expect((e as Error).message, caminho).toContain(caminho);
      expect((e as Error).message, caminho).toContain("tirar o `horario` inteiro");
    }
  });
});
