import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import EditorProsa from "@/app/admin/campos/EditorProsa";
import FormularioDeLugar, { ComecarLugarNovo, PROXIMA, SEGUIR_SEM_SALVAR } from "@/app/admin/FormularioDeLugar";
import { PortaDoEditor } from "@/app/admin/campos/gravar";
import { DESFAZER, SALVAR, TEXTO_GUARDADO } from "@/app/admin/campos/palavras";
import { CHAVE_DO_NOME_NOVO, chaveDoTexto } from "@/app/admin/campos/texto-guardado";
import type { CampoNaTela } from "@/app/admin/campos/tipos";

/** A RODADA `d-401` (25/10, desenho aprovado pelo João no chat): a sessão dela
 *  venceu no meio, o Salvar volta 401 e a tela recarrega pra pedir login. Antes
 *  de recarregar, o texto que estava na caixa fica guardado no aparelho; depois
 *  do login, ele volta à MESMA caixa, ainda não salvo, com o aviso. Sai quando
 *  ela salva ou toca "Desfazer". Só texto escrito (a caixa de texto e o nome do
 *  primeiro passo). No painel do João nada disso existe. */

const CAMPO: CampoNaTela = { caminho: "promessa", rotulo: "A promessa", obrigatorio: true };

function navegacaoFalsa() {
  const assign = vi.fn();
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign, reload });
  return { assign, reload };
}

function dela(valor: unknown, slug = "a-b") {
  return render(
    <PortaDoEditor.Provider value={{ gravarEm: "/api/contribuir/lugar", previa: false, depoisDeGravar: null, recarregarSe401: true, buscarEm: null }}>
      <EditorProsa campo={CAMPO} valor={valor} slug={slug} />
    </PortaDoEditor.Provider>,
  );
}

