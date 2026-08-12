import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import MapaHome from "@/app/MapaHome";
import CartaoTrilha from "@/app/CartaoTrilha";
import { LeiturasProvider } from "@/app/leituras";
import { getFichasComCondicao } from "@/lib/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

afterEach(() => { cleanup(); });

const fichas = getFichasComCondicao();
const leituras = new Map<string, LeituraCarimbo>(
  fichas.map((f) => [f.slug, { estado: "fresco", erro: false, calculadoEm: 1_800_000_000 }]),
);

describe("MapaHome", () => {
  it("um pin por trilha, e cada pin é âncora pro cartão dela", () => {
    const { container } = render(<MapaHome fichas={fichas} leituras={leituras} />);
    const pins = Array.from(container.querySelectorAll(".pin-home"));
    expect(pins).toHaveLength(fichas.length);
    for (const f of fichas) {
      expect(pins.some((p) => p.getAttribute("href") === `#${f.slug}`)).toBe(true);
    }
  });

  it("o pin funciona sem JS: é <a href>, não botão", () => {
    const { container } = render(<MapaHome fichas={fichas} leituras={leituras} />);
    for (const p of container.querySelectorAll(".pin-home")) {
      expect(p.tagName).toBe("A");
    }
  });

  it("a cor do pin é a leitura daquela trilha, não a de outra", () => {
    const mistas = new Map<string, LeituraCarimbo>(
      fichas.map((f, i) => [
        f.slug,
        { estado: i === 0 ? "frio" : "fresco", erro: false, calculadoEm: 1_800_000_000 },
      ]),
    );
    const { container } = render(<MapaHome fichas={fichas} leituras={mistas} />);
    const pin = container.querySelector(`.pin-home[href="#${fichas[0].slug}"]`);
    expect(pin?.getAttribute("data-state")).toBe("frio");
  });

  it("carrega tiles do OpenStreetMap", () => {
    const { container } = render(<MapaHome fichas={fichas} leituras={leituras} />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0].getAttribute("src")).toContain("tile.openstreetmap.org");
  });

  it("credita o OpenStreetMap — é obrigação de licença, não enfeite", () => {
    const { container } = render(<MapaHome fichas={fichas} leituras={leituras} />);
    expect(container.textContent).toContain("OpenStreetMap");
  });

  // Cicatriz: na rodada do carimbo o pin guardou a leitura do servidor e ficou
  // verde ao lado de um selo que já tinha virado vermelho. O guarda é
  // COMPORTAMENTAL de propósito — uma leitura nova no contexto tem que mover
  // TODOS os três: o pin, a cor do cartão e a palavra do selo. Renderizamos
  // CartaoTrilha (não SeloTrilha solto): depois da correção da Task 6, quem lê
  // o contexto é o CartaoTrilha, uma leitura só, que alimenta o data-state do
  // cartão E a prop do selo — SeloTrilha virou apresentacional.
  it("leitura nova no contexto move o pin, a cor do cartão E a palavra, no mesmo quadro", () => {
    const slug = fichas[0].slug;
    const nova = new Map<string, LeituraCarimbo>([
      [slug, { estado: "frio", erro: false, calculadoEm: 1_800_000_000 }],
    ]);
    const { container } = render(
      <LeiturasProvider value={nova}>
        <MapaHome fichas={fichas} leituras={leituras} />
        <CartaoTrilha ficha={fichas[0]} inicial={leituras.get(slug)!} />
      </LeiturasProvider>,
    );
    // As props (`leituras`, `inicial`) dizem "fresco" — é a semente do servidor.
    // O contexto diz "frio". Os três têm que obedecer ao contexto, senão existe
    // mais de uma fonte de cor na tela.
    expect(container.querySelector(`.pin-home[href="#${slug}"]`)?.getAttribute("data-state"))
      .toBe("frio");
    expect(container.querySelector(".cartao")?.getAttribute("data-state")).toBe("frio");
    expect(container.textContent).toContain("Não suba");
  });

  // Mesmo padrão do guarda do .selo em tests/app/home.test.tsx — essa classe
  // exata de bug (a regra de fase perdendo a cascata pra cor do estado) já
  // vazou pra produção uma vez. Aqui a disputa é (0,4,1) contra (0,3,1):
  // .bp .pin-home[data-state][data-fase="sem-informacoes"]::before tem um
  // seletor a mais que .bp .pin-home[data-state="fresco"]::before — vitória
  // direta de especificidade, não empate resolvido por ordem no arquivo.
  // jsdom não resolve cascata, então o guarda lê a folha — seletor E corpo
  // juntos — pra não passar só porque o texto apareceu num comentário, nem
  // porque a regra ganhou a cascata mas pintou a cor errada.
  it("a regra de fase do pin ganha da cor do estado — mesma disputa de especificidade do selo", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
    expect(css).toMatch(
      /\.bp \.pin-home\[data-state\]\[data-fase="sem-informacoes"\]::before\s*\{[^}]*background:\s*var\(--stop\)/,
    );
  });
});
