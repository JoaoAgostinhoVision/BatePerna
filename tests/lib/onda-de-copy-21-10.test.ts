import { describe, expect, it } from "vitest";
import { NOME_JA_EM_USO_NO_AR, PONTO_CAI_EM_NOME_EM_USO } from "@/lib/porta-da-pessoa";

/** A ONDA DE COPY DE 21/10 (pacote pequeno "o 409 do ponto"): as duas frases
 *  que o João escolheu no chat, lendo-as por extenso, AO PÉ DA LETRA. Os testes
 *  da rota comparam a resposta com a constante (verde com qualquer texto); é
 *  aqui que o texto escolhido fica travado. */
describe("as frases que o João escolheu em 21/10, ao pé da letra", () => {
  it("PONTO_CAI_EM_NOME_EM_USO", () => {
    expect(PONTO_CAI_EM_NOME_EM_USO).toBe(
      "Nada foi gravado: o ponto cai numa cidade onde esse nome já existe. Mexa o ponto ou use um nome que diferencie, como fazem por lá.",
    );
  });

  it("NOME_JA_EM_USO_NO_AR", () => {
    expect(NOME_JA_EM_USO_NO_AR).toBe(
      "Nada foi gravado: este nome já é de outro lugar no BatePerna. Use um nome que diferencie, como fazem por lá.",
    );
  });

  // O lugar no ar não muda de endereço: nenhuma das duas pode mandar pensar nele.
  it("nenhuma das duas fala de endereço", () => {
    expect(PONTO_CAI_EM_NOME_EM_USO).not.toMatch(/endereço/);
    expect(NOME_JA_EM_USO_NO_AR).not.toMatch(/endereço/);
  });
});
