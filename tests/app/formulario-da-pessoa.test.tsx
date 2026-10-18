import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import FormularioDeLugar, { ComecarLugarNovo } from "@/app/admin/FormularioDeLugar";
import TelaDePublicar, { AVISO_PUBLICAR, AVISO_PUBLICAR_PESSOA, PUBLICAR } from "@/app/admin/TelaDePublicar";
import BotaoDesistir, { DESISTIR, DESISTIR_MESMO } from "@/app/admin/BotaoDesistir";
import { PortaDoEditor, usarGravacao } from "@/app/admin/campos/gravar";
import { ROTAS, enderecoDaPergunta, enderecoDePublicar } from "@/app/admin/novo/enderecos";
import type { PerguntaNaTela } from "@/app/admin/campos/tipos";
import { SALVAR } from "@/app/admin/campos/palavras";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function navegacaoFalsa() {
  const assign = vi.fn();
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign, reload });
  return { assign, reload };
}

const PERGUNTA: PerguntaNaTela = {
  especie: "prosa",
  campo: { caminho: "promessa", rotulo: "A promessa", obrigatorio: true },
  texto: "Em uma frase, por que alguém pegaria o carro pra ir até aí?",
  valor: undefined,
};

describe("a tabela de endereços", () => {
  it("a linha do painel é a de sempre", () => {
    expect(ROTAS.painel.pergunta("a-b", 3)).toBe(enderecoDaPergunta("a-b", 3));
    expect(ROTAS.painel.publicar("a-b")).toBe(enderecoDePublicar("a-b"));
    expect(ROTAS.painel.rascunhoApi).toBe("/api/admin/rascunho");
    expect(ROTAS.painel.recarregarSe401).toBe(false);
  });

  it("a linha dela leva às rotas e telas DELA, e publicar leva à página pública", () => {
    expect(ROTAS.contribuir.rascunhoApi).toBe("/api/contribuir/rascunho");
    expect(ROTAS.contribuir.publicarApi).toBe("/api/contribuir/publicar");
    expect(ROTAS.contribuir.pergunta("a-b", 3)).toBe("/contribuir/novo?slug=a-b&p=3");
    expect(ROTAS.contribuir.publicar("a-b")).toBe("/contribuir/novo/publicar?slug=a-b");
    expect(ROTAS.contribuir.publicou("a-b")).toBe("/a-b");
    expect(ROTAS.contribuir.desistiu).toBe("/contribuir");
    expect(ROTAS.contribuir.recarregarSe401).toBe(true);
  });
});

