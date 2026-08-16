import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import BarraNavegacao from "@/app/BarraNavegacao";

afterEach(() => { cleanup(); });

/** Cada regra é lida NO ARQUIVO ONDE ELA VIVE: `.bp .barra` e `.bp .folha` no
 *  `home.css`, `.bp .screen` e `.bp .lista` no `ficha.css`. As duas telas
 *  importam os dois arquivos. Duplicar uma regra pro teste ficar mais curto
 *  criaria duas fontes pro mesmo seletor — a família de defeito que este app
 *  persegue desde a rodada do carimbo.
 *
 *  Os comentários do CSS saem antes de qualquer conta. Este arquivo CONTA
 *  ocorrências (`--barra-h`, a fórmula da goteira) pra provar "num lugar só",
 *  e comentário que fala SOBRE a constante é a coisa mais natural do mundo de
 *  se escrever — um `--barra-h: 64px` citado dentro de um comentário viraria
 *  uma segunda "declaração" e deixaria a suíte vermelha com uma mensagem que
 *  não descreve nada. Some o benefício de tabela: sem comentário, o `[^}]*` do
 *  `regraDe` não pode ser interrompido por uma chave escrita em prosa.
 *
 *  🔴 Este helper fica ANTES do primeiro `describe` de propósito: TODO leitor
 *  de CSS deste arquivo passa por ele. Um `readFileSync` cru convivendo com o
 *  helper deixa metade do arquivo sem a limpeza — e aí um `.barra { … }`
 *  escrito em PROSA num comentário do `home.css` casa antes da regra de
 *  verdade e a suíte fica vermelha com uma mensagem que não descreve defeito
 *  nenhum. Alarme falso, não passe falso — mas é exatamente o que o parágrafo
 *  acima diz estar resolvido. */
