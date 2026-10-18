import { describe, expect, it } from "vitest";
import {
  CAMPOS_DA_PESSOA, OPCIONAIS_DA_PESSOA, PONTO, SEM_NAO_SEI, campoDelaAcimaDoTeto, chavesForaDaPessoa, ehCampoDaPessoa,
  obrigatoriosDaPessoaFaltando,
  TETO_DO_TEXTO, TEXTO_LONGO_DEMAIS, TEXTO_LONGO_DEMAIS_NO_PUBLICAR, pontoDaPessoa, pontoNoRascunhoDaPessoa,
  textoAcimaDoTeto, tirarCampoDaPessoa, tirarDoRascunhoDaPessoa,
} from "@/lib/campos-da-pessoa";
import { campoPorCaminho } from "@/lib/campos-da-ficha";

const NOVO = JSON.stringify({ slug: "pedra-cidade", modos: [], cidade: "Cidade", trajeto: { waypoints: [{ nome: "Pedra" }] } });
const COMPLETO = {
  slug: "pedra-cidade", modos: [], cidade: "Cidade", promessa: "p", acesso: "a",
  trajeto: { waypoints: [{ nome: "Pedra", lat: -8.3, lng: -35.9 }] }, condicao: { coords: { lat: -8.3, lng: -35.9 } },
  custo: { tag: "gratis" },
};

// 🔴 M6 DA REVISÃO FINAL: um teto por campo que ela escreve. Sem ele, uma
// pessoa logada punha ~4 MB numa promessa, e a home e /trilhas renderizam
// todos os lugares pra todo visitante, até o João bloquear.
describe("o teto do texto dela", () => {
  it("é 2000, e as duas frases dizem o número que a porta usa", () => {
    expect(TETO_DO_TEXTO).toBe(2000);
    for (const f of [TEXTO_LONGO_DEMAIS, TEXTO_LONGO_DEMAIS_NO_PUBLICAR]) expect(f).toContain(TETO_DO_TEXTO.toLocaleString("pt-BR"));
  });

  it("2000 passa, 2001 não — e conta CARACTERE, não unidade de UTF-16", () => {
    expect(textoAcimaDoTeto("a".repeat(2000))).toBe(false);
    expect(textoAcimaDoTeto("a".repeat(2001))).toBe(true);
    expect(textoAcimaDoTeto("😀".repeat(2000)), "2000 emojis são 2000 caracteres").toBe(false);
    expect(textoAcimaDoTeto("😀".repeat(2001))).toBe(true);
  });

  it("acha o texto longo DENTRO de lista e objeto; número e booleano não contam", () => {
    expect(textoAcimaDoTeto(["x", "a".repeat(2001)])).toBe(true);
    expect(textoAcimaDoTeto({ abre: "a".repeat(2001) })).toBe(true);
    expect(textoAcimaDoTeto([{ abre: "06:00", fecha: "18:00" }])).toBe(false);
    expect(textoAcimaDoTeto(42)).toBe(false);
    expect(textoAcimaDoTeto(null)).toBe(false);
  });
});

describe("a lista dela", () => {
  // 🔴 17/10: a `cidade` saiu da lista — ela não a escreve, nem no lugar novo
  // nem no lugar no ar; a cidade sai do ponto que ela marca.
  it("são exatamente os campos das perguntas da spec (o ponto mora à parte, e a cidade sai dele)", () => {
    expect([...CAMPOS_DA_PESSOA].sort()).toEqual(
      ["acesso", "avisos", "custo.tag", "custo.valor", "dias", "horario", "promessa", "trajeto.waypoints.0.nome"],
    );
  });

  it("todo campo dela existe no registro (o mesmo instrumento do painel)", () => {
    for (const c of CAMPOS_DA_PESSOA) expect(campoPorCaminho(c), c).toBeDefined();
  });

  it("os opcionais dela são subconjunto da lista", () => {
    for (const c of OPCIONAIS_DA_PESSOA) expect(CAMPOS_DA_PESSOA).toContain(c);
  });

  it.each(["voz", "premio", "rotulo_escaneio", "condicao.regra.limiar_mm", "condicao.severidade", "condicao.coords",
    "discriminador.como_ler", "custo.curto", "piso", "secaRapido", "carroComum", "trajeto.waypoints.1.nome", "slug", "cidade", 42])(
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
    // O TEXTO, e não só o estouro: ele chega a ela no corpo do 400.
    expect(() => tirarDoRascunhoDaPessoa(JSON.stringify(COMPLETO), "promessa")).toThrow(new Error(SEM_NAO_SEI));
    expect(() => tirarDoRascunhoDaPessoa(JSON.stringify(COMPLETO), "voz")).toThrow(new Error(SEM_NAO_SEI));
  });

  it("a frase do 'não sei' recusado não fala caminho interno", () => {
    expect(SEM_NAO_SEI).not.toMatch(/`|promessa|custo|trajeto|waypoints/);
  });
});

describe("o que falta, e o que sobra", () => {
  it("o documento completo dela não falta nada", () => {
    expect(obrigatoriosDaPessoaFaltando(COMPLETO)).toEqual([]);
  });

  it("falta cada obrigatório, e o ponto conta como um", () => {
    expect(obrigatoriosDaPessoaFaltando(JSON.parse(NOVO)).sort()).toEqual(["acesso", "custo.tag", PONTO, "promessa"].sort());
  });

  // 🔴 17/10: a cidade não é campo que ela escreve, mas sem ela não há
  // endereço — ela falta pra publicar mesmo fora da lista (a tela leva à
  // pergunta do ponto, de onde ela sai).
  it("a cidade falta pra publicar mesmo fora da lista que ela escreve", () => {
    const { cidade: _cidade, ...semCidade } = COMPLETO;
    expect(obrigatoriosDaPessoaFaltando(semCidade)).toContain("cidade");
    expect(obrigatoriosDaPessoaFaltando(semCidade)).toEqual(["cidade"]);
  });

  // E continua sendo dela no documento: a porta de publicar não a acusa de
  // sobra, e o teto a confere (um rascunho de antes de 17/10 a tem digitada).
  it("a cidade não sobra, e o teto a confere", () => {
    expect(chavesForaDaPessoa(COMPLETO)).toEqual([]);
    expect(campoDelaAcimaDoTeto({ ...COMPLETO, cidade: "a".repeat(2001) })).toBe(true);
    expect(campoDelaAcimaDoTeto(COMPLETO)).toBe(false);
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

const NO_AR = JSON.stringify({ ...COMPLETO, avisos: "Leve água." });

describe("no lugar NO AR (passa pelo schema)", () => {
  it("pontoDaPessoa troca o ponto 0 E a coordenada da chuva", () => {
    const d = JSON.parse(pontoDaPessoa(NO_AR, -8.4, -36.0));
    expect(d.trajeto.waypoints[0]).toMatchObject({ lat: -8.4, lng: -36.0 });
    expect(d.condicao.coords).toEqual({ lat: -8.4, lng: -36.0 });
  });

  it("tirarCampoDaPessoa tira `avisos`, e recusa obrigatório dela", () => {
    expect("avisos" in JSON.parse(tirarCampoDaPessoa(NO_AR, "avisos"))).toBe(false);
    expect(() => tirarCampoDaPessoa(NO_AR, "acesso")).toThrow(SEM_NAO_SEI);
  });
});