describe("o formulário com onde='contribuir'", () => {
  it("o 'Próxima' da última pergunta leva à tela de publicar DELA", () => {
    const { container } = render(<FormularioDeLugar slug="a-b" pergunta={PERGUNTA} posicao={1} respondidas={[false]} onde="contribuir" />);
    expect(container.querySelector(".adm-novo-passo-proxima")?.getAttribute("href")).toBe("/contribuir/novo/publicar?slug=a-b");
  });

  it("os saltos levam às perguntas DELA", () => {
    const { container } = render(<FormularioDeLugar slug="a-b" pergunta={PERGUNTA} posicao={1} respondidas={[false, true]} onde="contribuir" />);
    expect(container.querySelector('[data-testid="saltos"] a')?.getAttribute("href")).toBe("/contribuir/novo?slug=a-b&p=1");
  });

  // Além do brief: o `depoisDeGravar` do provedor também é da linha dela.
  it("o Salvar com sucesso grava pela rota dela e fica na pergunta DELA (a última)", async () => {
    const { assign } = navegacaoFalsa();
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: "a-b" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { container, getByRole } = render(<FormularioDeLugar slug="a-b" pergunta={PERGUNTA} posicao={1} respondidas={[false]} onde="contribuir" />);
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "Porque sim." } });
    fireEvent.click(getByRole("button", { name: SALVAR }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/contribuir/novo?slug=a-b&p=1"));
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/contribuir/rascunho");
  });

  it("começar manda pra rota dela e abre a pergunta 1 dela", async () => {
    const { assign } = navegacaoFalsa();
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: "a-b" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { container } = render(<ComecarLugarNovo pergunta="N" onde="contribuir" />);
    fireEvent.change(container.querySelectorAll("input")[0], { target: { value: "A" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/contribuir/novo?slug=a-b"));
    expect(JSON.parse(String(fetchFalso.mock.calls[0][1].body))).toEqual({ nome: "A" });
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/contribuir/rascunho");
  });

  it("publicar manda pra rota dela, com o aviso DELA, e leva à página pública do lugar", async () => {
    const { assign } = navegacaoFalsa();
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: "a-b" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { container, getByRole } = render(<TelaDePublicar slug="a-b" atualizadoEm={1} frases={[]} onde="contribuir" />);
    expect(container.textContent).toContain(AVISO_PUBLICAR_PESSOA);
    expect(container.textContent).not.toContain(AVISO_PUBLICAR);
    fireEvent.click(getByRole("button", { name: PUBLICAR }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/a-b"));
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/contribuir/publicar");
  });

  it("desistir apaga pela rota dela e volta à lista dela", async () => {
    const { assign } = navegacaoFalsa();
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { getByRole } = render(<BotaoDesistir slug="a-b" voltarAoPainel onde="contribuir" />);
    fireEvent.click(getByRole("button", { name: DESISTIR }));
    fireEvent.click(getByRole("button", { name: DESISTIR_MESMO }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/contribuir"));
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/contribuir/rascunho");
  });
});

describe("401 — a sessão dela venceu no meio (Review Focus 4)", () => {
  function Gravador() {
    const g = usarGravacao();
    return <><button onClick={() => void g.gravar({ slug: "a-b", campo: "promessa", valor: "x" })}>gravar</button>{g.erro && <p role="alert">{g.erro}</p>}</>;
  }

  it("com recarregarSe401, o 401 recarrega a página (o Clerk pede login e devolve à mesma pergunta)", async () => {
    const { reload } = navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { getByRole } = render(
      <PortaDoEditor.Provider value={{ gravarEm: "/api/contribuir/rascunho", previa: false, depoisDeGravar: null, recarregarSe401: true }}>
        <Gravador />
      </PortaDoEditor.Provider>,
    );
    fireEvent.click(getByRole("button", { name: "gravar" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("no painel (padrão), o 401 continua sendo 'Não consegui salvar.' — nada muda pro João", async () => {
    const { reload } = navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { getByRole, findByRole } = render(<Gravador />);
    fireEvent.click(getByRole("button", { name: "gravar" }));
    expect((await findByRole("alert")).textContent).toBe("Não consegui salvar.");
    expect(reload).not.toHaveBeenCalled();
  });

  // Além do brief (07/10): as duas outras portas que recarregam — sem estes, um
  // `ComecarLugarNovo` ou um `BotaoDesistir` que nunca recarrega sobrevivia.
  it("começar, na tela dela, recarrega no 401; no painel, mostra a frase e não recarrega", async () => {
    const { reload } = navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const dela = render(<ComecarLugarNovo pergunta="N" onde="contribuir" />);
    fireEvent.submit(dela.container.querySelector("form")!);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    cleanup();
    const painel = render(<ComecarLugarNovo pergunta="N" />);
    fireEvent.submit(painel.container.querySelector("form")!);
    expect((await painel.findByRole("alert")).textContent).toBe("Não consegui salvar.");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("desistir, na tela dela, recarrega no 401 e não volta à lista", async () => {
    const { assign, reload } = navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { getByRole } = render(<BotaoDesistir slug="a-b" voltarAoPainel onde="contribuir" />);
    fireEvent.click(getByRole("button", { name: DESISTIR }));
    fireEvent.click(getByRole("button", { name: DESISTIR_MESMO }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(assign).not.toHaveBeenCalled();
  });

  // Além do brief: o formulário TEM de passar a linha dela ao provedor — sem
  // isto, um `recarregarSe401: false` cravado no `FormularioDeLugar` sobrevivia.
  it("o Salvar de uma pergunta, no formulário dela, recarrega no 401", async () => {
    const { reload } = navegacaoFalsa();
    const fetchFalso = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { container, getByRole } = render(<FormularioDeLugar slug="a-b" pergunta={PERGUNTA} posicao={1} respondidas={[false]} onde="contribuir" />);
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "Porque sim." } });
    fireEvent.click(getByRole("button", { name: SALVAR }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/contribuir/rascunho");
  });

  it("a tela de publicar dela também recarrega no 401", async () => {
    const { reload } = navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { getByRole } = render(<TelaDePublicar slug="a-b" atualizadoEm={1} frases={[]} onde="contribuir" />);
    fireEvent.click(getByRole("button", { name: PUBLICAR }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });
});
