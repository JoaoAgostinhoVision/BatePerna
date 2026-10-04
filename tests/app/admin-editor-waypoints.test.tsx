import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FichaInteira from "@/app/admin/FichaInteira";
import {
  ACRESCENTAR_PONTO,
  DICA_DO_PONTO_NOVO,
  NOME_DO_PONTO_NOVO,
  TIRAR_MESMO,
  tirarPonto,
} from "@/app/admin/campos/EditorWaypoints";
import { CAIXA_VAZIA, SALVAR } from "@/app/admin/campos/palavras";
import { AFASTAR, APROXIMAR, APROXIME_PRA_SALVAR } from "@/app/admin/campos/EditorCoordenada";
import { MAPA_ALTURA_PX, MAPA_LARGURA_PX, MAPA_ZOOM_EDITOR, coordDaPosicao } from "@/lib/mapa";
import { getAllFichas } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { TRES_PONTOS, doisPontos } from "../ficha-de-tres-pontos";
import { bancoDeProducao } from "../banco";

/** O EDITOR DA CADEIA DO TRAJETO (Tarefa 10, C1 da auditoria; onda de conserto 1).
 *
 *  🔴 TODO CASO RENDERIZA A `FichaInteira` INTEIRA, no padrão de
 *  `admin-editor-numero.test.tsx`: é o SERVIDOR que conta os pontos e monta as
 *  props do editor, então é a fiação do servidor que tem de ser medida — montar
 *  as props à mão aqui passaria verde com a contagem errada.
 *
 *  Duas ações, e só duas: acrescentar um ponto no FIM — com a coordenada que o
 *  dono MARCA no mapa, desde a onda 1 — e tirar o ÚLTIMO, em DOIS toques
 *  (decisão do João, 2026-10-01). O `waypoints[0]` é o lugar, e a tela nem
 *  oferece tirá-lo. A garantia é a porta (`tests/api/route-admin-ficha.test.ts`);
 *  aqui se prova o que a tela MANDA. */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

await bancoDeProducao();
const ACERVO = await getAllFichas();
const UM_PONTO_REAL: Ficha = (() => {
  const f = ACERVO.find((x) => x.slug === "rampa-do-pepe");
  if (!f) throw new Error('"rampa-do-pepe" sumiu do acervo — o caso de um ponto mede uma ficha real');
  return f;
})();
const DOIS = doisPontos();

const ROTA = "/api/admin/ficha";
type Chamada = [string, { method: string; body: string }];

function comRota(resposta: () => Promise<Response> = () => Promise.resolve(Response.json({ id: 99 }))) {
  const fetchFalso = vi.fn((_url: string, _init: { method: string; body: string }) => resposta());
  vi.stubGlobal("fetch", fetchFalso);
  const reloadFalso = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload: reloadFalso });
  return { fetchFalso, reloadFalso };
}
const corpos = (f: ReturnType<typeof comRota>["fetchFalso"]) =>
  (f.mock.calls as unknown as Chamada[]).map(([url, init]) => ({ url, metodo: init.method, corpo: JSON.parse(init.body) }));

const editor = (): HTMLElement => screen.getByTestId("editor-waypoints");
const botoes = (): (string | null)[] => within(editor()).getAllByRole("button").map((b) => b.textContent);
const abrir = (): void => {
  fireEvent.click(within(editor()).getByRole("button", { name: ACRESCENTAR_PONTO }));
};
const caixa = (): HTMLInputElement => within(editor()).getByLabelText(NOME_DO_PONTO_NOVO) as HTMLInputElement;
const confirmar = (): void => {
  fireEvent.click(within(editor()).getByRole("button", { name: SALVAR }));
};
const ultimoDe = (f: Ficha) => f.trajeto.waypoints[f.trajeto.waypoints.length - 1];

