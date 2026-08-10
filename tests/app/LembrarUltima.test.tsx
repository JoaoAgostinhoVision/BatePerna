import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import LembrarUltima from "@/app/LembrarUltima";
import { COOKIE_ULTIMA } from "@/lib/despacho";

afterEach(() => {
  cleanup();
  document.cookie = `${COOKIE_ULTIMA}=; path=/; max-age=0`;
});

describe("LembrarUltima", () => {
  it("grava a ficha aberta no cookie", () => {
    render(<LembrarUltima slug="rampa-do-pepe" />);
    expect(document.cookie).toContain(`${COOKIE_ULTIMA}=rampa-do-pepe`);
  });

  it("não desenha nada — é só memória", () => {
    const { container } = render(<LembrarUltima slug="rampa-do-pepe" />);
    expect(container.innerHTML).toBe("");
  });

  it("só a ficha grava", () => {
    // O ponto de #6: quem grava tem que ser quem já sabe que a ficha existe.
    // Se este componente aparecer no layout, numa lista ou num not-found, a
    // gravação volta a acontecer antes da certeza e o defeito renasce.
    const raiz = path.join(process.cwd(), "src");
    const usos: string[] = [];
    const varrer = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        const p = path.join(dir, entrada);
        if (statSync(p).isDirectory()) varrer(p);
        else if (/\.tsx$/.test(p) && readFileSync(p, "utf8").includes("<LembrarUltima")) {
          usos.push(path.relative(raiz, p).replace(/\\/g, "/"));
        }
      }
    };
    varrer(raiz);
    expect(usos).toEqual(["app/[slug]/page.tsx"]);
  });
});
