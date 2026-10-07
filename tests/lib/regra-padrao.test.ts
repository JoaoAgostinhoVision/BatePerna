import { describe, expect, it } from "vitest";
import { noAr, REGRA_PADRAO_INICIAL, type RegraPadrao } from "@/lib/regra-padrao";
import { loadAll } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";

const RAMPA = loadAll().find((f) => f.slug === "rampa-do-pepe")!;
const OUTRA: RegraPadrao = { janela_previsao_horas: 2, janela_passado_horas: 11, limiar_mm: 0.7, severidade: "espera" };

function semRegra(f: Ficha): Ficha {
  const copia = structuredClone(f);
  delete copia.condicao.regra;
  delete copia.condicao.severidade;
  return copia;
}

describe("noAr — a regra efetiva, montada num lugar só", () => {
  it("lugar com regra própria fica com a dele, e a padrão não encosta", () => {
    const f = noAr(RAMPA, { conferido: true }, OUTRA);
    expect(f.condicao.regra).toEqual(RAMPA.condicao.regra);
    expect(f.condicao.severidade).toBe(RAMPA.condicao.severidade);
    expect(f.origem).toEqual({ conferido: true, regraPropria: true });
  });

  it("lugar SEM regra própria usa a padrão RECEBIDA — os quatro números, nenhum fixo", () => {
    const f = noAr(semRegra(RAMPA), { conferido: false }, OUTRA);
    expect(f.condicao.regra).toEqual({ tipo: "chuva_binaria", janela_previsao_horas: 2, janela_passado_horas: 11, limiar_mm: 0.7 });
    expect(f.condicao.severidade).toBe("espera");
    expect(f.origem).toEqual({ conferido: false, regraPropria: false });
  });

  it("a origem vem de quem chama, e não do documento", () => {
    expect(noAr(RAMPA, { conferido: false }, REGRA_PADRAO_INICIAL).origem.conferido).toBe(false);
  });

  it("noAr não muda o documento recebido", () => {
    const doc = semRegra(RAMPA);
    const antes = structuredClone(doc);
    noAr(doc, { conferido: false }, OUTRA);
    expect(doc).toEqual(antes);
  });
});
