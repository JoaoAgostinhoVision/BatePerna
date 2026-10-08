import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MEIA_LINHA_REGRA_PADRAO } from "@/lib/origem";
import { bancoDeProducao, semearAcervo, semearLugarDaPessoa } from "../banco";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
  resolverEstados: vi.fn(),
}));

// Um SÁBADO às 8h de Recife, pela razão escrita em `tests/app/home.test.tsx`
// (a Rampa só abre sáb/dom; num dia útil a fase seria "fechado").
const AGORA_S = Math.floor(Date.UTC(2027, 0, 16, 11, 0) / 1000);
const SECO = { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S, aviso: null };

const banco = await bancoDeProducao();
const { resolverEstado, resolverEstados } = await import("@/lib/carimbo-estado");
const Ficha = (await import("@/app/[slug]/page")).default;
const Home = (await import("@/app/page")).default;
let SLUG: string;

beforeEach(async () => {
  // O relógio fixo no sábado das 8h: sem ele a Rampa (que só abre sáb/dom) cairia
  // na fase "fechado" e a linha seca nunca apareceria.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA_S * 1000);
  await semearAcervo(banco);
  SLUG = await semearLugarDaPessoa(banco, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  vi.mocked(resolverEstado).mockResolvedValue(SECO);
  vi.mocked(resolverEstados).mockImplementation(async (fichas) => new Map(fichas.map((f) => [f.slug, SECO])));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const abrir = async (slug: string) =>
  render(await Ficha({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }));

describe("o carimbo de um lugar sem regra própria", () => {
  it("a ficha da pessoa diz 'seco' sem 'carro comum', e mostra a meia-linha", async () => {
    const { container } = await abrir(SLUG);
    expect(container.querySelector(".stamp .sub")?.textContent).toBe("seco");
    expect(container.querySelector('[data-marca="regra-padrao"]')?.textContent).toBe(MEIA_LINHA_REGRA_PADRAO);
  });

  it("a ficha da Rampa continua 'seco · carro comum', sem meia-linha", async () => {
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(".stamp .sub")?.textContent).toBe("seco · carro comum");
    expect(container.querySelector('[data-marca="regra-padrao"]')).toBeNull();
  });

  it("o selo do cartão da pessoa na home também diz só 'seco'", async () => {
    const { container } = render(await Home());
    const cartao = container.querySelector(`a.cartao[href="/${SLUG}"]`);
    expect(cartao, "a premissa: o cartão da pessoa está na home").not.toBeNull();
    expect(cartao!.querySelector(".selo .s")?.textContent).toBe("seco");
  });

  it("depois de calibrado, a ficha da pessoa volta a 'seco · carro comum' e a meia-linha sai", async () => {
    const { gravarEdicao, versaoAtual } = await import("@/lib/db");
    const { calibrarDoc } = await import("@/lib/calibrar");
    const atual = (await versaoAtual(banco, SLUG))!;
    await gravarEdicao(banco, SLUG, calibrarDoc(atual.doc, { janela_previsao_horas: 2, janela_passado_horas: 5, limiar_mm: 1, severidade: "espera" }), AGORA_S, atual.id);
    const { container } = await abrir(SLUG);
    expect(container.querySelector('[data-marca="regra-padrao"]')).toBeNull();
    expect(container.querySelector(".stamp .sub")?.textContent).toBe("seco · carro comum");
  });
});
