import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import ConfirmarFui, { FUI_GUARDADO } from "@/app/ConfirmarFui";
import { CHAVE_FILA, CHAVE_FILA_VELHA, diaRecife } from "@/lib/fila-relato";

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
    await screen.findByText(FUI_GUARDADO);
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

    await screen.findByText(FUI_GUARDADO); // a tela continua dizendo a verdade
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
    await screen.findByText(FUI_GUARDADO);
    expect(naFila(), "a tela de erro apareceu antes de guardar").toHaveLength(1);
  });

  it("voltando pra tela com sinal, o relato sobe sozinho e vira 'anotado'", async () => {
    const posts = redeQueVolta(1, { foram: 4, barro: 1 });
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tava ruim/ }));
    await screen.findByText(FUI_GUARDADO);

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
    await screen.findByText(FUI_GUARDADO);

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

// 🔴 O ENDEREÇO TROCOU, E A FILA OFFLINE GUARDA O DE ANTES (Tarefa 11e, I1 da
// auditoria). ⚠️ DESDE A TAREFA 12b, ESTE BLOCO É O RAMO LEGADO: a tela monta
// SEM `lugar` (a página que não leu a identidade) e o relato não tem `lugar`
// (o guardado antes do deploy) — aceito como hoje (decisão do João, 06/10). Com identidade, o
// relato sobe pela página do LUGAR, em qualquer endereço, e os `antigos` não
// entram (ver "o relato carrega a identidade do lugar", abaixo). Quem contou "✓ Fui" sem sinal em /A tem `{slug: A}` na fila; se o
// dono trocar o endereço pra /B, a pessoa abre /A online, é levada pra /B, e o
// ✓ Fui monta com `slug = B`. Sem os ANTIGOS, o relato de A nunca subiria — e
// morreria na meia-noite. E o "já contei hoje" de A vale em B: sem isso a mesma
// pessoa contaria duas vezes no mesmo dia, o que a fila proíbe.
describe("o endereço trocou: os relatos e o 'já contei' do endereço de antes", () => {
  const A = "lugar-marcador-bom-marcador";
  const B = "lugar-marcador-outra-marcadora";
  const naFila = () => JSON.parse(localStorage.getItem(CHAVE_FILA) ?? "[]");

  function redeBoa() {
    const posts: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") posts.push(init);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ foram: 1, barro: 0 }) });
      }),
    );
    return posts;
  }

  it("relato {slug: A} na fila, ✓ Fui de B com antigos=[A]: o POST sobe e o relato sai da fila", async () => {
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: A, tipo: "seco", dia: diaRecife(Date.now()) }]));
    const posts = redeBoa();
    render(<ConfirmarFui slug={B} antigos={[A]} />);

    await screen.findByText(/anotado/i);
    expect(posts).toHaveLength(1);
    // Sobe com o slug que a pessoa contou; o servidor resolve A → B e grava em B.
    expect(JSON.parse(String(posts[0].body))).toEqual({ slug: A, tipo: "seco" });
    expect(naFila()).toHaveLength(0);
  });

  it("sem os antigos, o relato de A fica na fila (o controle: é a prop que sobe)", async () => {
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: A, tipo: "seco", dia: diaRecife(Date.now()) }]));
    const posts = redeBoa();
    render(<ConfirmarFui slug={B} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    await new Promise((r) => setTimeout(r, 0));
    expect(posts).toHaveLength(0);
    expect(naFila()).toHaveLength(1);
  });

  it("já contou hoje em A: em B a tela já diz 'anotado', sem perguntar de novo", async () => {
    localStorage.setItem(`bp:contou:${A}:${diaRecife(Date.now())}`, "1");
    redeBoa();
    render(<ConfirmarFui slug={B} antigos={[A]} />);
    await screen.findByText(/anotado/i);
    expect(screen.queryByRole("button", { name: /Fui/ })).toBeNull();
  });

  it("o 'já contou' de um lugar que NÃO é antigo deste não vale aqui", async () => {
    localStorage.setItem(`bp:contou:veu-de-noiva-de-bonito:${diaRecife(Date.now())}`, "1");
    redeBoa();
    render(<ConfirmarFui slug={B} antigos={[A]} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
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

// 🔴 O ✓ FUI CONTA PRO LUGAR QUE A PESSOA VIU (Tarefa 12b, 12-N6). P morava em
// A; quem foi a P contou sem sinal e o relato ficou na fila com a identidade de
// P. P foi pra B e Q passou a morar em A. A página de Q, em /A, NÃO sobe o
// relato de P — ele espera a página de P. Fetch dublado com STATUS explícito:
// sem ele, `{ ok: false }` não diz se é recusa (400) ou passagem (503).
describe("o relato carrega a identidade do lugar", () => {
  const A = "lugar-marcador-pe-marcador";
  const B = "lugar-marcador-pe-novo-marcador";
  const P = 17;
  const Q = 23;
  const hoje = () => diaRecife(Date.now());
  const naFila = () => JSON.parse(localStorage.getItem(CHAVE_FILA) ?? "[]");
  const PLACAR = { foram: 1, barro: 0 };

  /** `portal`: 2xx com corpo HTML (o portal cativo do Wi-Fi) — o `json()`
   *  rejeita, como no navegador. */
  type Resposta = { status: number; corpo?: unknown; portal?: true } | "sem-rede";
  /** Rede dublada: `post(corpo)` decide a resposta de cada POST; o GET devolve
   *  `get`. Guarda os POSTs e as URLs dos GETs. */
  function rede(post: (corpo: Record<string, unknown>) => Resposta, get: unknown = PLACAR) {
    const posts: Array<Record<string, unknown>> = [];
    const gets: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          const corpo = JSON.parse(String(init.body)) as Record<string, unknown>;
          posts.push(corpo);
          const r = post(corpo);
          if (r === "sem-rede") return Promise.reject(new TypeError("Failed to fetch"));
          const json = r.portal
            ? () => Promise.reject(new SyntaxError("Unexpected token '<', \"<!DOCTYPE html>\" is not valid JSON"))
            : () => Promise.resolve(r.corpo ?? null);
          return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json });
        }
        gets.push(url);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(get) });
      }),
    );
    return { posts, gets };
  }
  const sempre = (r: Resposta) => () => r;
  const assentar = () => new Promise((r) => setTimeout(r, 0));

  // N6-cliente (C2): a porta do cliente sozinha. Mata o filtro por endereço.
  it("N6-cliente: na página de Q em /A, o relato de P contado em A NÃO sobe — e continua na fila", async () => {
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: A, tipo: "barro", dia: hoje(), lugar: P }]));
    const { posts } = rede(sempre({ status: 200, corpo: PLACAR }));
    render(<ConfirmarFui slug={A} lugar={Q} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    await assentar();
    expect(posts.filter((c) => c.lugar === P), "o relato de P subiu pela página de Q").toEqual([]);
    expect(posts).toEqual([]);
    expect(naFila()).toEqual([{ slug: A, tipo: "barro", dia: hoje(), lugar: P }]);
    expect(localStorage.getItem(`bp:contou:L${Q}:${hoje()}`)).toBeNull();
  });

  // E depois, a página de P em /B o sobe — com a identidade de P.
  it("N6, continuação: a página de P em /B sobe o relato de P (com o lugar), e a fila esvazia", async () => {
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: A, tipo: "barro", dia: hoje(), lugar: P }]));
    const { posts } = rede(sempre({ status: 200, corpo: { foram: 1, barro: 1 } }));
    render(<ConfirmarFui slug={B} lugar={P} />);
    await screen.findByText(/anotado/i);
    expect(posts).toEqual([{ slug: A, tipo: "barro", lugar: P }]);
    expect(naFila()).toEqual([]);
    // O que subiu pela fila também acende o "já contei" DE P — sem isso, reabrir
    // a página mostraria o "✓ Fui" de novo pra quem já contou.
    expect(localStorage.getItem(`bp:contou:L${P}:${hoje()}`)).toBe("1");
  });

  // B11: o envio online leva a identidade.
  it("o envio online manda a identidade do lugar", async () => {
    const { posts } = rede(sempre({ status: 200, corpo: { foram: 1, barro: 1 } }));
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tava ruim/ }));
    await screen.findByText(/anotado/i);
    expect(posts).toEqual([{ slug: A, tipo: "barro", lugar: P }]);
  });

  // B12: o relato guardado leva a identidade — sem ela cairia no ramo legado.
  it("sem sinal, o relato guardado leva a identidade do lugar", async () => {
    rede(sempre({ status: 503 }));
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deu pra ir/ }));
    await screen.findByText(FUI_GUARDADO);
    expect(naFila()).toEqual([{ slug: A, tipo: "seco", dia: hoje(), lugar: P }]);
  });

  // B10 (lado do cliente): o placar é pedido por lugar.
  it("o GET do placar leva a identidade do lugar", async () => {
    const { gets } = rede(sempre({ status: 200, corpo: PLACAR }));
    render(<ConfirmarFui slug={A} lugar={P} />);
    await screen.findByText(/1 foi/);
    expect(gets).toHaveLength(1);
    expect(new URL(gets[0], "http://x").searchParams.get("lugar")).toBe(String(P));
  });

  // B7: a chave "já contei" é por LUGAR — produzida PELO componente, não
  // escrita à mão (uma chave escrita à mão nem seria lida pelo mutante).
  it("'já contei' por lugar: contar P em /A não acende Q em /A — e P reaberto em /B acende", async () => {
    rede(sempre({ status: 200, corpo: { foram: 1, barro: 0 } }));
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deu pra ir/ }));
    await screen.findByText(/anotado/i);
    cleanup();

    render(<ConfirmarFui slug={A} lugar={Q} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    await assentar();
    expect(screen.queryByText(/anotado/i), "Q acendeu 'contado' por um relato de P").toBeNull();
    cleanup();

    // O controle: a página de P, noutro endereço, acende.
    render(<ConfirmarFui slug={B} lugar={P} />);
    await screen.findByText(/anotado/i);
    expect(screen.queryByRole("button", { name: /Fui/ })).toBeNull();
  });

  // B5 + B6: a fila não trava num relato recusado. São DOIS relatos da mesma
  // página: com a dedup por lugar, o único jeito de a página de P ter dois é um
  // LEGADO (sem lugar, mesmo endereço) e um com lugar — montados à mão no
  // `localStorage`, que é onde o legado mora no dia do deploy.
  it("fila não trava: o relato recusado (400) sai, e o próximo sobe", async () => {
    localStorage.setItem(
      CHAVE_FILA,
      JSON.stringify([
        { slug: A, tipo: "barro", dia: hoje(), lugar: P },
        { slug: A, tipo: "seco", dia: hoje() },
      ]),
    );
    const { posts } = rede((c) => (c.lugar === P ? { status: 400 } : { status: 200, corpo: { foram: 1, barro: 0 } }));
    render(<ConfirmarFui slug={A} lugar={P} />);
    await screen.findByText(/anotado/i);
    expect(posts).toEqual([
      { slug: A, tipo: "barro", lugar: P },
      { slug: A, tipo: "seco" },
    ]);
    expect(naFila(), "o recusado ficou na fila — e seguraria tudo até a virada do dia").toEqual([]);
  });

  // B13: a recusa não pinta placar nem acende "contado".
  it("o 400 no escoar não pinta placar nem acende 'contado'", async () => {
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: A, tipo: "barro", dia: hoje(), lugar: P }]));
    rede(sempre({ status: 400, corpo: { foram: 9, barro: 9 } }), null);
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    await waitFor(() => expect(naFila()).toEqual([]));
    expect(screen.queryByText(/9 foram/)).toBeNull();
    expect(screen.queryByText(/anotado/i)).toBeNull();
    expect(localStorage.getItem(`bp:contou:L${P}:${hoje()}`)).toBeNull();
  });

  // I6: o envio online recusado (400) NÃO guarda — guardar seria mandar de
  // novo o que nunca passa. E também não pinta placar nem acende.
  it("o envio online com 400: tela de erro, nada guardado, nada aceso", async () => {
    rede(sempre({ status: 400, corpo: { foram: 9, barro: 9 } }), null);
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deu pra ir/ }));
    await screen.findByText(/tenta de novo/i);
    expect(naFila()).toEqual([]);
    expect(screen.queryByText(/9 foram/)).toBeNull();
    expect(localStorage.getItem(`bp:contou:L${P}:${hoje()}`)).toBeNull();
  });

  // B17: o lado oposto do B5 — o que é de PASSAGEM fica. Uma classe por caso.
  it.each([
    ["503", { status: 503 }],
    ["429 (firewall)", { status: 429 }],
    ["404 (deploy no meio)", { status: 404 }],
    ["403 (proteção de deploy)", { status: 403 }],
    ["sem rede", "sem-rede"],
  ] as Array<[string, Resposta]>)("%s no escoar: o relato FICA na fila", async (_nome, resposta) => {
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: A, tipo: "barro", dia: hoje(), lugar: P }]));
    const { posts } = rede(sempre(resposta));
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => expect(posts).toHaveLength(1));
    await assentar();
    expect(naFila()).toEqual([{ slug: A, tipo: "barro", dia: hoje(), lugar: P }]);
  });

  it.each([
    ["503", { status: 503 }],
    ["429 (firewall)", { status: 429 }],
    ["sem rede", "sem-rede"],
  ] as Array<[string, Resposta]>)("%s no envio online: o relato é GUARDADO", async (_nome, resposta) => {
    rede(sempre(resposta));
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deu pra ir/ }));
    await screen.findByText(FUI_GUARDADO);
    expect(naFila()).toEqual([{ slug: A, tipo: "seco", dia: hoje(), lugar: P }]);
  });

  // I1: só placar de verdade vira placar. O GET de lugar fora do ar é `null`, e
  // um corpo sem os dois números pintaria "Hoje: undefined foram".
  it.each([
    ["null", null],
    ["{ignorado: true}", { ignorado: true }],
    ["números em texto", { foram: "3", barro: "1" }],
  ])("GET que devolve %s: nenhuma linha de placar", async (_nome, corpo) => {
    rede(sempre({ status: 200, corpo: PLACAR }), corpo);
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    await assentar();
    expect(document.querySelector(".placar")).toBeNull();
  });

  // O relato LEGADO (sem lugar) do endereço desta página sobe — sem lugar,
  // pro servidor resolver o endereço: aceito como hoje (decisão do João,
  // 06/10, "aceitar como hoje").
  it("o relato legado do endereço sobe pela página com identidade", async () => {
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: A, tipo: "seco", dia: hoje() }]));
    const { posts } = rede(sempre({ status: 200, corpo: PLACAR }));
    render(<ConfirmarFui slug={A} lugar={P} />);
    await screen.findByText(/anotado/i);
    expect(posts).toEqual([{ slug: A, tipo: "seco" }]);
    expect(naFila()).toEqual([]);
  });
  // 🔴 I1 da revisão da 12b: um 2xx que NÃO é placar não é aceite. O portal
  // cativo do Wi-Fi responde 200 com HTML: o servidor nunca viu o relato.
  const NAO_PLACAR: Array<[string, Resposta]> = [
    ["portal cativo (200 com HTML)", { status: 200, portal: true }],
    ["200 com null", { status: 200, corpo: null }],
    ["200 com {}", { status: 200, corpo: {} }],
  ];

  it.each(NAO_PLACAR)("%s no escoar: o relato FICA na fila, nada aceso", async (_nome, resposta) => {
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: A, tipo: "barro", dia: hoje(), lugar: P }]));
    const { posts } = rede(sempre(resposta), null);
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => expect(posts).toHaveLength(1));
    await assentar();
    expect(naFila()).toEqual([{ slug: A, tipo: "barro", dia: hoje(), lugar: P }]);
    expect(screen.queryByText(/anotado/i)).toBeNull();
    expect(localStorage.getItem(`bp:contou:L${P}:${hoje()}`)).toBeNull();
    expect(screen.getByRole("button", { name: /Fui/ })).toBeTruthy();
  });

  // E a fila PARA ali, como numa falha de rede: o próximo relato não sobe por
  // trás de um portal (o dele também não chegaria).
  it("portal cativo no escoar: a fila para — o relato seguinte nem é mandado", async () => {
    localStorage.setItem(
      CHAVE_FILA,
      JSON.stringify([
        { slug: A, tipo: "barro", dia: hoje(), lugar: P },
        { slug: A, tipo: "seco", dia: hoje() },
      ]),
    );
    const { posts } = rede(sempre({ status: 200, portal: true }), null);
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => expect(posts).toHaveLength(1));
    await assentar();
    await assentar();
    expect(posts).toHaveLength(1);
    expect(naFila()).toHaveLength(2);
  });

  it.each(NAO_PLACAR)("%s no envio online: o relato é GUARDADO e a tela diz que guardou", async (_nome, resposta) => {
    rede(sempre(resposta), null);
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deu pra ir/ }));
    await screen.findByText(FUI_GUARDADO);
    expect(naFila()).toEqual([{ slug: A, tipo: "seco", dia: hoje(), lugar: P }]);
    expect(screen.queryByText(/anotado/i)).toBeNull();
    expect(localStorage.getItem(`bp:contou:L${P}:${hoje()}`)).toBeNull();
  });

  // O CONTROLE dos três de cima: o 200 COM placar é aceite — senão "nunca
  // aceita" passaria neles.
  it("200 com placar no envio online: anotado, nada guardado", async () => {
    rede(sempre({ status: 200, corpo: { foram: 5, barro: 0 } }), null);
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deu pra ir/ }));
    await screen.findByText(/anotado/i);
    await screen.findByText(/5 foram/);
    expect(naFila()).toEqual([]);
  });

  // 🔴 M2 da revisão da 12b: a chave "já contei" por ENDEREÇO ainda nasce (na
  // página com `lugar` nulo). A página com identidade NÃO a lê: senão Q, que
  // retomou `A`, acenderia "anotado" pelo relato que P recebeu em `A`.
  it("'já contei' por endereço (bp:contou:A) não acende a página de Q em /A", async () => {
    localStorage.setItem(`bp:contou:${A}:${hoje()}`, "1");
    rede(sempre({ status: 200, corpo: PLACAR }));
    render(<ConfirmarFui slug={A} lugar={Q} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    await assentar();
    expect(screen.queryByText(/anotado/i), "Q acendeu pela chave por endereço").toBeNull();
    expect(screen.getByRole("button", { name: /Fui/ })).toBeTruthy();
  });
});

