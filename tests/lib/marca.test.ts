import { describe, expect, it } from "vitest";
import { TAMANHOS, geometria } from "@/lib/marca";

// Pega justamente o bug que passou pela review visual: uma janela deslocada
// por -margem deixava o desenho encostado no canto inferior-direito em vez de
// sobrar respiro igual nos 4 lados. Aritmética pura — sem decodificar PNG.
describe("geometria do ícone", () => {
  it.each(Object.entries(TAMANHOS))("%s: respiro igual nos quatro lados", (_nome, { margem }) => {
    const { janela, desenho } = geometria(margem);
    const respiroAntes = desenho.inicio - janela.min;
    const respiroDepois = janela.min + janela.tamanho - desenho.fim;

    expect(respiroDepois).toBe(respiroAntes);
    expect(respiroAntes).toBe(margem);
  });
});
