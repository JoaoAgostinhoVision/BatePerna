import { describe, expect, it } from "vitest";
import { TEXTO_GUARDADO } from "@/app/admin/campos/palavras";

/** A ONDA DE COPY DE 25/10 (rodada `d-401`): a frase do aviso que o João
 *  escolheu no chat, lendo-a por extenso, AO PÉ DA LETRA. Os testes da tela
 *  procuram a constante (verde com qualquer texto); é aqui que o texto
 *  escolhido fica travado. */
describe("a frase que o João escolheu em 25/10, ao pé da letra", () => {
  it("TEXTO_GUARDADO", () => {
    expect(TEXTO_GUARDADO).toBe("Nada foi gravado ainda: o que você escreveu aqui entra quando você salvar.");
  });
});

describe("as palavras do perfil que o João leu em 25/10, ao pé da letra", () => {
  it.each([
    ["TITULO_VOCE", "Você"],
    ["TITULO_FUI", "Onde você já foi"],
    ["FUI_VAZIO", "Quando você tocar “✓ Fui” na ficha de um lugar, ele aparece aqui."],
    ["FOI_EM", "foi em"],
  ] as const)("%s", async (nome, texto) => {
    const palavras = (await import("@/app/contribuir/palavras")) as Record<string, string>;
    expect(palavras[nome]).toBe(texto);
  });
  it("ITEM_VOCE", async () => {
    expect((await import("@/app/BarraNavegacao")).ITEM_VOCE).toBe("Você");
  });
});
