import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import CaixaDeSenha from "@/app/admin/CaixaDeSenha";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";

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

});

// 🔴 I3 DA REVISÃO FINAL (2026-09-16): a spec diz que a PÁGINA exige o
// cookie, e nada provava. Inverter o `if (!dentro)` entregava o painel
// (fichas, avisos vigentes, "Tirar"/"Publicar") a qualquer um — a API ainda
// recusaria, mas a tela já teria mostrado o que só o dono vê. Os dois lados
// da porta, com a sessão de verdade (`criarSessao`), e não um mock da guarda.
vi.mock("@/lib/carimbo-estado", () => ({ resolverEstados: vi.fn() }));
vi.mock("@/lib/db", () => ({ avisosVigentes: vi.fn(), getClient: vi.fn(() => ({})) }));

describe("/admin — a porta", () => {
  const SENHA = "s".repeat(24);
  const SEGREDO = "segredo-de-assinatura-do-teste";

  beforeEach(async () => {
    notFoundFalso.mockClear();
    cookiesFalso.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_SENHA", SENHA);
    vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
    vi.resetModules();
    const { resolverEstados } = await import("@/lib/carimbo-estado");
    const { avisosVigentes } = await import("@/lib/db");
    vi.mocked(resolverEstados).mockResolvedValue(new Map());
    vi.mocked(avisosVigentes).mockResolvedValue(new Map());
  });
  afterEach(() => vi.unstubAllEnvs());

  it("ligado e SEM cookie: a caixa de senha, e nada do painel", async () => {
    semCookie();
    const { default: Admin } = await import("@/app/admin/page");
    const { container } = render(await Admin());
    expect(container.querySelector('input[type="password"]'), "a caixa de senha sumiu").not.toBeNull();
    expect(container.querySelector(".adm-painel"), "o painel apareceu sem cookie").toBeNull();
    expect(notFoundFalso).not.toHaveBeenCalled();
  });

  it("ligado e com cookie VÁLIDO: o painel, e nenhuma caixa de senha", async () => {
    const { criarSessao, DURACAO_SESSAO_S } = await import("@/lib/admin-sessao");
    const token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
    cookiesFalso.mockResolvedValue({ get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined) });
    const { default: Admin } = await import("@/app/admin/page");
    const { container } = render(await Admin());
    expect(container.querySelector(".adm-painel"), "o painel não apareceu com a sessão boa").not.toBeNull();
    expect(container.querySelector('input[type="password"]'), "a caixa de senha ficou na tela do painel").toBeNull();
  });

  // Cookie com assinatura de OUTRO segredo é o mesmo que nenhum: a porta não
  // abre por um token que parece sessão. Sem este, um `sessaoValida` que só
  // conferisse a forma do token passaria os dois de cima.
  it("ligado e com cookie de outro segredo: a caixa de senha, não o painel", async () => {
    const { criarSessao, DURACAO_SESSAO_S } = await import("@/lib/admin-sessao");
    const token = criarSessao("outro-segredo", Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
    cookiesFalso.mockResolvedValue({ get: () => ({ value: token }) });
    const { default: Admin } = await import("@/app/admin/page");
    const { container } = render(await Admin());
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(container.querySelector(".adm-painel")).toBeNull();
  });
});
