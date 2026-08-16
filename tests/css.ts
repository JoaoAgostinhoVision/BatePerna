/** A RÉGUA DE CSS — uma só, pro app inteiro.
 *
 *  Não é um teste (o vitest não coleta este arquivo: o `include` padrão pede
 *  `*.test.*`). São as ferramentas que os testes usam pra ler o CSS como o
 *  navegador o lê, e elas moram aqui por um motivo já pago: cada cópia solta
 *  do `regraDe`/`valorDe` é uma chance de UMA delas perder a âncora e o teste
 *  daquele arquivo enfraquecer em silêncio. Mesma razão do `coordDaDistancia`
 *  em src/lib/geo.ts — uma pergunta, uma resposta.
 *
 *  Quatro asserções deste projeto já passaram com o defeito de volta por lerem
 *  "existe em algum lugar deste bloco" em vez de "esta declaração vale isto".
 *  As frestas conhecidas estão documentadas em cada função abaixo. */

import { readFileSync } from "node:fs";
import path from "node:path";

/** O arquivo de `src/app/` SEM os comentários.
 *
 *  Todo leitor de CSS passa por aqui de propósito: um `.mapa-home { … }`
 *  escrito em PROSA dentro de um comentário casa antes da regra de verdade, e
 *  a suíte fica vermelha (ou verde) por causa de um texto. Some junto o
 *  benefício de tabela: sem comentário, o `[^}]*` do `regraDe` não pode ser
 *  interrompido por uma chave escrita em português. */
