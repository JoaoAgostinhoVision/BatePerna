import { describe, expect, it } from "vitest";
import { regraDe, semComentarios } from "../css";

/** ALVOS DE DEDO (25/10, consertos de confiança do estudo "uso e dinheiro").
 *  Medido no ar a 375 px: "escolher onde estou" (o caminho de quem não liga o
 *  GPS, que é o do João) e "Filtrar" com 32 px de altura, os chips com 36, o
 *  "Abrir no mapa" com 36, o "✓ Fui" com 42 e a distância com ~18. O mínimo
 *  confortável é 44 px. Cada regra tem de declarar `min-height: 44px`. */
const ALVOS = [
  ["home.css", ".bp .mapa-pilula"],
  ["home.css", ".bp .chip"],
  ["ficha.css", ".bp .maplink"],
  ["ficha.css", ".bp .confirmar .btn"],
  ["ficha.css", ".bp .confirmar .opt"],
  ["ficha.css", ".bp .dist-btn"],
] as const;

describe("todo botão do caminho de quem usa tem 44 px de altura no mínimo", () => {
  // O "Filtrar" é a exceção medida: a altura da linha dele entra na conta da
  // dobra da home (tests/lib/home-layout), então o desenho fica em 32px e a
  // ÁREA DE TOQUE cresce 6px pra cima e pra baixo por um `::after` invisível.
  it("home.css .bp .filtro-abrir: 32px de desenho + 2×6px de área = 44px", () => {
    const css = semComentarios("home.css");
    const botao = regraDe(css, ".bp .filtro-abrir")!.join(";");
    expect([...botao.matchAll(/min-height:\s*([^;]+)/g)].map((m) => m[1].trim()).at(-1)).toBe("32px");
    expect(botao).toMatch(/position:\s*relative/);
    const area = regraDe(css, ".bp .filtro-abrir::after");
    expect(area, "a área de toque invisível existe").not.toBeNull();
    expect(area!.join(";")).toMatch(/inset:\s*-6px 0/);
  });

  it.each(ALVOS)("%s %s", (arq, seletor) => {
    const regras = regraDe(semComentarios(arq), seletor);
    expect(regras, "a regra existe").not.toBeNull();
    // A ÚLTIMA altura mínima declarada é a que o navegador usa.
    const alturas = [...regras!.join(";").matchAll(/min-height:\s*([^;]+)/g)].map((m) => m[1].trim());
    expect(alturas.at(-1)).toBe("44px");
  });
});
