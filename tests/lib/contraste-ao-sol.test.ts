import { describe, expect, it } from "vitest";
import { semComentarios } from "../css";

/** LETRA QUE SE LÊ AO SOL (25/10, consertos de confiança do estudo "uso e
 *  dinheiro"). O `--ink-faint` pinta os rótulos de seção, o placar e o próprio
 *  botão "✓ Fui", e estava em 2,91:1 sobre a tela no tema claro — abaixo dos
 *  4,5:1 do WCAG AA. Na trilha, ao sol, sumia. Prova aritmética, nos dois
 *  temas, contra os dois fundos onde a letra mora (a tela e o cartão). */
const tokens = (metade: string): Record<string, string> =>
  Object.fromEntries([...metade.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const luz = (h: string) => {
  const [r, g, b] = rgb(h).map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [luz(a), luz(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const metades = () => {
  const ficha = semComentarios("ficha.css");
  const corte = ficha.indexOf("prefers-color-scheme");
  return [["claro", tokens(ficha.slice(0, corte))], ["escuro", tokens(ficha.slice(corte))]] as const;
};

describe("a letra clara passa de 4,5:1 nos dois temas", () => {
  for (const fundo of ["--screen", "--surface-2"] as const) {
    it(`--ink-faint sobre ${fundo}`, () => {
      for (const [tema, t] of metades()) {
        const c = contraste(t["--ink-faint"], t[fundo]);
        expect(c, `tema ${tema}: ${c.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
