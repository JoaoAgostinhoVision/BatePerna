import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import SecaoNaoConferidos, { TITULO_NAO_CONFERIDOS } from "@/app/admin/SecaoNaoConferidos";
import CaixaDaOrigem, { CONFERI, CONFERI_MESMO } from "@/app/admin/CaixaDaOrigem";
import { ComVersaoDaTela } from "@/app/admin/campos/gravar";
import { BLOQUEAR, DESBLOQUEAR } from "@/app/admin/campos/palavras";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const UM = { slug: "pedra-mandada-cidade-teste", nome: "Pedra Mandada", cidade: "Cidade Teste", mandadoEm: 1_759_800_000, quem: "Maria Teste", email: "maria@teste.invalid" };

describe("a seção dos não conferidos", () => {
  it("sem nenhum, a seção não existe — nem o título", () => {
    const { container } = render(<SecaoNaoConferidos itens={[]} />);
    expect(container.textContent).toBe("");
  });

  it("com um: título, link pro lugar no painel, nome, e-mail e data", () => {
    const { container } = render(<SecaoNaoConferidos itens={[UM]} />);
    expect(container.querySelector("h2")?.textContent).toBe(TITULO_NAO_CONFERIDOS);
    const link = container.querySelector(`a[href="/admin/${UM.slug}"]`);
    expect(link?.textContent).toContain("Pedra Mandada");
    expect(container.textContent).toContain("Maria Teste");
    expect(container.textContent).toContain("maria@teste.invalid");
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(new Date(UM.mandadoEm * 1000).toISOString());
  });

  it("quem mandou sem nome nem e-mail: a linha da pessoa cala", () => {
    const { container } = render(<SecaoNaoConferidos itens={[{ ...UM, quem: null, email: null }]} />);
    expect(container.querySelector(".adm-quem")).toBeNull();
  });
});

describe("a caixa da origem, no lugar", () => {
  it("o 'Conferi' pede o segundo toque, e só então grava, com o baseId da tela", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: UM.slug }), { status: 200 }));
    const recarregar = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    const { getByRole } = render(
      <ComVersaoDaTela id={77}>
        <CaixaDaOrigem slug={UM.slug} quem="Maria Teste" email={null} mandadoEm={UM.mandadoEm} conferido={false} contribuidor="user_x" bloqueado={false} />
      </ComVersaoDaTela>,
    );
    fireEvent.click(getByRole("button", { name: CONFERI }));
    expect(fetchFalso).not.toHaveBeenCalled();
    fireEvent.click(getByRole("button", { name: CONFERI_MESMO }));
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/admin/conferir");
    expect(JSON.parse(init.body)).toEqual({ slug: UM.slug, baseId: 77 });
  });

  // 🔴 18/10, medido em produção: o `finally` religava o botão DEPOIS do
  // `location.reload()`, enquanto a página seguinte ainda carregava.
  it("depois do 200 o botão segue desligado: a página está saindo, não voltando", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: UM.slug }), { status: 200 })));
    const recarregar = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    const { getByRole } = render(
      <CaixaDaOrigem slug={UM.slug} quem={null} email={null} mandadoEm={UM.mandadoEm} conferido={false} contribuidor="user_x" bloqueado={false} />,
    );
    fireEvent.click(getByRole("button", { name: CONFERI }));
    fireEvent.click(getByRole("button", { name: CONFERI_MESMO }));
    await waitFor(() => expect(recarregar).toHaveBeenCalledTimes(1));
    // dá a vez aos `finally`/renders pendentes antes de medir
    await new Promise((r) => setTimeout(r, 0));
    expect((getByRole("button", { name: CONFERI_MESMO }) as HTMLButtonElement).disabled).toBe(true);
  });

  // Desde a Task 15 a caixa tem o "Bloquear quem mandou" em TODO estado
  // (bloquear esconde os conferidos também): o que some com o lugar conferido
  // é só o "Conferi".
  it("lugar já conferido: a caixa diz quem mandou, sem o Conferi — e o Bloquear fica", () => {
    const { container, getAllByRole } = render(
      <CaixaDaOrigem slug={UM.slug} quem="Maria Teste" email={null} mandadoEm={UM.mandadoEm} conferido={true} contribuidor="user_x" bloqueado={false} />,
    );
    expect(container.textContent).toContain("Maria Teste");
    expect(getAllByRole("button").map((b) => b.textContent)).toEqual([BLOQUEAR]);
  });

  it("quem mandou já bloqueada: a caixa oferece o Desbloquear", () => {
    const { getAllByRole } = render(
      <CaixaDaOrigem slug={UM.slug} quem="Maria Teste" email={null} mandadoEm={UM.mandadoEm} conferido={false} contribuidor="user_x" bloqueado={true} />,
    );
    expect(getAllByRole("button").map((b) => b.textContent)).toEqual([CONFERI, DESBLOQUEAR]);
  });

  it("sem data (histórico ilegível), o <time> cala", () => {
    const { container } = render(
      <CaixaDaOrigem slug={UM.slug} quem="Maria Teste" email={null} mandadoEm={null} conferido={true} contribuidor="user_x" bloqueado={false} />,
    );
    expect(container.querySelector("time")).toBeNull();
  });

  it("409 mostra a frase da porta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Frase da porta.", { status: 409 })));
    const { getByRole, findByRole } = render(
      <CaixaDaOrigem slug={UM.slug} quem={null} email={null} mandadoEm={UM.mandadoEm} conferido={false} contribuidor="user_x" bloqueado={false} />,
    );
    fireEvent.click(getByRole("button", { name: CONFERI }));
    fireEvent.click(getByRole("button", { name: CONFERI_MESMO }));
    expect((await findByRole("alert")).textContent).toBe("Frase da porta.");
  });
});
