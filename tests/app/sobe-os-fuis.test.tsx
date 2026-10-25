import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import SobeOsFuis from "@/app/contribuir/SobeOsFuis";
import { anotarFui, lerFuis } from "@/lib/fui-no-aparelho";

/** A área dela leva pra conta as idas anotadas no aparelho (25/10). */
function navegacaoFalsa() {
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload });
  return reload;
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe("SobeOsFuis", () => {
  it("nada anotado: não chama a rota", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    render(<SobeOsFuis />);
    await new Promise((r) => setTimeout(r, 0));
    expect(f).not.toHaveBeenCalled();
  });

  it("sobe a lista, esquece do aparelho, e recarrega uma vez quando algo entrou", async () => {
    const reload = navegacaoFalsa();
    anotarFui({ slug: "a", lugar: 7, em: 1000 });
    const f = vi.fn().mockResolvedValue(Response.json({ gravados: 1 }));
    vi.stubGlobal("fetch", f);
    render(<SobeOsFuis />);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(f.mock.calls[0][0]).toBe("/api/contribuir/fui");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ itens: [{ slug: "a", lugar: 7, em: 1000 }] });
    expect(lerFuis()).toEqual([]);
  });

  it("nada entrou (lugar que saiu do ar): esquece e não recarrega", async () => {
    const reload = navegacaoFalsa();
    anotarFui({ slug: "a", lugar: 7, em: 1000 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ gravados: 0 })));
    render(<SobeOsFuis />);
    await waitFor(() => expect(lerFuis()).toEqual([]));
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([
    ["sem rede", () => Promise.reject(new Error("sem sinal"))],
    ["sessão vencida", () => Promise.resolve(new Response("", { status: 401 }))],
    ["2xx que não é da rota", () => Promise.resolve(new Response("<html>", { status: 200 }))],
  ])("%s: a lista fica no aparelho", async (_n, resposta) => {
    const reload = navegacaoFalsa();
    anotarFui({ slug: "a", lugar: 7, em: 1000 });
    const f = vi.fn(resposta);
    vi.stubGlobal("fetch", f);
    render(<SobeOsFuis />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(lerFuis()).toHaveLength(1);
    expect(reload).not.toHaveBeenCalled();
  });
});
