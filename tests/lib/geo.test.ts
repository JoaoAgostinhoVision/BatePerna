import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  distanciaKm,
  formatarDistancia,
  formatarDistanciaCurta,
  formatarExtensao,
  kmNaTelaDistancia,
  kmNaTelaExtensao,
} from "@/lib/geo";

// Âncoras derivadas da própria geometria da esfera, não de geografia real:
// um grau no equador = 2·π·6371/360 = 111,195 km.
const GRAU_KM = (2 * Math.PI * 6371) / 360;

describe("distanciaKm", () => {
  it("um grau de longitude no equador ≈ 111,195 km", () => {
    const d = distanciaKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(d).toBeCloseTo(GRAU_KM, 1);
  });

  it("um grau de latitude ≈ 111,195 km (vale em qualquer meridiano)", () => {
    const d = distanciaKm({ lat: 0, lng: -36 }, { lat: 1, lng: -36 });
    expect(d).toBeCloseTo(GRAU_KM, 1);
  });

  it("o mesmo ponto dá zero", () => {
    const p = { lat: -7.907889, lng: -36.019222 };
    expect(distanciaKm(p, p)).toBeCloseTo(0, 6);
  });

  it("é simétrica", () => {
    const a = { lat: -7.907889, lng: -36.019222 };
    const b = { lat: -8.05, lng: -34.9 };
    expect(distanciaKm(a, b)).toBeCloseTo(distanciaKm(b, a), 9);
  });

  it("longitude encolhe com a latitude (1° a −60° vale metade do equador)", () => {
    const noEquador = distanciaKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const em60 = distanciaKm({ lat: -60, lng: 0 }, { lat: -60, lng: 1 });
    expect(em60).toBeCloseTo(noEquador / 2, 0);
  });
});

describe("formatarDistancia", () => {
  it("abaixo de 1 km não finge precisão", () => {
    expect(formatarDistancia(0.4)).toBe("menos de 1 km em linha reta daqui");
    expect(formatarDistancia(0.9)).toBe("menos de 1 km em linha reta daqui");
  });

  it("entre 1 e 10 km usa uma casa decimal com vírgula", () => {
    expect(formatarDistancia(1)).toBe("~1,0 km em linha reta daqui");
    expect(formatarDistancia(4.24)).toBe("~4,2 km em linha reta daqui");
    expect(formatarDistancia(9.9)).toBe("~9,9 km em linha reta daqui");
  });

  it("de 10 km pra cima arredonda pra inteiro", () => {
    expect(formatarDistancia(10)).toBe("~10 km em linha reta daqui");
    expect(formatarDistancia(38.4)).toBe("~38 km em linha reta daqui");
    expect(formatarDistancia(124.6)).toBe("~125 km em linha reta daqui");
  });

  it("na lacuna [9,95, 10) arredonda pra 10 inteiro, não '10,0'", () => {
    expect(formatarDistancia(9.99)).toBe("~10 km em linha reta daqui");
  });

  it('cada ramo diz "em linha reta" — é o que impede o número de mentir', () => {
    for (const km of [0.1, 0.99, 1, 5.5, 9.99, 10, 42, 999]) {
      expect(formatarDistancia(km)).toContain("em linha reta");
    }
  });
});

describe("formatarDistanciaCurta: a linha do cartão", () => {
  // "em linha reta" é load-bearing: no agreste, 40km em reta podem ser 1h30
  // de serra. Sem o rótulo, o número mente pra baixo. Só o "daqui" sai — a
  // pílula do mapa já diz de onde se está medindo.
  it("mantém o 'em linha reta'", () => {
    expect(formatarDistanciaCurta(41)).toBe("~41 km em linha reta");
  });
  it("não repete o 'daqui' que a pílula já diz", () => {
    expect(formatarDistanciaCurta(41)).not.toContain("daqui");
  });
  it("abaixo de 1 km", () => {
    expect(formatarDistanciaCurta(0.4)).toBe("menos de 1 km em linha reta");
  });
  it("uma casa decimal abaixo de 10, com vírgula", () => {
    expect(formatarDistanciaCurta(4.25)).toBe("~4,3 km em linha reta");
  });
});

