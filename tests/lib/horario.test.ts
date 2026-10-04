import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  agoraRecife,
  fechadoAgora,
  fechadoHoje,
  minutosDeHHMM,
  minutosDoDiaRecife,
  faixasDe,
  fechadoNaHora,
  problemaDasFaixas,
  rotuloAbertura,
  rotuloFaixa,
  rotuloFaixaCurta,
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
const PEDRA: Horario = [{ abre: "05:00", fecha: "17:00" }];
const h = (hh: number, mm = 0) => hh * 60 + mm;

// 🔴 DESDE 2026-09-11 A PERGUNTA TEM DOIS EIXOS (hora e dia da semana), e estes
// dois embrulhos existem pra que cada asserção deste arquivo continue medindo
// UM. `so` põe o horário numa Abertura **sem dias** — a ficha que não folga
// nunca; `as` fixa o relógio numa QUARTA-FEIRA, que não é borda de nada.
// Sem eles, "18h é fechado" passaria a depender também do dia, e uma quebra no
// eixo do dia derrubaria testes que falam de hora — ruído no lugar de sinal.
const QUARTA = 3;
// O instante de onde hora e dia "saíram": qualquer epoch serve pra este
// arquivo, que fala de hora e dia, não de segundos — só `fechadoHoje` o lê, pra
// comparar com o prazo do aviso do dono (`avisoDe`, lá embaixo, vence DEPOIS).
const INSTANTE = 1_800_000_000;
const so = (horario?: Horario): Abertura => ({ horario });
const em = (minutos: number, dia: number): Agora => ({ minutos, dia, epochS: INSTANTE });
const as = (minutos: number | null): Agora | null =>
  minutos === null ? null : em(minutos, QUARTA);

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
    const noturno: Horario = [{ abre: "22:00", fecha: "05:00" }];
    expect(fechadoAgora(so(noturno), as(h(23)))).toBe(false);
    expect(fechadoAgora(so(noturno), as(h(3)))).toBe(false);
    expect(fechadoAgora(so(noturno), as(h(12)))).toBe(true);
  });

  it("abre e fecha na mesma hora significa 24h, não zero", () => {
    expect(fechadoAgora(so([{ abre: "00:00", fecha: "00:00" }]), as(h(13)))).toBe(false);
  });
});

