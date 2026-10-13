import { readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ETIQUETA_NAO_CONFERIDO, FAIXA_NAO_CONFERIDO } from "@/lib/origem";
import { bancoDeProducao, semearAcervo, semearLugarDaPessoa } from "../banco";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
  resolverEstados: vi.fn(),
}));
vi.mock("next/navigation", async (real) => ({
  ...(await real<typeof import("next/navigation")>()),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));

const AGORA_S = Math.floor(Date.UTC(2027, 0, 16, 11, 0) / 1000);
const SECO = { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S, aviso: null };
const NOME = "Pedra Mandada Marcador";

const banco = await bancoDeProducao();
const { resolverEstado, resolverEstados } = await import("@/lib/carimbo-estado");
let SLUG: string;

beforeEach(async () => {
  await semearAcervo(banco);
  SLUG = await semearLugarDaPessoa(banco, { nome: NOME, cidade: "Cidade Teste" });
  vi.mocked(resolverEstado).mockResolvedValue(SECO);
  vi.mocked(resolverEstados).mockImplementation(async (fichas) => new Map(fichas.map((f) => [f.slug, SECO])));
});
afterEach(() => cleanup());

// ═══ METADE 1: as páginas, do DISCO ═══════════════════════════════════════

const APP = path.join(process.cwd(), "src", "app");
const FORA = new Set(["admin", "contribuir", "api"]);

function paginasPublicas(dir = APP, base = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) return base === "" && FORA.has(e.name) ? [] : paginasPublicas(path.join(dir, e.name), rel);
    return /^(page|not-found)\.(tsx?|jsx?)$/.test(e.name) ? [rel] : [];
  });
}

/** 🔴 O RESTO DO QUE O NEXT SERVE (adição desta tarefa ao brief). A metade 1
 *  lê só `page`/`not-found` — e um `opengraph-image.tsx` ou um `sitemap.ts`
 *  sob `[slug]/` também mostrariam o nome do lugar pra fora do app, sem passar
 *  por nenhuma página. Aqui saem do DISCO todos os outros arquivos com nome de
 *  convenção do Next, e cada um tem de estar em `SEM_LUGAR` com o porquê:
 *  arquivo de rota novo = vermelho até alguém decidir se ele mostra lugar (e,
 *  se mostra, ele ganha linha em `RENDERIZAR` ou um caso próprio). */
const CONVENCAO = /^(layout|template|loading|error|global-error|default|route|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.(tsx?|jsx?)$/;

function outrasRotas(dir = APP, base = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) return base === "" && FORA.has(e.name) ? [] : outrasRotas(path.join(dir, e.name), rel);
    return CONVENCAO.test(e.name) ? [rel] : [];
  });
}

const SEM_LUGAR: Record<string, string> = {
  "layout.tsx": "a moldura de todas as páginas; título e descrição são os do app, nenhum lugar",
  "error.tsx": "a tela de erro não recebe ficha nenhuma",
  "manifest.ts": "o manifesto do PWA: nome do app e ícones",
  "icones/[nome]/route.tsx": "os PNGs do ícone do app; o [nome] é o TAMANHO, não um lugar",
};

/** Como cada página pública é aberta com o lugar da pessoa no acervo. Página
 *  pública NOVA sem linha aqui deixa o primeiro caso vermelho. `slug` só pesa
 *  na página de UM lugar (`[slug]`): o padrão é o dela; o caso "nenhum lugar
 *  do João leva a marca" a abre num lugar do João. */
const RENDERIZAR: Record<string, (slug?: string) => Promise<HTMLElement>> = {
  "page.tsx": async () => render(await (await import("@/app/page")).default()).container,
  "trilhas/page.tsx": async () => render(await (await import("@/app/trilhas/page")).default()).container,
  "not-found.tsx": async () => render(await (await import("@/app/not-found")).default()).container,
  "[slug]/page.tsx": async (slug = SLUG) =>
    render(
      await (await import("@/app/[slug]/page")).default({
        params: Promise.resolve({ slug }),
        searchParams: Promise.resolve({}),
      }),
    ).container,
};

