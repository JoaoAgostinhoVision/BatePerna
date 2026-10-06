import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Client } from "@libsql/client";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { TROCAR_MESMO, trocarPara } from "@/lib/endereco";
import { ESCONDER } from "@/app/admin/campos/palavras";
import { bancoVazio, base, semearAcervo } from "../banco";
import { lugarMarcador } from "../lugar-marcador";

/** A TELA MANDA A VERSÃO QUE ABRIU, EM TODA GRAVAÇÃO (onda de fix 2 da Tarefa
 *  11e, M6). A porta só sabe de qual lugar é uma gravação pelo `baseId`; se UM
 *  botão da tela esquecer de mandá-lo, aquele botão para de gravar (400) — e se
 *  mandar o id ERRADO (o de outra versão que não a que a tela leu), a prova de
 *  identidade vira sorteio.
 *
 *  🔴 A PÁGINA DE VERDADE, os botões de verdade: os cinco caminhos que gravam
 *  (o editor de um campo, esconder, aviso, voltar, trocar o endereço) são
 *  tocados na tela montada pela página de servidor, e o corpo que sai pro
 *  `fetch` tem de levar `baseId` = a versão atual que a página leu. O lugar tem
 *  DUAS versões, pra "a versão que a tela leu" não coincidir com qualquer id. */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const cookiesFalso = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT ${url}`); }),
}));
vi.mock("next/headers", () => ({ cookies: cookiesFalso }));

let cliente: Client;
vi.mock("@/lib/db", async (real) => {
  const mod = await real<typeof import("@/lib/db")>();
  return { ...mod, getClient: vi.fn(() => cliente) };
});
vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

const SENHA = "s".repeat(24);
const SEGREDO = "segredo-de-assinatura-do-teste-aba-velha-tela";
const A = "lugar-marcador-bom-marcador";
const B = "lugar-marcador-outra-marcadora";
const T0 = 1_759_200_000;

let primeira: number;
let daTela: number;
let corpos: Array<{ url: string; corpo: Record<string, unknown> }>;

beforeEach(async () => {
  cookiesFalso.mockReset();
  vi.unstubAllEnvs();
  cliente = bancoVazio();
  await semearAcervo(cliente);
  const { gravarVersao } = await import("@/lib/db");
  // Nasceu em "Bom Marcador", a cidade foi corrigida — o que faz a tela oferecer
  // a troca de endereço, o quinto caminho.
  primeira = await gravarVersao(cliente, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Bom Marcador")), "painel", T0);
  await gravarVersao(cliente, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", T0 + 1);
  daTela = await base(cliente, A);
  expect(daTela).not.toBe(primeira);
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  const { resolverEstado } = await import("@/lib/carimbo-estado");
  vi.mocked(resolverEstado).mockResolvedValue({ estado: "fresco", erro: false, calculadoEm: 0, aviso: null });

  const { criarSessao, DURACAO_SESSAO_S } = await import("@/lib/admin-sessao");
  const token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  cookiesFalso.mockResolvedValue({ get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined) });

  corpos = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: { body: string }) => {
      corpos.push({ url, corpo: JSON.parse(init.body) });
      return Promise.resolve(Response.json({ id: 1, slug: B }));
    }),
  );
  vi.stubGlobal("location", { ...window.location, reload: vi.fn(), assign: vi.fn() });
});
afterEach(() => vi.unstubAllEnvs());

async function abrirA(): Promise<HTMLElement> {
  const { default: Lugar } = await import("@/app/admin/[slug]/page");
  return render(await Lugar({ params: Promise.resolve({ slug: A }) })).container;
}

/** O único pedido que saiu, pra `url`, levou a versão que a tela leu. */
async function levouAVersaoDaTela(url: string): Promise<void> {
  await waitFor(() => expect(corpos).toHaveLength(1));
  expect(corpos[0].url).toBe(url);
  expect(corpos[0].corpo.slug).toBe(A);
  expect(corpos[0].corpo.baseId, "o pedido saiu sem a versão que a tela abriu").toBe(daTela);
}

describe("/admin/[slug]: toda gravação leva o baseId da versão que a página leu", () => {
  it("o editor de um campo (a voz)", async () => {
    const tela = await abrirA();
    const voz = tela.querySelector<HTMLElement>('[data-testid="campo-voz"]')!;
    fireEvent.change(voz.querySelector("textarea")!, { target: { value: "Uma voz marcadora nova." } });
    fireEvent.click(voz.querySelector('[data-salvar="voz"]')!);
    await levouAVersaoDaTela("/api/admin/ficha");
  });

  it("esconder", async () => {
    await abrirA();
    fireEvent.click(screen.getByRole("button", { name: ESCONDER }));
    await levouAVersaoDaTela("/api/admin/visibilidade");
  });

  it("o aviso", async () => {
    const tela = await abrirA();
    fireEvent.change(tela.querySelector(`textarea[data-slug="${A}"]`)!, { target: { value: "aviso marcador" } });
    fireEvent.click(tela.querySelector(`button[data-publicar="${A}"]`)!);
    await levouAVersaoDaTela("/api/admin/aviso");
  });

  it("voltar a uma versão do histórico", async () => {
    const tela = await abrirA();
    fireEvent.click(tela.querySelector(`button[data-abrir-versao="${primeira}"]`)!);
    fireEvent.click(tela.querySelector(`button[data-voltar-versao="${primeira}"]`)!);
    await levouAVersaoDaTela("/api/admin/ficha");
    expect(corpos[0].corpo.versaoId).toBe(primeira);
  });

  it("trocar o endereço", async () => {
    await abrirA();
    fireEvent.click(screen.getByRole("button", { name: trocarPara(B) }));
    fireEvent.click(screen.getByRole("button", { name: TROCAR_MESMO }));
    await levouAVersaoDaTela("/api/admin/endereco");
  });
});
