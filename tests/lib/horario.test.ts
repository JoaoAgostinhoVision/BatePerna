import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  abreAindaHoje,
  agoraRecife,
  fechadoAgora,
  fechadoHoje,
  minutosDeHHMM,
  minutosDoDiaRecife,
  rotuloAbertura,
  rotuloFaixa,
  rotuloHora,
  type Abertura,
  type Agora,
  type Horario,
} from "@/lib/horario";
import type { Aviso } from "@/lib/aviso";

// 🔴 O DEFEITO QUE ESTE ARQUIVO TRANCA (2026-08-27). O carimbo só olhava CHUVA.
// A Pedra Furada fecha às 17h, então às 18h com céu limpo a ficha dizia
// "Pode ir" com o lugar fechado havia uma hora — o app afirmando mais do que
// sabe, mesma família do `SEM INFORMAÇÕES · tome cuidado` da v3.4.
const PEDRA: Horario = { abre: "05:00", fecha: "17:00" };
const h = (hh: number, mm = 0) => hh * 60 + mm;

// 🔴 DESDE 2026-09-11 A PERGUNTA TEM DOIS EIXOS (hora e dia da semana), e estes
// dois embrulhos existem pra que cada asserção deste arquivo continue medindo
// UM. `so` põe o horário numa Abertura **sem dias** — a ficha que não folga
// nunca; `as` fixa o relógio numa QUARTA-FEIRA, que não é borda de nada.
// Sem eles, "18h é fechado" passaria a depender também do dia, e uma quebra no
// eixo do dia derrubaria testes que falam de hora — ruído no lugar de sinal.
const QUARTA = 3;
const so = (horario?: Horario): Abertura => ({ horario });
const as = (minutos: number | null): Agora | null =>
  minutos === null ? null : { minutos, dia: QUARTA };

describe("minutos do dia, em Recife", () => {
  it("converte 'HH:MM'", () => {
    expect(minutosDeHHMM("05:00")).toBe(300);
    expect(minutosDeHHMM("17:30")).toBe(1050);
    expect(minutosDeHHMM("00:00")).toBe(0);
  });

  // UTC 11h42 é 08h42 em Recife. O número 522 é escrito à mão de propósito:
  // derivá-lo com o mesmo offset da implementação seria o teste conferindo a
  // função contra ela mesma.
  it("desconta as 3h de Recife — o agreste não tem horário de verão", () => {
    expect(minutosDoDiaRecife(Date.UTC(2027, 0, 15, 11, 42) / 1000)).toBe(522);
  });

  // A virada do dia é onde um offset errado aparece: UTC 01h30 já é dia 16 lá
  // em cima, e ainda é 22h30 do dia 15 em Recife.
  it("a virada do dia UTC não vira o dia de Recife", () => {
    expect(minutosDoDiaRecife(Date.UTC(2027, 0, 16, 1, 30) / 1000)).toBe(h(22, 30));
  });
});

describe("fechadoAgora", () => {
  // 🔴 As DUAS portas do silêncio, e elas são diferentes: uma é "esta ficha não
  // tem hora", a outra é "ainda não sei que horas são". Nas duas o app NÃO
  // afirma que fechou — é a régua do `piso` e do `secaRapido`.
  it("ficha sem horário nunca fecha — o app não inventa hora que ninguém deu", () => {
    expect(fechadoAgora(undefined, as(h(23)))).toBe(false);
  });

  it("antes de o relógio falar (null), nunca fecha — é o primeiro render", () => {
    expect(fechadoAgora(so(PEDRA), null)).toBe(false);
  });

  it("dentro da faixa, aberto", () => {
    expect(fechadoAgora(so(PEDRA), as(h(9)))).toBe(false);
    expect(fechadoAgora(so(PEDRA), as(h(16, 59)))).toBe(false);
  });

  it("o defeito exato que estava no ar: 18h com céu limpo é FECHADO", () => {
    expect(fechadoAgora(so(PEDRA), as(h(18)))).toBe(true);
  });

  it("de madrugada, antes de abrir, também é fechado", () => {
    expect(fechadoAgora(so(PEDRA), as(h(4, 59)))).toBe(true);
  });

  // 🔴 As duas bordas, e elas separam `<`/`<=` — a família de mutação que já
  // produziu o "campo indigitável" da Task 4. No minuto que abre, ABRE; no
  // minuto que fecha, JÁ FECHOU (quem chega 17h00 em ponto não entra).
  it("no minuto de abrir já está aberto; no de fechar já está fechado", () => {
    expect(fechadoAgora(so(PEDRA), as(h(5)))).toBe(false);
    expect(fechadoAgora(so(PEDRA), as(h(17)))).toBe(true);
  });

  // Não existe ficha assim hoje. O ramo existe pra que uma faixa dessas não
  // seja lida AO CONTRÁRIO em silêncio — que é o que aconteceria com uma
  // comparação simples.
  it("faixa que atravessa a meia-noite (22h–5h) não é lida ao contrário", () => {
    const noturno: Horario = { abre: "22:00", fecha: "05:00" };
    expect(fechadoAgora(so(noturno), as(h(23)))).toBe(false);
    expect(fechadoAgora(so(noturno), as(h(3)))).toBe(false);
    expect(fechadoAgora(so(noturno), as(h(12)))).toBe(true);
  });

  it("abre e fecha na mesma hora significa 24h, não zero", () => {
    expect(fechadoAgora(so({ abre: "00:00", fecha: "00:00" }), as(h(13)))).toBe(false);
  });
});

