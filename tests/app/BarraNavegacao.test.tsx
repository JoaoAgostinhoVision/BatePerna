import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import BarraNavegacao from "@/app/BarraNavegacao";
import { paddingLado, regraDe, semComentarios, valorDe } from "../css";

afterEach(() => { cleanup(); });

/** Cada regra é lida NO ARQUIVO ONDE ELA VIVE: `.bp .barra` e `.bp .folha` no
 *  `home.css`, `.bp .screen` e `.bp .lista` no `ficha.css`. As duas telas
 *  importam os dois arquivos. Duplicar uma regra pro teste ficar mais curto
 *  criaria duas fontes pro mesmo seletor — a família de defeito que este app
 *  persegue desde a rodada do carimbo.
 *
 *  🔴 A leitura passa TODA pelo `semComentarios` de tests/css.ts, e por isso
 *  não sobrou nenhum `readFileSync` cru neste arquivo. Este arquivo CONTA
 *  ocorrências (`--barra-h`, a fórmula da goteira) pra provar "num lugar só",
 *  e comentário que fala SOBRE a constante é a coisa mais natural do mundo de
 *  se escrever — um `--barra-h: 64px` citado dentro de um comentário viraria
 *  uma segunda "declaração" e deixaria a suíte vermelha com uma mensagem que
 *  não descreve nada. Some o benefício de tabela: sem comentário, o `[^}]*` do
 *  `regraDe` não pode ser interrompido por uma chave escrita em prosa.
 *
 *  E os nulos viram asserção (`not.toBeNull()`) antes de qualquer `!` que
 *  INDEXE (`regra![0]`, `largura![1]`): o `!` some no runtime, então
 *  `expect(null)` ainda cai como asserção, mas `null[0]` estoura TypeError e
 *  deixa a suíte vermelha sem nenhuma asserção cair — que não é prova de
 *  nada. */
const home = () => semComentarios("home.css");
const ficha = () => semComentarios("ficha.css");


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

  // 🔴 Isto NÃO é asserção de cor nem de enfeite: é layout de iPhone disfarçado
  // de valor, e é a única coisa entre a barra e a faixa do gesto num aparelho
  // em tela cheia — o ambiente que nenhuma verificação daqui alcança.
  // `toContain("env(safe-area-inset-bottom)")` sobre o bloco só dizia "esse
  // texto existe em algum lugar da regra": MEDIDO, `--safe:
  // env(safe-area-inset-bottom); padding-bottom: 0` deixava 523/523 VERDE com
  // os rótulos intocáveis debaixo da faixa. A pergunta certa é qual LADO
  // reserva o inset.
  it("respeita a área segura do iPhone — sem isso a barra some atrás do gesto", () => {
    const regra = regraDe(home(), ".barra");
    expect(regra, "faltou a regra .barra").not.toBeNull();
    expect(
      paddingLado(regra![0], "bottom"),
      "a barra parou de somar a área segura embaixo — no iPhone em tela cheia ela nasce debaixo da faixa do gesto",
    ).toContain("env(safe-area-inset-bottom)");
  });
});