const caixa = (c: HTMLElement) => c.querySelector("textarea") as HTMLTextAreaElement;

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe("a caixa de texto dela", () => {
  it("no 401, guarda o texto antes de recarregar; montada de novo, devolve o texto com o aviso, sem gravar", async () => {
    const { reload } = navegacaoFalsa();
    const fetchFalso = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchFalso);
    const antes = dela("o salvo");
    fireEvent.change(caixa(antes.container), { target: { value: "o que ela escreveu" } });
    fireEvent.click(antes.getByRole("button", { name: SALVAR }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(chaveDoTexto("a-b", "promessa"))).toBe("o que ela escreveu");
    cleanup();

    const depois = dela("o salvo");
    await waitFor(() => expect(caixa(depois.container).value).toBe("o que ela escreveu"));
    expect(depois.getByText(TEXTO_GUARDADO)).toBeTruthy();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("salvar com sucesso apaga o guardado", async () => {
    navegacaoFalsa();
    localStorage.setItem(chaveDoTexto("a-b", "promessa"), "o que ela escreveu");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    const t = dela("o salvo");
    await waitFor(() => expect(caixa(t.container).value).toBe("o que ela escreveu"));
    fireEvent.click(t.getByRole("button", { name: SALVAR }));
    await waitFor(() => expect(localStorage.getItem(chaveDoTexto("a-b", "promessa"))).toBeNull());
  });

  it("uma recusa (409) não apaga o guardado, e o texto fica na caixa", async () => {
    navegacaoFalsa();
    localStorage.setItem(chaveDoTexto("a-b", "promessa"), "o que ela escreveu");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Nada foi gravado: x", { status: 409 })));
    const t = dela("o salvo");
    await waitFor(() => expect(caixa(t.container).value).toBe("o que ela escreveu"));
    fireEvent.click(t.getByRole("button", { name: SALVAR }));
    expect((await t.findByRole("alert")).textContent).toBe("Nada foi gravado: x");
    expect(localStorage.getItem(chaveDoTexto("a-b", "promessa"))).toBe("o que ela escreveu");
    expect(caixa(t.container).value).toBe("o que ela escreveu");
  });

  it("Desfazer volta ao salvo, tira o aviso e apaga o guardado", async () => {
    localStorage.setItem(chaveDoTexto("a-b", "promessa"), "o que ela escreveu");
    const t = dela("o salvo");
    await waitFor(() => expect(caixa(t.container).value).toBe("o que ela escreveu"));
    fireEvent.click(t.getByRole("button", { name: DESFAZER }));
    expect(caixa(t.container).value).toBe("o salvo");
    expect(t.queryByText(TEXTO_GUARDADO)).toBeNull();
    expect(localStorage.getItem(chaveDoTexto("a-b", "promessa"))).toBeNull();
  });

  it("guardado igual ao salvo: sem aviso, e o guardado sai", async () => {
    localStorage.setItem(chaveDoTexto("a-b", "promessa"), "o salvo");
    const t = dela("o salvo");
    await waitFor(() => expect(localStorage.getItem(chaveDoTexto("a-b", "promessa"))).toBeNull());
    expect(t.queryByText(TEXTO_GUARDADO)).toBeNull();
  });

  it("o guardado de outro lugar não entra nesta caixa", async () => {
    localStorage.setItem(chaveDoTexto("outro-lugar", "promessa"), "de outro lugar");
    const t = dela("o salvo");
    await new Promise((r) => setTimeout(r, 0));
    expect(caixa(t.container).value).toBe("o salvo");
    expect(t.queryByText(TEXTO_GUARDADO)).toBeNull();
  });

  it("aparelho sem armazenamento: o 401 recarrega do mesmo jeito", async () => {
    const { reload } = navegacaoFalsa();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("cheio"); });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const t = dela("o salvo");
    fireEvent.change(caixa(t.container), { target: { value: "x" } });
    fireEvent.click(t.getByRole("button", { name: SALVAR }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    vi.restoreAllMocks();
  });
});

describe("no painel do João, nada muda", () => {
  it("o 401 não guarda nada, e um guardado não entra na caixa", async () => {
    navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const t = render(<EditorProsa campo={CAMPO} valor="o salvo" slug="a-b" />);
    fireEvent.change(caixa(t.container), { target: { value: "do João" } });
    fireEvent.click(t.getByRole("button", { name: SALVAR }));
    expect((await t.findByRole("alert")).textContent).toBe("Não consegui salvar.");
    expect(localStorage.getItem(chaveDoTexto("a-b", "promessa"))).toBeNull();
    cleanup();

    localStorage.setItem(chaveDoTexto("a-b", "promessa"), "o que ela escreveu");
    const de = render(<EditorProsa campo={CAMPO} valor="o salvo" slug="a-b" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(caixa(de.container).value).toBe("o salvo");
    expect(de.queryByText(TEXTO_GUARDADO)).toBeNull();
  });
});

describe("o nome, no primeiro passo dela", () => {
  const nome = (c: HTMLElement) => c.querySelector("input[type=text]") as HTMLInputElement;

  it("no 401, guarda o nome; montado de novo, devolve com o aviso", async () => {
    const { reload } = navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const antes = render(<ComecarLugarNovo pergunta="N" onde="contribuir" />);
    fireEvent.change(nome(antes.container), { target: { value: "Pedra Marcador" } });
    fireEvent.submit(antes.container.querySelector("form")!);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(CHAVE_DO_NOME_NOVO)).toBe("Pedra Marcador");
    cleanup();

    const depois = render(<ComecarLugarNovo pergunta="N" onde="contribuir" />);
    await waitFor(() => expect(nome(depois.container).value).toBe("Pedra Marcador"));
    expect(depois.getByText(TEXTO_GUARDADO)).toBeTruthy();
  });

  it("começar com sucesso apaga o nome guardado", async () => {
    localStorage.setItem(CHAVE_DO_NOME_NOVO, "Pedra Marcador");
    const { assign } = navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ slug: "r-1" })));
    const t = render(<ComecarLugarNovo pergunta="N" onde="contribuir" />);
    await waitFor(() => expect(nome(t.container).value).toBe("Pedra Marcador"));
    fireEvent.submit(t.container.querySelector("form")!);
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(CHAVE_DO_NOME_NOVO)).toBeNull();
  });

  it("no painel, o 401 do começar não guarda nada", async () => {
    navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const t = render(<ComecarLugarNovo pergunta="N" />);
    fireEvent.change(nome(t.container), { target: { value: "Pedra do João" } });
    fireEvent.submit(t.container.querySelector("form")!);
    await t.findByRole("alert");
    expect(localStorage.length).toBe(0);
  });
});

// O agente das redações achou (25/10): "Seguir sem salvar? O que você escreveu
// aqui some." (LIDA 18/10) mentiria se o guardado sobrevivesse ao segundo toque.
describe("seguir sem salvar esquece o guardado", () => {
  it("com o texto de volta, o 1º toque em Próxima pede, o 2º sai e o guardado some", async () => {
    const { assign } = navegacaoFalsa();
    localStorage.setItem(chaveDoTexto("r-1", "promessa"), "o que ela escreveu");
    const t = render(
      <FormularioDeLugar
        slug="r-1"
        pergunta={{ especie: "prosa", campo: CAMPO, texto: "P?", valor: "o salvo" }}
        posicao={1}
        respondidas={[true, false]}
        onde="contribuir"
      />,
    );
    await waitFor(() => expect(caixa(t.container).value).toBe("o que ela escreveu"));
    fireEvent.click(t.getByRole("link", { name: PROXIMA }));
    expect(assign).not.toHaveBeenCalled();
    expect(localStorage.getItem(chaveDoTexto("r-1", "promessa"))).toBe("o que ela escreveu");
    fireEvent.click(t.getByRole("link", { name: SEGUIR_SEM_SALVAR }));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(chaveDoTexto("r-1", "promessa"))).toBeNull();
  });
});
