import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Appbar from "@/app/Appbar";

afterEach(() => { cleanup(); });

describe("Appbar", () => {
  it("a marca é a saída: leva pra lista de trilhas", () => {
    const { container } = render(<Appbar />);
    const marca = container.querySelector(".brand");
    expect(marca?.tagName).toBe("A");
    expect(marca?.getAttribute("href")).toBe("/trilhas");
  });

  it("na própria lista a marca não leva a lugar nenhum", () => {
    const { container } = render(<Appbar comSaida={false} />);
    expect(container.querySelector(".brand")?.tagName).toBe("DIV");
  });

  it("mostra a pílula de custo quando recebe uma", () => {
    const { container } = render(<Appbar chip="R$ 5 · portão" />);
    expect(container.querySelector(".cost-chip")?.textContent).toBe("R$ 5 · portão");
  });

  it("sem custo, não inventa pílula", () => {
    const { container } = render(<Appbar />);
    expect(container.querySelector(".cost-chip")).toBeNull();
  });
});
