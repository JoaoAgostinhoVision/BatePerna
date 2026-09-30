import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FichaInteira, { LISTA_MULTIPLA } from "@/app/admin/FichaInteira";
import { NAO_SEI, NAO_TEM } from "@/app/admin/campos/BotaoNaoSei";
import { ERRO_GRAVAR, ERRO_REDE } from "@/app/admin/campos/gravar";
import { CAIXA_VAZIA, HORA_VAZIA, NADA_ESCOLHIDO } from "@/app/admin/campos/palavras";
import { CAMPOS_DA_FICHA, aplicarCampo, camposDaFicha } from "@/lib/campos-da-ficha";
import { getAllFichas } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { bancoDeProducao } from "../banco";

/** OS EDITORES POR ESPÉCIE (Task 6, 2026-09-30) — e este arquivo é também o
 *  destino dos quatro casos de `tests/app/editor-de-voz.test.tsx`, que morreu
 *  junto com o componente. **Suíte verde não prova contração: teste apagado não
 *  falha.** A tabela caso-a-caso está no relatório da tarefa; aqui, cada caso
 *  migrado leva a marca `⇦ editor-de-voz` no nome ou no comentário.
 *
 *  🔴 QUASE TODO CASO RENDERIZA A `FichaInteira` INTEIRA e mede DENTRO do bloco
 *  do campo (`within(bloco("voz"))`), em vez de montar o editor solto com props
 *  escritas à mão. Duas razões, e a segunda é a que decide:
 *
 *   1. "está em algum lugar da tela" é a espécie que este projeto pegou em
 *      25/09. `within` no bloco do campo é a asserção na linha do item.
 *   2. Montar as props à mão aqui esconderia o defeito de FIAÇÃO — se
 *      `FichaInteira` passasse o rótulo errado, as `opcoes` erradas ou
 *      `multiplo` invertido, um editor testado solto passaria verde. É o
 *      servidor que monta o `CampoNaTela`, então é o servidor que tem que ser
 *      medido. */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

await bancoDeProducao();
const ACERVO = await getAllFichas();

function exigir(slug: string): Ficha {
  if (ACERVO.length < 2) throw new Error("com uma ficha só este arquivo não separa nada");
  const f = ACERVO.find((x) => x.slug === slug);
  if (!f) throw new Error(`"${slug}" sumiu do acervo — este arquivo mede as fichas reais`);
  return f;
}

/** A ficha SEM `horario` — é ela que prova o bloco AUSENTE (A3 do brief). */
const semHorario = exigir("rampa-do-pepe");
/** A ficha COM `horario` — o par simétrico, o bloco PRESENTE. */
const comHorario = exigir("pedra-furada-de-venturosa");

const bloco = (caminho: string): HTMLElement => screen.getByTestId(`campo-${caminho}`);
const emCampo = (caminho: string) => within(bloco(caminho));

/** O `fetch` dublado + o `location.reload` dublado.
 *
 *  ⚠️ O dublê do `location` é o MESMO padrão de `editor-de-voz.test.tsx` (e de
 *  `CaixaDeSenha`/`PainelAdmin` antes dele), copiado e não reinventado: `r.ok`
 *  dispara `location.reload()`, jsdom não implementa navegação de verdade e
 *  poluiria o stderr. */
type Requisicao = { method: string; body: string };

function comRota(resposta?: Response | Error) {
  const responder = (): Promise<Response> =>
    resposta instanceof Error ? Promise.reject(resposta) : Promise.resolve(resposta ?? Response.json({ id: 99 }));
  // As duas anotações existem pra o `mock.calls` ser LIDO com tipo — sem elas o
  // vitest infere a tupla vazia e `calls[0][1].body` não compila.
  const fetchFalso = vi.fn((_url: string, _init: Requisicao) => responder());
  vi.stubGlobal("fetch", fetchFalso);
  const reloadFalso = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload: reloadFalso });
  return { fetchFalso, reloadFalso };
}

type RotaFalsa = ReturnType<typeof comRota>["fetchFalso"];

const corpoDe = (fetchFalso: RotaFalsa, n = 0): Record<string, unknown> =>
  JSON.parse(fetchFalso.mock.calls[n][1].body);

const digitar = (caminho: string, texto: string): void => {
  fireEvent.change(emCampo(caminho).getByRole("textbox"), { target: { value: texto } });
};