// ── o arrasto do pin, como em `admin-editor-coordenada.test.tsx` ────────────
const L = MAPA_LARGURA_PX;
const A = MAPA_ALTURA_PX;
const RECT = { left: 10, top: 20, width: L, height: A };
function dublarRect(el: HTMLElement): void {
  el.getBoundingClientRect = () =>
    ({
      ...RECT,
      x: RECT.left,
      y: RECT.top,
      right: RECT.left + RECT.width,
      bottom: RECT.top + RECT.height,
      toJSON: () => ({}),
    }) as DOMRect;
}
const ponteiro = (el: HTMLElement, tipo: string, x: number, y: number): void => {
  fireEvent(el, new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: RECT.left + x, clientY: RECT.top + y }));
};
function arrastarPin(): void {
  const mapa = editor().querySelector<HTMLElement>('[data-testid="mapa-escolher"]')!;
  dublarRect(mapa);
  dublarRect(mapa.parentElement!);
  ponteiro(mapa, "pointerdown", L / 2, A / 2);
  ponteiro(mapa, "pointermove", L / 2 + 120, A / 2 - 60);
  ponteiro(mapa, "pointerup", L / 2 + 120, A / 2 - 60);
}
function lido(): { lat: number; lng: number } {
  const t = editor().querySelector('[data-testid="coord-atual"]')!.textContent ?? "";
  const m = /^(-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)$/.exec(t);
  expect(m, `"${t}" não é "lat, lng"`).not.toBeNull();
  return { lat: Number(m![1]), lng: Number(m![2]) };
}

describe("o painel mostra TODOS os pontos da ficha (C2: `camposDaFicha` já expande o molde)", () => {
  it("uma ficha de três pontos tem os campos dos três, rotulados Ponto 1, 2 e 3", () => {
    render(<FichaInteira ficha={TRES_PONTOS} />);
    for (const [i, w] of TRES_PONTOS.trajeto.waypoints.entries()) {
      const bloco = screen.getByTestId(`campo-trajeto.waypoints.${i}.nome`);
      expect(bloco.querySelector("[data-rotulo]")!.textContent).toBe(`Ponto ${i + 1} · O nome`);
      // o valor do PONTO CERTO, não um nome qualquer da cadeia
      expect((within(bloco).getByRole("textbox") as HTMLTextAreaElement | HTMLInputElement).value).toBe(w.nome);
    }
    expect(screen.queryByTestId("campo-trajeto.waypoints.3.nome")).toBeNull();
  });
});

