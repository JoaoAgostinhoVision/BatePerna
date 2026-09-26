import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import EditorDeVoz from "@/app/admin/EditorDeVoz";
import { getAllFichas } from "@/lib/ficha";
import { bancoDeProducao } from "../banco";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

await bancoDeProducao();
const fichas = await getAllFichas();

describe("EditorDeVoz", () => {
  it("mostra a voz atual da ficha no campo", () => {
    const f = fichas[0];
    render(<EditorDeVoz ficha={f} />);
    expect(screen.getByDisplayValue(f.voz)).not.toBeNull();
  });

  it("salvar manda slug, campo 'voz' e o valor novo, em PUT", async () => {
    const f = fichas[0];
    const fetchFalso = vi.fn().mockResolvedValue(Response.json({ id: 99 }));
    vi.stubGlobal("fetch", fetchFalso);
    // r.ok dispara location.reload(); jsdom não implementa navegação de
    // verdade e poluiria o stderr — mesmo ajuste que CaixaDeSenha e
    // PainelAdmin já precisaram.
    const reloadFalso = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: reloadFalso });
    const { container } = render(<EditorDeVoz ficha={f} />);
    fireEvent.change(container.querySelector(`textarea[data-voz="${f.slug}"]`)!, {
      target: { value: "a serra firmou de novo" },
    });
    fireEvent.click(container.querySelector(`button[data-salvar-voz="${f.slug}"]`)!);
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/admin/ficha");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ slug: f.slug, campo: "voz", valor: "a serra firmou de novo" });
    // 🔴 FIX ROUND 1: sem esta asserção, apagar o `location.reload()` do
    // componente e deixar só `return;` passava verde — a linha que traz a
    // tela "da fonte nova (o banco), nunca de estado otimista" não tinha prova.
    await waitFor(() => expect(reloadFalso).toHaveBeenCalledTimes(1));
  });

  it("resposta que não é ok mostra a mensagem de erro de gravação", async () => {
    const f = fichas[0];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 400 })));
    const { container } = render(<EditorDeVoz ficha={f} />);
    fireEvent.click(container.querySelector(`button[data-salvar-voz="${f.slug}"]`)!);
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toMatch(/não consegui salvar/i);
  });

  it("fetch que rejeita mostra a mensagem de erro de rede", async () => {
    const f = fichas[0];
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("falhou")));
    const { container } = render(<EditorDeVoz ficha={f} />);
    fireEvent.click(container.querySelector(`button[data-salvar-voz="${f.slug}"]`)!);
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toMatch(/sem rede/i);
  });
});
