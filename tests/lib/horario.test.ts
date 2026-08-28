import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  abreAindaHoje,
  fechadoAgora,
  minutosDeHHMM,
  minutosDoDiaRecife,
  rotuloAbertura,
  rotuloFaixa,
  rotuloHora,
  type Horario,
} from "@/lib/horario";

// 🔴 O DEFEITO QUE ESTE ARQUIVO TRANCA (2026-08-27). O carimbo só olhava CHUVA.
// A Pedra Furada fecha às 17h, então às 18h com céu limpo a ficha dizia
// "Pode ir" com o lugar fechado havia uma hora — o app afirmando mais do que
// sabe, mesma família do `SEM INFORMAÇÕES · tome cuidado` da v3.4.
const PEDRA: Horario = { abre: "05:00", fecha: "17:00" };
const h = (hh: number, mm = 0) => hh * 60 + mm;

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
    expect(fechadoAgora(undefined, h(23))).toBe(false);
  });

  it("antes de o relógio falar (null), nunca fecha — é o primeiro render", () => {
    expect(fechadoAgora(PEDRA, null)).toBe(false);
  });

  it("dentro da faixa, aberto", () => {
    expect(fechadoAgora(PEDRA, h(9))).toBe(false);
    expect(fechadoAgora(PEDRA, h(16, 59))).toBe(false);
  });

  it("o defeito exato que estava no ar: 18h com céu limpo é FECHADO", () => {
    expect(fechadoAgora(PEDRA, h(18))).toBe(true);
  });

  it("de madrugada, antes de abrir, também é fechado", () => {
    expect(fechadoAgora(PEDRA, h(4, 59))).toBe(true);
  });

  // 🔴 As duas bordas, e elas separam `<`/`<=` — a família de mutação que já
  // produziu o "campo indigitável" da Task 4. No minuto que abre, ABRE; no
  // minuto que fecha, JÁ FECHOU (quem chega 17h00 em ponto não entra).
  it("no minuto de abrir já está aberto; no de fechar já está fechado", () => {
    expect(fechadoAgora(PEDRA, h(5))).toBe(false);
    expect(fechadoAgora(PEDRA, h(17))).toBe(true);
  });

  // Não existe ficha assim hoje. O ramo existe pra que uma faixa dessas não
  // seja lida AO CONTRÁRIO em silêncio — que é o que aconteceria com uma
  // comparação simples.
  it("faixa que atravessa a meia-noite (22h–5h) não é lida ao contrário", () => {
    const noturno: Horario = { abre: "22:00", fecha: "05:00" };
    expect(fechadoAgora(noturno, h(23))).toBe(false);
    expect(fechadoAgora(noturno, h(3))).toBe(false);
    expect(fechadoAgora(noturno, h(12))).toBe(true);
  });

  it("abre e fecha na mesma hora significa 24h, não zero", () => {
    expect(fechadoAgora({ abre: "00:00", fecha: "00:00" }, h(13))).toBe(false);
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
    expect(rotuloAbertura(PEDRA, h(4))).toBe("abre às 5h");
    expect(rotuloAbertura(PEDRA, h(18))).toBe("abre amanhã às 5h");
  });

  it("a faixa inteira, pro motivo da ficha", () => {
    expect(rotuloFaixa(PEDRA)).toBe("Fecha às 17h, abre às 5h.");
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