describe("EditorWaypoints — onde ele mora", () => {
  it("dentro do grupo de como se chega, logo DEPOIS do último ponto e antes do acesso", () => {
    render(<FichaInteira ficha={TRES_PONTOS} />);
    const grupo = screen.getByTestId("grupo-chegar");
    expect(grupo.contains(editor()), "o editor saiu do grupo do trajeto").toBe(true);
    const ultimoCampo = screen.getByTestId("campo-trajeto.waypoints.2.nota");
    const acesso = screen.getByTestId("campo-acesso");
    expect(ultimoCampo.compareDocumentPosition(editor()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(editor().compareDocumentPosition(acesso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("aparece UMA vez só", () => {
    render(<FichaInteira ficha={TRES_PONTOS} />);
    expect(screen.getAllByTestId("editor-waypoints")).toHaveLength(1);
  });

  it("fechado, não desenha mapa nem caixa: só os botões", () => {
    render(<FichaInteira ficha={TRES_PONTOS} />);
    expect(editor().querySelector('[data-testid="mapa-escolher"]')).toBeNull();
    expect(within(editor()).queryByLabelText(NOME_DO_PONTO_NOVO)).toBeNull();
    expect(botoes()).toEqual([ACRESCENTAR_PONTO, tirarPonto("Ponto 3")]);
  });
});

describe("EditorWaypoints — acrescentar no FIM, na posição que o DONO marcou", () => {
  it("abrir mostra o nome, a dica e o MESMO mapa do pin, começando no último ponto", () => {
    render(<FichaInteira ficha={TRES_PONTOS} />);
    abrir();
    expect(caixa().value).toBe("");
    expect(within(editor()).getByText(DICA_DO_PONTO_NOVO)).toBeTruthy();
    expect(editor().querySelector('[data-testid="mapa-escolher"] [data-pin]')).not.toBeNull();
    const u = ultimoDe(TRES_PONTOS);
    expect(lido()).toEqual({ lat: u.lat, lng: u.lng });
  });

  // 🔴 O CRITICAL 1 DA REVISÃO, pelo lado da tela: o que vai no PUT é a posição
  // do PIN, e a mutação "volta a copiar do ponto anterior" morre aqui.
  it("arrastar o pin e confirmar manda o nome E a posição do pin pela forma `acrescentarEtapa`", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={TRES_PONTOS} />);
    abrir();
    fireEvent.change(caixa(), { target: { value: "Quarto ponto" } });
    arrastarPin();
    const marcado = lido();
    const u = ultimoDe(TRES_PONTOS);
    expect(marcado, "a premissa: o pin saiu do último ponto").not.toEqual({ lat: u.lat, lng: u.lng });
    confirmar();
    await waitFor(() => expect(reloadFalso).toHaveBeenCalled());
    expect(corpos(fetchFalso)).toEqual([
      {
        url: ROTA,
        metodo: "PUT",
        corpo: { slug: TRES_PONTOS.slug, acrescentarEtapa: { nome: "Quarto ponto", lat: marcado.lat, lng: marcado.lng } },
      },
    ]);
  });

  // 🔴 TAREFA 11f (m6 da auditoria): o mapa do ponto novo é o MESMO que anda —
  // um toque leva o pin, e o portão do Salvar vale aqui também (C1): afastado,
  // o ponto se marca mas não se confirma.
  it("o toque leva o pin; afastado, o Salvar desliga e diz pra aproximar; perto de novo, confirma o ponto do toque", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={TRES_PONTOS} />);
    abrir();
    fireEvent.change(caixa(), { target: { value: "Quarto ponto" } });
    const mapa = editor().querySelector<HTMLElement>('[data-testid="mapa-escolher"]')!;
    dublarRect(mapa);
    dublarRect(mapa.parentElement!);
    fireEvent.click(within(editor()).getByRole("button", { name: AFASTAR }));
    ponteiro(mapa, "pointerdown", 400, 30);
    ponteiro(mapa, "pointerup", 402, 31);
    const u = ultimoDe(TRES_PONTOS);
    const e = coordDaPosicao(402, 31, { lat: u.lat, lng: u.lng }, MAPA_ZOOM_EDITOR - 1, L, A);
    expect(lido().lat).toBeCloseTo(e.lat, 6);
    expect(lido().lng).toBeCloseTo(e.lng, 6);
    const salvarBotao = within(editor()).getByRole("button", { name: SALVAR }) as HTMLButtonElement;
    expect(salvarBotao.disabled, "afastado, o ponto novo continuou confirmável").toBe(true);
    expect(within(editor()).getByText(APROXIME_PRA_SALVAR)).toBeTruthy();
    confirmar();
    expect(fetchFalso).not.toHaveBeenCalled();
    fireEvent.click(within(editor()).getByRole("button", { name: APROXIMAR }));
    expect(salvarBotao.disabled).toBe(false);
    const marcado = lido();
    confirmar();
    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    expect(corpos(fetchFalso)[0].corpo).toEqual({
      slug: TRES_PONTOS.slug,
      acrescentarEtapa: { nome: "Quarto ponto", lat: marcado.lat, lng: marcado.lng },
    });
  });

  // Confirmar sem mexer é o DONO afirmando aquela posição — aceito, sem
  // heurística de "igual à anterior" (que comeria duas etapas no mesmo ponto).
  it("confirmar sem mexer o pin manda a posição em que ele está — e isso é o dono afirmando", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={UM_PONTO_REAL} />);
    abrir();
    fireEvent.change(caixa(), { target: { value: "Ponto marcador" } });
    confirmar();
    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    const u = ultimoDe(UM_PONTO_REAL);
    expect(corpos(fetchFalso)[0].corpo).toEqual({
      slug: UM_PONTO_REAL.slug,
      acrescentarEtapa: { nome: "Ponto marcador", lat: u.lat, lng: u.lng },
    });
  });

  for (const [nome, texto] of [
    ["vazia", ""],
    ["só espaços", "   "],
  ] as const) {
    it(`caixa ${nome}: recusa AQUI com a frase da caixa vazia, e a rota não é chamada`, () => {
      const { fetchFalso } = comRota();
      render(<FichaInteira ficha={TRES_PONTOS} />);
      abrir();
      fireEvent.change(caixa(), { target: { value: texto } });
      confirmar();
      expect(within(editor()).getByRole("alert").textContent).toBe(CAIXA_VAZIA);
      expect(fetchFalso).not.toHaveBeenCalled();
    });
  }

  it("recusa da porta: a frase dela aparece, e o nome digitado CONTINUA na caixa", async () => {
    const FRASE = "frase que só a porta sabe";
    const { reloadFalso } = comRota(() => Promise.resolve(new Response(FRASE, { status: 409 })));
    render(<FichaInteira ficha={TRES_PONTOS} />);
    abrir();
    fireEvent.change(caixa(), { target: { value: "Quarto ponto" } });
    confirmar();
    await waitFor(() => expect(within(editor()).getByRole("alert").textContent).toBe(FRASE));
    expect(caixa().value).toBe("Quarto ponto");
    expect(reloadFalso).not.toHaveBeenCalled();
  });
});

