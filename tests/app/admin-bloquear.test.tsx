import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import BotaoBloquear from "@/app/admin/BotaoBloquear";
import { BLOQUEAR, BLOQUEAR_MESMO, DESBLOQUEAR } from "@/app/admin/campos/palavras";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("BotaoBloquear", () => {
  it("bloquear pede o segundo toque, e só então manda", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response('{"escondidos":1}', { status: 200 }));
    const recarregar = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    const { getByRole } = render(<BotaoBloquear contribuidor="user_x" bloqueado={false} />);
    fireEvent.click(getByRole("button", { name: BLOQUEAR }));
    expect(fetchFalso).not.toHaveBeenCalled();
    fireEvent.click(getByRole("button", { name: BLOQUEAR_MESMO }));
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/admin/contribuidor");
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body)).toEqual({ id: "user_x", bloquear: true });
  });

  it("bloqueada: o botão é Desbloquear, num toque só", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
    const { getByRole } = render(<BotaoBloquear contribuidor="user_x" bloqueado={true} />);
    fireEvent.click(getByRole("button", { name: DESBLOQUEAR }));
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body)).toEqual({ id: "user_x", bloquear: false });
  });
});
