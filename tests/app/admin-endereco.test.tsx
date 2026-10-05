import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { Client } from "@libsql/client";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { TROCAR_MESMO, aindaDiz, enderecoTrocado, trocarPara } from "@/lib/endereco";
import { bancoVazio, semearAcervo } from "../banco";
import { lugarMarcador } from "../lugar-marcador";

/** A TROCA DE ENDEREÇO NA TELA DO DONO (Tarefa 11e, E3 com I4/I7/I8 e M5 da
 *  auditoria). Mesmo molde de `tests/app/admin-lugar.test.tsx`: a página de
 *  servidor roda contra o banco de verdade, só `cookies`, `notFound`/`redirect`,
 *  `getClient` e o carimbo são dublados. Nomes e cidades marcadores. */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirectFalso = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
const cookiesFalso = vi.fn();
vi.mock("next/navigation", () => ({ notFound: notFoundFalso, redirect: redirectFalso }));
vi.mock("next/headers", () => ({ cookies: cookiesFalso }));

let cliente: Client;
vi.mock("@/lib/db", async (real) => {
  const mod = await real<typeof import("@/lib/db")>();
  return { ...mod, getClient: vi.fn(() => cliente), historico: vi.fn(mod.historico) };
});
vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

const SENHA = "s".repeat(24);
const SEGREDO = "segredo-de-assinatura-do-teste-endereco-tela";
const A = "lugar-marcador-bom-marcador";
const B = "lugar-marcador-outra-marcadora";
const T0 = 1_759_200_000;

async function comSessaoValida() {
  const { criarSessao, DURACAO_SESSAO_S } = await import("@/lib/admin-sessao");
  const token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  cookiesFalso.mockResolvedValue({ get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined) });
}

async function abrir(slug: string) {
  const { default: Lugar } = await import("@/app/admin/[slug]/page");
  return Lugar({ params: Promise.resolve({ slug }) });
}

