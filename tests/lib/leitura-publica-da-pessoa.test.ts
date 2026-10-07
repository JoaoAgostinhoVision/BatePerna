import { beforeEach, describe, expect, it } from "vitest";
import { getAcervoDoDono, getAllFichas, getFicha, getFichaDoDono } from "@/lib/ficha";
import { gravarRegraPadrao } from "@/lib/db";
import { REGRA_PADRAO_INICIAL } from "@/lib/regra-padrao";
import { bancoDeProducao, semearAcervo, semearLugarDaPessoa } from "../banco";

const banco = await bancoDeProducao();
let SLUG: string;
beforeEach(async () => {
  await semearAcervo(banco);
  SLUG = await semearLugarDaPessoa(banco, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
});

describe("a leitura do público", () => {
  it("o lugar da pessoa chega NÃO conferido e com a regra padrão do banco", async () => {
    const f = (await getFicha(SLUG))!;
    expect(f.origem).toEqual({ conferido: false, regraPropria: false });
    expect(f.condicao.regra).toEqual({ tipo: "chuva_binaria", janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 0.2 });
    expect(f.condicao.severidade).toBe(REGRA_PADRAO_INICIAL.severidade);
  });

  it("mudar a regra padrão no banco muda a dele, e não a dos lugares do João", async () => {
    const rampaAntes = (await getFicha("rampa-do-pepe"))!.condicao;
    await gravarRegraPadrao(banco, { janela_previsao_horas: 1, janela_passado_horas: 12, limiar_mm: 2, severidade: "nao-va" }, 1);
    const f = (await getFicha(SLUG))!;
    expect(f.condicao.regra.janela_passado_horas).toBe(12);
    expect(f.condicao.severidade).toBe("nao-va");
    expect((await getFicha("rampa-do-pepe"))!.condicao).toEqual(rampaAntes);
  });

  it("todo lugar do João chega conferido e com regra própria", async () => {
    const doJoao = (await getAllFichas()).filter((f) => f.slug !== SLUG);
    expect(doJoao.length).toBeGreaterThan(2);
    for (const f of doJoao) expect([f.slug, f.origem]).toEqual([f.slug, { conferido: true, regraPropria: true }]);
  });
});

describe("a leitura do dono", () => {
  it("getAcervoDoDono traz o lugar da pessoa com a origem", async () => {
    const { fichas } = await getAcervoDoDono();
    expect(fichas.find((f) => f.slug === SLUG)?.origem.conferido).toBe(false);
  });

  it("getFichaDoDono devolve o documento CRU (sem regra) e o noAr (com a padrão)", async () => {
    const d = (await getFichaDoDono(SLUG))!;
    expect(d.ficha.condicao.regra).toBeUndefined();
    expect(d.noAr.condicao.regra.limiar_mm).toBe(0.2);
    expect(d.origem).toEqual({ contribuidor: expect.any(String), conferido: false });
  });
});
