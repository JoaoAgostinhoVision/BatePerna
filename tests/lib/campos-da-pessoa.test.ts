import { describe, expect, it } from "vitest";
import {
  CAMPOS_DA_PESSOA, OPCIONAIS_DA_PESSOA, PONTO, chavesForaDaPessoa, ehCampoDaPessoa, obrigatoriosDaPessoaFaltando,
  pontoNoRascunhoDaPessoa, tirarDoRascunhoDaPessoa,
} from "@/lib/campos-da-pessoa";
import { campoPorCaminho } from "@/lib/campos-da-ficha";

const NOVO = JSON.stringify({ slug: "pedra-cidade", modos: [], cidade: "Cidade", trajeto: { waypoints: [{ nome: "Pedra" }] } });
const COMPLETO = {
  slug: "pedra-cidade", modos: [], cidade: "Cidade", promessa: "p", acesso: "a",
  trajeto: { waypoints: [{ nome: "Pedra", lat: -8.3, lng: -35.9 }] }, condicao: { coords: { lat: -8.3, lng: -35.9 } },
  custo: { tag: "gratis" },
};

describe("a lista dela", () => {
  it("são exatamente os campos das oito perguntas da spec (o ponto mora à parte)", () => {
    expect([...CAMPOS_DA_PESSOA].sort()).toEqual(
      ["acesso", "avisos", "cidade", "custo.tag", "custo.valor", "dias", "horario", "promessa", "trajeto.waypoints.0.nome"],
    );
  });

  it("todo campo dela existe no registro (o mesmo instrumento do painel)", () => {
    for (const c of CAMPOS_DA_PESSOA) expect(campoPorCaminho(c), c).toBeDefined();
  });

  it("os opcionais dela são subconjunto da lista", () => {
    for (const c of OPCIONAIS_DA_PESSOA) expect(CAMPOS_DA_PESSOA).toContain(c);
  });

  it.each(["voz", "premio", "rotulo_escaneio", "condicao.regra.limiar_mm", "condicao.severidade", "condicao.coords",
    "discriminador.como_ler", "custo.curto", "piso", "secaRapido", "carroComum", "trajeto.waypoints.1.nome", "slug", 42])(
    "`%s` não é campo dela",
    (c) => expect(ehCampoDaPessoa(c)).toBe(false),
  );
});

describe("o ponto é um só", () => {
  it("grava o ponto 0 E a coordenada da chuva, iguais", () => {
    const d = JSON.parse(pontoNoRascunhoDaPessoa(NOVO, -8.31, -35.97));
    expect(d.trajeto.waypoints[0]).toEqual({ nome: "Pedra", lat: -8.31, lng: -35.97 });
    expect(d.condicao.coords).toEqual({ lat: -8.31, lng: -35.97 });
  });

  it("coordenada fora do planeta é recusada", () => {
    expect(() => pontoNoRascunhoDaPessoa(NOVO, 200, 0)).toThrow();
  });
});

describe("o 'não sei' dela", () => {
  it("tira `avisos` (opcional PRA ELA, ainda que obrigatório no registro do João)", () => {
    const d = JSON.parse(tirarDoRascunhoDaPessoa(JSON.stringify({ ...COMPLETO, avisos: "x" }), "avisos"));
    expect("avisos" in d).toBe(false);
  });

  it("recusa obrigatório dela, e campo fora da lista", () => {
    expect(() => tirarDoRascunhoDaPessoa(JSON.stringify(COMPLETO), "promessa")).toThrow();
    expect(() => tirarDoRascunhoDaPessoa(JSON.stringify(COMPLETO), "voz")).toThrow();
  });
});

describe("o que falta, e o que sobra", () => {
  it("o documento completo dela não falta nada", () => {
    expect(obrigatoriosDaPessoaFaltando(COMPLETO)).toEqual([]);
  });

  it("falta cada obrigatório, e o ponto conta como um", () => {
    expect(obrigatoriosDaPessoaFaltando(JSON.parse(NOVO)).sort()).toEqual(["acesso", "custo.tag", PONTO, "promessa"].sort());
  });

  it("ponto sem a coordenada da chuva (ou vice-versa) ainda falta", () => {
    expect(obrigatoriosDaPessoaFaltando({ ...COMPLETO, condicao: {} })).toContain(PONTO);
  });

  it("documento só com o que é dela: nada sobra", () => {
    expect(chavesForaDaPessoa({ ...COMPLETO, avisos: "a", custo: { tag: "pago", valor: "R$ 5" }, horario: [], dias: ["sab"] })).toEqual([]);
  });

  it.each([
    ["voz", { voz: "x" }],
    ["condicao.regra", { condicao: { coords: COMPLETO.condicao.coords, regra: {} } }],
    ["discriminador", { discriminador: {} }],
    ["custo.curto", { custo: { tag: "pago", curto: "R$ 5" } }],
    ["trajeto.waypoints.1", { trajeto: { waypoints: [...COMPLETO.trajeto.waypoints, { nome: "etapa", lat: 0, lng: 0 }] } }],
    ["trajeto.waypoints.0.nota", { trajeto: { waypoints: [{ ...COMPLETO.trajeto.waypoints[0], nota: "n" }] } }],
  ])("`%s` sobra", (caminho, mais) => {
    expect(chavesForaDaPessoa({ ...COMPLETO, ...mais })).toContain(caminho);
  });
});