beforeEach(async () => {
  notFoundFalso.mockClear();
  redirectFalso.mockClear();
  cookiesFalso.mockReset();
  vi.unstubAllEnvs();
  cliente = bancoVazio();
  await semearAcervo(cliente);
  const { gravarVersao } = await import("@/lib/db");
  // O caso dele: nasceu em "Bom Marcador", a cidade foi corrigida pra "Outra Marcadora".
  await gravarVersao(cliente, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Bom Marcador")), "painel", T0);
  await gravarVersao(cliente, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", T0 + 1);
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  const { resolverEstado } = await import("@/lib/carimbo-estado");
  vi.mocked(resolverEstado).mockResolvedValue({ estado: "fresco", erro: false, calculadoEm: 0, aviso: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("/admin/[slug] — o endereço e o aviso", () => {
  it("o caso dele: mostra o endereço, avisa a cidade velha e oferece o de agora", async () => {
    await comSessaoValida();
    const { container } = render(await abrir(A));
    const bloco = container.querySelector<HTMLElement>("[data-endereco]");
    expect(bloco, "o endereço sumiu da tela").not.toBeNull();
    expect(within(bloco!).getByText(A)).toBeTruthy();
    expect(within(bloco!).getByText(aindaDiz("bom-marcador"))).toBeTruthy();
    expect(within(bloco!).getByRole("button", { name: trocarPara(B) })).toBeTruthy();
  });

  it("lugar que só GANHOU cidade (nunca teve outra): o endereço aparece, sem aviso e sem botão", async () => {
    const { gravarVersao } = await import("@/lib/db");
    const S = "lugar-marcador-de-antes";
    await gravarVersao(cliente, S, JSON.stringify(lugarMarcador(S, "Lugar Marcador", undefined)), "semente", T0);
    await gravarVersao(cliente, S, JSON.stringify(lugarMarcador(S, "Lugar Marcador", "Cidade Marcadora")), "painel", T0 + 1);
    await comSessaoValida();
    const { container } = render(await abrir(S));
    const bloco = container.querySelector<HTMLElement>("[data-endereco]")!;
    expect(within(bloco).getByText(S)).toBeTruthy();
    expect(within(bloco).queryByText(/ainda diz/)).toBeNull();
    // I8: nada de botão solto — é o desenho que ele viu.
    expect(within(bloco).queryByRole("button")).toBeNull();
  });

  it("lugar sem cidade: o endereço aparece, sem aviso e sem botão", async () => {
    await comSessaoValida();
    const { container } = render(await abrir("rampa-do-pepe"));
    const bloco = container.querySelector<HTMLElement>("[data-endereco]")!;
    expect(within(bloco).getByText("rampa-do-pepe")).toBeTruthy();
    expect(within(bloco).queryByRole("button")).toBeNull();
  });

  it("histórico que não foi lido: sem aviso (o painel cala em vez de supor)", async () => {
    const { historico } = await import("@/lib/db");
    vi.mocked(historico).mockRejectedValue(new Error("banco fora"));
    await comSessaoValida();
    const { container } = render(await abrir(A));
    const bloco = container.querySelector<HTMLElement>("[data-endereco]")!;
    expect(within(bloco).getByText(A)).toBeTruthy();
    expect(within(bloco).queryByText(/ainda diz/)).toBeNull();
    expect(within(bloco).queryByRole("button")).toBeNull();
  });

  it("depois da troca: a linha do ato no histórico mostra o endereço velho", async () => {
    const { trocarEndereco } = await import("@/lib/db");
    await trocarEndereco(cliente, A, B, T0 + 5);
    await comSessaoValida();
    const { container } = render(await abrir(B));
    const hist = container.querySelector<HTMLElement>("[data-historico]")!;
    expect(within(hist).getAllByText(enderecoTrocado(A))).toHaveLength(1);
    // E o endereço novo é o do nome e da cidade: sem aviso.
    expect(within(container.querySelector<HTMLElement>("[data-endereco]")!).queryByRole("button")).toBeNull();
  });
});

describe("/admin/[slug] — o endereço velho leva ao painel novo (M5)", () => {
  it("com sessão: redireciona pro painel do endereço novo", async () => {
    const { trocarEndereco } = await import("@/lib/db");
    await trocarEndereco(cliente, A, B, T0 + 5);
    await comSessaoValida();
    await expect(abrir(A)).rejects.toThrow(`NEXT_REDIRECT /admin/${B}`);
    expect(notFoundFalso).not.toHaveBeenCalled();
  });

  it("lugar ESCONDIDO também (esconder é tirar do público, não do dono)", async () => {
    const { gravarVersao, trocarEndereco, versaoAtual } = await import("@/lib/db");
    await trocarEndereco(cliente, A, B, T0 + 5);
    await gravarVersao(cliente, B, (await versaoAtual(cliente, B))!.doc, "painel", T0 + 6, true);
    await comSessaoValida();
    await expect(abrir(A)).rejects.toThrow(`NEXT_REDIRECT /admin/${B}`);
  });

  it("sem sessão: a caixa de senha, e não revela pra onde o endereço leva", async () => {
    const { trocarEndereco } = await import("@/lib/db");
    await trocarEndereco(cliente, A, B, T0 + 5);
    cookiesFalso.mockResolvedValue({ get: () => undefined });
    render(await abrir(A));
    expect(redirectFalso).not.toHaveBeenCalled();
  });

  it("endereço que nunca existiu: 404, sem redirect", async () => {
    await comSessaoValida();
    await expect(abrir("lugar-que-nao-existe-marcador")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(redirectFalso).not.toHaveBeenCalled();
  });
});

describe("o botão de trocar: dois toques", () => {
  it("o primeiro toque só pergunta; o segundo manda {slug} e vai pro painel novo", async () => {
    const BotaoTrocarEndereco = (await import("@/app/admin/BotaoTrocarEndereco")).default;
    const chamadas: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        chamadas.push({ url, init });
        return Promise.resolve(new Response(JSON.stringify({ slug: B }), { status: 200 }));
      }),
    );
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });

    render(<BotaoTrocarEndereco slug={A} sugerido={B} />);
    fireEvent.click(screen.getByRole("button", { name: trocarPara(B) }));
    expect(chamadas, "o primeiro toque já trocou").toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: TROCAR_MESMO }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(`/admin/${B}`));
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("/api/admin/endereco");
    expect(chamadas[0].init?.method).toBe("POST");
    // I6: o corpo leva SÓ o slug — o endereço novo é conta do servidor.
    expect(JSON.parse(String(chamadas[0].init?.body))).toEqual({ slug: A });
  });

  it("a recusa mostra a frase da porta, e não sai da tela", async () => {
    const BotaoTrocarEndereco = (await import("@/app/admin/BotaoTrocarEndereco")).default;
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("frase marcadora da recusa", { status: 409 }))));
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });

    render(<BotaoTrocarEndereco slug={A} sugerido={B} />);
    fireEvent.click(screen.getByRole("button", { name: trocarPara(B) }));
    fireEvent.click(screen.getByRole("button", { name: TROCAR_MESMO }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "frase marcadora da recusa");
    expect(assign).not.toHaveBeenCalled();
  });
});