/** Quantas vezes, NO MÍNIMO, o nome tem de aparecer em cada página — a
 *  não-vacuidade: uma página que não mostrasse o lugar passaria a varredura
 *  sem medir nada. A home tem o cartão E o pin. */
const MINIMO: Record<string, number> = { "page.tsx": 2, "trilhas/page.tsx": 1, "not-found.tsx": 1, "[slug]/page.tsx": 2 };

// ═══ METADE 2: as ocorrências, da TELA ════════════════════════════════════

function ocorrencias(raiz: HTMLElement): Element[] {
  return [...raiz.querySelectorAll("*")].filter((el) => {
    const proprio = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? "").join("");
    const atributos = ["aria-label", "alt", "title"].map((a) => el.getAttribute(a) ?? "").join(" ");
    return proprio.includes(NOME) || atributos.includes(NOME);
  });
}

function semMarca(el: Element): string | null {
  const caixa = el.closest("[data-lugar]");
  if (caixa === null) return `<${el.tagName.toLowerCase()} class="${el.className}"> fora de qualquer [data-lugar]`;
  if (caixa.getAttribute("data-lugar") !== SLUG) return `dentro do [data-lugar="${caixa.getAttribute("data-lugar")}"], que não é o dele`;
  const marcada = caixa.matches('[data-marca="nao-conferido"]') || caixa.querySelector('[data-marca="nao-conferido"]') !== null;
  return marcada ? null : `[data-lugar="${SLUG}"] sem [data-marca="nao-conferido"]`;
}

describe("a invariante: lugar não conferido nunca aparece sem a marca", () => {
  it("toda página pública do disco está na varredura, e nenhuma entrada é fantasma", () => {
    const doDisco = paginasPublicas().sort();
    expect(doDisco, "a premissa: o disco foi lido").toContain("[slug]/page.tsx");
    expect(doDisco).toEqual(Object.keys(RENDERIZAR).sort());
  });

  it("todo outro arquivo de rota do Next está decidido: não mostra lugar, e diz por quê", () => {
    const doDisco = outrasRotas().sort();
    expect(doDisco, "a premissa: o disco foi lido").toContain("layout.tsx");
    expect(doDisco).toEqual(Object.keys(SEM_LUGAR).sort());
  });

  it.each(Object.keys(RENDERIZAR))("em %s, toda ocorrência do nome mora numa caixa marcada", async (pagina) => {
    const tela = await RENDERIZAR[pagina]();
    const achadas = ocorrencias(tela);
    expect(achadas.length, `${pagina}: o lugar da pessoa nem apareceu`).toBeGreaterThanOrEqual(MINIMO[pagina]);
    expect(achadas.map(semMarca).filter((x) => x !== null)).toEqual([]);
  });

  // O outro lado: a marca não vaza pros lugares do João. 🔴 Teste #4 da
  // revisão final: aberta no lugar DELA, a página de um lugar só não mostra
  // lugar do João nenhum, e este caso era vácuo ali — uma faixa
  // incondicional passava. Agora toda página é aberta num lugar do João (o
  // `[slug]` na Rampa), e a não-vacuidade exige um lugar do João NA TELA.
  it.each(Object.keys(RENDERIZAR))("em %s, nenhum lugar do João leva a marca", async (pagina) => {
    const tela = await RENDERIZAR[pagina]("rampa-do-pepe");
    expect(
      [...tela.querySelectorAll("[data-lugar]")].some((l) => l.getAttribute("data-lugar") !== SLUG),
      `${pagina}: nenhum lugar do João apareceu — o caso não mediria nada`,
    ).toBe(true);
    for (const m of tela.querySelectorAll('[data-marca="nao-conferido"]')) {
      expect(m.closest("[data-lugar]")?.getAttribute("data-lugar")).toBe(SLUG);
    }
  });
});

