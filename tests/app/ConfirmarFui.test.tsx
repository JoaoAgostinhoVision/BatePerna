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
    fireEvent.click(screen.getByRole("button", { name: /Tava ruim/ }));

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
    fireEvent.click(screen.getByRole("button", { name: /Deu pra ir/ }));
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

// 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-08-27). A pergunta do "✓ Fui"
// carregava as TRÊS suposições que o carimbo já tinha perdido no mesmo dia — e
// sobreviveu porque o levantamento olhou só `Carimbo.tsx` e `SeloTrilha.tsx`.
// Aqui era pior que no selo: quem volta de uma trilha de asfalto não teria
// botão que sirva pra reportar.
describe("o '✓ Fui' não supõe nada sobre o lugar", () => {
  async function abrirPergunta() {
    mockFetch([{ foram: 0, barro: 0 }]);
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
  }

  it("a pergunta e as duas saídas não falam em portão, subir nem barro", async () => {
    await abrirPergunta();
    const perg = document.querySelector(".perg");
    expect(perg, "o bloco da pergunta sumiu — a ausência abaixo seria vácua").not.toBeNull();
    const texto = perg!.textContent ?? "";
    // Igualdade na frase inteira, e não só ausência: sem ela, um bloco vazio
    // passaria nas três negações de baixo.
    expect(texto).toBe("E como estava o chão?Deu pra irTava ruim");
    for (const suposicao of [/portão/i, /sub(a|ir|e)/i, /barro/i]) {
      expect(texto, `o '✓ Fui' voltou a supor: ${suposicao}`).not.toMatch(suposicao);
    }
  });

  // 🔴 "achou ruim" lê-se em português como *não gostei* — outra coisa. É a
  // lição da frase invertida da Pedra Furada: ler o que a frase AFIRMA antes de
  // escrevê-la. E o verbo concorda, como o "foi/foram" ao lado.
  it("o placar diz 'achou O CHÃO ruim', e o verbo concorda", async () => {
    mockFetch([{ foram: 3, barro: 1 }]);
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    expect((await screen.findByText(/Hoje:/)).textContent).toBe("Hoje: 3 foram · 1 achou o chão ruim");
    cleanup();

    mockFetch([{ foram: 4, barro: 2 }]);
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    expect((await screen.findByText(/Hoje:/)).textContent).toBe("Hoje: 4 foram · 2 acharam o chão ruim");
  });

  // O enum gravado no banco NÃO mudou junto com o rótulo — trocá-lo seria
  // migração de dado. Este teste é o que impede alguém de "consertar" a
  // divergência renomeando o valor e quebrando as linhas já gravadas.
  it("'Tava ruim' continua gravando tipo 'barro' — o rótulo mudou, o dado não", async () => {
    const calls = mockFetch([{ foram: 0, barro: 0 }, { foram: 1, barro: 1 }]);
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tava ruim/ }));
    await screen.findByText(/anotado/i);
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ slug: "rampa-do-pepe", tipo: "barro" });
  });
});