// 🔴 Sem chamador hoje: a extensão saiu do cartão e da ficha em 2026-08-23
// (ver o comentário em geo.ts). O título descreve a GARANTIA da função — o
// mesmo número pra qualquer chamador, ontem cartão e ficha, hoje nenhum —,
// não uma tela ao vivo.
describe("formatarExtensao: o mesmo número pra qualquer chamador", () => {
  // O sufixo é da FUNÇÃO, não do chamador — ver o comentário em geo.ts.
  it("formatarExtensao(4) devolve '4 km de trilha', com o sufixo", () => {
    expect(formatarExtensao(4)).toBe("4 km de trilha");
  });

  it("não devolve o mesmo formato de formatarDistanciaCurta", () => {
    // formatarDistanciaCurta sempre diz "em linha reta" e nunca "de trilha";
    // formatarExtensao é o oposto. Se as duas convergissem, um chamador
    // trocado por outro passaria despercebido.
    //
    // MEDIDO, pra este comentário não prometer mais do que entrega:
    // - com `formatarExtensao` delegando pra `formatarDistanciaCurta` (a
    //   convergência que o nome do teste cita), ele CAI — 'expected
    //   "~4,0 km em linha reta" not to be "~4,0 km em linha reta"'.
    // - com o sufixo " de trilha" simplesmente apagado, ele NÃO cai: "4 km" e
    //   "~4,0 km em linha reta" continuam diferentes, e nenhuma das três
    //   asserções olha pro sufixo. Quem mata esse caso são os testes de valor
    //   exato acima e abaixo, e é lá que ele está coberto — não aqui.
    expect(formatarExtensao(4)).not.toBe(formatarDistanciaCurta(4));
    expect(formatarExtensao(4)).not.toContain("em linha reta");
    expect(formatarDistanciaCurta(4)).not.toContain("de trilha");
  });

  it("fração abaixo de 10 usa uma casa decimal com vírgula", () => {
    expect(formatarExtensao(4.25)).toBe("4,3 km de trilha");
  });

  it("valor inteiro não ganha ',0' à toa", () => {
    expect(formatarExtensao(12)).toBe("12 km de trilha");
  });

  // O piso, no molde do "abaixo de 1 km não finge precisão" da irmã. Sem ele o
  // arredondamento devolve "0 km de trilha" — o app afirmando ZERO, que é
  // justamente o que ele não faz. `0.9` entra junto porque o defeito não é só o
  // zero: "0,9 km de trilha" também é precisão que a fonte do número não tem.
  it("abaixo de 1 km não afirma zero", () => {
    expect(formatarExtensao(0.04)).toBe("menos de 1 km de trilha");
    expect(formatarExtensao(0.9)).toBe("menos de 1 km de trilha");
  });

  // A borda, do lado de cá: o piso não pode engolir o próprio limite. Sem este
  // caso, um `km <= 1` passaria batido e a trilha de 1 km — que a ficha sabe
  // medir — perderia o número.
  it("1 km exato continua sendo número: o piso não engole o limite", () => {
    expect(formatarExtensao(1)).toBe("1 km de trilha");
  });
});

/** 🔴 O NÚMERO DA TELA — a fonte única do arredondamento, e a razão de este
 *  bloco existir.
 *
 *  A tela arredondava e o filtro comparava o km CRU: "até 4 km" escondia um
 *  cartão dizendo "4 km de trilha", e "até 10 km" escondia um dizendo "~10 km
 *  em linha reta". A decisão do dono do app foi **o filtro segue a tela**, e a
 *  forma escolhida foi uma função que devolve o NÚMERO, com os dois lados
 *  chamando ELA. Os casos abaixo são o dono dessa função na prova de mutação —
 *  os testes do filtro provam que o recorte a usa, estes provam o que ela diz. */