const css = (arq: string) =>
  readFileSync(path.join(process.cwd(), "src", "app", arq), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const home = () => css("home.css");
const ficha = () => css("ficha.css");

/** `match` sem /g devolve a PRIMEIRA ocorrência. Os nulos viram asserção
 *  (`not.toBeNull()`) antes de qualquer `!` que INDEXE (`regra![0]`,
 *  `largura![1]`): o `!` some no runtime, então `expect(null)` ainda cai como
 *  asserção, mas `null[0]` estoura TypeError e deixa a suíte vermelha sem
 *  nenhuma asserção cair — que não é prova de nada. */
const regraDe = (fonte: string, seletor: string) => {
  const re = new RegExp(`${seletor.replace(/[.\-]/g, "\\$&")}\\s*\\{[^}]*\\}`, "s");
  return fonte.match(re);
};

describe("BarraNavegacao", () => {
  it("leva pra home e pro acervo, com âncora pura", () => {
    const { container } = render(<BarraNavegacao aqui="hoje" />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/", "/trilhas"]);
  });

  it("marca onde você está, e só pra quem lê a tela também", () => {
    const { container } = render(<BarraNavegacao aqui="trilhas" />);
    const atual = container.querySelector('[aria-current="page"]');
    expect(atual?.getAttribute("href")).toBe("/trilhas");
  });

  it("não tem aba morta: só Hoje e Trilhas até a memória existir", () => {
    const { container } = render(<BarraNavegacao aqui="hoje" />);
    expect(container.querySelectorAll("a")).toHaveLength(2);
    expect(container.textContent).not.toContain("Minhas");
  });

  it("respeita a área segura do iPhone — sem isso a barra some atrás do gesto", () => {
    const regra = regraDe(home(), ".barra");
    expect(regra, "faltou a regra .barra").not.toBeNull();
    expect(regra![0]).toContain("env(safe-area-inset-bottom)");
  });
});

describe("a barra fica presa no rodapé", () => {
  it("é fixa, não rola junto com a lista", () => {
    const regra = regraDe(home(), ".bp .barra");
    expect(regra, "faltou a regra .bp .barra").not.toBeNull();
    expect(regra![0]).toMatch(/position:\s*fixed/);
    expect(regra![0]).toMatch(/bottom:\s*0/);
  });

  // ——— elemento fixo se posiciona pela JANELA, não pela moldura. O app inteiro
  // vive dentro de `.bp .screen` (max-width 25.5rem, borda arredondada); sem
  // prender a barra no MESMO max-width, ela atravessa um monitor inteiro por
  // fora da moldura. E os dois números têm que ser o MESMO número: duas
  // larguras soltas discordam no dia em que uma mudar.
  it("a barra tem a largura da moldura, não a da janela", () => {
    const barra = regraDe(home(), ".bp .barra");
    expect(barra, "faltou a regra .bp .barra").not.toBeNull();
    const screen = regraDe(ficha(), ".bp .screen");
    expect(screen, "faltou a regra .bp .screen").not.toBeNull();
    const largura = screen![0].match(/max-width:\s*([^;]+);/);
    expect(largura, "o .screen perdeu o max-width").not.toBeNull();
    expect(barra![0]).toContain(`max-width: ${largura![1].trim()}`);
    // O max-width sozinho não centra nada: com ele e sem isto, a barra encosta
    // na esquerda da caixa em vez de acompanhar o `.screen`.
    expect(barra![0]).toMatch(/margin:\s*0 auto/);
  });

  // 🔴 O max-width acima trava o NÚMERO e não prova ALINHAMENTO — foi por essa
  // fresta que o defeito passou. O `.bp` tem goteira lateral, e a barra é
  // `fixed`: o `width: 100%` dela resolvia contra a JANELA, que não tem
  // goteira, então em 375 ela nascia 22,5px mais larga que a moldura e cobria
  // os cantos arredondados de baixo. Acima de ~440px o max-width morde nos
  // dois e o defeito SOME — o monitor mostrava certo, o celular mostrava
  // errado, com o mesmo CSS. A prova de que não volta é as duas caixas lerem
  // a MESMA fonte de goteira, e essa fonte existir uma vez só.
  it("a barra e a moldura se prendem na MESMA goteira", () => {
    const bp = regraDe(ficha(), ".bp");
    expect(bp, "faltou a regra .bp no ficha.css").not.toBeNull();
    expect(bp![0], "a goteira esquerda deixou de ser variável").toMatch(/--goteira-esq:\s*calc\(/);
    expect(bp![0], "a goteira direita deixou de ser variável").toMatch(/--goteira-dir:\s*calc\(/);
    // Esquerda e direita separadas: em landscape com notch os dois insets
    // diferem, e uma variável só centraria errado justamente ali.
    expect(bp![0]).toContain("env(safe-area-inset-left)");
    expect(bp![0]).toContain("env(safe-area-inset-right)");
    // O padding do `.bp` LÊ as variáveis em vez de repetir a fórmula: é ele
    // que define onde a moldura começa e termina.
    expect(bp![0], "o padding do .bp voltou a escrever a fórmula à mão")
      .toMatch(/padding:[^;]*var\(--goteira-dir\)[^;]*var\(--goteira-esq\)/s);

    const barra = regraDe(home(), ".bp .barra");
    expect(barra, "faltou a regra .bp .barra").not.toBeNull();
    expect(barra![0], "a barra não se prende na goteira esquerda").toMatch(/left:\s*var\(--goteira-esq\)/);
    expect(barra![0], "a barra não se prende na goteira direita").toMatch(/right:\s*var\(--goteira-dir\)/);

    // Uma fórmula só no app: as duas declarações do `.bp` e mais nenhuma.
    // Copiada pra dentro da barra, ela concordaria hoje e discordaria no dia
    // em que uma das duas mudasse — que é o defeito que esta task existe pra
    // matar, com outra roupa.
    const goteira = /clamp\(0px,\s*3vw,\s*1rem\)/g;
    expect(ficha().match(goteira) ?? [], "a fórmula da goteira se multiplicou no ficha.css")
      .toHaveLength(2);
    expect(home().match(goteira) ?? [], "a fórmula da goteira foi copiada pro home.css")
      .toHaveLength(0);
  });

  // Barra fixa flutua sobre o conteúdo: sem respiro, o último cartão nasce
  // atrás dela e a pessoa nunca vê a última trilha da lista.
  //
  // `match` sem /g devolve a PRIMEIRA ocorrência — de propósito. Acrescentar
  // uma segunda regra `.bp .folha` mais abaixo no arquivo funcionaria pela
  // cascata e deixaria este teste vermelho, o que é o certo: a medida tem que
  // entrar na regra que já existe. **Não "conserte" a regex.**
  it("a folha reserva o espaço da barra embaixo", () => {
    const regra = regraDe(home(), ".bp .folha");
    expect(regra, "faltou a regra .bp .folha").not.toBeNull();
    expect(regra![0]).toMatch(/padding-bottom:[^;]*var\(--barra-h\)|padding:[^;]*var\(--barra-h\)/);
  });

  // O acervo tem a MESMA barra por cima, e a regra dele mora no ficha.css —
  // é o jeito mais fácil de o respiro entrar só na home e o último item do
  // acervo continuar escondido.
  it("a lista do acervo reserva o mesmo espaço", () => {
    const regra = regraDe(ficha(), ".bp .lista");
    expect(regra, "faltou a regra .bp .lista").not.toBeNull();
    expect(regra![0]).toMatch(/padding-bottom:[^;]*var\(--barra-h\)|padding:[^;]*var\(--barra-h\)/);
  });

  // A altura reservada não pode ser MENOR que a barra, senão o último cartão
  // fica atrás dela — o defeito que esta task existe pra tirar. O número vem
  // MEDIDO no navegador, não do desejo (mesmo padrão do home-layout.ts).
  it("--barra-h é declarado num lugar só, e é o .bp que o declara", () => {
    expect(home().match(/--barra-h:/g) ?? [], "--barra-h tem que estar em UM lugar só no home.css")
      .toHaveLength(1);
    // Uma segunda declaração no ficha.css venceria ou perderia por ordem de
    // import, e ninguém saberia qual das duas está valendo.
    expect(ficha().match(/--barra-h:/g) ?? [], "--barra-h duplicado no ficha.css").toHaveLength(0);
    const bp = regraDe(home(), ".bp");
    expect(bp, "faltou a regra .bp no home.css").not.toBeNull();
    expect(bp![0]).toMatch(/--barra-h:\s*\d+px/);
  });
});
