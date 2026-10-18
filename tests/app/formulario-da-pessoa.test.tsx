import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import FormularioDeLugar, { ComecarLugarNovo } from "@/app/admin/FormularioDeLugar";
import TelaDePublicar, { AVISO_PUBLICAR, AVISO_PUBLICAR_PESSOA, PUBLICAR } from "@/app/admin/TelaDePublicar";
import BotaoDesistir, { DESISTIR, DESISTIR_MESMO } from "@/app/admin/BotaoDesistir";
import { PortaDoEditor, usarGravacao } from "@/app/admin/campos/gravar";
import { ROTAS, enderecoDaPergunta, enderecoDePublicar } from "@/app/admin/novo/enderecos";
import type { PerguntaNaTela } from "@/app/admin/campos/tipos";
import { SALVAR } from "@/app/admin/campos/palavras";
import EdicaoDaPessoa from "@/app/contribuir/EdicaoDaPessoa";
import { montarPerguntasDaPessoa } from "@/app/contribuir/perguntas";
import { montarPerguntas } from "@/app/admin/novo/perguntas";

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
    expect(ROTAS.painel.buscaApi).toBe("/api/admin/buscar-no-mapa");
  });

  it("a linha dela leva às rotas e telas DELA, e publicar leva à página pública", () => {
    expect(ROTAS.contribuir.rascunhoApi).toBe("/api/contribuir/rascunho");
    expect(ROTAS.contribuir.publicarApi).toBe("/api/contribuir/publicar");
    expect(ROTAS.contribuir.pergunta("a-b", 3)).toBe("/contribuir/novo?slug=a-b&p=3");
    expect(ROTAS.contribuir.publicar("a-b")).toBe("/contribuir/novo/publicar?slug=a-b");
    expect(ROTAS.contribuir.publicou("a-b")).toBe("/a-b");
    expect(ROTAS.contribuir.desistiu).toBe("/contribuir");
    expect(ROTAS.contribuir.recarregarSe401).toBe(true);
    expect(ROTAS.contribuir.buscaApi).toBe("/api/contribuir/buscar-no-mapa");
  });
});

// 17/10, Task 5: a caixa de busca do mapa do ponto nasce em cada formulário e vai à
// rota de QUEM A MONTOU — a dela nunca à do painel.
describe("a busca no mapa, por quem usa o formulário", () => {
  const DO_PONTO: PerguntaNaTela = {
    especie: "coord",
    campo: {
      caminho: "trajeto.waypoints.0.lat",
      rotulo: "Latitude",
      obrigatorio: true,
      vista: { centro: { lat: -8.5, lng: -36.5 }, z: 11, origem: "cidade" },
    },
    texto: "Onde fica o ponto?",
    valor: undefined,
  };
  for (const [onde, rota] of [
    ["painel", "/api/admin/buscar-no-mapa"],
    ["contribuir", "/api/contribuir/buscar-no-mapa"],
  ] as const) {
    it(`${onde}: a busca sai pela rota ${rota}`, async () => {
      const fetchFalso = vi.fn().mockResolvedValue(Response.json([]));
      vi.stubGlobal("fetch", fetchFalso);
      const { getByRole } = render(
        <FormularioDeLugar slug="a-b" pergunta={DO_PONTO} posicao={1} respondidas={[false]} onde={onde} />,
      );
      fireEvent.change(getByRole("searchbox"), { target: { value: "Lugar Marcador" } });
      fireEvent.submit(getByRole("searchbox").closest("form")!);
      await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
      expect(fetchFalso.mock.calls[0][0]).toBe(`${rota}?q=Lugar%20Marcador`);
    });
  }
});

// 17/10, Task 5: a cidade do documento desce com o PONTO 0 (a linha `.lat`), pra o mapa dizer
// "Fica em:"; sem cidade no documento, nada desce. A edição dela no ar não monta a busca.
describe("a cidade do documento desce com o ponto 0", () => {
  const P0 = "trajeto.waypoints.0.lat";
  const comCidade = { cidade: "Cidade Marcador Um", trajeto: { waypoints: [{ nome: "Lugar Marcador", lat: -8.1, lng: -35.2 }] } };
  const daCidade = (qs: PerguntaNaTela[]) => qs.filter((q) => q.campo.cidade !== undefined).map((q) => q.campo.caminho);

  it("só a linha `.lat` do ponto 0 recebe a cidade, no painel e na dela", () => {
    expect(daCidade(montarPerguntas(comCidade))).toEqual([P0]);
    expect(montarPerguntas(comCidade).find((q) => q.campo.caminho === P0)!.campo.cidade).toBe("Cidade Marcador Um");
    expect(daCidade(montarPerguntasDaPessoa(comCidade))).toEqual([P0]);
  });

  it("documento sem cidade (ou com cidade vazia): ninguém recebe", () => {
    for (const doc of [{}, { cidade: "" }, { cidade: 7 }, null]) {
      expect(daCidade(montarPerguntas(doc)), JSON.stringify(doc)).toEqual([]);
    }
  });

  it("a edição dela no ar: \"Fica em:\" e NENHUMA caixa de busca (a busca é do lugar novo)", () => {
    const perguntas = montarPerguntasDaPessoa(comCidade);
    const { container, queryByRole } = render(<EdicaoDaPessoa slug="a-b" versaoId={1} perguntas={perguntas} />);
    expect(queryByRole("searchbox")).toBeNull();
    expect(container.querySelector(`[data-editor="${P0}"] [data-testid="coord-atual"]`)?.textContent).toBe("Fica em: Cidade Marcador Um");
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
      <PortaDoEditor.Provider value={{ gravarEm: "/api/contribuir/rascunho", previa: false, depoisDeGravar: null, recarregarSe401: true, buscarEm: "/api/contribuir/buscar-no-mapa" }}>
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
