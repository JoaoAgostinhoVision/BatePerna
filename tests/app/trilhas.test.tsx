import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Trilhas from "@/app/trilhas/page";
import { getAllFichas } from "@/lib/ficha";

afterEach(() => { cleanup(); });

describe("/trilhas", () => {
  it("dá um link pra cada ficha de content/fichas", () => {
    const { container } = render(<Trilhas />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    const fichas = getAllFichas();
    expect(fichas.length).toBeGreaterThan(0);
    for (const f of fichas) expect(hrefs).toContain(`/${f.slug}`);
  });

  it("mostra o nome do lugar e o rótulo de escaneio de cada ficha", () => {
    const { container } = render(<Trilhas />);
    for (const f of getAllFichas()) {
      expect(container.textContent).toContain(f.trajeto.waypoints[0].nome);
      expect(container.textContent).toContain(f.rotulo_escaneio);
    }
  });
});
