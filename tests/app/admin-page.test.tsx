import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import CaixaDeSenha from "@/app/admin/CaixaDeSenha";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import type { Client } from "@libsql/client";
import { bancoVazio, semearAcervo, semearLugarDaPessoa } from "../banco";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("CaixaDeSenha", () => {
  it("mostra um campo de senha, e ele é do tipo password", () => {
    const { container } = render(<CaixaDeSenha />);
    const campo = container.querySelector('input[type="password"]');
    expect(campo, "a senha do painel nao pode ser um campo de texto aberto").not.toBeNull();
  });

  // 🔴 A senha NUNCA pode virar query string: ela entraria no log do servidor,
  // no histórico do navegador e no Referer de qualquer link seguinte.
  it("a senha vai no CORPO de um POST, nunca na URL", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    // r.ok dispara location.reload(); jsdom não implementa navegação de
    // verdade e poluiria o stderr com "Not implemented: navigation" — o
    // componente não escolhe PARA ONDE ir, só recarrega, então travar a
    // chamada em si (sem navegar) não abre mão de nada que este teste prova.
    const recarregar = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    const { container } = render(<CaixaDeSenha />);
    const campo = container.querySelector('input[type="password"]') as HTMLInputElement;
    const { fireEvent, waitFor } = await import("@testing-library/react");
    fireEvent.change(campo, { target: { value: "uma-senha-qualquer" } });
    fireEvent.submit(container.querySelector("form")!);
    // O `waitFor` do testing-library (não o do vitest) embrulha cada
    // repique em `act(...)` — é o que faz o `setIndo(false)` do `finally`
    // assentar sem sair pro stderr como update fora de act.
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(String(url)).not.toContain("uma-senha-qualquer");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("uma-senha-qualquer");
  });

  it("senha recusada vira recado na tela, e o campo continua lá", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { container } = render(<CaixaDeSenha />);
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "x" } });
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Senha não confere.")).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
  });
});

// 🔴 M3/M4 do plano de mutação pedem teste PRÓPRIO, escrito nesta tarefa: a
// página é um Server Component (usa `cookies()` de next/headers e
// `notFound()` de next/navigation), então os dois módulos são mockados pra
// poder importar `@/app/admin/page` fora do runtime do Next.
const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const cookiesFalso = vi.fn();

vi.mock("next/navigation", () => ({ notFound: notFoundFalso }));
vi.mock("next/headers", () => ({ cookies: cookiesFalso }));

function semCookie() {
  cookiesFalso.mockResolvedValue({ get: () => undefined });
}