export const semComentarios = (arq: string): string =>
  readFileSync(path.join(process.cwd(), "src", "app", arq), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

/** 🔴 TODAS as regras que casam o seletor, na ordem do arquivo — porque é
 *  assim que o navegador lê.
 *
 *  Isto já foi `match` sem /g, devolvendo só a PRIMEIRA, e o comentário que
 *  estava aqui AFIRMAVA que uma segunda regra "deixaria o teste vermelho, o
 *  que é o certo". **Era falso, e foi medido:** anexando ao fim do `home.css`
 *
 *      .bp .folha    { padding: 0; }
 *      .bp .mapa-home { height: 40px; }
 *
 *  a suíte fechava **523/523 verde** — e no navegador o último cartão voltava
 *  pra trás da barra fixa e o mapa da home colapsava pra 40px, com
 *  `MAPA_ALTURA_HOME_PX = 168` e o orçamento da dobra inteiro virando ficção.
 *  A régua lia a primeira regra, que continuava certa; a tela obedecia à
 *  última. **Comentário errado é pior que a fresta: o próximo leitor confia
 *  nele.**
 *
 *  Devolver a concatenação (e não só a última regra) é o que casa com a
 *  cascata de verdade: uma segunda regra sobrescreve **as propriedades que
 *  declara**, não a regra inteira. Quem resolve o empate é o `valorDe`, lendo
 *  a ÚLTIMA declaração.
 *
 *  O `\s*\{` continua sendo o que impede `.bp .cartao` de casar dentro de
 *  `.bp .cartao:active {` ou de `.bp .cartao, .bp .outro {` — `:` e `,` não
 *  são espaço nem chave.
 *
 *  Índice 0 = as regras juntas, pra os ~31 pontos de uso continuarem fazendo
 *  `regra![0]` sem saber de nada disto. */
export const regraDe = (fonte: string, seletor: string): string[] | null => {
  // Escapa TODO metacaractere, não só `.` e `-`: seletor de atributo
  // (`.bp[data-state="frio"] .wp-pin`) tem colchetes, e sem escapar eles viram
  // classe de caractere — a regra some e o teste fica vermelho por regex, não
  // por defeito.
  const re = new RegExp(`${seletor.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\s*\\{[^}]*\\}`, "gs");
  const todas = fonte.match(re);
  return todas ? [todas.join("\n")] : null;
};

/** 🔴 O VALOR DA DECLARAÇÃO, nunca "existe em algum lugar deste bloco".
 *
 *  `toContain("height: 168px")` sobre o bloco inteiro é substring de
 *  `max-height: 168px`: essa mutação deixava a suíte VERDE e o mapa sumia
 *  inteiro da home (os tiles são `position: absolute`, a caixa colapsa). As
 *  outras três da mesma família já pegas neste projeto:
 *    • `min-height: 36px` casando dentro de `--min-height: 36px`;
 *    • `font-size: 16px` do `.busca-campo` casando dentro de
 *      `--font-size: 16px; font-size: 13px` — e ABAIXO de 16px o Safari do
 *      iPhone dá zoom sozinho ao focar o campo e a tela salta;
 *    • `width: 44px` do `.pin-home` casando dentro de `max-width: 44px`,
 *      deixando o alvo de toque real virar 28 com o teste ainda dizendo 44.
 *
 *  A âncora `(?:^|[{;])` obriga a propriedade a COMEÇAR uma declaração: o `-`
 *  de `max-` e o `-` de `--font` não são `{`, nem `;`, nem início de string.
 *  Devolve o valor inteiro, pra ser comparado com `toBe` — bloco cresce,
 *  declaração não. `null` quando a declaração não existe (que também é uma
 *  resposta: ver o teste do `.grupo-k`, que EXIGE `min-height` ausente).
 *
 *  🔴 A ÚLTIMA declaração, não a primeira — é a que o navegador usa, tanto
 *  quando a propriedade se repete dentro de um bloco quanto quando o
 *  `regraDe` juntou duas regras do mesmo seletor. Ler a primeira era a outra
 *  metade da fresta descrita no `regraDe`. */
export const valorDe = (regra: string, prop: string): string | null => {
  const re = new RegExp(`(?:^|[{;])\\s*${prop}\\s*:\\s*([^;}]+)`, "gs");
  const todas = [...regra.matchAll(re)];
  const ultima = todas[todas.length - 1];
  return ultima ? ultima[1].trim() : null;
};

/** Os valores de um shorthand, respeitando parênteses: `calc(a + b) 1rem` são
 *  DOIS valores, não cinco. Sem isso não dá pra saber qual LADO do shorthand
 *  um `calc(...)` ocupa. */
export const fatiar = (valores: string): string[] => {
  const fora: string[] = [];
  let atual = "";
  let fundo = 0;
  for (const c of valores.trim()) {
    if (c === "(") fundo++;
    if (c === ")") fundo--;
    if (/\s/.test(c) && fundo === 0) {
      if (atual) fora.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  if (atual) fora.push(atual);
  return fora;
};

/** 🔴 UM LADO do padding — o único que responde a pergunta que se está
 *  fazendo.
 *
 *  `/padding:[^;]*var\(--barra-h\)/` só dizia "o shorthand cita a variável em
 *  algum lugar". Mutação: mover o `calc(var(--barra-h) …)` do FIM do shorthand
 *  pro COMEÇO — suíte verde, e o último cartão volta pra trás da barra fixa.
 *
 *  No shorthand de 1 a 4 valores: topo é o 1º; direita o 2º (ou o 1º); baixo o
 *  3º (ou o 1º); esquerda o 4º (ou o 2º, ou o 1º). Uma declaração explícita
 *  (`padding-bottom:`) ganha, porque é o que o navegador usa. */
export type Lado = "top" | "right" | "bottom" | "left";

export const ladoDe = (regra: string, prop: "padding" | "margin", lado: Lado): string | null => {
  const explicito = valorDe(regra, `${prop}-${lado}`);
  if (explicito) return explicito;
  const curto = valorDe(regra, prop);
  if (!curto) return null;
  const v = fatiar(curto);
  if (v.length === 0) return null;
  const indice = { top: 0, right: 1, bottom: 2, left: 3 }[lado];
  // Cada lado herda do que está DUAS posições antes quando o shorthand é curto.
  for (let i = indice; i >= 0; i -= 2) {
    if (v[i] !== undefined) return v[i];
  }
  return v[0] ?? null;
};

export const paddingLado = (regra: string, lado: Lado): string | null =>
  ladoDe(regra, "padding", lado);

export const margemLado = (regra: string, lado: Lado): string | null =>
  ladoDe(regra, "margin", lado);

/** rem → px. Nenhum arquivo do app declara `font-size` na raiz — e existe um
 *  teste em tests/lib/home-layout.test.ts provando que ninguém declarou, sem o
 *  qual TODA altura derivada de rem passa a mentir em silêncio. */
export const REM_PX = 16;

export const px = (valor: string | null | undefined): number => {
  const m = valor?.trim().match(/^(-?[\d.]*\d)(px|rem)$/);
  if (!m) return NaN;
  return parseFloat(m[1]) * (m[2] === "rem" ? REM_PX : 1);
};
