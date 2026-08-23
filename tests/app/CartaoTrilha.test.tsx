import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import CartaoTrilha from "@/app/CartaoTrilha";
import LocalVivo from "@/app/local";
import { CHAVE_LOCAL } from "@/lib/local";
import { getFichasComCondicao } from "@/lib/ficha";

afterEach(() => { cleanup(); localStorage.clear(); });

const ficha = getFichasComCondicao()[0];
const leitura = { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 };

describe("a linha de metadados do cartão", () => {
  it("sem localização, não inventa km", () => {
    const { container } = render(<CartaoTrilha ficha={ficha} inicial={leitura} />);
    expect(container.textContent).not.toContain("linha reta");
  });

  it("com localização, mostra o km em linha reta", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    render(<LocalVivo><CartaoTrilha ficha={ficha} inicial={leitura} /></LocalVivo>);
    expect(await screen.findByText(/km em linha reta/)).toBeTruthy();
  });

  // ANTES este teste era `if (ficha.custo.tag === "pago") expect(...)` — um `if`
  // sem `else`, que **não assere nada** se a ficha for gratuita. Teste que pode
  // silenciosamente não testar é a família que esta rodada já pagou sete vezes.
  // A Rampa é `pago` hoje (conferido no JSON), mas amarrar o teste a isso o
  // deixa refém do conteúdo: ficha sintética resolve os dois problemas.
  it("mostra o custo quando a ficha cobra, e só a parte curta dele", () => {
    const paga = {
      ...ficha,
      custo: { tag: "pago" as const, valor: "R$ 5 por pessoa — cobrado no portão da entrada" },
    };
    const { container } = render(<CartaoTrilha ficha={paga} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toContain("R$ 5 por pessoa");
    // O cartão é uma linha de relance: a logística do portão fica pra ficha.
    expect(meta).not.toContain("cobrado no portão");
  });

  // Este é o teste que teria pego o defeito real: o de cima usa ficha
  // SINTÉTICA com "—" (suposição errada de um brief antigo); o JSON de
  // verdade da Rampa usa "·". Ficha sintética só prova a função; só a ficha
  // real prova que ela funciona com o conteúdo que existe. `ficha` aqui é
  // getFichasComCondicao()[0] sem override nenhum — é a Rampa de verdade.
  // Se a Rampa um dia mudar de custo, este teste QUEBRA — é esperado: o
  // conteúdo mudou, alguém tem que olhar a tela de novo, não é bug.
  it("com a ficha real da Rampa, mostra só a parte curta do custo (separador '·')", () => {
    expect(ficha.custo.tag).toBe("pago");
    expect(ficha.custo.valor).toContain(" · ");
    const { container } = render(<CartaoTrilha ficha={ficha} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toContain("R$ 5 por pessoa");
    expect(meta).not.toContain("cobrado no portão");
  });

  // custo.valor é texto livre; nada no schema garante separador nenhum. Um
  // custo curto sem "—" nem "·" tem que continuar aparecendo inteiro, não
  // sumir nem virar string vazia.
  it("custo sem separador continua aparecendo inteiro", () => {
    const semSeparador = { ...ficha, custo: { tag: "pago" as const, valor: "R$ 10" } };
    const { container } = render(<CartaoTrilha ficha={semSeparador} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toContain("R$ 10");
  });

  // O piso está aqui de propósito, e é o conserto de uma asserção que
  // MASCARAVA um sumiço: antes este teste era só `?.textContent ?? ""` +
  // `not.toContain("R$")` numa ficha gratuita SEM mais nada — e nessa ficha a
  // linha inteira não existe, então a asserção passava com o elemento AUSENTE.
  // É a mesma família do `aria-label` que escondeu a `<legend>` na Task 4.
  // Com a linha sustentada por outra parte, "não tem custo" volta a significar
  // "a linha existe e o custo não está nela".
  // (Era `extensaoKm` quem sustentava a linha antes da Task 6; a extensão
  // saiu da tela, então quem sustenta agora é o piso.)
  //
  // O `valor` numa ficha `gratis` não é descuido, é o que faz o teste provar o
  // que o nome promete. O schema PERMITE `{ tag: "gratis", valor: … }`, e uma
  // ficha que virou gratuita com o texto de custo herdado de uma edição
  // anterior é o caso real: sem esta string aqui, o cartão podia ler `valor`
  // sem olhar a `tag` e mostrar "R$ 5" num cartão marcado como grátis, com a
  // suíte inteira verde (medido: apagar `custo.tag === "pago" &&` sobrevivia).
  // As duas versões só se separam quando existe um `valor` pra ser mostrado
  // por engano.
  it("ficha gratuita não ganha linha de custo", () => {
    const gratis = {
      ...ficha,
      custo: { tag: "gratis" as const, valor: "R$ 5 por pessoa" },
      piso: "asfalto-esburacado" as const,
    };
    const { container } = render(<CartaoTrilha ficha={gratis} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta");
    expect(meta).not.toBeNull();
    expect(meta?.textContent).toBe("asfalto esburacado");
  });

  // O PAYLOAD desta rodada chega aqui. Herdeiro direto do teste que antes
  // guardava `esforco`/`duracao`: sem ele, o campo que o schema ganhou
  // (`piso`) podia nunca chegar à tela e nada acusaria — todos os outros
  // testes desta lista só provam AUSÊNCIA.
  //
  // Duas escolhas de exemplo são load-bearing, e nenhuma é decorativa:
  //
  // - `piso: "asfalto-esburacado"`, não "barro". `rotuloPiso("barro")` devolve
  //   "barro": com barro, chamar a função e mostrar o enum cru dão a MESMA
  //   string e nenhuma asserção separa as duas versões. Com o hífen, separa.
  // - a asserção é da LINHA INTEIRA (`toBe`), não `toContain`. É a única coisa
  //   aqui que prova a ORDEM — distância · piso · custo.
  it("com piso, ele aparece na linha, já formatado", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    const cheia = { ...ficha, piso: "asfalto-esburacado" as const };
    const { container } = render(
      <LocalVivo><CartaoTrilha ficha={cheia} inicial={leitura} /></LocalVivo>,
    );
    await screen.findByText(/km em linha reta/);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    // O "~60 km" é de Gravatá até o waypoint da Rampa, com o conteúdo real: se
    // a ficha mudar de coordenada este número muda e o teste quebra, que é o
    // comportamento certo — alguém tem que olhar a tela de novo.
    expect(meta).toBe("~60 km em linha reta · asfalto esburacado · R$ 5 por pessoa");
  });

  // Ausência de TEXTO mascara o sumiço do elemento: `?.textContent ?? ""`
  // devolve a mesma string vazia com o span presente-e-vazio e com ele
  // ausente. Aqui o que se prova é que o número da trilha não está mais na
  // linha, com o elemento PRESENTE — por isso o `toBe` da linha inteira, e não
  // um `not.toContain`.
  // 🔴 A ficha do teste TRAZ `extensaoKm` de propósito: nesta task o campo
  // ainda existe no schema (ele só morre na Task 7), então este é o caso que
  // SEPARA "a tela parou de mostrar" de "o dado sumiu". Com um fixture sem o
  // campo, a asserção passaria com a linha do cartão de volta no lugar.
  //
  // E `piso: "asfalto-esburacado"`, nunca `barro`: `rotuloPiso("barro")`
  // devolve `"barro"`, então com esse exemplo chamar a função ou usar o campo
  // cru dá a MESMA string e a prova fica oca (lição da Task 6 da rodada
  // passada).
  it("o cartão não mostra mais km de trilha, mesmo com o campo na ficha", async () => {
    const semExtensaoNaTela = {
      ...ficha,
      custo: { tag: "gratis" as const },
      extensaoKm: 4.2,
      piso: "asfalto-esburacado" as const,
    };
    const { container } = render(
      <LocalVivo><CartaoTrilha ficha={semExtensaoNaTela} inicial={leitura} /></LocalVivo>,
    );
    // Sem localização e ficha gratuita, o piso é a única parte que sobra — e o
    // `toBe` da linha INTEIRA é o que prova a ausência, porque um
    // `not.toContain("km de trilha")` passaria também com o elemento sumido.
    expect(container.querySelector(".cartao-meta")!.textContent)
      .toBe("asfalto esburacado");
  });

  // Herdeiro do antigo "ficha sem esforço/duração não mostra campo vazio",
  // apontado pro campo novo: sem piso, nem traço nem "undefined" no lugar.
  // 🔴 `extensaoKm: 4.25` fica no fixture de propósito: mesmo com o campo
  // presente e sem piso, a linha não pode inventar "km de trilha" — a
  // extensão não é mais lida por esta tela, e é isso que este teste prova.
  it("sem piso, a linha não inventa e não deixa separador solto", () => {
    const semPiso = { ...ficha, piso: undefined, extensaoKm: 4.25 };
    const { container } = render(<CartaoTrilha ficha={semPiso} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toBe("R$ 5 por pessoa");
    expect(container.textContent).not.toContain("undefined");
  });

  // O teste que fala de PRODUÇÃO. `ficha` é getFichasComCondicao()[0] sem
  // override nenhum — o JSON de verdade da Rampa, que não traz `piso` nem
  // `extensaoKm` (nem trazia `esforco`/`duracao`). Consequência, e não é
  // defeito: com uma ficha só, o cartão no celular do João não muda uma
  // vírgula nesta rodada. Fixture sintética não provaria isso.
  it("a Rampa REAL (sem piso, sem extensão) mostra só distância e custo", async () => {
    expect(ficha.piso).toBeUndefined();
    expect(ficha.extensaoKm).toBeUndefined();
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    const { container } = render(
      <LocalVivo><CartaoTrilha ficha={ficha} inicial={leitura} /></LocalVivo>,
    );
    await screen.findByText(/km em linha reta/);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toBe("~60 km em linha reta · R$ 5 por pessoa");
  });

  // Ausência de ELEMENTO, não de texto — e é a diferença que importa. Nenhuma
  // asserção sobre `textContent` pega isto: `?.textContent ?? ""` dá a mesma
  // string vazia com o `<span>` presente e vazio ou com ele ausente, e o
  // `partes.length > 0 &&` podia cair sem nada acusar (medido: caía, e a suíte
  // ficava toda verde). Não é cosmético: `.bp .cartao` é flex com `gap: .2rem`
  // e `.cartao-meta` tem `margin-top: .35rem`, então um span vazio ainda é
  // item de flex e deixa ~0,55rem de folga — um cartão mais alto que os
  // vizinhos, com nada dentro. Ficha gratuita, sem localização, sem piso e sem
  // extensão é o caso real que chega lá.
  it("sem nada pra mostrar, a linha de metadados não existe", () => {
    const nua = {
      ...ficha,
      custo: { tag: "gratis" as const },
      piso: undefined,
      extensaoKm: undefined,
    };
    const { container } = render(<CartaoTrilha ficha={nua} inicial={leitura} />);
    expect(container.querySelector(".cartao-meta")).toBeNull();
  });
});