describe("kmNaTelaDistancia: o número que a tela da distância mostra", () => {
  it("abaixo de 10 km é o de uma casa decimal", () => {
    expect(kmNaTelaDistancia(1)).toBe(1);
    expect(kmNaTelaDistancia(4.24)).toBe(4.2);
    expect(kmNaTelaDistancia(4.25)).toBe(4.3);
    expect(kmNaTelaDistancia(9.9)).toBe(9.9);
  });

  // 🔴 O RAMO, e este é o caso que o separa do de cima. Com o ramo do inteiro
  // valendo em toda a escala, `kmNaTelaDistancia(9.9)` daria 10 e o de cima
  // cairia; com o ramo de uma casa valendo em toda a escala, `12.4` daria 12,4
  // e este cai. Um caso de cada lado, porque a fronteira é no meio da escala.
  it("de 10 km pra cima é o INTEIRO", () => {
    expect(kmNaTelaDistancia(10)).toBe(10);
    expect(kmNaTelaDistancia(12.4)).toBe(12);
    expect(kmNaTelaDistancia(38.4)).toBe(38);
    expect(kmNaTelaDistancia(124.6)).toBe(125);
  });

  // A lacuna [9,95, 10): arredonda pra uma casa ANTES de escolher o ramo, senão
  // 9,99 cairia no ramo decimal e viraria 10,0 — a mesma distância com duas
  // caras. O número devolvido é 10, inteiro.
  it("9,99 já é 10 inteiro, e não 10,0", () => {
    expect(kmNaTelaDistancia(9.99)).toBe(10);
    expect(Number.isInteger(kmNaTelaDistancia(9.99))).toBe(true);
  });

  // 🔴 A DECISÃO SOBRE O "MENOS DE 1 KM", e o teste que a separa das
  // alternativas. A tela não mostra número nesse ramo, então a função não
  // devolve número: `null` quer dizer "não há número na tela pra comparar", e o
  // filtro lê isso como "não esconde". Devolver o km cru (0,4) ou o teto do
  // texto (1) seriam as duas alternativas razoáveis — e é AQUI que elas morrem,
  // porque no filtro nenhuma das três se separa (todo teto guardável é inteiro
  // ≥ 1, e as três passam em todos).
  //
  // A razão da escolha: `null` faz o ramo ficar INCAPAZ de esconder por
  // construção, em vez de por sorte aritmética — se um dia o teto puder ser
  // fracionário (0,5 km), o km cru continuaria escondendo e o `null` não. E é
  // ele que mantém o limiar `km < 1` escrito uma vez só no módulo.
  it("abaixo de 1 km não há número na tela: devolve null, não 0 e não o km cru", () => {
    expect(kmNaTelaDistancia(0.4)).toBe(null);
    expect(kmNaTelaDistancia(0.9)).toBe(null);
    expect(kmNaTelaDistancia(0.04)).toBe(null);
  });

  it("1 km exato já tem número: o piso não engole o limite", () => {
    expect(kmNaTelaDistancia(1)).toBe(1);
  });
});

describe("kmNaTelaExtensao: o número que a tela da extensão mostra", () => {
  it("é sempre o de uma casa decimal, em toda a escala", () => {
    expect(kmNaTelaExtensao(1)).toBe(1);
    expect(kmNaTelaExtensao(4.04)).toBe(4);
    expect(kmNaTelaExtensao(4.25)).toBe(4.3);
    expect(kmNaTelaExtensao(12)).toBe(12);
    expect(kmNaTelaExtensao(12.4)).toBe(12.4);
    expect(kmNaTelaExtensao(124.64)).toBe(124.6);
  });

  it("abaixo de 1 km não há número na tela: devolve null", () => {
    expect(kmNaTelaExtensao(0.4)).toBe(null);
    expect(kmNaTelaExtensao(0.04)).toBe(null);
  });

  // 🔴 SÃO DUAS FUNÇÕES, e este é o caso que prova que uma só não serviria. As
  // duas telas divergem de 10 km pra cima: a distância vira inteira ("~12 km"),
  // a extensão fica com a casa ("12,4 km de trilha"). Fundir as duas faria uma
  // das duas telas mentir — e um recorte comparar um número que a outra não
  // mostra, que é o defeito que este conserto veio fechar.
  it("as duas divergem de 10 km pra cima — por isso são duas", () => {
    expect(kmNaTelaDistancia(12.4)).toBe(12);
    expect(kmNaTelaExtensao(12.4)).toBe(12.4);
    expect(kmNaTelaDistancia(12.4)).not.toBe(kmNaTelaExtensao(12.4));
  });

  // E o outro lado: abaixo de 10 km as duas COINCIDEM. Sem isto, "são duas"
  // podia virar "são duas que fazem coisas diferentes em qualquer lugar", e
  // alguém trocaria o degrau de uma delas sem nada cair.
  it("abaixo de 10 km as duas dão o mesmo número", () => {
    expect(kmNaTelaDistancia(4.25)).toBe(kmNaTelaExtensao(4.25));
    expect(kmNaTelaDistancia(9.94)).toBe(kmNaTelaExtensao(9.94));
  });
});

/** 🔴 A PROVA DE FONTE do lado do `geo.ts` — irmã da que está em
 *  tests/lib/filtros.test.ts, e pela MESMA razão.
 *
 *  Em runtime, um `formatarExtensao` que refizesse `Math.round(km * 10) / 10`
 *  por conta própria devolve exatamente o mesmo texto: nenhuma asserção sobre a
 *  string separa as duas versões — todos os testes de texto deste arquivo
 *  passam com a conta duplicada. E DUPLICADA ela volta a divergir do filtro no
 *  dia em que uma das duas mudar, que é o defeito inteiro.
 *
 *  A "uma fonte" tem dois lados e os dois estão aqui: quem formata CHAMA a
 *  função do número, e quem formata NÃO arredonda. */
