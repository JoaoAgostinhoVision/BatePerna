import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Client } from "@libsql/client";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { criarRascunho, lerRascunho, moverRascunho } from "@/lib/db";
import { docDoLugarNovo } from "@/lib/rascunho";
import { DESISTIR, DESISTIR_MESMO, ERRO_DESISTIR } from "@/app/admin/BotaoDesistir";
import { AVISO_RASCUNHO } from "@/app/admin/FormularioDeLugar";
import { ERRO_REDE } from "@/app/admin/campos/gravar";
import { ORDEM } from "@/app/admin/novo/perguntas";
import { bancoVazio, semearAcervo } from "../banco";

/** DESISTIR DE UM LUGAR NOVO (Tarefa 15, 07/10 — o João, olhando o painel no
 *  ar: *"ficou faltando o botão de cancelar"*). Dois lugares, o mesmo botão: em
 *  toda pergunta do `/admin/novo` e em cada item de "Começados, ainda fora do
 *  ar". Dois toques, no molde do "Tirar mesmo?" do `EditorWaypoints`.
 *
 *  Molde de `admin-formulario-de-lugar.test.tsx`: a PÁGINA de verdade contra o
 *  banco `:memory:`, e o `DELETE` levado à ROTA de verdade com o cookie da
 *  sessão — "apagou" é o banco sem a linha, não um mock dizendo que apagou.
 *
 *  A outra metade da promessa — desistir NUNCA tira lugar do ar — mora em
 *  `tests/app/desistir-nao-tira-do-ar.test.tsx`, que abre a página PÚBLICA. */

const SENHA = "s".repeat(24);
const SEGREDO = "segredo-de-assinatura-do-teste-desistir";
const NOME = "Lugar Marcador Um";
const CIDADE = "Cidade Marcador Um";
const S = "lugar-marcador-um";

const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const cookiesFalso = vi.fn();
vi.mock("next/navigation", () => ({ notFound: notFoundFalso }));
vi.mock("next/headers", () => ({ cookies: cookiesFalso }));
vi.mock("@/lib/carimbo-estado", () => ({ resolverEstados: vi.fn() }));

let cliente: Client;
vi.mock("@/lib/db", async (real) => ({
  ...(await real<typeof import("@/lib/db")>()),
  getClient: vi.fn(() => cliente),
}));

let token: string;

beforeEach(async () => {
  // Nenhum teste daqui sai pra rede: o `fetch` padrão recusa tudo — menos a
  // busca de cidade que a PÁGINA (servidor) faz nas perguntas de mapa sem
  // ponto, que aqui responde "fora do ar" (a vista cai no acervo).
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("https://geocoding-api.open-meteo.com/")) return new Response("", { status: 503 });
      throw new Error(`fetch sem dublê neste teste: ${url}`);
    }),
  );
  cliente = bancoVazio();
  await semearAcervo(cliente);
  notFoundFalso.mockClear();
  cookiesFalso.mockReset();
  vi.unstubAllEnvs();
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  const { resolverEstados } = await import("@/lib/carimbo-estado");
  vi.mocked(resolverEstados).mockResolvedValue(new Map());
  token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  cookiesFalso.mockResolvedValue({ get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined) });
  expect(await criarRascunho(cliente, S, docDoLugarNovo(S, NOME, CIDADE), 1)).toBe(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function paginaNovo(slug?: string, p?: string) {
  const { default: Novo } = await import("@/app/admin/novo/page");
  const params: { slug?: string; p?: string } = {};
  if (slug !== undefined) params.slug = slug;
  if (p !== undefined) params.p = p;
  return render(await Novo({ searchParams: Promise.resolve(params) }));
}

async function paginaAdmin() {
  const { default: Admin } = await import("@/app/admin/page");
  return render(await Admin());
}

/** O `fetch` que leva o pedido à ROTA de verdade, com o cookie da sessão, no
 *  mesmo banco. Guarda o que a TELA mandou. */
async function comRotaDeVerdade() {
  const rota = await import("@/app/api/admin/rascunho/route");
  const chamadas: { url: string; metodo: string; corpo: Record<string, unknown> }[] = [];
  const fetchFalso = vi.fn(async (url: string, init: { method: string; body: string }) => {
    chamadas.push({ url, metodo: init.method, corpo: JSON.parse(init.body) });
    const req = new Request(`http://x${url}`, {
      method: init.method,
      headers: { cookie: `${COOKIE_ADMIN}=${token}` },
      body: init.body,
    });
    return rota[init.method as "PUT" | "POST" | "DELETE"](req);
  });
  vi.stubGlobal("fetch", fetchFalso);
  const reload = vi.fn();
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload, assign });
  return { fetchFalso, chamadas, reload, assign };
}

/** O `fetch` que responde sempre a mesma coisa (ou estoura, pra rede). */
function comResposta(resposta: () => Promise<Response>) {
  const fetchFalso = vi.fn(async (_url: string, _init: { method: string; body: string }) => resposta());
  vi.stubGlobal("fetch", fetchFalso);
  const reload = vi.fn();
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload, assign });
  return { fetchFalso, reload, assign };
}

