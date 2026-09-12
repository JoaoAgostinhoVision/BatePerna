import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import NaoAchei from "@/app/not-found";
import { getAllFichas } from "@/lib/ficha";

afterEach(() => { cleanup(); });

/** 🔴 O BECO QUE ESTE ARQUIVO FECHA (2026-09-11). Sem `not-found.tsx`, um slug
 *  errado caía no 404 padrão do Next — **"This page could not be found"**, em
 *  inglês, fora da moldura do app, sem uma única porta de volta. Em standalone
 *  não há barra de URL: não dá nem pra digitar outro endereço.
 *
 *  É o mesmo beco que o aquecimento do service worker fechou horas antes, por
 *  outra causa (lá era a rede, aqui é o endereço). E ficou mais provável de ser
 *  alcançado hoje mesmo: os links das fichas passaram a mandar cartão próprio
 *  no WhatsApp, então eles vão circular — e link circulando sobrevive a uma
 *  ficha mudar de nome. */
describe("o endereço que não existe", () => {
  it("responde dentro da moldura do app, e não no 404 cru do navegador", () => {
    const { container } = render(<NaoAchei />);
    expect(container.querySelector("main.bp"), "a tela saiu da moldura do app").not.toBeNull();
    expect(container.querySelector(".appbar"), "sumiu a marca do topo").not.toBeNull();
  });

  // 🔴 A PORTA DE SAÍDA É O PONTO INTEIRO DA TELA. Em standalone, sem ela, a
  // pessoa fica presa — e este teste é o que impede alguém de "simplificar" a
  // página tirando a barra.
  it("sempre tem porta de saída — as duas seções do app", () => {
    const { container } = render(<NaoAchei />);
    const destinos = Array.from(container.querySelectorAll(".barra a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(destinos).toContain("/");
    expect(destinos).toContain("/trilhas");
  });

  // A resposta útil pra quem tocou num link de trilha é mostrar as trilhas que
  // existem — a mesma doutrina que `planoDaRaiz` já segue no service worker.
  it("mostra o acervo inteiro, com link pra cada ficha", () => {
    const { container } = render(<NaoAchei />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    const fichas = getAllFichas();
    expect(fichas.length, "o acervo sumiu — este guarda ficaria oco").toBeGreaterThanOrEqual(3);
    for (const f of fichas) {
      expect(hrefs, `sumiu o link de ${f.slug}`).toContain(`/${f.slug}`);
      expect(container.textContent).toContain(f.trajeto.waypoints[0].nome);
    }
  });

  // 🔴 A FRASE NÃO AFIRMA NADA SOBRE LUGAR NENHUM, e a diferença é real: "essa
  // trilha não existe" é uma afirmação sobre o mundo — o endereço pode ter
  // mudado, e quem sabe disso não é esta tela. "Não achei" diz o que o app fez.
  it("a frase conta o que o app fez, e não afirma sobre o mundo", () => {
    const { container } = render(<NaoAchei />);
    const frase = container.querySelector(".nao-achei")?.textContent ?? "";
    expect(frase, "sumiu a frase do 404").toBeTruthy();
    expect(frase, "a frase passou a afirmar que o lugar não existe").not.toMatch(/não existe/i);
  });

  // Nada de inglês nesta tela: o 404 padrão do Next é o que ela substitui, e a
  // frase dele é a marca de que ela não foi substituída.
  it("nenhuma palavra do 404 padrão do Next sobrou", () => {
    const { container } = render(<NaoAchei />);
    expect(container.textContent).not.toMatch(/could not be found|404/i);
  });

  // 🔴 CARIMBO CONTINUA FORA: quem julga a chuva é a home. A lista aqui é a
  // mesma do acervo, e o guarda existe porque a tentação é mostrar veredito
  // numa tela que já está mostrando trilhas.
  it("nenhuma palavra de veredito entra — esta tela não julga chuva", () => {
    const { container } = render(<NaoAchei />);
    for (const p of ["Pode ir", "Não vá", "Fechado agora", "Vá com cuidado", "SEM INFORMAÇÕES"]) {
      expect(container.textContent?.includes(p), `o 404 passou a dizer "${p}"`).toBe(false);
    }
  });
});