describe("a barra fica presa no rodapé", () => {
  // 🔴 Tudo aqui passa pelo `valorDe`, nunca por `toMatch` sobre o bloco. As
  // duas frestas desta regra foram MEDIDAS (suíte 521/521 verde com os decoys):
  //   • `/position:\s*fixed/` casa dentro de `--position: fixed`, e aí a barra
  //     podia virar `static` e voltar a descer junto com a lista — o defeito
  //     que o João viu e apontou;
  //   • `/bottom:\s*0/` casa dentro de `--bottom: 0` (e de `margin-bottom: 0`,
  //     e de `padding-bottom: 0`), e sem `bottom` um elemento `fixed` fica onde
  //     a posição estática o deixar.
  it("é fixa, não rola junto com a lista", () => {
    const regra = regraDe(home(), ".bp .barra");
    expect(regra, "faltou a regra .bp .barra").not.toBeNull();
    expect(valorDe(regra![0], "position"), "a barra deixou de ser fixed").toBe("fixed");
    expect(valorDe(regra![0], "bottom"), "a barra deixou de se prender no rodapé").toBe("0");
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
    // As DUAS pontas ancoradas: um `--max-width` no `.screen` faria a régua
    // medir a coisa errada, e um `--max-width` na barra faria a asserção passar
    // com a barra atravessando o monitor inteiro. Medido: verde nos dois casos.
    const largura = valorDe(screen![0], "max-width");
    expect(largura, "o .screen perdeu o max-width").not.toBeNull();
    expect(valorDe(barra![0], "max-width"), "a barra perdeu a largura da moldura")
      .toBe(largura);
    // O max-width sozinho não centra nada: com ele e sem isto, a barra encosta
    // na esquerda da caixa em vez de acompanhar o `.screen`.
    expect(valorDe(barra![0], "margin"), "a barra parou de se centrar na moldura")
      .toBe("0 auto");
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
    // Lidas como VALOR das duas variáveis, não como texto solto no bloco: um
    // `--eco: env(safe-area-inset-left)` qualquer satisfazia o `toContain`
    // antigo enquanto a goteira somava `0px` — MEDIDO, 523/523 verde, e o notch
    // em landscape volta a cortar a moldura. Foi a goteira lateral que produziu
    // o Important da Task 12.
    const esq = valorDe(bp![0], "--goteira-esq");
    const dir = valorDe(bp![0], "--goteira-dir");
    expect(esq, "a goteira esquerda deixou de ser variável").toMatch(/^calc\(/);
    expect(dir, "a goteira direita deixou de ser variável").toMatch(/^calc\(/);
    // Esquerda e direita separadas: em landscape com notch os dois insets
    // diferem, e uma variável só centraria errado justamente ali.
    expect(esq, "a goteira esquerda parou de somar o inset do notch")
      .toContain("env(safe-area-inset-left)");
    expect(dir, "a goteira direita parou de somar o inset do notch")
      .toContain("env(safe-area-inset-right)");
    // O padding do `.bp` LÊ as variáveis em vez de repetir a fórmula: é ele
    // que define onde a moldura começa e termina.
    //
    // 🔴 Pelo LADO, e não por `/padding:[^;]*var\(--goteira-…\)/` sobre o
    // bloco: aquele regex casava dentro de `--padding:`, e MEDIDO ele deixava
    // passar `--padding: <a fórmula toda>; padding: 0` — a moldura ia de borda
    // a borda com a suíte 521/521 verde. E era a mesma fresta nos dois
    // arquivos: o guarda do `.bp` do home.css não pega isto, porque aqui a
    // anulação acontece dentro do PRÓPRIO ficha.css.
    expect(paddingLado(bp![0], "right"), "o padding direito do .bp parou de sair da goteira")
      .toBe("var(--goteira-dir)");
    expect(paddingLado(bp![0], "left"), "o padding esquerdo do .bp parou de sair da goteira")
      .toBe("var(--goteira-esq)");

    const barra = regraDe(home(), ".bp .barra");
    expect(barra, "faltou a regra .bp .barra").not.toBeNull();
    // MEDIDO vivo: `/left:\s*var\(--goteira-esq\)/` casa dentro de
    // `margin-left`, e com `margin: 0 auto` na linha seguinte os margins ainda
    // são sobrescritos — a barra perde a amarração inteira e volta a resolver
    // contra a JANELA. É o defeito "celular errado, monitor certo" de novo, com
    // a suíte verde: foi assim que ele passou da primeira vez.
    expect(valorDe(barra![0], "left"), "a barra não se prende na goteira esquerda")
      .toBe("var(--goteira-esq)");
    expect(valorDe(barra![0], "right"), "a barra não se prende na goteira direita")
      .toBe("var(--goteira-dir)");

    // Uma fórmula só no app: as duas declarações do `.bp` e mais nenhuma.
    // Copiada pra dentro da barra, ela concordaria hoje e discordaria no dia
    // em que uma das duas mudasse — que é o defeito que esta task existe pra
    // matar, com outra roupa.
    const goteira = /clamp\(0px,\s*3vw,\s*1rem\)/g;
    expect(ficha().match(goteira) ?? [], "a fórmula da goteira se multiplicou no ficha.css")
      .toHaveLength(2);
    expect(home().match(goteira) ?? [], "a fórmula da goteira foi copiada pro home.css")
      .toHaveLength(0);

    // 🔴 O contador acima procura uma CÓPIA da fórmula. Ele é cego pra uma
    // ANULAÇÃO — e existe uma porta aberta pra ela: o home.css ganhou um `.bp`
    // próprio (o `--barra-h`), e ele vem DEPOIS do ficha.css no import de toda
    // página. Medido: um `padding-left: 0; padding-right: 0` nesse `.bp` leva a
    // moldura de borda a borda e a barra volta a desalinhar — com a suíte
    // inteira verde, porque tudo o que este teste lia morava no OUTRO arquivo.
    const bpHome = regraDe(home(), ".bp");
    expect(bpHome, "faltou a regra .bp no home.css").not.toBeNull();
    expect(bpHome![0], "o .bp do home.css mexeu no padding e anulou a goteira do ficha.css")
      .not.toMatch(/(?:^|[{;])\s*padding(-[a-z]+)?\s*:/s);
    expect(bpHome![0], "o .bp do home.css redeclarou a goteira — duas fontes pra mesma medida")
      .not.toMatch(/--goteira-/);
  });

  // Barra fixa flutua sobre o conteúdo: sem respiro, o último cartão nasce
  // atrás dela e a pessoa nunca vê a última trilha da lista.
  //
  // ⚠️ ESTE COMENTÁRIO ESTAVA ERRADO, e o conserto dele é registro, não teste.
  // Ele afirmava que acrescentar uma segunda regra `.bp .folha` mais abaixo no
  // arquivo "deixaria este teste vermelho, o que é o certo". NÃO deixa: MEDIDO
  // em 2026-08-16, `.bp .folha { padding: 0 }` no fim do home.css fecha a suíte
  // em 523/523 VERDE, porque o `regraDe` usa `match` sem /g e devolve a
  // PRIMEIRA regra enquanto o navegador usa a ÚLTIMA. É a terceira família da
  // asserção frouxa — "duplicata por cascata" —, está registrada como deferido
  // vivo no docs/RESUME.md com o exemplo medido e o custo, e a rodada foi
  // mergeada sabendo dela. Quem for fechá-la mexe no `regraDe` e re-roda as
  // provas de mutação que ele carrega (lição 20).
  it("a folha reserva o espaço da barra embaixo", () => {
    const regra = regraDe(home(), ".bp .folha");
    expect(regra, "faltou a regra .bp .folha").not.toBeNull();
    expect(paddingLado(regra![0], "bottom"), "o lado de BAIXO da folha parou de reservar a barra")
      .toContain("var(--barra-h)");
  });

  // O acervo tem a MESMA barra por cima, e a regra dele mora no ficha.css —
  // é o jeito mais fácil de o respiro entrar só na home e o último item do
  // acervo continuar escondido.
  it("a lista do acervo reserva o mesmo espaço", () => {
    const regra = regraDe(ficha(), ".bp .lista");
    expect(regra, "faltou a regra .bp .lista").not.toBeNull();
    expect(paddingLado(regra![0], "bottom"), "o lado de BAIXO da lista parou de reservar a barra")
      .toContain("var(--barra-h)");
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
