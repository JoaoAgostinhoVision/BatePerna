import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { chuvaNoPiso, ordemPiso, PISOS, PISOS_FILTRAVEIS, rotuloPiso } from "@/lib/piso";

describe("PISOS: a ordem é a escala", () => {
  // A escala existe pra ser comparada; sem isto, ordemPiso é decoração.
  it("a ordem vai do pior pro melhor: barro < paralelepipedo < esburacado < tapete", () => {
    expect(ordemPiso("barro")).toBeLessThan(ordemPiso("paralelepipedo"));
    expect(ordemPiso("paralelepipedo")).toBeLessThan(ordemPiso("asfalto-esburacado"));
    expect(ordemPiso("asfalto-esburacado")).toBeLessThan(ordemPiso("asfalto-tapete"));
  });

  // Este é o CINTO, e ele cobre uma coisa diferente do teste de fonte abaixo:
  // ele morde quando `PISOS_FILTRAVEIS` DIVERGE de `PISOS` — por exemplo,
  // quando alguém acrescenta um quinto piso a `PISOS` e a lista de baixo não
  // acompanha. Medido: com um 5º piso em `PISOS` e `PISOS_FILTRAVEIS` copiado
  // à mão com 3 nomes, é este teste que cai.
  //
  // O que ele NÃO pega, também medido: `PISOS_FILTRAVEIS` virando uma lista
  // literal com exatamente os mesmos 3 nomes — a suíte fecha verde. Por isso
  // existe o teste de fonte logo abaixo; um não substitui o outro.
  it("PISOS_FILTRAVEIS tem o mesmo conteúdo de PISOS sem o primeiro", () => {
    expect(PISOS_FILTRAVEIS).toEqual(PISOS.slice(1));
    expect(PISOS_FILTRAVEIS.length).toBe(PISOS.length - 1);
    expect(PISOS_FILTRAVEIS).not.toContain(PISOS[0]);
  });

  // 🔴 A prova de que é DERIVADO só existe na FONTE. Em runtime, uma lista
  // derivada e uma lista copiada à mão com o mesmo conteúdo são o MESMO VALOR:
  // nenhuma asserção sobre o valor distingue as duas, e foi medido — trocando
  // `PISOS.slice(1)` por `["paralelepipedo", "asfalto-esburacado",
  // "asfalto-tapete"] as const`, tests/lib/piso.test.ts fechava verde.
  //
  // Mesma família dos testes de `"use client"` (tests/app/MapaHome.test.tsx) e
  // do "a ficha não tem GPS próprio" (tests/app/DistanciaDaqui.test.tsx): o
  // que precisa morrer é uma FORMA de escrever, e forma só se vê lendo o
  // arquivo.
  it("PISOS_FILTRAVEIS é derivado de PISOS na fonte, não uma segunda lista", () => {
    const fonte = readFileSync(path.join(process.cwd(), "src", "lib", "piso.ts"), "utf8");
    expect(fonte).toMatch(/PISOS_FILTRAVEIS\s*=\s*PISOS\.slice\(/);
  });

  it("rotuloPiso troca o hífen por espaço: asfalto-esburacado → 'asfalto esburacado'", () => {
    expect(rotuloPiso("asfalto-esburacado")).toBe("asfalto esburacado");
    expect(rotuloPiso("barro")).toBe("barro");
  });
});

// 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-08-27). "O barro segura água —
// risco de atolar" vivia FIXA no `Carimbo.tsx`, e o carimbo serve o acervo
// inteiro: bastava entrar uma ficha de asfalto pra o app afirmar barro onde não
// há. É a mentira agendada do `secaRapido` (2026-08-26) na outra ponta da
// mesma frase — aquela no ramo seco, esta no molhado.
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
