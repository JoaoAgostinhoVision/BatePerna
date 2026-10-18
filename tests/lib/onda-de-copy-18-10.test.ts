import { describe, expect, it } from "vitest";
import { ENDERECO_AINDA_NAO_SAIU } from "@/lib/porta-de-publicar";

/** A ONDA DE COPY DE 18/10 (rodada "cidade do ponto"): a frase cujo texto o
 *  João TROCOU no pacote "Frases da cidade do ponto" — ele escolheu a proposta
 *  da faixa amarela —, AO PÉ DA LETRA. Os testes da rota comparam a resposta com
 *  a constante (constante contra constante, verde com qualquer texto); é aqui
 *  que o texto aprovado fica travado: reescrevê-la sem ele ler deixa este
 *  arquivo vermelho. As outras 17 ele marcou "Serve" com o texto que já tinham. */
describe("a frase que o João trocou em 18/10, ao pé da letra", () => {
  it("ENDERECO_AINDA_NAO_SAIU", () => {
    expect(ENDERECO_AINDA_NAO_SAIU).toBe(
      "Nada foi publicado: este lugar ainda não ganhou o endereço dele. Abra a pergunta do nome e salve de novo, mesmo sem mudar nada.",
    );
  });
});