describe("quem formata não refaz a conta — os dois lados da mesma fonte", () => {
  const src = readFileSync(path.join(process.cwd(), "src", "lib", "geo.ts"), "utf8");

  /** O corpo de uma função exportada, SEM COMENTÁRIOS: do
   *  `export function <nome>(` até a chave de fechamento na coluna 0. Só serve
   *  porque este arquivo é formatado assim — e a conferência dentro de cada
   *  teste grita se deixar de ser.
   *
   *  🔴 A tira de comentários foi medida como necessária na irmã deste teste
   *  (tests/lib/filtros.test.ts): lá, um comentário citando o nome da função
   *  deixou a asserção de "chama" verde com a chamada apagada. Um teste de
   *  fonte que lê comentário prova que alguém ESCREVEU o nome, não que o código
   *  o CHAMA. Aqui os corpos hoje não têm comentário nenhum — a tira é o que
   *  garante que continuem sem valer como prova se ganharem um. */
  const corpo = (nome: string) => {
    const i = src.indexOf(`export function ${nome}(`);
    expect(i, `${nome} sumiu de geo.ts`).toBeGreaterThan(-1);
    const j = src.indexOf("\n}", i);
    expect(j, `não achei o fim de ${nome}`).toBeGreaterThan(i);
    return src
      .slice(i, j)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  };

  it.each([
    ["formatarDistancia", "kmNaTelaDistancia"],
    ["formatarExtensao", "kmNaTelaExtensao"],
  ])("%s formata o que %s devolve, e não arredonda nada", (formatador, fonte) => {
    const c = corpo(formatador);
    // A extração é conferida antes de valer como prova: um corpo vazio faria as
    // duas asserções abaixo passarem sem olhar nada.
    expect(c, `o corpo de ${formatador} veio vazio`).toContain("return");
    expect(c, `${formatador} tem que chamar ${fonte}`).toContain(`${fonte}(`);
    expect(c, `${formatador} está refazendo a conta em vez de usar a fonte`).not.toMatch(
      /Math\.round\(/,
    );
  });

  // O `formatarDistanciaCurta` é o terceiro consumidor e não tem conta própria
  // nenhuma: ele reescreve o texto da irmã. Se um dia ganhar uma, é aqui que
  // aparece.
  it("formatarDistanciaCurta não tem conta própria — ele reescreve o texto da irmã", () => {
    const c = corpo("formatarDistanciaCurta");
    expect(c).toContain("formatarDistancia(");
    expect(c).not.toMatch(/Math\.round\(/);
  });
});

/** 🔴 A JUNÇÃO DENTRO DO MÓDULO: o número que sai da função é EXATAMENTE o
 *  número que aparece no texto. É esta igualdade que dá sentido a o filtro
 *  comparar com a função — sem ela, "o filtro segue a tela" seria uma frase.
 *
 *  O número é extraído do TEXTO por regex e comparado com o valor devolvido:
 *  duas rotas independentes pro mesmo fato. Os valores são os de fronteira,
 *  onde as versões se separam. */
describe("o número da função é o número que está escrito no texto", () => {
  const noTexto = (t: string) => {
    const m = t.match(/(\d+(?:,\d+)?) km/);
    return m ? Number(m[1].replace(",", ".")) : null;
  };

  it.each([1, 4.04, 4.25, 9.99, 10, 10.4495, 12.4, 30.44, 30.46, 124.6])(
    "distância de %s km: o texto mostra o mesmo número que kmNaTelaDistancia",
    (km) => {
      expect(noTexto(formatarDistancia(km))).toBe(kmNaTelaDistancia(km));
      expect(noTexto(formatarDistanciaCurta(km))).toBe(kmNaTelaDistancia(km));
    },
  );

  it.each([1, 4, 4.04, 4.06, 4.25, 12, 12.4, 20])(
    "extensão de %s km: o texto mostra o mesmo número que kmNaTelaExtensao",
    (km) => {
      expect(noTexto(formatarExtensao(km))).toBe(kmNaTelaExtensao(km));
    },
  );

  // O ramo sem número: o texto do "menos de 1 km" tem um `1` escrito, e a
  // função devolve `null`. Aqui as duas rotas divergem DE PROPÓSITO — e é essa
  // divergência que o filtro lê como "não esconde". Sem este caso, o `it.each`
  // acima podia ganhar um valor sub-1 um dia e falhar sem que ninguém
  // entendesse por quê.
  it("no ramo do 'menos de 1 km' o texto traz um 1 e a função devolve null — de propósito", () => {
    expect(formatarDistancia(0.4)).toBe("menos de 1 km em linha reta daqui");
    expect(noTexto(formatarDistancia(0.4))).toBe(1);
    expect(kmNaTelaDistancia(0.4)).toBe(null);
    expect(formatarExtensao(0.4)).toBe("menos de 1 km de trilha");
    expect(kmNaTelaExtensao(0.4)).toBe(null);
  });
});