describe("as frases da tela", () => {
  it("rotuloHora corta o :00 e mantém o resto", () => {
    expect(rotuloHora("05:00")).toBe("5h");
    expect(rotuloHora("17:00")).toBe("17h");
    expect(rotuloHora("17:30")).toBe("17h30");
  });

  it("abreAindaHoje separa quem só espera de quem perdeu o dia", () => {
    expect(abreAindaHoje(PEDRA, h(4))).toBe(true);
    expect(abreAindaHoje(PEDRA, h(18))).toBe(false);
  });

  // 🔴 O "amanhã" não é enfeite: a MESMA frase nos dois casos mentiria pra
  // metade das pessoas. Quem lê às 18h perdeu o dia; quem lê às 4h só espera.
  it("de madrugada é 'abre às 5h'; à noite é 'abre AMANHÃ às 5h'", () => {
    expect(rotuloAbertura(so(PEDRA), as(h(4))!)).toBe("abre às 5h");
    expect(rotuloAbertura(so(PEDRA), as(h(18))!)).toBe("abre amanhã às 5h");
  });

  it("a faixa inteira, pro motivo da ficha", () => {
    expect(rotuloFaixa(so(PEDRA))).toBe("Fecha às 17h, abre às 5h.");
  });
});

// 🔴 OS DOIS EIXOS JUNTOS (2026-09-11). `fechadoAgora` guarda o nome de
// propósito: quando o dia entrou, a saída preguiçosa era deixá-la cuidando só
// da hora e pedir a cada componente que chamasse também a do dia e juntasse as
// duas — QUATRO componentes fazendo a mesma montagem à mão. Estes testes são a
// prova de que quem chama esta função recebe a pergunta INTEIRA.
// 🔴 M11, MEDIDA E SOBREVIVENTE NA PRIMEIRA VARREDURA (2026-09-11): trocar o
// dia de `agoraRecife` por `new Date().getUTCDay()` — o relogio do fuso do
// navegador, sem as tres horas de Recife — deixava a suite INTEIRA verde.
// Nada media esta funcao, e ela e justamente a que existe pra hora e dia
// sairem do MESMO instante.
//
// Sem isso, a virada de sabado pra domingo em Recife (21h) fecharia a Rampa
// cedo demais nas noites de sabado, e ninguem veria.
describe("agoraRecife — um relogio so, hora e dia do mesmo instante", () => {
  // As tres horas mudam o DIA, nao so a hora: domingo 00h em UTC ainda e
  // sabado, 21h, em Recife. Os dois campos sao cravados a mao; deriva-los com
  // o mesmo offset da implementacao seria o teste conferindo a funcao contra
  // ela mesma.
  it("domingo 00h UTC e sabado 21h em Recife — nos DOIS campos", () => {
    expect(agoraRecife(Date.UTC(2027, 0, 17, 0, 0) / 1000)).toEqual({
      minutos: 21 * 60,
      dia: 6, // sabado
    });
  });

  it("e tres horas depois virou domingo, zero hora", () => {
    expect(agoraRecife(Date.UTC(2027, 0, 17, 3, 0) / 1000)).toEqual({
      minutos: 0,
      dia: 0, // domingo
    });
  });

  // 🔴 O PAR QUE PEGA A SEGUNDA FONTE. Os dois testes acima passariam com o dia
  // vindo de outro relogio, desde que por acaso ele batesse. Este exige que os
  // dois campos descrevam o MESMO instante ao longo de uma semana inteira,
  // hora a hora — e uma segunda fonte (que sempre devolve o dia de HOJE) nao
  // sobrevive a isso.
  it("hora e dia nunca discordam — varrendo a semana de 3 em 3 horas", () => {
    const inicio = Date.UTC(2027, 0, 17, 0, 0) / 1000;
    for (let i = 0; i < 56; i++) {
      const t = inicio + i * 3 * 3600;
      const { minutos, dia } = agoraRecife(t);
      const local = new Date((t - 3 * 3600) * 1000); // Recife, escrito a mao
      expect({ minutos, dia }, "instante " + i).toEqual({
        minutos: local.getUTCHours() * 60 + local.getUTCMinutes(),
        dia: local.getUTCDay(),
      });
    }
  });
});

