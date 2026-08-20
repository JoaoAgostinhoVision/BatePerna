import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ordemPiso, PISOS, PISOS_FILTRAVEIS, rotuloPiso } from "@/lib/piso";

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
