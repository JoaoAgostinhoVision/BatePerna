import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIAS,
  diaDaSemanaRecife,
  diasAteAbrir,
  fechadoNoDia,
  rotuloDias,
  rotuloProximoDia,
  rotuloSemana,
  type Dia,
} from "@/lib/semana";

// 🔴 O DEFEITO QUE ESTE ARQUIVO TRANCA (2026-09-11). A Rampa do Pepê virou "Eco
// Park" e passou a receber visita **só aos sábados e domingos**. Como ela não
// tem `horario` nenhum, numa quarta-feira seca o app dizia "Pode ir" — e
// mandava a pessoa dirigir 178 km até um portão trancado.
//
// É a MESMA família do defeito de 2026-08-27 (a Pedra Furada dizendo "Pode ir"
// às 18h num lugar fechado desde as 17h), num eixo que o app não tinha: lá ele
// afirmava mais do que sabia sobre a HORA, aqui sobre o DIA.

const FIM_DE_SEMANA: Dia[] = ["sab", "dom"];
const DOM = 0, SEG = 1, TER = 2, QUA = 3, QUI = 4, SEX = 5, SAB = 6;

describe("o dia da semana em Recife", () => {
  // 🔴 A ASSERÇÃO MAIS LOAD-BEARING DO ARQUIVO. A ordem de `DIAS` **é** o índice
  // de `Date.getUTCDay()`, e é isso que dispensa uma tabela de conversão entre
  // "o dia que o relógio diz" e "o dia que a ficha declara". Reordenar o array
  // por estética — pra começar na segunda, por exemplo — faria `fechadoNoDia`
  // errar o dia inteiro **em silêncio**: a ficha diria "sab" e o app fecharia
  // na sexta. As sete datas são escritas à mão de propósito; derivá-las com
  // `getUTCDay` seria o teste conferindo a função contra ela mesma.
  it("cada posição de DIAS é o índice que o relógio devolve", () => {
    // 2027-01-17 é um domingo. Sete dias seguidos, um por posição.
    const esperado = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
    expect(DIAS).toEqual(esperado);
    for (let i = 0; i < 7; i++) {
      const meioDiaUTC = Date.UTC(2027, 0, 17 + i, 15, 0) / 1000; // 12h em Recife
      expect(DIAS[diaDaSemanaRecife(meioDiaUTC)], `dia ${i} da varredura`).toBe(esperado[i]);
    }
  });

  // 🔴 AS TRÊS HORAS DE RECIFE MUDAM O DIA, e é aqui que um offter esquecido
  // aparece: às 21h de um sábado em Recife já é DOMINGO em UTC. Sem o
  // deslocamento, o app fecharia a Rampa no sábado à noite — o dia errado por
  // três horas, bem na hora em que alguém checa se vale a pena sair amanhã.
  it("às 21h de sábado em Recife ainda é sábado — mesmo já sendo domingo em UTC", () => {
    const instante = Date.UTC(2027, 0, 17, 0, 0) / 1000; // domingo 00h UTC
    expect(new Date(instante * 1000).getUTCDay(), "a premissa do teste").toBe(DOM);
    expect(diaDaSemanaRecife(instante)).toBe(SAB);
  });

  it("e a virada acontece na hora certa: 03h UTC de domingo já é domingo em Recife", () => {
    expect(diaDaSemanaRecife(Date.UTC(2027, 0, 17, 3, 0) / 1000)).toBe(DOM);
  });
});