describe("/admin — a página", () => {
  beforeEach(() => {
    notFoundFalso.mockClear();
    cookiesFalso.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  // 🔴 M3: apagar o notFound() da página. Não basta provar "não renderizou
  // nada" — isso também passaria se o componente quebrasse por outro motivo
  // (ausência de texto mascarando o sumiço do elemento). A prova tem que ser
  // que `notFound()` foi CHAMADO, com o painel desligado (env vazio).
  it("com o painel desligado (env vazio), a página CHAMA notFound()", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.stubEnv("ADMIN_SEGREDO", "");
    semCookie();
    const { default: Admin } = await import("@/app/admin/page");
    await expect(Admin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundFalso).toHaveBeenCalledTimes(1);
  });

  // 🔴 M4: apagar o metadata de robots. Trava os DOIS campos — só a
  // existência do objeto não bastaria pra travar um `{ index: true }` solto.
  it("o metadata da página tira o painel do índice — index e follow, os dois false", async () => {
    const { metadata } = await import("@/app/admin/page");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  // 🔴 I4 DA REVISÃO FINAL (2026-09-16): falha fechada vence "motivo na tela".
  // O 404 fica; o motivo vai pro `console.warn` do servidor — e só quando é
  // ENGANO (senha curta). Sem ADMIN_SENHA é o estado normal: nada no log.
  it("com ADMIN_SENHA curta, a página continua 404 — e avisa o motivo no log, uma vez", async () => {
    vi.stubEnv("ADMIN_SENHA", "curta");
    vi.stubEnv("ADMIN_SEGREDO", "x");
    semCookie();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { default: Admin } = await import("@/app/admin/page");
    await expect(Admin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("senha-curta");
  });

  it("sem ADMIN_SENHA, a página é 404 SEM avisar nada — ausente é o normal", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.stubEnv("ADMIN_SEGREDO", "");
    semCookie();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { default: Admin } = await import("@/app/admin/page");
    await expect(Admin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(warn).not.toHaveBeenCalled();
  });
});

// 🔴 I3 DA REVISÃO FINAL (2026-09-16): a spec diz que a PÁGINA exige o
// cookie, e nada provava. Inverter o `if (!dentro)` entregava a lista (o
// acervo, o estado de cada lugar) a qualquer um — a API ainda recusaria, mas
// a tela já teria mostrado o que só o dono vê. Os dois lados da porta, com a
// sessão de verdade (`criarSessao`), e não um mock da guarda.
vi.mock("@/lib/carimbo-estado", () => ({ resolverEstados: vi.fn() }));

// 🔴 O DUBLÊ DO BANCO FICOU PARCIAL EM 2026-09-25: a página lê o acervo do
// BANCO (`getAllFichas` virou `async`), então ela precisa da leitura do acervo de
// verdade (`lerAcervoComOrigem` desde 07/10) — com o dublê total de antes, a lista estouraria antes de mostrar
// coisa nenhuma, e o teste da porta morreria por um motivo que não é a porta.
// `avisosVigentes` saiu do dublê na Task 5 (2026-09-25): a lista não lê mais
// os avisos vigentes do acervo inteiro — isso virou responsabilidade de
// `/admin/<slug>`, medida em `tests/app/admin-lugar.test.tsx`.
let cliente: Client;
vi.mock("@/lib/db", async (real) => ({
  ...(await real<typeof import("@/lib/db")>()),
  getClient: vi.fn(() => cliente),
}));

describe("/admin — a porta", () => {
  const SENHA = "s".repeat(24);
  const SEGREDO = "segredo-de-assinatura-do-teste";

  beforeEach(async () => {
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
  });
  afterEach(() => vi.unstubAllEnvs());

  it("ligado e SEM cookie: a caixa de senha, e nada da lista", async () => {
    semCookie();
    const { default: Admin } = await import("@/app/admin/page");
    const { container } = render(await Admin());
    expect(container.querySelector('input[type="password"]'), "a caixa de senha sumiu").not.toBeNull();
    expect(container.querySelector(".adm-lista"), "a lista apareceu sem cookie").toBeNull();
    expect(notFoundFalso).not.toHaveBeenCalled();
  });

  it("ligado e com cookie VÁLIDO: a lista, e nenhuma caixa de senha", async () => {
    const { criarSessao, DURACAO_SESSAO_S } = await import("@/lib/admin-sessao");
    const token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
    cookiesFalso.mockResolvedValue({ get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined) });
    const { default: Admin } = await import("@/app/admin/page");
    const { container } = render(await Admin());
    expect(container.querySelector(".adm-lista"), "a lista não apareceu com a sessão boa").not.toBeNull();
    expect(container.querySelector('input[type="password"]'), "a caixa de senha ficou na tela da lista").toBeNull();
  });

  // Cookie com assinatura de OUTRO segredo é o mesmo que nenhum: a porta não
  // abre por um token que parece sessão. Sem este, um `sessaoValida` que só
  // conferisse a forma do token passaria os dois de cima.
  it("ligado e com cookie de outro segredo: a caixa de senha, não a lista", async () => {
    const { criarSessao, DURACAO_SESSAO_S } = await import("@/lib/admin-sessao");
    const token = criarSessao("outro-segredo", Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
    cookiesFalso.mockResolvedValue({ get: () => ({ value: token }) });
    const { default: Admin } = await import("@/app/admin/page");
    const { container } = render(await Admin());
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(container.querySelector(".adm-lista")).toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 🔴 B1 DA AUDITORIA DA TASK 9 (2026-10-01) — A PROVA É NA PÁGINA.
  //
  // Até aqui a página lia `getAllFichas()`, que passa por `versoesAtuais` SEM
  // `incluirOcultos` — o filtro do PÚBLICO. O dono escondia um lugar e ele
  // sumia da lista DELE, sem caminho de volta pela tela. O teste do componente
  // (`admin-lista.test.tsx`) entrega `ocultos` pronto e passaria verde com a
  // página ainda escondendo; por isso este roda a página inteira contra o banco.
  // ───────────────────────────────────────────────────────────────────────────
  const SLUG_ESCONDIDO = "rampa-do-pepe";

  async function esconder(slug: string) {
    const { gravarVersao, versaoAtual } = await import("@/lib/db");
    const atual = (await versaoAtual(cliente, slug))!;
    expect(atual, `a premissa: ${slug} está no banco de teste`).not.toBeNull();
    await gravarVersao(cliente, slug, atual.doc, "painel", Math.floor(Date.now() / 1000), true);
  }

  async function comSessao() {
    const { criarSessao, DURACAO_SESSAO_S } = await import("@/lib/admin-sessao");
    const token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
    cookiesFalso.mockResolvedValue({ get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined) });
  }

  it("o lugar escondido aparece na lista do dono, marcado — e os outros não", async () => {
    await esconder(SLUG_ESCONDIDO);
    await comSessao();
    const { default: Admin } = await import("@/app/admin/page");
    const { container } = render(await Admin());

    const item = container.querySelector(`[data-testid="lugar-${SLUG_ESCONDIDO}"]`) as HTMLElement | null;
    expect(item, "o lugar escondido sumiu da lista do próprio dono").not.toBeNull();
    expect(within(item!).getByText(/escondid/i)).toBeTruthy();

    const outros = [...container.querySelectorAll<HTMLElement>('[data-testid^="lugar-"]')].filter(
      (el) => el !== item,
    );
    expect(outros.length, "sem os outros lugares na lista, o laço abaixo não prova nada").toBeGreaterThan(0);
    for (const el of outros) {
      expect(within(el).queryByText(/escondid/i), `${el.dataset.testid} veio marcado sem estar escondido`).toBeNull();
    }
  });

  // 🔴 O LUGAR MANDADO POR QUEM USA, AINDA NÃO CONFERIDO, MORA SÓ NA SEÇÃO DO
  // TOPO (Task 6 da rodada de 07/10): na lista normal ele apareceria duas vezes,
  // e o que pede conferência se perderia entre os lugares do João. Roda a
  // página inteira contra o banco — o componente sozinho recebe `fichas`
  // pronto e passaria verde com a página entregando todas.
  it("o lugar não conferido sai da lista normal e entra na seção do topo", async () => {
    const slug = await semearLugarDaPessoa(cliente, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    await comSessao();
    const { default: Admin } = await import("@/app/admin/page");
    const { container } = render(await Admin());
    expect(container.querySelector('[data-testid="nao-conferidos"]')?.textContent).toContain("Pedra Mandada");
    expect(
      container.querySelectorAll('[data-testid="lugares"] [data-lugar]').length,
      "a premissa: os lugares do João continuam na lista normal",
    ).toBeGreaterThan(0);
    expect(container.querySelector(`[data-testid="lugares"] [data-lugar="${slug}"]`)).toBeNull();
  });

  // 🔴 E A HOME CONTINUA SEM ELE, DEPOIS QUE O PAINEL LEU. Nasceu (M6) contra a
  // memória do público: `getAllFichas` guardava a última leitura boa e a servia
  // com o banco fora, e um painel que lesse COM ocultos por aquele caminho a
  // carregaria com o escondido. A memória saiu em 07/10 (decisão do João, ver
  // `buscarFichas`), e o caso agora prova as duas metades do que sobrou: com o
  // banco de pé, a home lida DEPOIS do painel continua sem o lugar; com o banco
  // fora, a home ESTOURA — não serve nada de antes, muito menos o escondido.
  it("a home continua sem ele depois que o painel leu — e com o banco fora estoura", async () => {
    await esconder(SLUG_ESCONDIDO);
    await comSessao();
    const { getAllFichas } = await import("@/lib/ficha");
    const daHome = await getAllFichas();
    expect(daHome.map((f) => f.slug), "a premissa: a home lida com o banco de pé já não tem o lugar").not.toContain(
      SLUG_ESCONDIDO,
    );

    const { default: Admin } = await import("@/app/admin/page");
    render(await Admin());

    const depois = await getAllFichas();
    expect(depois.length, "a premissa: a home lida depois do painel tem lugares").toBeGreaterThan(0);
    expect(depois.map((f) => f.slug), "o painel pôs o escondido na leitura do público").not.toContain(SLUG_ESCONDIDO);

    // o banco cai: sem memória (07/10), a home estoura em vez de servir o de antes
    cliente = {
      execute: () => Promise.reject(new Error("turso fora")),
      batch: () => Promise.reject(new Error("turso fora")),
    } as unknown as Client;
    await expect(getAllFichas()).rejects.toThrow(/banco fora/);
  });
});
