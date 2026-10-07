import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/** 🔴 ESCONDER TODOS OS LUGARES (C1 da revisão final do painel completo,
 *  2026-10-06) — a linha vermelha, pelo caminho de produção inteiro.
 *
 *  O dono esconde os três lugares pelo celular (três toques; nenhuma porta
 *  recusa o "último visível"). Até 06/10 a leitura pública perguntava "banco
 *  vazio?" ao mapa JÁ FILTRADO pelo SQL, e o vazio caía no ramo do banco fora:
 *  a home, o acervo e toda ficha caíam no `error.tsx` — e, enquanto houve
 *  memória (até 07/10), uma instância que já tinha lido servia os três
 *  ESCONDIDOS na home, no acervo e no link direto, com o banco de pé.
 *
 *  A cadeia medida é a de produção — `getAllFichas` → `buscarFichas` →
 *  `versoesAtuais` → SQL contra o `:memory:` que o `getClient` de verdade abre
 *  (`tests/banco.ts`). Sem dublê de getter: por isso a mutação "o vazio decide
 *  pelo mapa filtrado" morre AQUI, esteja ela no `getAllFichas` (tirar o
 *  `incluirOcultos`) ou no `buscarFichas` (filtrar antes de perguntar o vazio).
 *
 *  ⚠️ CADA CASO LÊ O ACERVO COM OS TRÊS NO AR ANTES DE ESCONDER. Era o pior dos
 *  dois lados enquanto havia memória; sem ela (07/10), é o que mantém estas
 *  provas valendo se a memória voltar. */
const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", async (real) => ({
  ...(await real<typeof import("next/navigation")>()),
  notFound: notFoundFalso,
}));

// Clima e aviso saem do caminho: nada aqui é sobre o carimbo, e sem lugar no ar
// não há o que ler. Mesmo molde de `tests/app/ficha-escondida.test.tsx`.
vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
  resolverEstados: vi.fn(),
}));

const { resolverEstado, resolverEstados } = await import("@/lib/carimbo-estado");
const { getAllFichas } = await import("@/lib/ficha");
const { gravarVersao, versaoAtual } = await import("@/lib/db");
const Ficha = (await import("@/app/[slug]/page")).default;
const Home = (await import("@/app/page")).default;
const Trilhas = (await import("@/app/trilhas/page")).default;
const NaoAchei = (await import("@/app/not-found")).default;
const { bancoDeProducao, AGORA_SEMENTE } = await import("../banco");

let banco: Awaited<ReturnType<typeof bancoDeProducao>>;
let slugs: string[];

/** Esconde TODOS, como o painel faz: versão nova com o mesmo documento e
 *  `oculto = 1`. */
async function esconderTodos(): Promise<void> {
  for (const slug of slugs) {
    const v = (await versaoAtual(banco, slug))!;
    await gravarVersao(banco, slug, v.doc, "painel", AGORA_SEMENTE + 60, true);
  }
}

const abrir = (slug: string) =>
  Ficha({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });

beforeEach(async () => {
  // Re-semeia o MESMO cliente (limpa as tabelas).
  banco = await bancoDeProducao();
  notFoundFalso.mockClear();
  vi.mocked(resolverEstado).mockResolvedValue({
    estado: "fresco",
    erro: false,
    calculadoEm: AGORA_SEMENTE,
    aviso: null,
  });
  vi.mocked(resolverEstados).mockImplementation(async (fichas) =>
    new Map(fichas.map((f) => [f.slug, { estado: "fresco", erro: false, calculadoEm: AGORA_SEMENTE, aviso: null }])),
  );
  // Uma leitura boa com os três NO AR, antes de qualquer esconder.
  slugs = (await getAllFichas()).map((f) => f.slug);
});

afterEach(() => {
  cleanup();
  vi.mocked(resolverEstado).mockReset();
  vi.mocked(resolverEstados).mockReset();
});

describe("esconder TODOS os lugares, depois de uma leitura com os três no ar", () => {
  // 🔴 A PREMISSA: o acervo tem mais de um lugar, e cada link abre. Sem ela os
  // casos de baixo passariam com o banco vazio ou o slug errado.
  it("antes de esconder, os lugares existem e cada página abre", async () => {
    expect(slugs.length).toBeGreaterThan(1);
    for (const slug of slugs) await expect(abrir(slug)).resolves.toBeTruthy();
    expect(notFoundFalso).not.toHaveBeenCalled();
  });

  it("a leitura pública devolve lista VAZIA — nem os escondidos, nem estouro", async () => {
    await esconderTodos();
    expect(await getAllFichas()).toEqual([]);
  });

  it("o link direto de CADA escondido dá 404 — a página chama notFound()", async () => {
    await esconderTodos();
    for (const slug of slugs) {
      notFoundFalso.mockClear();
      await expect(abrir(slug), slug).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFoundFalso, slug).toHaveBeenCalledTimes(1);
    }
  });

  // 🔴 AS TELAS DESENHAM O ACERVO VAZIO SEM ESTOURAR, e nenhuma nomeia um
  // escondido. (A frase que a home mostra nesse estado — a da folha vazia — é
  // pendência de produto, registrada em `FolhaTrilhas.tsx`; aqui só se prova
  // que a tela fica de pé e não mostra lugar escondido.)
  it("home, /trilhas e o 404 abrem com o acervo vazio, sem link pra lugar escondido", async () => {
    const nomes = (await getAllFichas()).map((f) => f.trajeto.waypoints[0].nome);
    expect(nomes.length, "a premissa: os nomes foram lidos com os lugares no ar").toBe(slugs.length);
    const telas = [
      ["home", Home],
      ["/trilhas", Trilhas],
      ["404", NaoAchei],
    ] as const;

    // O CONTROLE: com os lugares no ar, as MESMAS telas têm o link de cada um.
    // Sem ele, as asserções de baixo passariam com uma tela que não desenha nada.
    for (const [tela, montar] of telas) {
      const { container } = render(await montar());
      const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
      for (const slug of slugs) expect(hrefs, `${tela} no ar: link pra ${slug}`).toContain(`/${slug}`);
      cleanup();
    }

    await esconderTodos();
    for (const [tela, montar] of telas) {
      const { container } = render(await montar());
      const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
      for (const slug of slugs) expect(hrefs, `${tela}: link pra ${slug}`).not.toContain(`/${slug}`);
      for (const nome of nomes) expect(container.textContent, `${tela}: nome ${nome}`).not.toContain(nome);
      cleanup();
    }
  });
});

// 🔴 O CONTROLE: a tabela REALMENTE vazia (schema sem semente) continua no ramo
// do banco fora — e estoura, mesmo depois da leitura boa do `beforeEach` (a
// decisão de 07/10: sem memória, nada de antes é servido). É o C1 de 26/09, e o
// conserto de 06/10 não pode tê-lo levado junto.
describe("tabela de versões realmente vazia, pelo getter de produção", () => {
  it("estoura, mesmo com uma leitura boa antes", async () => {
    expect(slugs.length, "a premissa: houve uma leitura boa antes").toBeGreaterThan(1);
    await banco.execute("DELETE FROM ficha_versoes");
    await expect(getAllFichas()).rejects.toThrow(/sem nenhuma linha/);
  });
});