describe("as palavras e o desenho de cada superfície", () => {
  it("o cartão da home: a etiqueta junto do nome", async () => {
    const tela = await RENDERIZAR["page.tsx"]();
    const cartao = tela.querySelector(`a.cartao[data-lugar="${SLUG}"]`)!;
    expect(cartao.querySelector(".cartao-topo [data-marca='nao-conferido']")?.textContent).toBe(ETIQUETA_NAO_CONFERIDO);
  });

  it("o pin: contorno diferente, e a etiqueta no nome que o leitor de tela lê", async () => {
    const tela = await RENDERIZAR["page.tsx"]();
    const pin = tela.querySelector(`a.pin-home[href="#${SLUG}"]`)!;
    expect(pin.getAttribute("data-conferido")).toBe("nao");
    expect(pin.getAttribute("aria-label")).toContain(ETIQUETA_NAO_CONFERIDO);
    const rampa = tela.querySelector('a.pin-home[href="#rampa-do-pepe"]')!;
    expect(rampa.hasAttribute("data-conferido")).toBe(false);
  });

  it("o contorno do pin existe no CSS", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(path.join(APP, "home.css"), "utf8");
    // `outline\s*:` e não só `outline`: com a palavra solta, o `outline-offset`
    // que fica na regra bastava, e arrancar o contorno passava verde (M11,
    // medido nesta tarefa). E `dashed`: é o tracejado que nenhum outro estado
    // do pin usa — um contorno liso seria só mais um pin.
    // E no `::before`, que é a GOTA: o `<a>` é a caixa de toque de 44px,
    // invisível, e o contorno nele era um quadrado em volta do ponto (onda de
    // fix da Task 5).
    expect(css).toMatch(/\.pin-home\[data-conferido="nao"\]::before\s*\{[^}]*\boutline\s*:[^;}]*dashed/);
    // E o `<a>` sem `outline` de autor: um `outline` nele apaga o anel de foco
    // do teclado do navegador justo no pin não conferido.
    expect(css).not.toMatch(/\.pin-home\[data-conferido="nao"\]\s*\{[^}]*\boutline\s*:/);
  });

  // jsdom não faz layout: o que se prova aqui é que a regra que segura a
  // etiqueta junto do nome (cartão) e do tamanho dela (lista) existe. O olho
  // de tela continua sendo o juiz do desenho (onda de fix da Task 5).
  it("a etiqueta fica junto do nome no cartão e do tamanho dela na lista", async () => {
    const { readFileSync } = await import("node:fs");
    const home = readFileSync(path.join(APP, "home.css"), "utf8");
    const ficha = readFileSync(path.join(APP, "ficha.css"), "utf8");
    expect(home).toMatch(/\.bp \.cartao-nome \+ \.etiqueta-nao-conferido\s*\{[^}]*\bmargin-right\s*:\s*auto/);
    expect(ficha).toMatch(/\.bp \.lista-item \.etiqueta-nao-conferido\s*\{[^}]*\balign-self\s*:\s*flex-start/);
  });

  it("a ficha: a faixa abaixo do nome, e o nome de quem mandou NÃO aparece", async () => {
    const tela = await RENDERIZAR["[slug]/page.tsx"]();
    const faixa = tela.querySelector(".hero [data-marca='nao-conferido']");
    expect(faixa?.textContent).toBe(FAIXA_NAO_CONFERIDO);
    expect(tela.textContent).not.toContain("user_pessoa_de_teste");
  });

  it("o cartão do link no WhatsApp leva a etiqueta; o da Rampa não", async () => {
    const { generateMetadata } = await import("@/app/[slug]/page");
    const dela = await generateMetadata({ params: Promise.resolve({ slug: SLUG }) });
    expect(String(dela.title)).toContain(ETIQUETA_NAO_CONFERIDO);
    expect(String(dela.openGraph?.title)).toContain(ETIQUETA_NAO_CONFERIDO);
    expect(String((dela.twitter as { title?: string }).title)).toContain(ETIQUETA_NAO_CONFERIDO);
    const rampa = await generateMetadata({ params: Promise.resolve({ slug: "rampa-do-pepe" }) });
    expect(String(rampa.title)).not.toContain(ETIQUETA_NAO_CONFERIDO);
  });
});
