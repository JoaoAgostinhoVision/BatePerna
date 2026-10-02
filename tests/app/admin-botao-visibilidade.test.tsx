import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import BotaoVisibilidade from "@/app/admin/BotaoVisibilidade";

/** O botão de esconder um lugar e de mostrá-lo de novo (Task 9, 2026-10-01).
 *  A porta é a da Task 4 (`POST /api/admin/visibilidade`, `{ slug, oculto }`),
 *  com o teste dela em `tests/api/`; aqui se prova a TELA: o corpo que sai, o
 *  recarregar (nunca estado otimista) e as palavras. */

const SLUG = "rampa-do-pepe";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("BotaoVisibilidade", () => {
  // 🔴 Esconder NÃO APAGA nada — `ficha_versoes` é append-only e esconder é uma
  // versão nova. Uma palavra de apagar na tela faria o dono hesitar diante de
  // uma ação que se desfaz com um toque, ou pior, achar que perdeu o lugar.
  // Os DOIS estados do botão, porque cada um tem a sua frase.
  it("a palavra 'apagar' não existe em tela nenhuma do painel — nos dois estados", () => {
    for (const oculto of [false, true]) {
      const { container } = render(<BotaoVisibilidade slug={SLUG} oculto={oculto} />);
      expect(container.textContent!.length, "o botão não renderizou nada").toBeGreaterThan(0);
      expect(screen.queryByText(/apagar|excluir|deletar|remover/i)).toBeNull();
      cleanup();
    }
  });

  it("no ar: o botão esconde, e manda oculto true pra porta da Task 4", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(Response.json({ id: 9 }));
    vi.stubGlobal("fetch", fetchFalso);
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    render(<BotaoVisibilidade slug={SLUG} oculto={false} />);
    expect(screen.queryByText(/escondid/i), "lugar no ar não pode vir marcado").toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /esconder/i }));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/admin/visibilidade");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ slug: SLUG, oculto: true });
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("escondido: diz que está escondido, e o botão mostra de novo (oculto false)", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(Response.json({ id: 10 }));
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });

    render(<BotaoVisibilidade slug={SLUG} oculto={true} />);
    expect(screen.getByText(/escondid/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /mostrar de novo/i }));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body)).toEqual({ slug: SLUG, oculto: false });
  });

  it("enquanto o pedido está no ar, o botão fica desabilitado", async () => {
    let liberar!: () => void;
    const pendurado = new Promise<Response>((ok) => { liberar = () => ok(Response.json({ id: 9 })); });
    const fetchFalso = vi.fn().mockReturnValue(pendurado);
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });

    render(<BotaoVisibilidade slug={SLUG} oculto={false} />);
    const botao = screen.getByRole("button") as HTMLButtonElement;
    fireEvent.click(botao);
    await waitFor(() => expect(botao.disabled).toBe(true));
    fireEvent.click(botao);
    expect(fetchFalso, "dois toques viraram dois pedidos").toHaveBeenCalledTimes(1);
    liberar();
  });

  it("recusa e rede caída viram recado na tela, e não recarregam", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 400 })));
    render(<BotaoVisibilidade slug={SLUG} oculto={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/não consegui salvar/i);
    cleanup();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("caiu")));
    render(<BotaoVisibilidade slug={SLUG} oculto={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/sem rede/i);
    expect(reload).not.toHaveBeenCalled();
  });
});
