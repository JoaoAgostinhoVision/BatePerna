import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import ConfirmarFui from "@/app/ConfirmarFui";
import { CHAVE_FILA, diaRecife } from "@/lib/fila-relato";

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

// 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-09-10). O `✓ Fui` é a ÚNICA porta
// pela qual conhecimento de quem foi entra neste app sem o dono escrever uma
// ficha — e ela se fechava exatamente onde a pessoa está quando tem o que
// contar: no lugar, sem sinal. O `catch` do envio pintava "tenta de novo" e o
// relato morria ali. Quem volta de 120 km de estrada é justamente quem esteve
// fora de cobertura.
describe("o relato não se perde sem sinal", () => {
  /** Rede que falha N vezes e depois funciona. Sem isto não dá pra separar
   *  "guardou" de "mandou": as duas pintam a mesma tela no primeiro quadro. */
  function redeQueVolta(falhasAntes: number, corpo: unknown = { foram: 1, barro: 0 }) {
    let n = 0;
    const posts: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          posts.push(init);
          n++;
          if (n <= falhasAntes) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(corpo) });
      }),
    );
    return posts;
  }

  const naFila = () => JSON.parse(localStorage.getItem(CHAVE_FILA) ?? "[]");

  it("POST que falha GUARDA o relato, em vez de perdê-lo", async () => {
    redeQueVolta(99);
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tava ruim/ }));

    await screen.findByText(/tenta de novo/i); // a tela continua dizendo a verdade
    expect(naFila()).toHaveLength(1);
    expect(naFila()[0]).toMatchObject({ slug: "rampa-do-pepe", tipo: "barro" });
  });

  // MUTAÇÃO: guardar DEPOIS de pintar o erro. A ordem é o teste — se a gravação
  // falhasse, a pessoa leria "tenta de novo" com o relato perdido de verdade.
  it("a tela de erro só aparece com o relato já guardado", async () => {
    redeQueVolta(99);
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deu pra ir/ }));
    await screen.findByText(/tenta de novo/i);
    expect(naFila(), "a tela de erro apareceu antes de guardar").toHaveLength(1);
  });

  it("voltando pra tela com sinal, o relato sobe sozinho e vira 'anotado'", async () => {
    const posts = redeQueVolta(1, { foram: 4, barro: 1 });
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tava ruim/ }));
    await screen.findByText(/tenta de novo/i);

    // O celular voltou pro bolso e saiu de novo — o mesmo gatilho que o carimbo
    // usa pra reler a chuva. É quando o sinal costuma ter voltado.
    document.dispatchEvent(new Event("visibilitychange"));

    await screen.findByText(/anotado/i);
    await screen.findByText(/4 foram/);
    expect(naFila(), "subiu mas continuou na fila — subiria duas vezes").toHaveLength(0);
    expect(posts).toHaveLength(2);
    expect(JSON.parse(String(posts[1].body))).toEqual({ slug: "rampa-do-pepe", tipo: "barro" });
  });

  // 🔴 Só sai da fila depois que o SERVIDOR aceitou. Remover antes seria perder
  // o relato num 500 — o defeito que esta fila existe pra impedir, de volta com
  // outra roupa.
  it("se a volta também falhar, o relato CONTINUA na fila", async () => {
    redeQueVolta(99);
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deu pra ir/ }));
    await screen.findByText(/tenta de novo/i);

    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 0));
    expect(naFila()).toHaveLength(1);
  });

  // Relato guardado antes de a tela existir — é o caso de quem fechou o app no
  // meio do mato e só reabriu na cidade.
  it("relato guardado numa sessão anterior sobe ao abrir a ficha", async () => {
    localStorage.setItem(
      CHAVE_FILA,
      JSON.stringify([{ slug: "rampa-do-pepe", tipo: "seco", dia: diaRecife(Date.now()) }]),
    );
    redeQueVolta(0, { foram: 2, barro: 0 });
    render(<ConfirmarFui slug="rampa-do-pepe" />);

    await screen.findByText(/anotado/i);
    expect(naFila()).toHaveLength(0);
  });

  // A fila é por trilha: abrir a Rampa não pode mandar o relato da cachoeira.
  it("abrir uma ficha não sobe o relato de OUTRA", async () => {
    localStorage.setItem(
      CHAVE_FILA,
      JSON.stringify([{ slug: "veu-de-noiva-de-bonito", tipo: "seco", dia: diaRecife(Date.now()) }]),
    );
    const posts = redeQueVolta(0);
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    await new Promise((r) => setTimeout(r, 0));

    expect(posts).toHaveLength(0);
    expect(naFila()).toHaveLength(1);
  });
});

// 🔴 O PLACAR AFIRMAVA O QUE NÃO PERGUNTOU, e o conserto é SUBTRAÇÃO.
// A condição era `if (!placar || placar.foram === 0)`, e os dois casos caíam na
// mesma frase. Mas `placar === null` não é zero — é "não perguntei, ou perguntei
// e não veio resposta". Com a rede fora do ar (o mesmo instante em que a fila
// acima entra em ação), a tela dizia saber que ninguém tinha ido. Não sabia.
describe("sem placar, o app CALA", () => {
  it("GET que falha não vira 'Ninguém contou ainda hoje'", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })));
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/Ninguém contou/)).toBe(null);
    expect(document.querySelector(".placar")).toBeNull();
  });

  // 🔴 O CONTROLE, e sem ele o teste de cima passaria com a linha APAGADA de
  // vez: zero de verdade continua dizendo "ninguém contou", porque aí o app
  // perguntou e sabe a resposta.
  it("mas zero de VERDADE continua convidando", async () => {
    mockFetch([{ foram: 0, barro: 0 }]);
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await screen.findByText(/Ninguém contou/);
  });
});
