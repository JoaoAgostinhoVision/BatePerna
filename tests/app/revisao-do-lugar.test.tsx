import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RevisaoDoLugar, { CORRIGIR, TITULO_REVISAO } from "@/app/admin/RevisaoDoLugar";
import { NAO, PULADA, SEM_RESPOSTA, SIM } from "@/app/admin/campos/palavras";
import type { PerguntaNaTela } from "@/app/admin/campos/tipos";
import { rotuloDe } from "@/app/admin/FichaInteira";
import { ORDEM, montarPerguntas } from "@/app/admin/novo/perguntas";
import { montarRevisao, respostaNaTela, type LinhaDaRevisao } from "@/app/admin/novo/revisao";
import { rascunhoCompleto } from "../rascunho-completo";

/** A REVISÃO ANTES DE PUBLICAR (17/10, Task 8) — o dado (`montarRevisao`) e o
 *  componente (`RevisaoDoLugar`), sem banco. As páginas que as montam têm os
 *  casos delas em `admin-tela-de-publicar` e `contribuir-telas`.
 *
 *  Nenhum lugar real: nomes e cidades são marcadores. */

afterEach(() => cleanup());

const DOC = rascunhoCompleto("lugar-marcador-revisao-cidade-marcador-revisao", "Lugar Marcador Revisao", "Cidade Marcador Revisao");
const O = { corrigir: (n: number) => `/c/${n}`, aviso: null as string | null };
const linhasDe = (doc: unknown = DOC, o = O): LinhaDaRevisao[] => montarRevisao(montarPerguntas(doc), doc, o);
const sem = (...chaves: string[]): Record<string, unknown> => {
  const c = structuredClone(DOC);
  for (const k of chaves) delete c[k];
  return c;
};

function desenhar(linhas: readonly LinhaDaRevisao[]) {
  const { container } = render(<RevisaoDoLugar linhas={linhas} />);
  const linha = (caminho: string): HTMLElement => {
    const el = container.querySelector<HTMLElement>(`[data-caminho="${caminho}"]`);
    expect(el, `a linha ${caminho} está na revisão`).not.toBeNull();
    return el!;
  };
  return { container, linha };
}

describe("montarRevisao — o dado", () => {
  it("toda pergunta da tela vira uma linha, na ordem, e a cidade logo depois do ponto", () => {
    const l = linhasDe();
    expect(l.map((x) => x.caminho)).toEqual([ORDEM[0], ORDEM[1], "cidade", ...ORDEM.slice(2)]);
    expect(ORDEM[1], "a premissa: o ponto é a 2ª pergunta").toBe("trajeto.waypoints.0.lat");
    // O "Corrigir" da cidade é o do ponto (posição 2), nunca o da linha seguinte.
    expect(l[1].corrigir).toBe("/c/2");
    expect(l[2].corrigir).toBe(l[1].corrigir);
    expect(l[3].corrigir, "a pergunta seguinte ao ponto é a 3ª").toBe("/c/3");
    expect(l[2].pergunta).toBe(rotuloDe("cidade"));
    expect(l[2].resposta).toBe("Cidade Marcador Revisao");
  });

  it("a cidade ausente é falta, com o destino do ponto (rascunho com ponto e sem cidade)", () => {
    const l = linhasDe(sem("cidade")).find((x) => x.caminho === "cidade")!;
    expect(l.estado).toBe("falta");
    expect(l.resposta).toBeNull();
    expect(l.corrigir).toBe("/c/2");
    expect(linhasDe(sem("cidade")).find((x) => x.caminho === "trajeto.waypoints.0.lat")!.estado).toBe("respondida");
  });

  it("o nome tem Corrigir pra pergunta 1", () => {
    expect(linhasDe()[0].corrigir).toBe("/c/1");
    const { linha } = desenhar(linhasDe());
    expect(within(linha("trajeto.waypoints.0.nome")).getByRole("link", { name: CORRIGIR }).getAttribute("href")).toBe("/c/1");
  });

  it("com a trava, o aviso vai na linha do nome — e só nela", () => {
    const l = linhasDe(DOC, { ...O, aviso: "Frase marcadora do aviso." });
    expect(l.filter((x) => x.aviso !== null).map((x) => x.caminho)).toEqual(["trajeto.waypoints.0.nome"]);
    const { linha } = desenhar(l);
    expect(within(linha("trajeto.waypoints.0.nome")).getByRole("status").textContent).toBe("Frase marcadora do aviso.");
    expect(linhasDe().every((x) => x.aviso === null)).toBe(true);
  });

  it("lista sem a pergunta do ponto estoura (a cidade ficaria sem linha)", () => {
    const sem2 = montarPerguntas(DOC).filter((p) => p.campo.caminho !== "trajeto.waypoints.0.lat");
    expect(() => montarRevisao(sem2, DOC, O)).toThrow(/a linha da cidade/);
  });
});

