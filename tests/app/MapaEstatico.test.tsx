import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { regraDe, semComentarios, valorDe } from "../css";
import MapaEstatico from "@/app/MapaEstatico";

afterEach(() => { cleanup(); });

const RAMPA = { lat: -7.907889, lng: -36.019222, nome: "Rampa do Pepe" };

describe("MapaEstatico", () => {
  it("mostra a atribuição do OpenStreetMap como link pro copyright deles", () => {
    const { getByText } = render(<MapaEstatico {...RAMPA} />);
    const credito = getByText("© OpenStreetMap");
    expect(credito.tagName).toBe("A");
    expect(credito.getAttribute("href")).toContain("openstreetmap.org");
  });

  it("o pin não guarda estado próprio — a cor dele é a da moldura", () => {
    // Antes o pin levava data-estado com a leitura do SERVIDOR. Quando o carimbo
    // buscava leitura nova no portão e o selo virava vermelho, esse atributo
    // ficava para trás e o pin seguia verde ao lado dele. Cor de decisão tem
    // uma fonte só: o [data-state] do <main>.
    const { container } = render(<MapaEstatico {...RAMPA} />);
    const pin = container.querySelector(".wp-pin");
    expect(pin).not.toBeNull();
    expect(pin?.getAttribute("data-estado")).toBeNull();
  });

  it("o CSS pinta o pin a partir do mesmo atributo que a moldura escreve", () => {
    // Par que não pode desemparelhar: se o seletor voltar a olhar um atributo
    // do próprio pin, ele sai do ar sem nenhum teste reclamar — jsdom não
    // computa cor.
    //
    // 🔴 A cor é lida pelo VALOR da declaração. `[^}]*background:\s*var\(--stop\)`
    // dentro do bloco casava em `--background: var(--stop); background:
    // var(--go)`: MEDIDO, 523/523 VERDE com o pin da ficha PINTADO DE VERDE ao
    // lado de um carimbo que diz frio. "Cor de um lado, palavra do outro" já
    // custou dois Criticals a este app; esta era a terceira porta.
    const css = semComentarios("ficha.css");
    const regra = regraDe(css, '.bp[data-state="frio"] .wp-pin');
    expect(regra, "faltou a regra que pinta o pin de frio no ficha.css").not.toBeNull();
    expect(valorDe(regra![0], "background"), "o pin da ficha parou de pintar frio com a cor de frio")
      .toBe("var(--stop)");
    expect(css).not.toMatch(/\.wp-pin\[data-estado/);
  });

  it("renderiza ao menos um tile do OSM", () => {
    const { container } = render(<MapaEstatico {...RAMPA} />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs.every((img) => img.getAttribute("src")?.includes("tile.openstreetmap.org"))).toBe(true);
  });
});