describe("fechadoNoDia", () => {
  // As DUAS portas do silêncio, iguais às do `fechadoAgora`: uma é "esta ficha
  // não folga", a outra é "ainda não sei que dia é". Nas duas o app NÃO afirma
  // que fechou — é a régua do `piso`, do `secaRapido` e do `horario`.
  it("ficha sem dias nunca fecha — o app não inventa folga que ninguém deu", () => {
    expect(fechadoNoDia(undefined, QUA)).toBe(false);
  });

  it("antes de o relógio falar (null), nunca fecha — é o primeiro render", () => {
    expect(fechadoNoDia(FIM_DE_SEMANA, null)).toBe(false);
  });

  // 🔴 OS DOIS LADOS DA RÉGUA, e eles não são redundantes: um `fechadoNoDia`
  // que devolvesse sempre `true` passaria só no primeiro; um que devolvesse
  // sempre `false` passaria só no segundo. Juntos, matam as duas.
  it("nos cinco dias em que não abre, fecha", () => {
    for (const d of [SEG, TER, QUA, QUI, SEX]) {
      expect(fechadoNoDia(FIM_DE_SEMANA, d), `dia ${DIAS[d]}`).toBe(true);
    }
  });

  it("nos dois dias em que abre, não fecha", () => {
    expect(fechadoNoDia(FIM_DE_SEMANA, SAB)).toBe(false);
    expect(fechadoNoDia(FIM_DE_SEMANA, DOM)).toBe(false);
  });

  it("a ficha que abre todo dia nunca fecha por dia", () => {
    expect(DIAS.some((_, d) => fechadoNoDia([...DIAS], d))).toBe(false);
  });
});

describe("quantos dias até abrir", () => {
  it("no próprio dia é zero", () => {
    expect(diasAteAbrir(FIM_DE_SEMANA, SAB)).toBe(0);
  });

  it("a sexta espera um dia; a segunda espera cinco", () => {
    expect(diasAteAbrir(FIM_DE_SEMANA, SEX)).toBe(1);
    expect(diasAteAbrir(FIM_DE_SEMANA, SEG)).toBe(5);
  });

  // 🔴 A VOLTA DA SEMANA, e é o ramo que um laço ingênuo erra: do domingo pro
  // sábado seguinte são SEIS dias, não um passeio pra frente que estoura a
  // lista. O `% 7` é o que segura isso, e sem este caso apagá-lo não quebraria
  // nada.
  it("do domingo ao sábado seguinte a contagem dá a volta na semana", () => {
    expect(diasAteAbrir(["sab"], DOM)).toBe(6);
    expect(diasAteAbrir(["seg"], SAB)).toBe(2);
  });

  // Lista vazia é o que o schema recusa — e é justamente por isso que o laço
  // precisa parar: um `[]` chegando por qualquer outro caminho travaria o
  // navegador na mão de quem só queria saber se dá pra ir.
  it("lista vazia devolve null em vez de girar pra sempre", () => {
    expect(diasAteAbrir([], QUA)).toBeNull();
  });
});

