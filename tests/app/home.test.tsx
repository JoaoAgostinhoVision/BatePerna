import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { getFichasComCondicao } from "@/lib/ficha";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstados: vi.fn(),
}));

const { resolverEstados } = await import("@/lib/carimbo-estado");
const Home = (await import("@/app/page")).default;

const AGORA_S = Math.floor(Date.UTC(2027, 0, 15, 11, 0) / 1000);

function leituras(estado: "fresco" | "frio", erro = false) {
  return new Map(
    getFichasComCondicao().map((f) => [f.slug, { estado, erro, calculadoEm: AGORA_S }]),
  );
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_S * 1000); });
afterEach(() => { vi.useRealTimers(); cleanup(); vi.mocked(resolverEstados).mockReset(); });

describe("a home", () => {
  it("dá um link pra cada trilha com condição", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(leituras("fresco"));
    const { container } = render(await Home());
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    for (const f of getFichasComCondicao()) expect(hrefs).toContain(`/${f.slug}`);
  });

  it("o carimbo já vem pintado no HTML do servidor, sem depender de JS", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(leituras("fresco"));
    const { container } = render(await Home());
    const selo = container.querySelector(".cartao .selo");
    expect(selo?.textContent).toContain("Pode subir");
    expect(container.querySelector('.cartao[data-state="fresco"]')).not.toBeNull();
  });

  it("agrupa por veredito: o que dá hoje em cima, o que não dá embaixo", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(leituras("frio"));
    const { container } = render(await Home());
    expect(container.textContent).toContain("Hoje não");
    expect(container.querySelector('.cartao[data-state="frio"]')).not.toBeNull();
  });

  it("sem leitura, informa em vez de mandar — 'Não suba' é só pro barro medido", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(leituras("frio", true));
    const { container } = render(await Home());
    expect(container.textContent).toContain("SEM INFORMAÇÕES");
    expect(container.textContent).not.toContain("Não suba");
  });

  it("a barra marca que você está na home", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(leituras("fresco"));
    const { container } = render(await Home());
    expect(container.querySelector('.barra [aria-current="page"]')?.getAttribute("href")).toBe("/");
  });

  it("não é estática — se congelar no build, todo visitante recebe carimbo vencido", async () => {
    const mod = await import("@/app/page");
    expect(mod.dynamic).toBe("force-dynamic");
  });

  // A palavra e a cor têm que dizer a mesma coisa. Em CSS isso é uma disputa de
  // especificidade, e ela já foi perdida uma vez neste app: a rodada do carimbo
  // shipou "Não suba" dentro de um selo verde. jsdom não resolve cascata, então
  // o guarda lê a folha.
  it("a regra de fase ganha da cor do estado — senão 'sem informações' sai verde", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
    const fase = css.match(/^.*\.selo\[data-fase="sem-informacoes"\].*$/m);
    expect(fase, "faltou a regra de fase do selo").not.toBeNull();
    expect(
      fase![0],
      "a regra de fase precisa carregar [data-state] pra vencer a regra de cor",
    ).toContain("[data-state]");
  });
});