describe("as frases da tela", () => {
  it("rotuloHora corta o :00 e mantém o resto", () => {
    expect(rotuloHora("05:00")).toBe("5h");
    expect(rotuloHora("17:00")).toBe("17h");
    expect(rotuloHora("17:30")).toBe("17h30");
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
      epochS: Date.UTC(2027, 0, 17, 0, 0) / 1000, // o instante viaja junto
    });
  });

  it("e tres horas depois virou domingo, zero hora", () => {
    expect(agoraRecife(Date.UTC(2027, 0, 17, 3, 0) / 1000)).toEqual({
      minutos: 0,
      dia: 0, // domingo
      epochS: Date.UTC(2027, 0, 17, 3, 0) / 1000,
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
    expect(fechadoAgora(RAMPA, em(h(12), QUA))).toBe(true);
    expect(fechadoAgora(RAMPA, em(h(12), SAB))).toBe(false);
  });

  // O par ortogonal: ficha SEM dias não pode passar a fechar por dia nenhum.
  // Sem ele, um fechadoNoDia que devolvesse true pra undefined fecharia o
  // acervo inteiro e o teste de cima continuaria verde.
  it("ficha SEM dias não fecha por dia — nos sete", () => {
    for (let d = 0; d < 7; d++) {
      expect(fechadoAgora(SO_HORA, em(h(12), d)), "dia " + d).toBe(false);
    }
  });

  // 🔴 OS DOIS EIXOS SÃO UM "OU", e estas quatro linhas são as quatro casas da
  // tabela. A do meio é a que pega a implementação preguiçosa: **sábado às 18h**
  // está aberto pelo dia e fechado pela hora, e um && no lugar do || diria que
  // dá pra ir.
  it("basta UM dos eixos fechar", () => {
    expect(fechadoAgora(AMBOS, em(h(12), SAB))).toBe(false); // dia ok, hora ok
    expect(fechadoAgora(AMBOS, em(h(18), SAB))).toBe(true);  // dia ok, hora não
    expect(fechadoAgora(AMBOS, em(h(12), QUA))).toBe(true);  // dia não, hora ok
    expect(fechadoAgora(AMBOS, em(h(18), QUA))).toBe(true);  // nenhum dos dois
  });

  // 🔴 O DIA GANHA DA HORA NA FRASE, e não é arbitrário: numa quarta-feira, num
  // lugar que só abre sábado, dizer "abre às 5h" é verdade sobre o relógio e
  // mentira sobre a viagem. Quem perdeu o dia precisa ouvir do dia.
  it("fechada pelos dois, a frase fala do DIA — não da hora", () => {
    expect(rotuloAbertura(AMBOS, em(h(18), QUA))).toBe("abre sábado");
    expect(rotuloAbertura(AMBOS, em(h(18), SEX))).toBe("abre amanhã");
  });

  // E no dia em que ABRE, quem fala é a hora: aí o dia não tem nada a dizer.
  it("aberta pelo dia e fechada pela hora, a frase volta a ser da hora", () => {
    expect(rotuloAbertura(AMBOS, em(h(18), SAB))).toBe("abre amanhã às 5h");
    expect(rotuloAbertura(AMBOS, em(h(4), DOM))).toBe("abre às 5h");
  });

  it("aberta pelos dois, não há frase de abertura — o app cala", () => {
    expect(rotuloAbertura(AMBOS, em(h(12), SAB))).toBeNull();
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
//
// `venceEm` DEPOIS do `INSTANTE` de `em()`: desde 2026-09-16 o aviso só fecha
// enquanto vale, e um `venceEm: 0` aqui faria o dono "perder" pra um prazo
// vencido — o teste de cima passaria a provar outra coisa (o fixture rejeitado
// pela guarda ERRADA, espécie já catalogada). O prazo vencido tem teste próprio.
const avisoDe = (efeito: Aviso["efeito"], venceEm = INSTANTE + 3600): Aviso => ({
  texto: "aviso de teste",
  efeito,
  criadoEm: 0,
  venceEm,
});

describe("fechadoHoje junta o calendário e o dono", () => {
  // 🔴 O RELÓGIO É O MESMO (2026-09-16): `epochS` sai do mesmo `Agora` que dá
  // hora e dia ao calendário. Um aviso `fechado` já vencido pelo próprio prazo
  // não fecha mais — é o que separa "o dono fechou até sábado" de "o dono
  // fechou pra sempre" numa ficha aberta do cache dias depois.
  it("calendário aberto, dono fechou mas o aviso VENCEU — aberto: o prazo é do dono também", () => {
    expect(fechadoHoje(so(PEDRA), avisoDe("fechado", INSTANTE - 1), as(h(9)))).toBe(false);
    // O instante exato do prazo já é vencido — o `>` estrito de `avisoVigente`.
    expect(fechadoHoje(so(PEDRA), avisoDe("fechado", INSTANTE), as(h(9)))).toBe(false);
  });

  it("calendário FECHADO e aviso vencido — fechado, pelo calendário", () => {
    expect(fechadoHoje(so(PEDRA), avisoDe("fechado", INSTANTE - 1), as(h(18)))).toBe(true);
  });

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

// 🔴 O HORÁRIO COM INTERVALO (Tarefa 11c, decisão do João, 2026-10-04): *"tem
// lugares que fecham para o almoço, aí fica de 8 às 10 e 14 às 17"*. O horário
// passou a ser uma LISTA de 1 a 3 faixas, e o veredito é "dentro de ALGUMA".
describe("o horário com intervalo — a lista de faixas", () => {
  const ALMOCO: Horario = [
    { abre: "08:00", fecha: "10:00" },
    { abre: "14:00", fecha: "17:00" },
  ];
  const fechado = (hor: Horario, minutos: number) => fechadoAgora(so(hor), as(minutos));
  const frase = (hor: Horario, minutos: number) => rotuloAbertura(so(hor), as(minutos)!);

  // A tabela do brief (H3), hora a hora. As bordas são as de hoje — `<` pra
  // abrir, `>=` pra fechar —, lidas do código e não da intuição: no minuto de
  // abrir já abriu, no de fechar já fechou.
  it("a tabela de horas de 8–10 e 14–17", () => {
    expect([fechado(ALMOCO, h(7, 59)), frase(ALMOCO, h(7, 59))]).toEqual([true, "abre às 8h"]);
    expect([fechado(ALMOCO, h(8)), frase(ALMOCO, h(8))]).toEqual([false, null]);
    expect([fechado(ALMOCO, h(9, 59)), frase(ALMOCO, h(9, 59))]).toEqual([false, null]);
    expect([fechado(ALMOCO, h(10)), frase(ALMOCO, h(10))]).toEqual([true, "abre às 14h"]);
    expect([fechado(ALMOCO, h(13, 59)), frase(ALMOCO, h(13, 59))]).toEqual([true, "abre às 14h"]);
    expect([fechado(ALMOCO, h(14)), frase(ALMOCO, h(14))]).toEqual([false, null]);
    expect([fechado(ALMOCO, h(17)), frase(ALMOCO, h(17))]).toEqual([true, "abre amanhã às 8h"]);
  });

  // 🔴 11c-I2: "a próxima faixa" é o MENOR `abre` depois de agora, nunca "a
  // seguinte no array". O schema de leitura só confere FORMA — um documento
  // gravado fora de ordem (à mão, pelo "voltar") chega aqui fora de ordem.
  it("fora de ordem no documento, a resposta é a mesma", () => {
    const TROCADA: Horario = [ALMOCO[1], ALMOCO[0]];
    expect(frase(TROCADA, h(7))).toBe("abre às 8h");
    expect(frase(TROCADA, h(11))).toBe("abre às 14h");
    expect(frase(TROCADA, h(18))).toBe("abre amanhã às 8h");
    expect(fechado(TROCADA, h(9))).toBe(false);
    expect(fechado(TROCADA, h(12))).toBe(true);
  });

  // 🔴 11c-C1, O CRITICAL DA AUDITORIA: "dentro de alguma faixa" sobre uma
  // lista VAZIA é "fechado a qualquer hora" — o carimbo dizendo "Fechado" num
  // lugar cujo dono só tirou as horas. O schema recusa `[]`; esta é a segunda
  // trava, porque o documento é dado e dado chega torto.
  it("lista vazia não fecha nunca — é o mesmo silêncio de não ter horário", () => {
    expect(fechadoNaHora([], h(12))).toBe(false);
    expect(fechado([], h(3))).toBe(false);
    expect(frase([], h(12))).toBeNull();
  });

  it("a faixa curta mostra as faixas juntas", () => {
    expect(rotuloFaixaCurta(ALMOCO)).toBe("8h–10h · 14h–17h");
  });

  // 🔴 I-1 DA REVISÃO DA 11c: o motivo e o tíquete são a MESMA tela, e uma lista
  // fora de ordem no documento (o schema de leitura só confere FORMA) saía
  // "Abre das 8h às 10h e das 14h às 17h." no motivo e "14h–17h · 8h–10h" no
  // tíquete. Os dois ordenam pelo `abre` — a ordem do dia.
  it("lista INVERTIDA: o motivo e o tíquete dizem a ordem do dia, os dois", () => {
    const INVERTIDA: Horario = [ALMOCO[1], ALMOCO[0]];
    expect(rotuloFaixaCurta(INVERTIDA)).toBe("8h–10h · 14h–17h");
    expect(rotuloFaixa(so(INVERTIDA))).toBe("Abre das 8h às 10h e das 14h às 17h.");
    // e ordenar não pode mexer no documento de quem chamou
    expect(INVERTIDA[0].abre).toBe("14:00");
  });

  it("o motivo, com duas faixas, diz as duas", () => {
    expect(rotuloFaixa(so(ALMOCO))).toBe("Abre das 8h às 10h e das 14h às 17h.");
    const TRES: Horario = [
      { abre: "07:00", fecha: "09:00" },
      { abre: "10:00", fecha: "12:00" },
      { abre: "14:00", fecha: "17:30" },
    ];
    expect(rotuloFaixa(so(TRES))).toBe("Abre das 7h às 9h, das 10h às 12h e das 14h às 17h30.");
  });

  // 🔴 M1 DA AUDITORIA: "byte a byte igual a hoje" só se prova com OURO tirado
  // do código de ANTES. Estas strings foram geradas pelo `horario.ts` anterior
  // à 11c (2026-10-04, `1de5d53`), com as duas fichas reais e as horas da
  // tabela, e coladas aqui. Escrever o esperado depois seria tautologia.
  describe("com UMA faixa, tudo sai como saía — o ouro do código de antes", () => {
    const OURO = {
      pedra: { h: [{ abre: "05:00", fecha: "17:00" }], faixa: "Fecha às 17h, abre às 5h.", curta: "5h–17h" },
      veu: { h: [{ abre: "08:00", fecha: "17:00" }], faixa: "Fecha às 17h, abre às 8h.", curta: "8h–17h" },
    } as const;
    const HORAS: Record<string, { pedra: [boolean, string | null]; veu: [boolean, string | null] }> = {
      "04:59": { pedra: [true, "abre às 5h"], veu: [true, "abre às 8h"] },
      "05:00": { pedra: [false, null], veu: [true, "abre às 8h"] },
      "07:59": { pedra: [false, null], veu: [true, "abre às 8h"] },
      "08:00": { pedra: [false, null], veu: [false, null] },
      "09:59": { pedra: [false, null], veu: [false, null] },
      "10:00": { pedra: [false, null], veu: [false, null] },
      "13:59": { pedra: [false, null], veu: [false, null] },
      "14:00": { pedra: [false, null], veu: [false, null] },
      "16:59": { pedra: [false, null], veu: [false, null] },
      "17:00": { pedra: [true, "abre amanhã às 5h"], veu: [true, "abre amanhã às 8h"] },
      "23:59": { pedra: [true, "abre amanhã às 5h"], veu: [true, "abre amanhã às 8h"] },
      "00:00": { pedra: [true, "abre às 5h"], veu: [true, "abre às 8h"] },
    };

    it("o motivo e a faixa curta", () => {
      for (const o of Object.values(OURO)) {
        expect(rotuloFaixa(so(o.h))).toBe(o.faixa);
        expect(rotuloFaixaCurta(o.h)).toBe(o.curta);
      }
    });

    it("hora a hora, o veredito e a frase", () => {
      for (const [hhmm, esperado] of Object.entries(HORAS)) {
        const m = minutosDeHHMM(hhmm);
        for (const k of ["pedra", "veu"] as const) {
          expect([fechadoNaHora(OURO[k].h, m), rotuloAbertura(so(OURO[k].h), as(m)!)], `${k} ${hhmm}`).toEqual(
            esperado[k],
          );
        }
      }
    });
  });

  // 🔴 11c-I5: UM DEFEITO DE HOJE que esta tarefa conserta. O "abre amanhã às
  // 8h" não olhava `dias`: domingo 18h, num lugar de sábado e domingo, dizia
  // "amanhã" — e segunda está fechado.
  it("domingo 18h num lugar de sábado e domingo: abre SÁBADO, não amanhã", () => {
    const FIM_DE_SEMANA: Abertura = { horario: [{ abre: "08:00", fecha: "17:00" }], dias: ["sab", "dom"] };
    expect(rotuloAbertura(FIM_DE_SEMANA, em(h(18), 0))).toBe("abre sábado às 8h");
    // e no sábado à noite o amanhã é verdade, e continua sendo dito
    expect(rotuloAbertura(FIM_DE_SEMANA, em(h(18), 6))).toBe("abre amanhã às 8h");
  });

  it("o único dia é hoje: depois de fechar, abre no mesmo dia da semana que vem", () => {
    const SO_DOMINGO: Abertura = { horario: [{ abre: "08:00", fecha: "17:00" }], dias: ["dom"] };
    expect(rotuloAbertura(SO_DOMINGO, em(h(18), 0))).toBe("abre domingo às 8h");
  });
});

describe("faixasDe — a forma velha e a nova, lidas igual", () => {
  it("o objeto de antes vira lista de uma faixa; a lista passa como está", () => {
    expect(faixasDe({ abre: "05:00", fecha: "17:00" })).toEqual([{ abre: "05:00", fecha: "17:00" }]);
    expect(faixasDe([{ abre: "08:00", fecha: "10:00" }])).toEqual([{ abre: "08:00", fecha: "10:00" }]);
  });

  it("ausência e lixo não viram horário", () => {
    expect(faixasDe(undefined)).toBeUndefined();
    expect(faixasDe("08:00")).toBeUndefined();
    expect(faixasDe(null)).toBeUndefined();
  });
});

// 🔴 11c-I2: AS REGRAS DE UMA LISTA VÁLIDA MORAM AQUI, não no schema. No schema
// elas virariam 400 MUDO na porta e, pior, derrubariam a LEITURA de um
// documento já gravado — e o "voltar" grava verbatim, então a leitura tem de
// aceitar tudo o que um dia entrou. Quem chama isto são as portas de ESCRITA.
describe("problemaDasFaixas — as regras da porta de escrita", () => {
  const f = (abre: string, fecha: string) => ({ abre, fecha });

  it("as listas boas passam", () => {
    expect(problemaDasFaixas([f("05:00", "17:00")])).toBeNull();
    expect(problemaDasFaixas([f("08:00", "10:00"), f("14:00", "17:00")])).toBeNull();
    expect(problemaDasFaixas([f("07:00", "09:00"), f("10:00", "12:00"), f("14:00", "17:00")])).toBeNull();
    // 24h e a travessia da meia-noite continuam valendo SOZINHAS
    expect(problemaDasFaixas([f("00:00", "00:00")])).toBeNull();
    expect(problemaDasFaixas([f("22:00", "05:00")])).toBeNull();
  });

  // M4 da auditoria: faixas que se TOCAM são aceitas. Com `<`/`>=` às 10:00
  // cai na segunda e não há buraco nenhum.
  it("faixas que se tocam (8–10 e 10–14) passam, e às 10h está aberto", () => {
    const TOCAM: Horario = [f("08:00", "10:00"), f("10:00", "14:00")];
    expect(problemaDasFaixas(TOCAM)).toBeNull();
    expect(fechadoNaHora(TOCAM, h(10))).toBe(false);
  });

  it("vazia, ou com mais de 3, não entra — e a frase diz o que fazer", () => {
    expect(problemaDasFaixas([])).toMatch(/não tem/);
    expect(problemaDasFaixas([f("06:00", "07:00"), f("08:00", "09:00"), f("10:00", "11:00"), f("12:00", "13:00")])).toMatch(/3/);
  });

  it("uma faixa sem a hora de abrir ou de fechar não entra", () => {
    expect(problemaDasFaixas([{ abre: "08:00" }])).toMatch(/abrir e .* fechar/);
    expect(problemaDasFaixas([{ fecha: "17:00" }])).toMatch(/abrir e .* fechar/);
    expect(problemaDasFaixas([{ abre: "8h", fecha: "17:00" }])).not.toBeNull();
    expect(problemaDasFaixas({ abre: "08:00", fecha: "17:00" })).not.toBeNull(); // a porta grava a lista
    expect(problemaDasFaixas("08:00")).not.toBeNull();
  });

  it("fora de ordem não entra", () => {
    expect(problemaDasFaixas([f("14:00", "17:00"), f("08:00", "10:00")])).toMatch(/ordem/);
  });

  it("sobrepostas não entram", () => {
    expect(problemaDasFaixas([f("08:00", "11:00"), f("10:00", "17:00")])).toMatch(/sobrep/);
  });

  // H2: combinar 22–05 (ou 24h) com outra faixa fica de fora — é o que existia
  // e estava testado, e nenhum lugar real pediu outra coisa.
  it("24h ou travessia da meia-noite, só sozinhas", () => {
    expect(problemaDasFaixas([f("06:00", "08:00"), f("22:00", "05:00")])).toMatch(/sozinha/);
    expect(problemaDasFaixas([f("00:00", "00:00"), f("08:00", "10:00")])).toMatch(/sozinha/);
  });

  // 🔴 M-2 DA REVISÃO DA 11c: a faixa que FECHA à meia-noite (14:00–00:00) era
  // recusada dizendo que "passa da meia-noite" — falso: ela termina nela. A
  // REGRA não muda (as três seguem recusadas junto com outra faixa); muda a
  // frase, que agora diz o que cada uma É. As três pontas da bifurcação, cada
  // uma com a frase dela e sem a das outras (49ª espécie).
  it("a frase diz o que a faixa é: 24 horas, fecha à meia-noite, ou passa dela", () => {
    const de24 = problemaDasFaixas([f("00:00", "00:00"), f("08:00", "10:00")])!;
    const ateMeiaNoite = problemaDasFaixas([f("08:00", "10:00"), f("14:00", "00:00")])!;
    const passa = problemaDasFaixas([f("06:00", "08:00"), f("22:00", "05:00")])!;
    expect(de24).toBe("a faixa 0h–0h é de 24 horas, e uma faixa assim só vale sozinha no horário");
    expect(ateMeiaNoite).toBe("a faixa 14h–0h fecha à meia-noite, e uma faixa assim só vale sozinha no horário");
    expect(passa).toBe("a faixa 22h–5h passa da meia-noite, e uma faixa assim só vale sozinha no horário");
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