describe("respostaNaTela — a resposta como se lê", () => {
  const achar = (doc: unknown, caminho: string): PerguntaNaTela =>
    montarPerguntas(doc).find((p) => p.campo.caminho === caminho)!;

  it("custo.tag e dias aparecem pelo rótulo, nunca pelo valor cru", () => {
    const tag = achar(DOC, "custo.tag");
    const dias = achar(DOC, "dias");
    expect(tag.campo.rotulos, "a premissa: o servidor traz os rótulos").toBeDefined();
    expect(respostaNaTela(tag)).toBe(tag.campo.rotulos!.pago);
    expect(respostaNaTela(tag)).not.toBe("pago");
    expect(respostaNaTela(dias)).toBe(`${dias.campo.rotulos!.sab}, ${dias.campo.rotulos!.dom}`);
    expect(respostaNaTela(dias)).not.toMatch(/\bsab\b|\bdom\b/);
    const { linha } = desenhar(linhasDe());
    expect(linha("custo.tag").textContent).toContain(tag.campo.rotulos!.pago);
    expect(linha("dias").textContent).toContain(dias.campo.rotulos!.sab);
  });

  it("prosa é o texto; booleano é Sim/Não; faixas são as horas curtas", () => {
    expect(respostaNaTela(achar(DOC, "promessa"))).toBe(DOC.promessa);
    expect(respostaNaTela(achar(DOC, "carroComum"))).toBe(SIM);
    expect(respostaNaTela(achar({ ...DOC, carroComum: false }, "carroComum"))).toBe(NAO);
    expect(respostaNaTela(achar(DOC, "horario"))).toBe("8h–17h");
  });

  it("forma que a espécie não espera é sem resposta, nunca estoura", () => {
    expect(respostaNaTela(achar({ ...DOC, promessa: 42 }, "promessa"))).toBeNull();
    expect(respostaNaTela(achar({ ...DOC, horario: "de manhã" }, "horario"))).toBeNull();
    expect(respostaNaTela(achar({ ...DOC, dias: [] }, "dias"))).toBeNull();
  });
});

describe("RevisaoDoLugar — o componente", () => {
  it("o título, e uma linha por pergunta, cada uma com Corrigir", () => {
    const l = linhasDe();
    const { container } = desenhar(l);
    expect(container.textContent).toContain(TITULO_REVISAO);
    expect(container.querySelectorAll("li")).toHaveLength(l.length);
    expect(within(container as HTMLElement).getAllByRole("link", { name: CORRIGIR })).toHaveLength(l.length);
  });

  it("o ponto é mapinha, nunca número", () => {
    const { linha } = desenhar(linhasDe());
    const ponto = linha("trajeto.waypoints.0.lat");
    expect(ponto.textContent).not.toMatch(/-?\d+\.\d{3,}/);
    expect(ponto.textContent).not.toMatch(/-?\d+[,.]\s*-?\d+/);
    expect(ponto.querySelector("img"), "o mapinha tem tiles").toBeTruthy();
    expect(ponto.textContent).toContain("© OpenStreetMap");
    const lat = String((DOC.trajeto as { waypoints: { lat: number }[] }).waypoints[0].lat);
    expect(ponto.innerHTML, "nenhuma parte da coordenada vira texto").not.toContain(lat);
  });

  it("obrigatória sem resposta: falta, destacada, com o destino de hoje; opcional: pulada", () => {
    const doc = sem("voz", "secaRapido");
    const { linha } = desenhar(linhasDe(doc));
    const voz = linha("voz");
    expect(voz.getAttribute("data-estado")).toBe("falta");
    expect(voz.textContent).toContain(SEM_RESPOSTA);
    expect(within(voz).getByRole("link", { name: CORRIGIR }).getAttribute("href")).toBe(`/c/${ORDEM.indexOf("voz") + 1}`);
    const seca = linha("secaRapido");
    expect(seca.getAttribute("data-estado")).toBe("pulada");
    expect(seca.textContent).toContain(PULADA);
    expect(seca.textContent).not.toContain(SEM_RESPOSTA);
    expect(linha("promessa").getAttribute("data-estado")).toBe("respondida");
    expect(linha("promessa").textContent).not.toContain(SEM_RESPOSTA);
  });

  it("o ponto sem resposta é falta em texto, sem mapinha", () => {
    const doc = structuredClone(DOC) as { trajeto: { waypoints: Record<string, unknown>[] } };
    delete doc.trajeto.waypoints[0].lat;
    delete doc.trajeto.waypoints[0].lng;
    const { linha } = desenhar(linhasDe(doc));
    const ponto = linha("trajeto.waypoints.0.lat");
    expect(ponto.getAttribute("data-estado")).toBe("falta");
    expect(ponto.querySelector("img")).toBeNull();
    expect(ponto.textContent).toContain(SEM_RESPOSTA);
  });
});