describe("fechadoAgora junta a hora e o dia", () => {
  const SAB = 6, DOM = 0, QUA = 3, SEX = 5;
  const RAMPA: Abertura = { dias: ["sab", "dom"] };       // dia sem hora
  const SO_HORA: Abertura = { horario: PEDRA };            // hora sem dia
  const AMBOS: Abertura = { horario: PEDRA, dias: ["sab", "dom"] };

  // 🔴 O DEFEITO EXATO QUE ESTAVA NO AR: a Rampa não tem horário nenhum, então
  // o eixo da hora diz "aberto" o dia inteiro. Só o eixo do dia a fecha.
  it("ficha SEM horário fecha pelo dia — era isto que dizia que dava pra ir na quarta", () => {
    expect(fechadoAgora(RAMPA, { minutos: h(12), dia: QUA })).toBe(true);
    expect(fechadoAgora(RAMPA, { minutos: h(12), dia: SAB })).toBe(false);
  });

  // O par ortogonal: ficha SEM dias não pode passar a fechar por dia nenhum.
  // Sem ele, um fechadoNoDia que devolvesse true pra undefined fecharia o
  // acervo inteiro e o teste de cima continuaria verde.
  it("ficha SEM dias não fecha por dia — nos sete", () => {
    for (let d = 0; d < 7; d++) {
      expect(fechadoAgora(SO_HORA, { minutos: h(12), dia: d }), "dia " + d).toBe(false);
    }
  });

  // 🔴 OS DOIS EIXOS SÃO UM "OU", e estas quatro linhas são as quatro casas da
  // tabela. A do meio é a que pega a implementação preguiçosa: **sábado às 18h**
  // está aberto pelo dia e fechado pela hora, e um && no lugar do || diria que
  // dá pra ir.
  it("basta UM dos eixos fechar", () => {
    expect(fechadoAgora(AMBOS, { minutos: h(12), dia: SAB })).toBe(false); // dia ok, hora ok
    expect(fechadoAgora(AMBOS, { minutos: h(18), dia: SAB })).toBe(true);  // dia ok, hora não
    expect(fechadoAgora(AMBOS, { minutos: h(12), dia: QUA })).toBe(true);  // dia não, hora ok
    expect(fechadoAgora(AMBOS, { minutos: h(18), dia: QUA })).toBe(true);  // nenhum dos dois
  });

  // 🔴 O DIA GANHA DA HORA NA FRASE, e não é arbitrário: numa quarta-feira, num
  // lugar que só abre sábado, dizer "abre às 5h" é verdade sobre o relógio e
  // mentira sobre a viagem. Quem perdeu o dia precisa ouvir do dia.
  it("fechada pelos dois, a frase fala do DIA — não da hora", () => {
    expect(rotuloAbertura(AMBOS, { minutos: h(18), dia: QUA })).toBe("abre sábado");
    expect(rotuloAbertura(AMBOS, { minutos: h(18), dia: SEX })).toBe("abre amanhã");
  });

  // E no dia em que ABRE, quem fala é a hora: aí o dia não tem nada a dizer.
  it("aberta pelo dia e fechada pela hora, a frase volta a ser da hora", () => {
    expect(rotuloAbertura(AMBOS, { minutos: h(18), dia: SAB })).toBe("abre amanhã às 5h");
    expect(rotuloAbertura(AMBOS, { minutos: h(4), dia: DOM })).toBe("abre às 5h");
  });

  it("aberta pelos dois, não há frase de abertura — o app cala", () => {
    expect(rotuloAbertura(AMBOS, { minutos: h(12), dia: SAB })).toBeNull();
  });

  // A frase do motivo, na ficha. Com os dois eixos declarados as DUAS saem: são
  // fatos diferentes, e esconder um faria a pessoa planejar pela metade.
  it("o motivo diz o que houver — e os dois quando houver os dois", () => {
    expect(rotuloFaixa(RAMPA)).toBe("Abre sábado e domingo.");
    expect(rotuloFaixa(SO_HORA)).toBe("Fecha às 17h, abre às 5h.");
    expect(rotuloFaixa(AMBOS)).toBe("Abre sábado e domingo. Fecha às 17h, abre às 5h.");
  });
});

