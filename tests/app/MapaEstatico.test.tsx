import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import MapaEstatico from "@/app/MapaEstatico";

afterEach(() => { cleanup(); });

const RAMPA = { lat: -7.907889, lng: -36.019222, nome: "Rampa do Pepe" };

describe("MapaEstatico", () => {
  it("mostra a atribuição do OpenStreetMap como link pro copyright deles", () => {
    const { getByText } = render(<MapaEstatico {...RAMPA} estado="fresco" />);
    const credito = getByText("© OpenStreetMap");
    expect(credito.tagName).toBe("A");
    expect(credito.getAttribute("href")).toContain("openstreetmap.org");
  });

  it("o pin carrega data-estado='frio' quando o estado é frio", () => {
    const { container } = render(<MapaEstatico {...RAMPA} estado="frio" />);
    const pin = container.querySelector(".wp-pin");
    expect(pin).not.toBeNull();
    expect(pin?.getAttribute("data-estado")).toBe("frio");
  });

  it("o pin carrega data-estado='fresco' quando o estado é fresco", () => {
    const { container } = render(<MapaEstatico {...RAMPA} estado="fresco" />);
    const pin = container.querySelector(".wp-pin");
    expect(pin?.getAttribute("data-estado")).toBe("fresco");
  });

  it("renderiza ao menos um tile do OSM", () => {
    const { container } = render(<MapaEstatico {...RAMPA} estado="fresco" />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs.every((img) => img.getAttribute("src")?.includes("tile.openstreetmap.org"))).toBe(true);
  });
});
