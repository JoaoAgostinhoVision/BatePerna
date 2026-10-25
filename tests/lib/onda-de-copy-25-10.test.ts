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
