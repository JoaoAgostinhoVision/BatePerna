import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import BarraNavegacao from "@/app/BarraNavegacao";

afterEach(() => { cleanup(); });

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
    const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
    const regra = css.match(/\.barra\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .barra").not.toBeNull();
    expect(regra![0]).toContain("env(safe-area-inset-bottom)");
  });
});
