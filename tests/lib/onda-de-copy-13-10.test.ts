import { describe, expect, it } from "vitest";
import { CONFERI_MESMO } from "@/app/admin/CaixaDaOrigem";
import { NAO_CONFERIU } from "@/app/admin/campos/palavras";
import * as origem from "@/lib/origem";
import {
  CLERK_FORA, CLERK_FORA_AO_ABRIR, JA_CONFERIDO, JA_CONFERIDO_AO_ABRIR, NOME_JA_EM_USO, RASCUNHO_DELA_SUMIU,
} from "@/lib/porta-da-pessoa";
import { LIMIAR_SEM_CHUVA } from "@/lib/porta-da-regra-padrao";

/** A ONDA DE COPY DE 13/10 (Task 18): as frases que o João MUDOU no pacote
 *  "Frases de quem manda", AO PÉ DA LETRA. Os outros testes comparam a rota
 *  com a constante — constante contra constante, verde com qualquer texto. É
 *  aqui que o texto aprovado por ele fica travado: reescrever uma destas sem
 *  ele ler deixa este arquivo vermelho. */
describe("as frases que o João mudou em 13/10, ao pé da letra", () => {
  it.each([
    ["CONFERI_MESMO", CONFERI_MESMO, "Conferi mesmo? A etiqueta e a faixa saem do ar, e quem mandou não edita mais."],
    [
      "NAO_CONFERIU", NAO_CONFERIU,
      "Nada mudou: este lugar já foi conferido, não foi mandado por quem usa o app, ou mudou desde que você abriu esta página. Recarregue a página e leia de novo antes de conferir.",
    ],
    [
      "LIMIAR_SEM_CHUVA", LIMIAR_SEM_CHUVA,
      "Nada foi gravado: o limite de chuva tem de ser maior que 0 mm. Com 0, qualquer orvalho faria o carimbo dizer que choveu em todo lugar sem regra própria.",
    ],
    [
      "RASCUNHO_DELA_SUMIU", RASCUNHO_DELA_SUMIU,
      "Nada foi gravado: este rascunho não existe mais. Ele foi publicado ou apagado: volte pela sua lista de lugares.",
    ],
    [
      "NOME_JA_EM_USO", NOME_JA_EM_USO,
      "Nada foi gravado: este nome, ou o endereço que sairia dele, já é de outro lugar no BatePerna. Use um nome que diferencie, como fazem por lá.",
    ],
    ["CLERK_FORA_AO_ABRIR", CLERK_FORA_AO_ABRIR, "Não deu pra conferir quem você é agora: tente de novo daqui a pouco."],
    ["JA_CONFERIDO_AO_ABRIR", JA_CONFERIDO_AO_ABRIR, "O BatePerna já conferiu este lugar, e agora só ele muda o que o app diz daqui."],
  ] as const)("%s", (_, atual, aprovada) => {
    expect(atual).toBe(aprovada);
  });

  // As de GRAVAR ficam como estavam: a irmã nova é só pra quando a tela é
  // apenas aberta.
  it("as irmãs de gravar não mudaram", () => {
    expect(CLERK_FORA).toBe("Não deu pra conferir quem você é agora. Nada foi gravado: tente de novo daqui a pouco.");
    expect(JA_CONFERIDO).toBe("Nada foi gravado: o BatePerna já conferiu este lugar, e agora só ele muda o que o app diz daqui.");
  });

  // A frase que SAIU: o João mandou tirar a meia-linha da regra padrão.
  it("a meia-linha da regra padrão não existe mais em origem.ts", () => {
    expect(Object.keys(origem)).not.toContain("MEIA_LINHA_REGRA_PADRAO");
    expect(Object.values(origem).join(" ")).not.toMatch(/calibrou/);
  });
});