const salvar = (caminho: string): void => {
  fireEvent.click(bloco(caminho).querySelector(`[data-salvar="${caminho}"]`)!);
};

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorProsa — a caixa de texto (absorveu o `EditorDeVoz`)", () => {
  // ⇦ editor-de-voz: "mostra a voz atual da ficha no campo"
  it("a caixa abre com o que está no banco, no bloco do campo", () => {
    render(<FichaInteira ficha={semHorario} />);
    expect(emCampo("voz").getByDisplayValue(semHorario.voz)).toBeTruthy();
    // e não é "está em algum lugar da tela": a caixa de OUTRO campo de prosa
    // tem o valor DELE, não o da voz.
    expect(emCampo("acesso").getByDisplayValue(semHorario.acesso)).toBeTruthy();
  });

  // ⇦ editor-de-voz: "salvar manda slug, campo 'voz' e o valor novo, em PUT"
  it("grava o que foi digitado, no caminho certo, e a tela vem da fonte nova", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    digitar("voz", "a serra firmou de novo");
    salvar("voz");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/admin/ficha");
    expect(init.method).toBe("PUT");
    expect(corpoDe(fetchFalso)).toEqual({
      slug: semHorario.slug,
      campo: "voz",
      valor: "a serra firmou de novo",
    });
    // 🔴 ⇦ editor-de-voz, FIX ROUND 1 de lá: sem esta asserção, apagar o
    // `location.reload()` e deixar só `return;` passa verde — a linha que traz a
    // tela "da fonte nova (o banco), nunca de estado otimista" fica sem prova.
    await waitFor(() => expect(reloadFalso).toHaveBeenCalledTimes(1));
  });

  it("um campo ANINHADO grava no caminho aninhado, não na chave do primeiro nível", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    digitar("discriminador.formato", "duas placas");
    salvar("discriminador.formato");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpoDe(fetchFalso).campo).toBe("discriminador.formato");
  });

  it("o campo de um PONTO do trajeto grava com o índice concreto, nunca o molde", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    digitar("trajeto.waypoints.0.nome", "outro nome");
    salvar("trajeto.waypoints.0.nome");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpoDe(fetchFalso).campo).toBe("trajeto.waypoints.0.nome");
  });

  // 🔴 Global constraint do desenho: `""` nunca chega ao documento.
  it("caixa esvaziada NÃO grava — a rota nem é chamada, e o 'não sei' está ali do lado", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    digitar("secaRapido", "");
    salvar("secaRapido");
    expect(fetchFalso, "a caixa vazia foi mandada pra porta").not.toHaveBeenCalled();
    expect(emCampo("secaRapido").getByRole("alert").textContent).toBe(CAIXA_VAZIA);
    expect(emCampo("secaRapido").getByRole("button", { name: new RegExp(NAO_SEI, "i") })).toBeTruthy();
  });

  it("só-espaços também não grava — a mesma régua da porta", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    digitar("secaRapido", "   ");
    salvar("secaRapido");
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(emCampo("secaRapido").getByRole("alert").textContent).toBe(CAIXA_VAZIA);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('O "não sei" — a ação que TIRA a chave, e só em campo opcional', () => {
  it("manda `naoSei: true` no caminho do campo, e nenhum `valor`", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    fireEvent.click(bloco("piso").querySelector('[data-nao-sei="piso"]')!);
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpoDe(fetchFalso)).toEqual({ slug: semHorario.slug, campo: "piso", naoSei: true });
  });

  // 🔴 M5 do plano, generalizado pro registro inteiro em vez de um campo só: a
  // mutação "o 'não sei' aparece em campo obrigatório" morre aqui, e morre
  // também a inversa (campo opcional que perde o botão e vira campo sem saída).
  it('aparece em TODO campo opcional com editor, e em NENHUM obrigatório', () => {
    render(<FichaInteira ficha={semHorario} />);
    let opcionais = 0;
    let obrigatorios = 0;
    for (const c of camposDaFicha(semHorario)) {
      if (bloco(c.caminho).querySelector("[data-editor]") === null) continue;
      const botao = bloco(c.caminho).querySelector(`[data-nao-sei="${c.caminho}"]`);
      if (c.obrigatorio) {
        expect(botao, `${c.caminho} é obrigatório e a tela ofereceu "não sei" — a porta recusa`).toBeNull();
        obrigatorios++;
      } else {
        expect(botao, `${c.caminho} é opcional e ficou sem saída de "não sei"`).not.toBeNull();
        opcionais++;
      }
    }
    expect(opcionais, "nenhum campo opcional foi medido: o caso ficaria oco").toBeGreaterThan(3);
    expect(obrigatorios, "nenhum campo obrigatório foi medido: o caso ficaria oco").toBeGreaterThan(5);
  });

  // 🔴 A 49ª espécie do catálogo (bifurcação de frase com prova de um lado só):
  // a palavra do botão muda no BLOCO, e os dois ramos são medidos. Colapsar a
  // bifurcação nos dois sentidos deixa este caso vermelho.
  it("a palavra é 'não sei' num campo comum e 'não tem' num BLOCO — nunca a mesma", () => {
    render(<FichaInteira ficha={comHorario} />);
    expect(bloco("piso").querySelector('[data-nao-sei="piso"]')!.textContent).toBe(NAO_SEI);
    expect(bloco("horario").querySelector('[data-nao-sei="horario"]')!.textContent).toBe(NAO_TEM);
    expect(NAO_SEI, "as duas palavras colapsaram numa").not.toBe(NAO_TEM);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("As recusas da porta — a FRASE dela, e o que ele digitou não some", () => {
  const DIGITADO = "texto novo que não pode sumir";

  /** Digita algo na `voz`, salva, e devolve o que a porta respondeu. */
  async function recusa(resposta: Response | Error) {
    const { fetchFalso } = comRota(resposta);
    render(<FichaInteira ficha={semHorario} />);
    digitar("voz", DIGITADO);
    salvar("voz");
    await waitFor(() => expect(emCampo("voz").getByRole("alert")).toBeTruthy());
    return { fetchFalso, alerta: emCampo("voz").getByRole("alert").textContent };
  }

  // 🔴 M4 do plano.
  it("409 da coerência mostra a FRASE que voltou, não 'erro'", async () => {
    const frase = "o chip diz R$ 5 e o preço diz R$ 10";
    const { alerta } = await recusa(new Response(frase, { status: 409 }));
    expect(alerta).toBe(frase);
    expect(alerta, "a frase da porta foi trocada pela frase própria").not.toBe(ERRO_GRAVAR);
  });

  // 🔴 A4 DO BRIEF: o 400 também. A Tarefa 3 fez o 400 passar a devolver a
  // frase do registro — são elas que dizem ao dono O QUE FAZER. Um editor que
  // mostrasse frase própria no 400 jogaria aquele conserto no lixo.
  it("400 da porta mostra a FRASE que voltou, não a frase própria", async () => {
    const frase = "`horario` não está preenchido nesta ficha: preencha o `horario` inteiro de uma vez";
    const { alerta } = await recusa(new Response(frase, { status: 400 }));
    expect(alerta).toBe(frase);
    expect(alerta).not.toBe(ERRO_GRAVAR);
  });

  // ⇦ editor-de-voz: "resposta que não é ok mostra a mensagem de erro de
  // gravação" — era exatamente um 400 de corpo VAZIO, que é o único caso em que
  // a frase própria é a certa (ZodError e recusas de forma).
  it("400 com o corpo VAZIO cai na frase própria — é o único caso dela", async () => {
    const { alerta } = await recusa(new Response("", { status: 400 }));
    expect(alerta).toBe(ERRO_GRAVAR);
  });

  it("corpo só de espaço em branco conta como vazio, não como frase", async () => {
    const { alerta } = await recusa(new Response("   \n", { status: 400 }));
    expect(alerta).toBe(ERRO_GRAVAR);
  });

  // ⇦ editor-de-voz: "fetch que rejeita mostra a mensagem de erro de rede" — e
  // com a SEGUNDA METADE, que o A9 do brief diz importar mais que a primeira.
  it("sem rede mostra a frase de sem rede, e NÃO some com o que foi digitado", async () => {
    const { alerta } = await recusa(new TypeError("Failed to fetch"));
    expect(alerta).toBe(ERRO_REDE);
    expect(
      emCampo("voz").getByDisplayValue(DIGITADO),
      "o texto que ele acabou de escrever sumiu numa falha de rede",
    ).toBeTruthy();
  });

  // 🔴 A9: nos TRÊS, não só no sem-rede. Perder no celular, por um sinal ruim,
  // o texto que ele acabou de escrever é o defeito que faz alguém parar de usar
  // o painel.
  it("o que ele digitou continua na caixa no 400 e no 409 também", async () => {
    const quatrocentos = await recusa(new Response("caixa vazia em `voz`", { status: 400 }));
    expect(quatrocentos.alerta).toBe("caixa vazia em `voz`");
    expect(emCampo("voz").getByDisplayValue(DIGITADO), "o texto sumiu num 400").toBeTruthy();
    cleanup();

    await recusa(new Response("a voz deste lugar é a de outro", { status: 409 }));
    expect(emCampo("voz").getByDisplayValue(DIGITADO), "o texto sumiu num 409").toBeTruthy();
  });

  // O par simétrico do de cima: no SUCESSO a tela recarrega, então o valor vem
  // do banco e NÃO de estado otimista. Sem este caso, um editor que nunca
  // recarregasse passaria nos três de cima.
  it("no sucesso a tela recarrega — o valor passa a vir do banco", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    digitar("voz", DIGITADO);
    salvar("voz");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    await waitFor(() => expect(reloadFalso).toHaveBeenCalledTimes(1));
    expect(emCampo("voz").queryByRole("alert"), "recarregou e ainda reclamou").toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorLista — escolher, nunca digitar", () => {
  // 🔴 M2 do plano.
  it("só as opções do registro aparecem, e não dá pra digitar", () => {
    render(<FichaInteira ficha={semHorario} />);
    const piso = CAMPOS_DA_FICHA.find((c) => c.caminho === "piso")!;
    expect(piso.opcoes, "o registro perdeu as opções de `piso`: o caso ficaria oco").toBeTruthy();
    expect(
      [...emCampo("piso").getAllByRole("option")].map((o) => o.textContent),
      "as opções da tela não são as do registro",
    ).toEqual([...piso.opcoes!]);
    expect(emCampo("piso").queryByRole("textbox"), "a lista fechada virou caixa de digitar").toBeNull();
  });

  it("grava a escolha como UMA palavra no caminho certo", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    fireEvent.change(bloco("piso").querySelector('[data-escolha="piso"]')!, {
      target: { value: "asfalto-tapete" },
    });
    salvar("piso");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpoDe(fetchFalso)).toEqual({
      slug: semHorario.slug,
      campo: "piso",
      valor: "asfalto-tapete",
    });
  });

  // 🔴 `dias` é a única lista de VÁRIOS, e uma escolha única ali TRANCARIA o
  // dono de gravar "sábado e domingo" — a verdade da ficha que está no banco.
  it("a lista de vários manda um ARRAY, e na ordem do registro — nunca a dos toques", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    const caixa = (dia: string) => emCampo("dias").getByRole("checkbox", { name: dia });
    // a ficha real tem sab e dom marcados; desmarca tudo e marca na ordem
    // INVERSA à do registro, pra a ordem da gravação não poder vir dos toques.
    for (const d of ["sab", "dom"]) fireEvent.click(caixa(d));
    for (const d of ["sex", "qua"]) fireEvent.click(caixa(d));
    salvar("dias");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpoDe(fetchFalso)).toEqual({
      slug: semHorario.slug,
      campo: "dias",
      valor: ["qua", "sex"],
    });
  });

  it("a lista de vários abre com o que está no banco marcado, e só ele", () => {
    render(<FichaInteira ficha={semHorario} />);
    expect(semHorario.dias, "esta ficha perdeu os dias — o caso deixou de ser medido").toBeTruthy();
    for (const caixa of emCampo("dias").getAllByRole("checkbox")) {
      const dia = caixa.getAttribute("value")!;
      expect((caixa as HTMLInputElement).checked, `${dia} veio marcado ao contrário`).toBe(
        (semHorario.dias as readonly string[]).includes(dia),
      );
    }
  });

  it("nada escolhido NÃO grava — nem lista vazia, nem palavra vazia", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    for (const d of ["sab", "dom"]) fireEvent.click(emCampo("dias").getByRole("checkbox", { name: d }));
    salvar("dias");
    expect(fetchFalso, "uma lista vazia foi mandada pra porta").not.toHaveBeenCalled();
    expect(emCampo("dias").getByRole("alert").textContent).toBe(NADA_ESCOLHIDO);
  });

  // 🔴 §4.4 do desenho: nada é pré-preenchido. Os dois ramos, porque uma opção
  // em branco que ficasse também com valor seria um convite a esvaziar — e
  // esvaziar não é "não sei".
  it("campo AUSENTE abre em branco; campo com valor não ganha opção em branco", () => {
    const semPiso: Ficha = { ...semHorario, piso: undefined };
    const { unmount } = render(<FichaInteira ficha={semPiso} />);
    const vazio = bloco("piso").querySelector<HTMLSelectElement>('[data-escolha="piso"]')!;
    expect(vazio.value, "a tela pré-preencheu um campo que o dono nunca respondeu").toBe("");
    expect(emCampo("piso").getAllByRole("option")).toHaveLength(
      CAMPOS_DA_FICHA.find((c) => c.caminho === "piso")!.opcoes!.length + 1,
    );
    unmount();

    render(<FichaInteira ficha={semHorario} />);
    expect(bloco("piso").querySelector<HTMLSelectElement>('[data-escolha="piso"]')!.value).toBe(
      semHorario.piso,
    );
    expect(emCampo("piso").getAllByRole("option")).toHaveLength(
      CAMPOS_DA_FICHA.find((c) => c.caminho === "piso")!.opcoes!.length,
    );
  });

  it("um campo ausente não grava sem escolha nenhuma", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={{ ...semHorario, piso: undefined }} />);
    salvar("piso");
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(emCampo("piso").getByRole("alert").textContent).toBe(NADA_ESCOLHIDO);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorBooleano — o interruptor, com TRÊS estados", () => {
  // 🔴 M3 do plano: a mutação "booleano mostra o nome do campo" morre aqui.
  it("mostra a frase que o valor vira na ficha, e nunca o nome do campo", () => {
    render(<FichaInteira ficha={semHorario} />);
    const dentro = emCampo("carroComum");
    expect(dentro.getByRole("group", { name: /carro comum/i }), "o grupo não é a pergunta").toBeTruthy();
    expect(dentro.getByRole("radio", { name: "Sim" })).toBeTruthy();
    expect(dentro.getByRole("radio", { name: "Não" })).toBeTruthy();
    expect(dentro.queryByText("carroComum"), "o nome cru do campo vazou pra tela").toBeNull();
    expect(dentro.queryByText("true"), "o valor cru vazou pra tela").toBeNull();
  });

  it("abre marcado no valor do banco", () => {
    render(<FichaInteira ficha={semHorario} />);
    expect(semHorario.carroComum, "esta ficha perdeu o `carroComum`").toBe(true);
    expect(
      (emCampo("carroComum").getByRole("radio", { name: "Sim" }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (emCampo("carroComum").getByRole("radio", { name: "Não" }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  // 🔴 `false` NÃO É SILÊNCIO: "não chega" é afirmação. Um `!marcado` no editor
  // recusaria gravar a verdade.
  it("grava `false` como afirmação, e não como nada escolhido", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    fireEvent.click(emCampo("carroComum").getByRole("radio", { name: "Não" }));
    salvar("carroComum");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpoDe(fetchFalso)).toEqual({
      slug: semHorario.slug,
      campo: "carroComum",
      valor: false,
    });
  });

  it("campo ausente: sem sim nem não, nada é gravado", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={{ ...semHorario, carroComum: undefined }} />);
    for (const r of emCampo("carroComum").getAllByRole("radio")) {
      expect((r as HTMLInputElement).checked, "a tela chutou uma resposta").toBe(false);
    }
    salvar("carroComum");
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(emCampo("carroComum").getByRole("alert").textContent).toBe(NADA_ESCOLHIDO);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorHora — o seletor, e o que ele NÃO confere", () => {
  it("grava a hora no caminho da folha", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={comHorario} />);
    fireEvent.change(bloco("horario.fecha").querySelector('[data-hora="horario.fecha"]')!, {
      target: { value: "19:30" },
    });
    salvar("horario.fecha");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpoDe(fetchFalso)).toEqual({
      slug: comHorario.slug,
      campo: "horario.fecha",
      valor: "19:30",
    });
  });

  it("abre com a hora que está no banco", () => {
    render(<FichaInteira ficha={comHorario} />);
    expect(
      bloco("horario.abre").querySelector<HTMLInputElement>('[data-hora="horario.abre"]')!.value,
    ).toBe(comHorario.horario!.abre);
  });

  // 🔴 O PLANO PEDIA "recusa texto que não é HH:MM antes de chamar a rota", e o
  // que ESTE caso mede é o estado que o controle DE FATO produz. Medido em
  // 2026-09-30: `<input type="time">` recebendo `"17h"` fica com `value === ""`
  // — a especificação manda o controle devolver hora válida ou string vazia.
  // Uma regex de `HH:MM` no cliente seria condição semanticamente morta.
  it("hora que não é HH:MM não chega à rota: o controle a esvazia, e o editor recusa dizendo o formato", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={comHorario} />);
    const caixa = bloco("horario.fecha").querySelector<HTMLInputElement>('[data-hora="horario.fecha"]')!;
    fireEvent.change(caixa, { target: { value: "17h" } });
    expect(caixa.value, "o controle de hora aceitou texto livre — o caso mudou de natureza").toBe("");
    salvar("horario.fecha");
    expect(fetchFalso, "uma hora malformada foi mandada pra porta").not.toHaveBeenCalled();
    const alerta = bloco("horario.fecha").querySelector('[role="alert"]')!.textContent;
    expect(alerta).toBe(HORA_VAZIA);
    expect(alerta, "a frase da recusa não diz o formato").toMatch(/HH:MM/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("O bloco `horario` — a tela não convida ao que a porta nega (A3)", () => {
  it("bloco AUSENTE: o editor do bloco pede as folhas JUNTAS e grava o bloco inteiro", async () => {
    expect(semHorario.horario, "esta ficha ganhou horário — o caso deixou de ser medido").toBeUndefined();
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    const dentro = bloco("horario");
    fireEvent.change(dentro.querySelector('[data-hora="horario.abre"]')!, { target: { value: "08:00" } });
    fireEvent.change(dentro.querySelector('[data-hora="horario.fecha"]')!, { target: { value: "17:00" } });
    salvar("horario");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    // 🔴 É ISTO que a porta aceita com o bloco ausente (`gravarBloco`): o bloco,
    // com as folhas dentro, chaveadas pelo nome DENTRO do bloco.
    expect(corpoDe(fetchFalso)).toEqual({
      slug: semHorario.slug,
      campo: "horario",
      valor: { abre: "08:00", fecha: "17:00" },
    });
  });

  // 🔴 O DEFEITO DO A3, DE FRENTE: com o bloco ausente a porta RECUSA
  // `{campo: "horario.abre"}`. A tela não pode oferecer o ato.
  it("bloco AUSENTE: a folha NÃO oferece salvar nem editor nenhum", () => {
    render(<FichaInteira ficha={semHorario} />);
    for (const folha of ["horario.abre", "horario.fecha"]) {
      const el = bloco(folha);
      expect(el.querySelector("[data-editor]"), `${folha} ganhou editor com o bloco ausente`).toBeNull();
      expect(
        within(el).queryByRole("button"),
        `${folha} ofereceu um botão — o dono levaria recusa num campo que a tela ofereceu`,
      ).toBeNull();
      expect(within(el).queryByRole("textbox"), `${folha} ofereceu caixa`).toBeNull();
      // e continua DIZENDO que está ausente, em vez de sumir
      expect(el.hasAttribute("data-ausente"), `${folha} perdeu a marca de ausente`).toBe(true);
    }
  });

  it("bloco AUSENTE: uma folha só não grava — o bloco entra completo", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semHorario} />);
    fireEvent.change(bloco("horario").querySelector('[data-hora="horario.abre"]')!, {
      target: { value: "08:00" },
    });
    salvar("horario");
    expect(fetchFalso, "meio bloco foi mandado pra porta").not.toHaveBeenCalled();
    expect(bloco("horario").querySelector('[role="alert"]')!.textContent).toBe(HORA_VAZIA);
  });

  // O par simétrico. Sem ele, um editor de bloco que mostrasse as caixas SEMPRE
  // passaria no caso de cima — e `aplicarCampo` no bloco PRESENTE é recusado de
  // propósito (cada folha tem o instrumento dela).
  it("bloco PRESENTE: o bloco não oferece caixa nenhuma, e cada folha oferece a dela", () => {
    expect(comHorario.horario, "esta ficha perdeu o horário — o caso deixou de ser medido").toBeTruthy();
    render(<FichaInteira ficha={comHorario} />);
    expect(
      bloco("horario").querySelectorAll("input"),
      "o bloco presente ofereceu caixa — a porta recusa gravar o bloco por cima",
    ).toHaveLength(0);
    expect(bloco("horario").querySelector('[data-salvar="horario"]')).toBeNull();
    // o bloco continua respondendo a pergunta que é dele
    expect(emCampo("horario").getByText("Sim")).toBeTruthy();
    // e as folhas, agora sim, editam
    for (const folha of ["horario.abre", "horario.fecha"]) {
      expect(bloco(folha).querySelector(`[data-hora="${folha}"]`), `${folha} ficou sem editor`).not.toBeNull();
      expect(bloco(folha).querySelector(`[data-salvar="${folha}"]`)).not.toBeNull();
    }
  });

  it("bloco PRESENTE: o botão do bloco tira o BLOCO INTEIRO, nunca uma folha", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={comHorario} />);
    fireEvent.click(bloco("horario").querySelector('[data-nao-sei="horario"]')!);
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpoDe(fetchFalso)).toEqual({ slug: comHorario.slug, campo: "horario", naoSei: true });
  });

  it("a folha de um bloco nunca oferece 'não sei' — o dela é tirar o bloco", () => {
    render(<FichaInteira ficha={comHorario} />);
    for (const folha of ["horario.abre", "horario.fecha"]) {
      expect(
        bloco(folha).querySelector(`[data-nao-sei="${folha}"]`),
        `${folha} ofereceu "não sei" — a porta recusa, mandando tirar o bloco`,
      ).toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Os guardas do que cresce — registro × instrumento", () => {
  // 🔴 A2 DO BRIEF: são SETE espécies e esta tarefa construiu CINCO. As duas que
  // faltam continuam em LEITURA, e isso tem de estar provado — senão a Task 7
  // herda uma tela que parece quebrada.
  it("espécie sem editor continua em LEITURA: o valor num `<p>`, e nenhum controle", () => {
    render(<FichaInteira ficha={semHorario} />);
    const semEditor = camposDaFicha(semHorario).filter(
      (c) => c.especie === "numero" || c.especie === "coord",
    );
    expect(semEditor.length, "o registro perdeu `numero`/`coord`: o caso ficaria oco").toBeGreaterThan(3);
    for (const c of semEditor) {
      const el = bloco(c.caminho);
      expect(
        el.querySelector(".adm-campo-valor"),
        `${c.caminho} perdeu o \`<p>\` de leitura e ficou sem mostrar nada`,
      ).not.toBeNull();
      expect(el.querySelector("[data-editor]"), `${c.caminho} ganhou editor sem decisão`).toBeNull();
      expect(within(el).queryByRole("button"), `${c.caminho} ganhou botão`).toBeNull();
    }
    // e o valor está DENTRO do `<p>`, não em algum lugar da tela
    expect(bloco("condicao.regra.limiar_mm").querySelector(".adm-campo-valor")!.textContent).toBe(
      String(semHorario.condicao.regra.limiar_mm),
    );
    expect(bloco("condicao.coords").querySelector(".adm-campo-valor")!.textContent).toBe(
      `${semHorario.condicao.coords.lat}, ${semHorario.condicao.coords.lng}`,
    );
  });

  it("toda espécie COM editor tem o editor dentro do bloco do campo, e nenhum `<p>` repetindo", () => {
    render(<FichaInteira ficha={comHorario} />);
    const comEditor = camposDaFicha(comHorario).filter((c) =>
      ["prosa", "lista", "booleano", "hora"].includes(c.especie),
    );
    expect(comEditor.length, "o registro perdeu as quatro espécies: o caso ficaria oco").toBeGreaterThan(15);
    for (const c of comEditor) {
      const el = bloco(c.caminho);
      expect(
        el.querySelector(`[data-editor="${c.caminho}"]`),
        `${c.caminho} ficou sem instrumento`,
      ).not.toBeNull();
      expect(
        el.querySelector(".adm-campo-valor"),
        `${c.caminho}: o valor aparece duas vezes — no \`<p>\` e dentro do controle`,
      ).toBeNull();
    }
  });

  it("toda lista do registro tem multiplicidade declarada, e não há declaração sobrando", () => {
    const listas = CAMPOS_DA_FICHA.filter((c) => c.especie === "lista").map((c) => c.caminho);
    expect(listas.length, "o registro perdeu as listas: o guarda ficaria oco").toBeGreaterThan(3);
    expect(Object.keys(LISTA_MULTIPLA).sort()).toEqual([...listas].sort());
  });

  // 🔴 E O GUARDA QUE IMPORTA: a tabela pode estar COMPLETA e MENTINDO. O
  // oráculo é a porta de escrita de verdade — `aplicarCampo` aceita a forma que
  // a tabela declara e recusa a outra. Inverter uma linha da tabela sai vermelho
  // aqui, e não na mão do dono.
  it("a multiplicidade declarada é a que a PORTA de escrita aceita", () => {
    const doc = JSON.stringify(comHorario);
    for (const c of CAMPOS_DA_FICHA.filter((x) => x.especie === "lista")) {
      const uma = c.opcoes![0];
      const comoPalavra = () => aplicarCampo(doc, c.caminho, uma);
      const comoLista = () => aplicarCampo(doc, c.caminho, [uma]);
      if (LISTA_MULTIPLA[c.caminho]) {
        expect(comoLista, `${c.caminho}: declarado de vários e a porta recusou a lista`).not.toThrow();
        expect(comoPalavra, `${c.caminho}: declarado de vários e a porta aceitou UMA palavra`).toThrow();
      } else {
        expect(comoPalavra, `${c.caminho}: declarado de um e a porta recusou a palavra`).not.toThrow();
        expect(comoLista, `${c.caminho}: declarado de um e a porta aceitou uma lista`).toThrow();
      }
    }
  });

  // 🔴 O GUARDA DO `EditorBloco` E DO `EditorHora`, no lugar de um comentário:
  // o editor de bloco mostra um seletor de HORA por folha, e o editor de hora
  // não oferece "não sei". As duas coisas só são certas enquanto toda folha de
  // bloco for `hora` e obrigatória. Bloco novo com folha de prosa (ou folha de
  // hora opcional) sai vermelho aqui.
  it("toda folha de BLOCO do registro é da espécie `hora` e é obrigatória", () => {
    const blocos = CAMPOS_DA_FICHA.filter((c) => c.especie === "bloco").map((c) => c.caminho);
    expect(blocos.length, "o registro perdeu o bloco: o guarda ficaria oco").toBeGreaterThan(0);
    const folhas = CAMPOS_DA_FICHA.filter((c) => blocos.some((b) => c.caminho.startsWith(`${b}.`)));
    expect(folhas.length, "bloco sem folha nenhuma: o guarda ficaria oco").toBeGreaterThan(1);
    for (const f of folhas) {
      expect(f.especie, `${f.caminho}: o EditorBloco mostraria um seletor de HORA pra ela`).toBe("hora");
      expect(f.obrigatorio, `${f.caminho} é opcional e o EditorHora não oferece "não sei"`).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Os editores servem os três lugares", () => {
  // 🔴 A LINHA VERMELHA. O cerco de `admin-ficha-inteira.test.tsx` lê h2, h3,
  // rótulo e a frase de ausência; os EDITORES trouxeram frases novas (botões,
  // ajuda, opções) e elas têm de entrar no mesmo cerco. Mesmo molde: o
  // vocabulário proibido sai dos radicais dos slugs do acervo, casado por
  // PALAVRA (a fronteira que fez `veu` entrar e "choveu" não disparar).
  it("nenhuma frase fixa de editor nomeia um lugar do acervo", () => {
    const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const CONECTIVOS = ["de", "do", "da", "dos", "das", "e"];
    const proibidas = [...new Set(ACERVO.flatMap((f) => f.slug.split("-")))]
      .map(semAcento)
      .filter((p) => !CONECTIVOS.includes(p));
    expect(proibidas.length, "nenhum radical de slug: o cerco ficaria oco").toBeGreaterThan(2);
    expect(proibidas, "o radical curto do Véu tem de estar no cerco").toContain("veu");

    const fixas: string[] = [];
    for (const f of ACERVO) {
      const { container, unmount } = render(<FichaInteira ficha={f} />);
      for (const sel of [
        "[data-editor] button",
        "[data-editor] label",
        "[data-editor] option",
        ".adm-editor-ajuda",
      ]) {
        for (const e of container.querySelectorAll(sel)) fixas.push(e.textContent ?? "");
      }
      // e os `aria-label`, que são texto de tela pra quem usa leitor
      for (const e of container.querySelectorAll("[data-editor] [aria-label]")) {
        fixas.push(e.getAttribute("aria-label") ?? "");
      }
      unmount();
    }
    expect(fixas.length, "nenhuma frase de editor foi lida: o cerco ficaria oco").toBeGreaterThan(60);

    for (const frase of fixas) {
      const palavras = new Set(
        semAcento(frase)
          .split(/[^a-z0-9]+/)
          .filter((p) => p.length > 0),
      );
      for (const palavra of proibidas) {
        expect(
          palavras.has(palavra),
          `a frase de editor "${frase}" fala de um lugar (${palavra}) num componente que serve os três`,
        ).toBe(false);
      }
    }
  });

  // 🔴 METADE 2, e é a que o cerco não pega: frase de editor que VARIE de lugar
  // pra lugar saiu do dado da ficha em vez da forma do campo.
  //
  // 🔴 A CHAVE LEVA O ESTADO DO CAMPO (cheio × ausente), e a primeira versão
  // deste caso NÃO levava — ele ficou VERMELHO no bloco `horario`, com razão, e
  // por um comportamento CERTO: com o bloco ausente o editor dele mostra as duas
  // horas e um Salvar; com o bloco presente, só o botão que tira. Isso varia com
  // o DADO, que é o que um editor deve fazer, e não com o LUGAR, que é o que ele
  // nunca pode fazer. Sem separar os dois, o caso ou fica vermelho por inocência
  // ou é afrouxado pra deixar passar o defeito de verdade.
  it("o botão, a ajuda e o rótulo de um mesmo campo NO MESMO ESTADO são iguais nas três fichas", () => {
    const porFicha = ACERVO.map((f) => {
      const { container, unmount } = render(<FichaInteira ficha={f} />);
      const mapa = new Map<string, string>();
      for (const e of container.querySelectorAll("[data-editor]")) {
        const caminho = e.getAttribute("data-editor")!;
        const estado = e.closest("[data-ausente]") === null ? "cheio" : "ausente";
        const botoes = [...e.querySelectorAll("button")].map((b) => b.textContent).join("|");
        const rotulos = [...e.querySelectorAll("[aria-label]")]
          .map((x) => x.getAttribute("aria-label"))
          .join("|");
        mapa.set(`${caminho}:${estado}`, `${botoes}//${rotulos}`);
      }
      unmount();
      return mapa;
    });
    expect(porFicha[0].size, "nenhum editor foi lido: o marcador `data-editor` sumiu").toBeGreaterThan(15);
    let comparados = 0;
    for (const outra of porFicha.slice(1)) {
      for (const [chave, texto] of outra) {
        if (!porFicha[0].has(chave)) continue;
        comparados++;
        expect(texto, `o texto do editor de ${chave} muda de lugar pra lugar`).toBe(porFicha[0].get(chave));
      }
    }
    // 🔴 Sem esta linha o laço de cima pode não comparar NADA (duas fichas sem
    // chave em comum) e o caso passa verde medindo zero.
    expect(comparados, "nenhum par foi comparado: o caso ficaria oco").toBeGreaterThan(30);
  });
});