const tocar = (onde: HTMLElement, nome: string): void => {
  fireEvent.click(within(onde).getByRole("button", { name: nome }));
};

const formulario = (container: HTMLElement): HTMLElement => container.querySelector<HTMLElement>(".adm-novo")!;
const itemDaLista = (): HTMLElement =>
  screen.getByTestId("rascunhos").querySelector<HTMLElement>(`[data-rascunho="${S}"]`)!;

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo — desistir do lugar novo", () => {
  it("o 1º toque só pergunta — nenhuma ida à porta, e o rascunho continua no banco", async () => {
    const { fetchFalso, assign, reload } = await comRotaDeVerdade();
    const { container } = await paginaNovo(S, "1");
    const aqui = formulario(container);
    tocar(aqui, DESISTIR);
    expect(within(aqui).getByRole("button", { name: DESISTIR_MESMO })).toBeTruthy();
    expect(within(aqui).queryByRole("button", { name: DESISTIR }), "o 1º toque não trocou a pergunta").toBeNull();
    expect(fetchFalso, "o 1º toque já mandou apagar").not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(await lerRascunho(cliente, S)).not.toBeNull();
  });

  it("o 2º toque manda DELETE com o slug DESTE rascunho, o rascunho some do banco, e a tela volta ao painel", async () => {
    // 🔴 Dois rascunhos: o slug errado apagaria o OUTRO, e só a dupla distingue.
    const OUTRO = "lugar-marcador-dois";
    expect(await criarRascunho(cliente, OUTRO, docDoLugarNovo(OUTRO, "Lugar Marcador Dois", CIDADE), 1)).toBe(true);
    const { chamadas, assign, reload } = await comRotaDeVerdade();
    const { container } = await paginaNovo(S, "1");
    const aqui = formulario(container);
    tocar(aqui, DESISTIR);
    tocar(aqui, DESISTIR_MESMO);
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(chamadas).toEqual([{ url: "/api/admin/rascunho", metodo: "DELETE", corpo: { slug: S } }]);
    expect(assign).toHaveBeenCalledWith("/admin");
    expect(reload).not.toHaveBeenCalled();
    expect(await lerRascunho(cliente, S), "o rascunho continua no banco").toBeNull();
    expect(await lerRascunho(cliente, OUTRO), "apagou o rascunho de OUTRO lugar").not.toBeNull();
  });

  it("o botão está em TODA pergunta, perto do aviso de rascunho", async () => {
    for (let n = 1; n <= ORDEM.length; n++) {
      const { container } = await paginaNovo(S, String(n));
      const aqui = formulario(container);
      expect(within(aqui).getByText(AVISO_RASCUNHO), `a premissa: a tela ${n} é do formulário`).toBeTruthy();
      expect(within(aqui).queryAllByRole("button", { name: DESISTIR }), `a tela ${n} sem o desistir`).toHaveLength(1);
      cleanup();
    }
  });

  it("a tela do nome e da cidade (ainda sem rascunho) não tem o botão", async () => {
    await paginaNovo();
    expect(screen.getAllByRole("textbox"), "a premissa: é a tela do nome e da cidade").toHaveLength(2);
    expect(screen.queryByRole("button", { name: DESISTIR })).toBeNull();
    expect(screen.queryByRole("button", { name: DESISTIR_MESMO })).toBeNull();
  });

  it("a porta recusa: a frase na tela, a pergunta continua, e nada navega", async () => {
    const { fetchFalso, assign, reload } = comResposta(async () => new Response("", { status: 401 }));
    const { container } = await paginaNovo(S, "1");
    const aqui = formulario(container);
    tocar(aqui, DESISTIR);
    tocar(aqui, DESISTIR_MESMO);
    expect((await within(aqui).findByRole("alert")).textContent).toBe(ERRO_DESISTIR);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(within(aqui).getByText(AVISO_RASCUNHO)).toBeTruthy();
    expect(await lerRascunho(cliente, S)).not.toBeNull();
  });

  it("sem rede: 'Sem rede.' na tela, a pergunta continua, e nada navega", async () => {
    const { fetchFalso, assign, reload } = comResposta(async () => {
      throw new TypeError("Failed to fetch");
    });
    const { container } = await paginaNovo(S, "1");
    const aqui = formulario(container);
    tocar(aqui, DESISTIR);
    tocar(aqui, DESISTIR_MESMO);
    expect((await within(aqui).findByRole("alert")).textContent).toBe(ERRO_REDE);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("o rascunho mudou de endereço noutra aba: o DELETE no velho é 404, nada some, a frase na tela, e nada navega", async () => {
    // M1 da revisão da Tarefa 15. A tela abriu no endereço S; noutra aba o nome
    // mudou e o rascunho foi pra outro endereço (o que o PUT do nome faz).
    const { chamadas, assign, reload } = await comRotaDeVerdade();
    const { container } = await paginaNovo(S, "1");
    const aqui = formulario(container);
    const NOVO = "lugar-marcador-movido";
    expect(await moverRascunho(cliente, S, NOVO, (await lerRascunho(cliente, S))!.doc, 2)).toBe(true);
    tocar(aqui, DESISTIR);
    tocar(aqui, DESISTIR_MESMO);
    expect((await within(aqui).findByRole("alert")).textContent).toBe(ERRO_DESISTIR);
    expect(chamadas).toEqual([{ url: "/api/admin/rascunho", metodo: "DELETE", corpo: { slug: S } }]);
    expect(assign, "a tela voltou ao painel como se tivesse desistido").not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(await lerRascunho(cliente, NOVO), "o rascunho movido sumiu").not.toBeNull();
    expect(within(aqui).getByText(AVISO_RASCUNHO)).toBeTruthy();
  });

  it("dois toques no 'Desistir mesmo?' antes de a tela redesenhar: UMA ida à porta só", async () => {
    // M2 da revisão da Tarefa 15. Os dois cliques no MESMO `act`: o 2º chega
    // com a tela ainda sem o `disabled` e com o estado da renderização de antes
    // — é a trava de dentro do botão que o segura, não o atributo.
    let soltar: (r: Response) => void = () => {};
    const { fetchFalso } = comResposta(() => new Promise<Response>((ok) => (soltar = ok)));
    const { container } = await paginaNovo(S, "1");
    const aqui = formulario(container);
    tocar(aqui, DESISTIR);
    const mesmo = within(aqui).getByRole("button", { name: DESISTIR_MESMO });
    act(() => {
      mesmo.click();
      mesmo.click();
    });
    await act(async () => {
      soltar(new Response("", { status: 401 }));
    });
    expect(fetchFalso, "o duplo toque mandou dois DELETE").toHaveBeenCalledTimes(1);
    expect(within(aqui).getByRole("alert").textContent).toBe(ERRO_DESISTIR);
    // E a trava se SOLTA quando a porta responde: depois da recusa, um novo
    // toque tenta de novo — trava presa deixaria o botão mudo pra sempre.
    tocar(aqui, DESISTIR_MESMO);
    await act(async () => {
      soltar(new Response("", { status: 401 }));
    });
    expect(fetchFalso, "depois da recusa, o toque de novo não foi à porta").toHaveBeenCalledTimes(2);
  });

  it("as frases de recusa são DIFERENTES — sem isso as duas asserções acima não distinguiriam caminho nenhum", () => {
    expect(ERRO_DESISTIR).not.toBe(ERRO_REDE);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin — desistir de um rascunho da lista", () => {
  it("o botão mora no item do rascunho, ao lado do publicar — e em nenhum lugar no ar", async () => {
    const { container } = await paginaAdmin();
    expect(within(itemDaLista()).getAllByRole("button", { name: DESISTIR })).toHaveLength(1);
    const lugares = container.querySelector<HTMLElement>('[data-testid="lugares"]')!;
    expect(within(lugares).getAllByRole("link").length, "a premissa: os lugares no ar estão lá").toBeGreaterThan(1);
    expect(within(lugares).queryByRole("button", { name: DESISTIR }), "desistir apareceu num lugar NO AR").toBeNull();
  });

  it("1º toque pergunta e não manda nada; 2º manda DELETE com o slug do ITEM, apaga, e a lista se relê do banco", async () => {
    const OUTRO = "lugar-marcador-dois";
    expect(await criarRascunho(cliente, OUTRO, docDoLugarNovo(OUTRO, "Lugar Marcador Dois", CIDADE), 1)).toBe(true);
    const { fetchFalso, chamadas, reload, assign } = await comRotaDeVerdade();
    await paginaAdmin();
    const item = itemDaLista();
    tocar(item, DESISTIR);
    expect(fetchFalso, "o 1º toque já mandou apagar").not.toHaveBeenCalled();
    tocar(item, DESISTIR_MESMO);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(chamadas).toEqual([{ url: "/api/admin/rascunho", metodo: "DELETE", corpo: { slug: S } }]);
    expect(assign).not.toHaveBeenCalled();
    expect(await lerRascunho(cliente, S)).toBeNull();
    expect(await lerRascunho(cliente, OUTRO)).not.toBeNull();
    // e relida (o que o `reload` faria), a lista não o tem mais
    cleanup();
    await paginaAdmin();
    expect(screen.getByTestId("rascunhos").querySelector(`[data-rascunho="${S}"]`)).toBeNull();
  });

  it("a porta recusa: a frase no ITEM, e ele continua na lista", async () => {
    const { reload } = comResposta(async () => new Response("", { status: 400 }));
    await paginaAdmin();
    const item = itemDaLista();
    tocar(item, DESISTIR);
    tocar(item, DESISTIR_MESMO);
    expect((await within(item).findByRole("alert")).textContent).toBe(ERRO_DESISTIR);
    expect(reload).not.toHaveBeenCalled();
    expect(itemDaLista()).toBeTruthy();
  });
});
