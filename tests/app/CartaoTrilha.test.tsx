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

  it("ficha gratuita não ganha linha de custo", () => {
    const gratis = { ...ficha, custo: { tag: "gratis" as const } };
    const { container } = render(<CartaoTrilha ficha={gratis} inicial={leitura} />);
    expect(container.querySelector(".cartao-meta")?.textContent ?? "").not.toContain("R$");
  });

  // O PAYLOAD da Task 8 chega aqui. Sem este teste, os dois campos que ela
  // acrescentou ao schema podiam nunca aparecer na tela e nada acusaria —
  // todos os outros testes desta lista só provam AUSÊNCIA.
  it("com esforço e duração, os dois aparecem na linha", () => {
    const cheia = { ...ficha, esforco: "puxada" as const, duracao: 90 };
    const { container } = render(<CartaoTrilha ficha={cheia} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toContain("puxada");
    expect(meta).toContain("~1h30");
  });

  // Não inventar: ficha sem esforço não ganha traço nem "—" no lugar.
  it("ficha sem esforço/duração não mostra campo vazio", () => {
    const semCampos = { ...ficha, esforco: undefined, duracao: undefined };
    const { container } = render(<CartaoTrilha ficha={semCampos} inicial={leitura} />);
    expect(container.textContent).not.toContain("undefined");
    expect(container.querySelector(".cartao-meta")?.textContent ?? "").not.toContain("·  ·");
  });
});
