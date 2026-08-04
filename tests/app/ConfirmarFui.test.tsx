import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import ConfirmarFui from "@/app/ConfirmarFui";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
beforeEach(() => { localStorage.clear(); });

function mockFetch(seq: Array<unknown>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let i = 0;
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(seq[i++]) });
  }));
  return calls;
}

describe("ConfirmarFui", () => {
  it("carrega placar, clica Fui, escolhe barro, mostra agradecimento e placar novo", async () => {
    const calls = mockFetch([{ foram: 2, barro: 0 }, { foram: 3, barro: 1 }]);
    render(<ConfirmarFui slug="rampa-do-pepe" />);

    // placar inicial
    await screen.findByText(/2 foram/);

    // CTA
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    // pergunta + opções
    screen.getByText(/como estava/i);
    fireEvent.click(screen.getByRole("button", { name: /Tava barro/ }));

    // agradecimento + placar atualizado
    await screen.findByText(/anotado/i);
    await screen.findByText(/3 foram/);
    expect(calls[1].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ slug: "rampa-do-pepe", tipo: "barro" });
  });

  it("erro no POST mostra mensagem e não trava", async () => {
    let i = 0;
    vi.stubGlobal("fetch", vi.fn(() => {
      i++;
      if (i === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve({ foram: 0, barro: 0 }) });
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }));
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deu pra subir/ }));
    await screen.findByText(/tenta de novo/i);
  });

  it("já contou hoje (localStorage) + GET do mount falha: mostra Valeu, não mostra placar vazio contraditório", async () => {
    const OFFSET = -3 * 3600;
    const diaRecife = Math.floor((Date.now() / 1000 + OFFSET) / 86400);
    localStorage.setItem(`bp:contou:rampa-do-pepe:${diaRecife}`, "1");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })));

    render(<ConfirmarFui slug="rampa-do-pepe" />);

    await screen.findByText(/anotado/i);
    expect(screen.queryByText(/Ninguém contou/)).toBe(null);
  });
});