describe("as palavras da semana", () => {
  // 🔴 ESTE TESTE NASCEU DE UM DEFEITO MEDIDO, não de uma intuição: a primeira
  // versão de `rotuloDias` lia a lista na ordem de `DIAS` — que começa no
  // domingo, porque é a ordem do relógio — e a ficha da Rampa dizia
  // **"Abre domingo e sábado."** na tela. Ninguém fala assim.
  it("o fim de semana se lê sábado→domingo, e não na ordem do relógio", () => {
    expect(rotuloDias(FIM_DE_SEMANA)).toBe("sábado e domingo");
  });

  // A ordem da FICHA não decide a frase: os dois arranjos são o mesmo fato, e
  // duas fichas com o mesmo fato têm que dizer a mesma coisa na tela.
  it("a ordem em que a ficha escreveu não muda a frase", () => {
    expect(rotuloDias(["dom", "sab"])).toBe(rotuloDias(["sab", "dom"]));
  });

  it("três dias levam vírgula e um 'e' no fim; um dia vai sozinho", () => {
    expect(rotuloDias(["sex", "seg", "qua"])).toBe("segunda, quarta e sexta");
    expect(rotuloDias(["ter"])).toBe("terça");
  });

  it("a semana inteira se lê de segunda a domingo", () => {
    expect(rotuloDias([...DIAS])).toBe(
      "segunda, terça, quarta, quinta, sexta, sábado e domingo",
    );
  });

  // 🔴 O "amanhã" é o mesmo raciocínio que o `rotuloAbertura` já carrega pra
  // hora: quem lê numa sexta precisa saber que é só esperar a noite passar, e
  // quem lê numa segunda precisa saber que perdeu a semana. A MESMA frase nos
  // dois casos mentiria pra metade das pessoas.
  it("na sexta é 'abre amanhã'; na segunda é 'abre sábado'", () => {
    expect(rotuloProximoDia(FIM_DE_SEMANA, SEX)).toBe("abre amanhã");
    expect(rotuloProximoDia(FIM_DE_SEMANA, SEG)).toBe("abre sábado");
  });

  // O domingo é a borda: quem lê no domingo ainda ESTÁ no dia em que abre, e
  // esta frase nunca chega à tela (o carimbo só a pede quando já sabe que
  // fechou). Vale cravar mesmo assim — se um dia chegar, "abre hoje" é o certo,
  // e "abre amanhã" seria a mentira.
  it("no próprio dia em que abre, não diz 'amanhã'", () => {
    expect(rotuloProximoDia(FIM_DE_SEMANA, DOM)).toBe("abre domingo");
  });

  it("sem dia nenhum pra abrir, cala em vez de inventar um sábado", () => {
    expect(rotuloProximoDia([], QUA)).toBeNull();
  });

  it("a frase do motivo, pra ficha", () => {
    expect(rotuloSemana(FIM_DE_SEMANA)).toBe("Abre sábado e domingo.");
  });
});

// 🔴 A MESMA PROVA QUE `horario.test.ts` carrega, e pela mesma história: quatro
// rodadas de 2026-08-27 arrancaram substantivo de lugar do código ("portão",
// "barro", "subir"). Um módulo novo sobre "quando o lugar abre" é o candidato
// óbvio pra reintroduzir um — a tentação de escrever "o parque abre sábado" é
// enorme, e ela é verdade só na Rampa.
describe("nenhum substantivo de lugar mora aqui", () => {
  const fonte = readFileSync(path.join(process.cwd(), "src", "lib", "semana.ts"), "utf8");
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  it("o código do módulo não nomeia o que abre", () => {
    // A tira precisa de guarda: sem estas duas linhas, um regex que comesse o
    // arquivo deixaria a ausência abaixo passar por vacuidade, sempre.
    expect(codigo, "a tira de comentários comeu o código").toContain("export function fechadoNoDia");
    expect(codigo).toContain("rotuloSemana");
    expect(codigo, "voltou substantivo de lugar pro código").not.toMatch(
      /portão|guarita|cancela|catraca|parque|guichê|bilheteria/i,
    );
  });

  // O fuso é UM só neste app. Repetir `-3 * 3600` aqui seria a segunda fonte, e
  // o dia em que alguém corrigisse um dos dois o app teria dois relógios — um
  // dizendo que horas são e outro dizendo que dia é.
  it("o offset de Recife é IMPORTADO, não reescrito", () => {
    expect(codigo, "o fuso virou uma segunda fonte").not.toMatch(/3\s*\*\s*3600/);
    expect(fonte).toMatch(/import\s*\{\s*OFFSET_RECIFE_S\s*\}/);
  });

  // 🔴 E a ordem de leitura é DERIVADA de `DIAS`, nunca uma segunda lista de
  // nomes escrita à mão: com duas listas, o dia em que alguém acrescentasse um
  // dia a uma e não à outra, a tela perderia um dia em silêncio.
  it("a ordem de leitura sai de DIAS, e não de uma segunda lista", () => {
    expect(codigo, "a ordem de leitura virou uma lista escrita à mão").not.toMatch(
      /ORDEM_LEITURA[^=]*=\s*\[\s*"/,
    );
    expect(codigo).toMatch(/ORDEM_LEITURA[^=]*=\s*\[\s*\.\.\.DIAS/);
  });
});