// 🔴 A SEGUNDA CAUSA (2026-09-16). `fechadoAgora` só sabe do calendário; o
// dono fecha por fora dele, e `fechadoHoje` é a ÚNICA função que junta as
// duas. Nasceu do achado da revisão das Tasks 7+8: `MioloHome` e
// `FolhaTrilhas` chamavam `fechadoAgora` cada um por sua conta, e os dois
// ficaram cegos ao dono.
const avisoDe = (efeito: Aviso["efeito"]): Aviso => ({
  texto: "aviso de teste",
  efeito,
  criadoEm: 0,
  venceEm: 0,
});

describe("fechadoHoje junta o calendário e o dono", () => {
  it("calendário aberto, sem aviso — aberto", () => {
    expect(fechadoHoje(so(PEDRA), null, as(h(9)))).toBe(false);
  });

  it("calendário FECHADO, sem aviso — fechado pelo calendário, como sempre foi", () => {
    expect(fechadoHoje(so(PEDRA), null, as(h(18)))).toBe(true);
  });

  it("calendário aberto, dono fechou — o dono ganha do calendário", () => {
    expect(fechadoHoje(so(PEDRA), avisoDe("fechado"), as(h(9)))).toBe(true);
  });

  it("aviso que não fecha não fecha", () => {
    expect(fechadoHoje(so(PEDRA), avisoDe("frio"), as(h(9)))).toBe(false);
  });

  it("agora === null, dono fechou — o dono não precisa do relógio: já no primeiro render", () => {
    expect(fechadoHoje(so(PEDRA), avisoDe("fechado"), null)).toBe(true);
  });

  it("agora === null, sem aviso — o comportamento de hoje, preservado", () => {
    expect(fechadoHoje(so(PEDRA), null, null)).toBe(false);
  });
});

// 🔴 A PROVA QUE FECHA O DIA 2026-08-27 INTEIRO. Quatro rodadas seguidas
// arrancaram substantivo de lugar do código: "portão", "barro", "subir". Este
// módulo é o candidato óbvio pra reintroduzir um — a tentação de escrever "o
// portão fecha às 17h" é enorme, e ela é verdade só na Pedra Furada.
describe("nenhum substantivo de lugar mora aqui", () => {
  const fonte = readFileSync(path.join(process.cwd(), "src", "lib", "horario.ts"), "utf8");
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  it("o código do módulo não nomeia o que fecha", () => {
    // A tira precisa de guarda: sem estas duas linhas, um regex que comesse o
    // arquivo deixaria a ausência abaixo passar por vacuidade, sempre.
    expect(codigo, "a tira de comentários comeu o código").toContain("export function fechadoAgora");
    expect(codigo).toContain("rotuloFaixa");
    expect(codigo, "voltou substantivo de lugar pro código").not.toMatch(
      /portão|guarita|cancela|entrada|catraca/i,
    );
  });

  // O fuso é UM só neste app. Repetir `-3 * 3600` aqui seria a segunda fonte, e
  // o dia em que alguém corrigisse um dos dois o app teria dois relógios.
  it("o offset de Recife é IMPORTADO, não reescrito", () => {
    expect(codigo, "o fuso virou uma segunda fonte").not.toMatch(/3\s*\*\s*3600/);
    expect(fonte).toMatch(/import\s*\{\s*OFFSET_RECIFE_S\s*\}/);
  });
});
