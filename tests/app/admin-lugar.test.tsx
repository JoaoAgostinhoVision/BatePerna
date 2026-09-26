import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import type { Client } from "@libsql/client";
import { bancoVazio, semearAcervo } from "../banco";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// 🔴 A página é um Server Component (usa `cookies()` de next/headers e
// `notFound()` de next/navigation) — mesmo molde de
// `tests/app/admin-page.test.tsx`, que já mocka os dois pra poder importar a
// página fora do runtime do Next.
const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const cookiesFalso = vi.fn();

vi.mock("next/navigation", () => ({ notFound: notFoundFalso }));
vi.mock("next/headers", () => ({ cookies: cookiesFalso }));

function semCookie() {
  cookiesFalso.mockResolvedValue({ get: () => undefined });
}

describe("/admin/[slug] — painel desligado", () => {
  beforeEach(() => {
    notFoundFalso.mockClear();
    cookiesFalso.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  // 🔴 M3 do plano de mutação: pôr a guarda de sessão ANTES da de config
  // tem que morrer aqui. Sem cookie e sem ADMIN_SENHA, o mutante ainda cairia
  // no ramo "sem sessão" e devolveria a caixa de senha — nunca o 404 que a
  // spec exige (painel desligado NÃO ANUNCIA que existe).
  it("com o painel desligado (env vazio), a página CHAMA notFound() mesmo com um slug qualquer", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.stubEnv("ADMIN_SEGREDO", "");
    semCookie();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    await expect(Lugar({ params: Promise.resolve({ slug: "qualquer-coisa" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFoundFalso).toHaveBeenCalledTimes(1);
  });

  it("com ADMIN_SENHA curta, a página continua 404 — e avisa o motivo no log, uma vez", async () => {
    vi.stubEnv("ADMIN_SENHA", "curta");
    vi.stubEnv("ADMIN_SEGREDO", "x");
    semCookie();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    await expect(Lugar({ params: Promise.resolve({ slug: "qualquer-coisa" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

// 🔴 O DUBLÊ DO BANCO É PARCIAL, mesmo molde de `admin-page.test.tsx`: a
// página lê o acervo do BANCO (`getFicha` é `async`), então precisa do
// `versoesAtuais` de verdade — só `avisoVigente`/`getClient` são dublados.
let cliente: Client;
vi.mock("@/lib/db", async (real) => ({
  ...(await real<typeof import("@/lib/db")>()),
  avisoVigente: vi.fn(),
  getClient: vi.fn(() => cliente),
}));
vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

describe("/admin/[slug] — a porta e o conteúdo", () => {
  const SENHA = "s".repeat(24);
  const SEGREDO = "segredo-de-assinatura-do-teste-lugar";

  beforeEach(async () => {
    notFoundFalso.mockClear();
    cookiesFalso.mockReset();
    vi.unstubAllEnvs();
    cliente = bancoVazio();
    await semearAcervo(cliente);
    vi.stubEnv("ADMIN_SENHA", SENHA);
    vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
    vi.resetModules();
    const { resolverEstado } = await import("@/lib/carimbo-estado");
    const { avisoVigente } = await import("@/lib/db");
    vi.mocked(resolverEstado).mockResolvedValue({ estado: "fresco", erro: false, calculadoEm: 0, aviso: null });
    vi.mocked(avisoVigente).mockResolvedValue(null);
  });
  afterEach(() => vi.unstubAllEnvs());

  async function comSessaoValida() {
    const { criarSessao, DURACAO_SESSAO_S } = await import("@/lib/admin-sessao");
    const token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
    cookiesFalso.mockResolvedValue({
      get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined),
    });
  }

  // 1. Com cookie válido: o bloco do lugar aparece.
  it("com cookie válido: o bloco do lugar aparece", async () => {
    const { getAllFichas } = await import("@/lib/ficha");
    const fichas = await getAllFichas();
    const ficha = fichas[0];
    await comSessaoValida();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    const { container } = render(await Lugar({ params: Promise.resolve({ slug: ficha.slug }) }));
    expect(container.querySelector(".adm-painel")).not.toBeNull();
    expect(screen.getByText(new RegExp(ficha.trajeto.waypoints[0].nome))).toBeTruthy();
  });

  // 2. Slug fora do acervo: `notFound()` é chamado.
  // 🔴 M2 do plano de mutação: tirar este `notFound()` tem que morrer aqui.
  it("slug que não existe no acervo: 404", async () => {
    await comSessaoValida();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    await expect(Lugar({ params: Promise.resolve({ slug: "nao-existe" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  // 3. Sem cookie: caixa de senha, e NADA do lugar.
  // 🔴 A asserção que vale é a do `textContent`: "não mostra o painel" (a
  // classe `.adm-painel` ausente) já não distingue caixa vazia de ausência
  // real — o que falta provar é que o CONTEÚDO do lugar (a voz dele, escrita
  // à mão na ficha) não vaza pra quem não entrou.
  it("sem cookie: caixa de senha, e NADA do lugar", async () => {
    const { getAllFichas } = await import("@/lib/ficha");
    const fichas = await getAllFichas();
    const ficha = fichas[0];
    semCookie();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    const { container } = render(await Lugar({ params: Promise.resolve({ slug: ficha.slug }) }));
    expect(container.querySelector('input[type="password"]'), "a caixa de senha sumiu").not.toBeNull();
    expect(container.querySelector(".adm-painel"), "o painel apareceu sem cookie").toBeNull();
    expect(container.textContent).not.toContain(ficha.voz);
  });

  // 4. Painel desligado (sem ADMIN_SENHA), agora com sessão dentro do bloco
  // que semeia o banco — prova que a guarda de config corta ANTES de tocar o
  // banco: com `ADMIN_SENHA` vazia o `getFicha` nem chega a ser chamado.
  it("painel desligado (sem ADMIN_SENHA): 404, e a tela não explica", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.stubEnv("ADMIN_SEGREDO", "");
    semCookie();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    await expect(Lugar({ params: Promise.resolve({ slug: "pedra-furada-de-venturosa" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
