import { describe, expect, it } from "vitest";
import { chuvaNoPiso, PISOS, rotuloPiso } from "@/lib/piso";

describe("PISOS: o vocabulário do piso", () => {
  // 🔴 A CONTRAÇÃO DE 2026-08-27. Este describe tinha mais três testes, e os
  // três morreram junto com o que provavam: `ordemPiso` ("a ordem vai do pior
  // pro melhor") e `PISOS_FILTRAVEIS` (o conteúdo, e a prova de FONTE de que
  // era derivado). Os dois símbolos existiam pro filtro "piso, no mínimo", que
  // saiu da tela — o piso parou de ser comparado com piso.
  //
  // Não foram "movidos" nem "adaptados": provavam uma ESCALA que o app não tem
  // mais. Mantê-los seria travar código morto, que é o teste que passa verde
  // sem proteger nada. A ordem do array segue documentada em `piso.ts` pra
  // quando voltar a importar.
  it("rotuloPiso troca o hífen por espaço: asfalto-esburacado → 'asfalto esburacado'", () => {
    expect(rotuloPiso("asfalto-esburacado")).toBe("asfalto esburacado");
    expect(rotuloPiso("barro")).toBe("barro");
  });

  // O vocabulário em si continua sendo contrato: é ele que o `z.enum` aceita e
  // o questionário oferece. Quatro palavras, nesta ordem.
  it("as quatro palavras, na ordem em que o questionário as oferece", () => {
    expect([...PISOS]).toEqual(["barro", "paralelepipedo", "asfalto-esburacado", "asfalto-tapete"]);
  });
});

describe("chuvaNoPiso: o que a chuva faz com o chão é do MATERIAL, não do app", () => {
  it("barro tem a frase do dono do app — 'segura água', a palavra dele", () => {
    expect(chuvaNoPiso("barro")).toBe("O barro segura água — risco de atolar.");
  });

  // 🔴 Varrido a partir de `PISOS`, nunca de uma lista escrita aqui: no dia em
  // que um 5º piso entrar na escala, este teste já cobra a decisão em vez de
  // deixá-lo passar mudo por esquecimento.
  //
  // O que ele morde: alguém acrescentar `paralelepipedo: "pedra molhada
  // escorrega"` à tabela — copy que ninguém disse, a geografia inventada
  // vestida de física. Só ele cai; os de cima e os de baixo ficam verdes.
  it.each(PISOS.filter((p) => p !== "barro"))(
    "%s CALA — ninguém escreveu a frase dele ainda, e inventá-la é o defeito",
    (p) => {
      expect(chuvaNoPiso(p)).toBeUndefined();
    },
  );

  // A régua do `secaRapido`, aplicada ao piso: sem o dado, silêncio. Frase
  // genérica de reserva seria o defeito de volta com outra roupa.
  //
  // ⚠️ Este caso NÃO separa o `piso ?` da fonte: indexar a tabela com
  // `undefined` devolve `undefined` do mesmo jeito, e a guarda é do verificador
  // de tipos. Ele tranca o CONTRATO — quem chamar sem piso recebe silêncio —,
  // não a linha. Dizer o contrário seria a prova oca da Task 4 de volta.
  it("ficha sem piso não recebe frase nenhuma", () => {
    expect(chuvaNoPiso(undefined)).toBeUndefined();
    expect(chuvaNoPiso()).toBeUndefined();
  });
});
