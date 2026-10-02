import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FichaInteira from "@/app/admin/FichaInteira";
import { ACRESCENTAR_PONTO, DICA_DO_PONTO_NOVO, NOME_DO_PONTO_NOVO, tirarPonto } from "@/app/admin/campos/EditorWaypoints";
import { CAIXA_VAZIA } from "@/app/admin/campos/palavras";
import { getAllFichas } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { TRES_PONTOS } from "../ficha-de-tres-pontos";
import { bancoDeProducao } from "../banco";

/** O EDITOR DA CADEIA DO TRAJETO (Tarefa 10, C1 da auditoria).
 *
 *  🔴 TODO CASO RENDERIZA A `FichaInteira` INTEIRA, no padrão de
 *  `admin-editor-numero.test.tsx`: é o SERVIDOR que conta os pontos e monta as
 *  props do editor, então é a fiação do servidor que tem de ser medida — montar
 *  as props à mão aqui passaria verde com a contagem errada.
 *
 *  Duas ações, e só duas: acrescentar um ponto no FIM e tirar o ÚLTIMO. O
 *  `waypoints[0]` é o lugar, e a tela nem oferece tirá-lo. A garantia é a porta
 *  (`tests/api/route-admin-ficha.test.ts`); aqui se prova o que a tela MANDA. */

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
const caixa = (): HTMLInputElement => within(editor()).getByLabelText(NOME_DO_PONTO_NOVO) as HTMLInputElement;
const botaoAcrescentar = (): HTMLElement => within(editor()).getByRole("button", { name: ACRESCENTAR_PONTO });

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

  it("diz ao dono de onde vem a coordenada do ponto novo", () => {
    render(<FichaInteira ficha={TRES_PONTOS} />);
    expect(within(editor()).getByText(DICA_DO_PONTO_NOVO)).toBeTruthy();
  });
});

describe("EditorWaypoints — acrescentar no FIM", () => {
  it("manda o nome digitado pela forma `acrescentarEtapa`, e recarrega no sucesso", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={TRES_PONTOS} />);
    fireEvent.change(caixa(), { target: { value: "Quarto ponto" } });
    fireEvent.click(botaoAcrescentar());
    await waitFor(() => expect(reloadFalso).toHaveBeenCalled());
    expect(corpos(fetchFalso)).toEqual([
      { url: ROTA, metodo: "PUT", corpo: { slug: TRES_PONTOS.slug, acrescentarEtapa: { nome: "Quarto ponto" } } },
    ]);
  });

  it("num lugar de UM ponto também se acrescenta", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={UM_PONTO_REAL} />);
    fireEvent.change(caixa(), { target: { value: "Ponto marcador" } });
    fireEvent.click(botaoAcrescentar());
    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    expect(corpos(fetchFalso)[0].corpo).toEqual({ slug: UM_PONTO_REAL.slug, acrescentarEtapa: { nome: "Ponto marcador" } });
  });

  for (const [nome, texto] of [
    ["vazia", ""],
    ["só espaços", "   "],
  ] as const) {
    it(`caixa ${nome}: recusa AQUI com a frase da caixa vazia, e a rota não é chamada`, () => {
      const { fetchFalso } = comRota();
      render(<FichaInteira ficha={TRES_PONTOS} />);
      fireEvent.change(caixa(), { target: { value: texto } });
      fireEvent.click(botaoAcrescentar());
      expect(within(editor()).getByRole("alert").textContent).toBe(CAIXA_VAZIA);
      expect(fetchFalso).not.toHaveBeenCalled();
    });
  }

  it("recusa da porta: a frase dela aparece, e o nome digitado CONTINUA na caixa", async () => {
    const FRASE = "frase que só a porta sabe";
    const { reloadFalso } = comRota(() => Promise.resolve(new Response(FRASE, { status: 409 })));
    render(<FichaInteira ficha={TRES_PONTOS} />);
    fireEvent.change(caixa(), { target: { value: "Quarto ponto" } });
    fireEvent.click(botaoAcrescentar());
    await waitFor(() => expect(within(editor()).getByRole("alert").textContent).toBe(FRASE));
    expect(caixa().value).toBe("Quarto ponto");
    expect(reloadFalso).not.toHaveBeenCalled();
  });
});

describe("EditorWaypoints — tirar o ÚLTIMO", () => {
  it("o botão nomeia o último ponto, e manda o ÍNDICE dele pela forma `tirarEtapa`", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={TRES_PONTOS} />);
    fireEvent.click(within(editor()).getByRole("button", { name: tirarPonto("Ponto 3") }));
    await waitFor(() => expect(reloadFalso).toHaveBeenCalled());
    expect(corpos(fetchFalso)).toEqual([{ url: ROTA, metodo: "PUT", corpo: { slug: TRES_PONTOS.slug, tirarEtapa: 2 } }]);
  });

  it("só existe UM botão de tirar — nenhum ponto do meio, e nunca o Ponto 1", () => {
    render(<FichaInteira ficha={TRES_PONTOS} />);
    const botoes = within(editor()).getAllByRole("button").map((b) => b.textContent);
    expect(botoes).toEqual([ACRESCENTAR_PONTO, tirarPonto("Ponto 3")]);
  });

  // 🔴 O `[0]` É O LUGAR: num lugar de um ponto só, o único ponto é o lugar, e a
  // tela nem oferece tirá-lo (a porta recusaria com 409 se alguém mandasse).
  it("num lugar de UM ponto não existe botão de tirar", () => {
    render(<FichaInteira ficha={UM_PONTO_REAL} />);
    const botoes = within(editor()).getAllByRole("button").map((b) => b.textContent);
    expect(botoes).toEqual([ACRESCENTAR_PONTO]);
  });
});