describe("EditorWaypoints — tirar o ÚLTIMO, em DOIS toques", () => {
  // 🔴 R2 — decisão do João (2026-10-01): o primeiro toque troca o botão pela
  // pergunta; só o segundo tira.
  it("UM toque não chama a rota: o botão vira a pergunta", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={TRES_PONTOS} />);
    fireEvent.click(within(editor()).getByRole("button", { name: tirarPonto("Ponto 3") }));
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(botoes()).toEqual([ACRESCENTAR_PONTO, TIRAR_MESMO]);
  });

  it("DOIS toques chamam a rota UMA vez, com o ÍNDICE do último, pela forma `tirarEtapa`", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={TRES_PONTOS} />);
    fireEvent.click(within(editor()).getByRole("button", { name: tirarPonto("Ponto 3") }));
    fireEvent.click(within(editor()).getByRole("button", { name: TIRAR_MESMO }));
    await waitFor(() => expect(reloadFalso).toHaveBeenCalled());
    expect(corpos(fetchFalso)).toEqual([{ url: ROTA, metodo: "PUT", corpo: { slug: TRES_PONTOS.slug, tirarEtapa: 2 } }]);
  });

  it("recarregar desfaz o estado de confirmar: a tela nova volta ao botão", () => {
    const { unmount } = render(<FichaInteira ficha={TRES_PONTOS} />);
    fireEvent.click(within(editor()).getByRole("button", { name: tirarPonto("Ponto 3") }));
    unmount();
    render(<FichaInteira ficha={TRES_PONTOS} />);
    expect(botoes()).toEqual([ACRESCENTAR_PONTO, tirarPonto("Ponto 3")]);
  });

  // 🔴 R3 — A FRONTEIRA DE DOIS PONTOS (Critical 2 da revisão): lugar + UMA
  // etapa, o estado logo depois do primeiro "acrescentar".
  it("com DOIS pontos o botão aparece, nomeia o Ponto 2, e tira com `tirarEtapa: 1`", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={DOIS} />);
    expect(botoes()).toEqual([ACRESCENTAR_PONTO, tirarPonto("Ponto 2")]);
    fireEvent.click(within(editor()).getByRole("button", { name: tirarPonto("Ponto 2") }));
    fireEvent.click(within(editor()).getByRole("button", { name: TIRAR_MESMO }));
    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    expect(corpos(fetchFalso)[0].corpo).toEqual({ slug: DOIS.slug, tirarEtapa: 1 });
  });

  // 🔴 O `[0]` É O LUGAR: num lugar de um ponto só, o único ponto é o lugar, e a
  // tela nem oferece tirá-lo (a porta recusaria com 409 se alguém mandasse).
  it("num lugar de UM ponto não existe botão de tirar", () => {
    render(<FichaInteira ficha={UM_PONTO_REAL} />);
    expect(botoes()).toEqual([ACRESCENTAR_PONTO]);
  });
});