// 🔴 M1 da revisão da 12b, pela tela: o relato que esta tela guarda mora na
// chave NOVA; a velha (`bp:fila-relato`), que uma aba de antes do deploy ainda
// lê, nunca o recebe. O legado que o código velho guardou lá sobe e some.
describe("a tela e as duas chaves da fila", () => {
  const A = "lugar-marcador-chave-marcador";
  const P = 31;
  const hoje = () => diaRecife(Date.now());

  function rede(status: number) {
    const posts: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          posts.push(JSON.parse(String(init.body)));
          return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve({ foram: 1, barro: 0 }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ foram: 0, barro: 0 }) });
      }),
    );
    return posts;
  }

  it("sem sinal, o relato com lugar é guardado na chave NOVA, e a velha não o contém", async () => {
    rede(503);
    render(<ConfirmarFui slug={A} lugar={P} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tava ruim/ }));
    await screen.findByText(FUI_GUARDADO);
    expect(localStorage.getItem(CHAVE_FILA_VELHA)).toBeNull();
    expect(JSON.parse(localStorage.getItem(CHAVE_FILA) ?? "[]")).toEqual([
      { slug: A, tipo: "barro", dia: hoje(), lugar: P },
    ]);
  });

  it("o legado guardado pelo código velho sobe, e a chave velha é apagada", async () => {
    localStorage.setItem(CHAVE_FILA_VELHA, JSON.stringify([{ slug: A, tipo: "seco", dia: hoje() }]));
    const posts = rede(200);
    render(<ConfirmarFui slug={A} lugar={P} />);
    await screen.findByText(/anotado/i);
    expect(posts).toEqual([{ slug: A, tipo: "seco" }]);
    expect(localStorage.getItem(CHAVE_FILA_VELHA)).toBeNull();
  });
});

// 25/10 (o perfil dela): o toque no "Fui" também ANOTA no aparelho onde e
// quando — é isso que a área dela leva pra conta. Anota mesmo sem rede: ela foi.
describe("o Fui anota no aparelho", () => {
  it("com a identidade do lugar, e mesmo quando o envio falha", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_760_000_000_000);
    let i = 0;
    vi.stubGlobal("fetch", vi.fn(() => (i++ === 0
      ? Promise.resolve({ ok: true, json: () => Promise.resolve({ foram: 0, barro: 0 }) })
      : Promise.reject(new Error("sem sinal")))));
    render(<ConfirmarFui slug="rampa-do-pepe" lugar={7} />);
    fireEvent.click(await screen.findByRole("button", { name: /Fui/ }));
    expect((await import("@/lib/fui-no-aparelho")).lerFuis()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /Deu pra ir/ }));
    // Anotou no toque, antes da rede; e a rede caiu depois, sem desfazer nada.
    await waitFor(() => expect(i).toBe(2));
    expect((await import("@/lib/fui-no-aparelho")).lerFuis()).toEqual([{ slug: "rampa-do-pepe", lugar: 7, em: 1_760_000_000_000 }]);
  });
});
