import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import Quebrou from "@/app/error";

afterEach(() => { cleanup(); });

/** 🔴 O BECO QUE ESTE ARQUIVO FECHA (2026-09-11). É o irmão do `not-found`, e
 *  fecha o mesmo beco por outra causa: sem `error.tsx`, um erro de render caía
 *  na tela de erro padrão do Next — fora da moldura do app, sem porta de volta.
 *  Em standalone não há barra de URL, e a pessoa fica presa **exatamente no
 *  momento em que o app já falhou uma vez**. */
describe("quando alguma coisa quebra", () => {
  const erro = () => Object.assign(new Error("TypeError: cannot read x of undefined"), {
    digest: "abc123",
  });

  it("responde dentro da moldura do app, e não na tela crua do Next", () => {
    const { container } = render(<Quebrou error={erro()} reset={() => {}} />);
    expect(container.querySelector("main.bp"), "a tela saiu da moldura do app").not.toBeNull();
    expect(container.querySelector(".appbar"), "sumiu a marca do topo").not.toBeNull();
  });

  // 🔴 A PORTA DE SAÍDA É O PONTO INTEIRO DA TELA, e aqui mais que no 404:
  // quem chegou aqui já viu o app falhar. Sem a barra, em standalone, fica
  // preso na tela de erro.
  it("sempre tem porta de saída — as duas seções do app", () => {
    const { container } = render(<Quebrou error={erro()} reset={() => {}} />);
    const destinos = Array.from(container.querySelectorAll(".barra a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(destinos).toContain("/");
    expect(destinos).toContain("/trilhas");
  });

  // O `reset` é o que o Next dá pra tentar renderizar de novo. Um erro
  // passageiro some no toque, sem recarregar a página inteira.
  it("o toque em tentar de novo chama o reset do Next", () => {
    const reset = vi.fn();
    const { container } = render(<Quebrou error={erro()} reset={reset} />);
    const botao = container.querySelector("button.btn");
    expect(botao, "sumiu o botão de tentar de novo").not.toBeNull();
    fireEvent.click(botao!);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  // 🔴 A MENSAGEM DO ERRO NÃO VAI À TELA, e não é estética: ela é escrita pra
  // quem programa, em inglês, e quase sempre não diz nada a quem está no portão
  // decidindo se sobe. O app já tem uma regra pra isso — quando não pode
  // afirmar, para de afirmar — e mostrar `TypeError: undefined` seria afirmar
  // uma precisão que não existe. O `digest` é pior ainda: é um hash.
  it("não despeja a mensagem do erro nem o digest na cara de quem lê", () => {
    const e = erro();
    const { container } = render(<Quebrou error={e} reset={() => {}} />);
    const texto = container.textContent ?? "";
    expect(texto, "a mensagem do erro vazou pra tela").not.toContain("TypeError");
    expect(texto, "o digest do erro vazou pra tela").not.toContain("abc123");
    expect(texto, "sobrou inglês de runtime na tela").not.toMatch(/undefined|Error:/);
  });

  // Nada de veredito nesta tela: ela não sabe nada sobre chuva nem sobre lugar
  // nenhum, e fingir que sabe é o defeito que o app inteiro evita.
  it("não diz uma palavra sobre chuva nem sobre trilha nenhuma", () => {
    const { container } = render(<Quebrou error={erro()} reset={() => {}} />);
    for (const p of ["Pode ir", "Não vá", "Fechado agora", "SEM INFORMAÇÕES", "chuva"]) {
      expect(container.textContent?.includes(p), `a tela de erro passou a dizer "${p}"`).toBe(false);
    }
  });
});
